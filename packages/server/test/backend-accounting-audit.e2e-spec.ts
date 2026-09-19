import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import dayjs from 'dayjs';
import { Bill } from '../src/modules/bill/bill.entity';
import { RentRecord } from '../src/modules/rent/rent-record.entity';
import { Tenant } from '../src/modules/tenant/tenant.entity';
import { UtilityReading } from '../src/modules/utility-reading/utility-reading.entity';
import { feeRuleDueMonths } from '../src/modules/fee/fee-rules';
import { apiCall, createProperty, createRoom, createTenant, createTestApp, currentMonthStr, expectOk, loginAsLandlord } from './helpers/app';

describe('Backend accounting audit regressions', () => {
  let app: INestApplication;
  let db: DataSource;
  const period = currentMonthStr();
  const rentRule = { name: '房租', type: 'fixed', amount: 1000, isRent: true };
  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(DataSource);
    // Exercise populated deletion with foreign keys enabled, even on SQL.js.
    if (db.options.type === 'sqljs') await db.query('PRAGMA foreign_keys = ON');
  });
  afterAll(async () => { await app?.close(); });

  async function setup(overrides: Parameters<typeof createTenant>[3] = {}) {
    const auth = await loginAsLandlord(app);
    const propertyId = await createProperty(app, auth);
    const roomId = await createRoom(app, auth, propertyId, { rent: 1000 });
    const tenantId = await createTenant(app, auth, roomId, { moveInDate: `${period}-01`, ...overrides });
    const bill = await db.getRepository(Bill).findOneByOrFail({ tenantId });
    return { auth, propertyId, roomId, tenantId, bill };
  }

  it('keeps a one-cent balance pending and records its final payment', async () => {
    const { auth, bill } = await setup();
    const partial = expectOk(await apiCall(app, 'put', `/api/bills/${bill.id}/confirm`, auth, { actualAmount: 999.99 }));
    expect(partial.status).toBe(3);
    expect(Number(partial.paidAmount)).toBe(999.99);
    expectOk(await apiCall(app, 'put', `/api/bills/${bill.id}/confirm`, auth, {}));
    const records = await db.getRepository(RentRecord).findBy({ billId: bill.id, type: 1 });
    expect(records.map(r => Number(r.amount)).sort((a, b) => a - b)).toEqual([0.01, 999.99]);
  });

  it.each([1000.01, 0.001])('rejects payment %s without changing the bill or ledger', async amount => {
    const { auth, bill } = await setup();
    expect((await apiCall(app, 'put', `/api/bills/${bill.id}/confirm`, auth, { actualAmount: amount })).status).toBe(400);
    expect(Number((await db.getRepository(Bill).findOneByOrFail({ id: bill.id })).paidAmount)).toBe(0);
    expect(await db.getRepository(RentRecord).countBy({ billId: bill.id })).toBe(0);
  });

  it('honors an explicitly zero initial receipt instead of marking the first bill paid', async () => {
    const { bill } = await setup({ initialPaymentMethod: 'cash', initialPaymentAmount: 0 });
    expect(bill.status).toBe(0);
    expect(Number(bill.paidAmount)).toBe(0);
    expect(await db.getRepository(RentRecord).countBy({ billId: bill.id })).toBe(0);
  });

  it.each([-1, 0.001])('rejects invalid send item amount %s atomically', async amount => {
    const { auth, bill } = await setup();
    expect((await apiCall(app, 'put', `/api/bills/${bill.id}/send`, auth, { items: [{ feeName: '房租', amount }] })).status).toBe(400);
    const stored = await db.getRepository(Bill).findOneOrFail({ where: { id: bill.id }, relations: ['items'] });
    expect(Number(stored.totalAmount)).toBe(1000);
    expect(stored.items).toHaveLength(1);
  });

  it('preserves a fixed water charge while synchronizing metered electricity', async () => {
    const { auth, roomId, bill } = await setup({ feeItems: [rentRule,
      { name: '水费', type: 'fixed', amount: 30 }, { name: '电费', type: 'manual', amount: 0 },
    ] });
    expectOk(await apiCall(app, 'put', `/api/rooms/${roomId}/utility-readings`, auth, {
      period, readings: [{ utilityType: 1, mode: 'manual', amount: 50 }],
    }));
    const stored = await db.getRepository(Bill).findOneOrFail({ where: { id: bill.id }, relations: ['items'] });
    expect(Number(stored.totalAmount)).toBe(1080);
    expect(stored.items.find(i => i.feeName === '水费')).toBeDefined();
  });

  it('protects legacy overdue bills with recorded partial payments from meter edits', async () => {
    const { auth, roomId, bill } = await setup({ feeItems: [rentRule, { name: '水费', type: 'manual', amount: 0 }] });
    expectOk(await apiCall(app, 'put', `/api/bills/${bill.id}/confirm`, auth, { actualAmount: 100 }));
    await db.getRepository(Bill).update(bill.id, { status: 2 });
    expect((await apiCall(app, 'put', `/api/rooms/${roomId}/utility-readings`, auth, {
      period, readings: [{ utilityType: 0, mode: 'manual', amount: 25 }],
    })).status).toBe(400);
    expect(await db.getRepository(UtilityReading).countBy({ roomId })).toBe(0);
  });

  it('room checkout records a refund once and agrees with cash statistics', async () => {
    const { auth, roomId, tenantId, bill } = await setup();
    expectOk(await apiCall(app, 'put', `/api/bills/${bill.id}/confirm`, auth, { actualAmount: 400 }));
    expectOk(await apiCall(app, 'put', `/api/rooms/${roomId}`, auth, { action: 'checkout', prepaidRefundAmount: 150,
      debtAction: 'waive', debtReason: '测试明确减免' }));
    expect((await db.getRepository(Tenant).findOneByOrFail({ id: tenantId })).status).toBe(0);
    expect((await db.getRepository(Bill).findOneByOrFail({ id: bill.id })).status).toBe(4);
    expectOk(await apiCall(app, 'put', `/api/rooms/${roomId}`, auth, { action: 'checkout', prepaidRefundAmount: 150 }));
    const refunds = await db.getRepository(RentRecord).findBy({ roomId, type: 6 });
    expect(refunds).toHaveLength(1);
    expect(Number(refunds[0].amount)).toBe(-150);
    expect(expectOk(await apiCall(app, 'get', `/api/stats/rent?period=${period}`, auth)).totalCollected).toBe(250);
  });

  it('does not allow direct vacancy status to hide an active tenant', async () => {
    const { auth, roomId } = await setup();
    expect((await apiCall(app, 'put', `/api/rooms/${roomId}`, auth, { status: 0 })).status).toBe(400);
  });

  it.each(['room', 'property'])('blocks deletion of a historical %s and preserves all history', async target => {
    const { auth, roomId, propertyId, tenantId, bill } = await setup({ feeItems: [rentRule, { name: '水费', type: 'manual', amount: 0 }] });
    const other = await setup();
    expectOk(await apiCall(app, 'put', `/api/rooms/${roomId}/utility-readings`, auth, {
      period, readings: [{ utilityType: 0, mode: 'manual', amount: 25 }],
    }));
    expectOk(await apiCall(app, 'put', `/api/bills/${bill.id}/confirm`, auth, { actualAmount: 400 }));
    expectOk(await apiCall(app, 'delete', `/api/tenants/${tenantId}`, auth, { prepaidRefundAmount: 0 }));
    const path = target === 'room' ? `/api/rooms/${roomId}` : `/api/properties/${propertyId}`;
    expect((await apiCall(app, 'delete', path, other.auth)).status).toBe(403);
    expect((await apiCall(app, 'delete', path, auth)).status).toBe(400);
    expect(await db.getRepository(UtilityReading).countBy({ roomId })).toBe(1);
    expect(await db.getRepository(RentRecord).countBy({ roomId })).toBeGreaterThan(0);
    expect(await db.getRepository(Bill).countBy({ id: other.bill.id })).toBe(1);
  });

  it('home reminders retain previous debt even when the current bill is paid', async () => {
    const previous = dayjs(`${period}-01`).subtract(1, 'month').format('YYYY-MM');
    const { auth, roomId } = await setup({ moveInDate: `${previous}-01` });
    const current = expectOk(await apiCall(app, 'post', `/api/rooms/${roomId}/bills`, auth, {
      period, items: [{ feeName: '房租', amount: 1000 }],
    }));
    expectOk(await apiCall(app, 'put', `/api/bills/${current.id}/confirm`, auth, {}));
    expect(expectOk(await apiCall(app, 'get', '/api/stats/home', auth)).pendingHouseholds).toBe(1);
  });

  it('home reminders honor the issued due date after rentDay changes', async () => {
    const { auth, tenantId, bill } = await setup();
    const dueDate = dayjs().add(1, 'day').format('YYYY-MM-DD');
    await db.getRepository(Bill).update(bill.id, { dueDate });
    expect((await db.getRepository(Bill).findOneByOrFail({ id: bill.id })).dueDate).toBe(dueDate);
    expectOk(await apiCall(app, 'put', `/api/tenants/${tenantId}`, auth, { rentDay: 1 }));
    expect(expectOk(await apiCall(app, 'get', `/api/bills/${bill.id}`, auth)).dueDate).toBe(dueDate);
    const home = expectOk(await apiCall(app, 'get', '/api/stats/home', auth));
    expect(home.pendingDesc).toContain('还有1天');
    expect(home.pendingDesc).not.toContain('已逾期');
  });

  it('uses a generated bill even after the collection schedule changes', async () => {
    const { auth, roomId, tenantId, bill } = await setup();
    expectOk(await apiCall(app, 'put', `/api/tenants/${tenantId}`, auth, {
      moveInDate: dayjs(`${period}-01`).subtract(1, 'month').format('YYYY-MM-DD'), payMonths: 3,
    }));
    // A stored zero total must also not fall back to a fresh rule estimate.
    await db.getRepository(Bill).update(bill.id, { dueDate: `${period}-01` });
    const groups = expectOk(await apiCall(app, 'get', '/api/rent/pending', auth));
    const due = [...groups.today, ...groups.overdue];
    expect(due.some((r: any) => r.roomId === roomId)).toBe(true);
  });

  it('does not replace a zero-valued bill with estimated rent', async () => {
    const { auth, bill, roomId } = await setup();
    expectOk(await apiCall(app, 'put', `/api/bills/${bill.id}/send`, auth, { items: [{ feeName: '房租减免', amount: 0 }] }));
    const groups = expectOk(await apiCall(app, 'get', '/api/rent/pending', auth));
    const entry = Object.values(groups).flat().find((r: any) => r.roomId === roomId) as any;
    expect(entry.totalAmount).toBe(0);
  });

  it('property overdue counts use due dates rather than coverage end months', async () => {
    const { auth, propertyId, bill } = await setup();
    await db.getRepository(Bill).update(bill.id, { dueDate: dayjs().add(1, 'day').format('YYYY-MM-DD') });
    expect(expectOk(await apiCall(app, 'get', `/api/properties/${propertyId}`, auth)).overdueCount).toBe(0);
    await db.getRepository(Bill).update(bill.id, {
      dueDate: dayjs().subtract(1, 'day').format('YYYY-MM-DD'),
      periodEnd: dayjs(`${period}-01`).add(2, 'month').format('YYYY-MM'),
    });
    expect(expectOk(await apiCall(app, 'get', `/api/properties/${propertyId}`, auth)).overdueCount).toBe(1);
  });

  it.each([1000, 5000, 6000])('refunds only unearned receipts on a 6000 rent bill with %s paid', async paid => {
    const { auth, tenantId, bill } = await setup({ moveInDate: '2026-04-01', payMonths: 3,
      feeItems: [{ ...rentRule, amount: 2000 }], initialPaymentAmount: paid,
    });
    expect(Number(bill.totalAmount)).toBe(6000);
    const tenant = expectOk(await apiCall(app, 'delete', `/api/tenants/${tenantId}`, auth, { moveOutDate: '2026-06-01' }));
    expect(Number(tenant.prepaidRefundAmount)).toBe(Math.max(0, paid - 4000));
  });

  it('includes older refundable rent cycles and custom rent names, but not utility-only bills', async () => {
    const { auth, tenantId, roomId, bill } = await setup({ moveInDate: '2026-04-15', payMonths: 3,
      feeItems: [{ ...rentRule, name: '租金', amount: 2000 }], initialPaymentAmount: 6000,
    });
    const utilities = expectOk(await apiCall(app, 'post', `/api/rooms/${roomId}/bills`, auth, {
      period: '2026-05', items: [{ feeName: '电费', amount: 100 }],
    }));
    expectOk(await apiCall(app, 'put', `/api/bills/${utilities.id}/confirm`, auth, {}));
    const tenant = expectOk(await apiCall(app, 'delete', `/api/tenants/${tenantId}`, auth, { moveOutDate: '2026-06-01' }));
    // 14 unused days before move-in + 30 unused days in June, at 2000 / 30.
    expect(Number(tenant.prepaidRefundAmount)).toBe(2933.33);
    expect(Number(bill.paidAmount)).toBe(6000);
  });

  it('changing payMonths updates rent collection without shortening initial billed coverage', async () => {
    const { auth, tenantId, bill } = await setup({ moveInDate: '2026-04-01', payMonths: 3,
      feeItems: [{ ...rentRule, billingMonths: 3, initialMonths: 3 }],
    });
    expectOk(await apiCall(app, 'put', `/api/tenants/${tenantId}`, auth, { payMonths: 1 }));
    const tenant = await db.getRepository(Tenant).findOneByOrFail({ id: tenantId });
    const rule = tenant.feeRules!.find(r => r.isRent)!;
    expect(rule.billingMonths).toBe(1);
    expect(rule.initialMonths).toBe(3);
    expect(feeRuleDueMonths(rule, tenant.payMonths, tenant.moveInDate, '2026-05')).toBe(0);
    expect(feeRuleDueMonths(rule, tenant.payMonths, tenant.moveInDate, '2026-07')).toBe(0);
    expect(feeRuleDueMonths(rule, tenant.payMonths, tenant.moveInDate, '2026-08')).toBe(0);
    expect(feeRuleDueMonths(rule, tenant.payMonths, tenant.moveInDate, period)).toBe(1);
    const unchanged = await db.getRepository(Bill).findOneByOrFail({ id: bill.id });
    expect(unchanged.periodEnd).toBe('2026-06');
    expect(Number(unchanged.totalAmount)).toBe(3000);
  });

  it('disabled monthly fees do not create a reminder during a prepaid rent month', async () => {
    const previous = dayjs(`${period}-01`).subtract(1, 'month').format('YYYY-MM');
    const { auth, roomId } = await setup({ moveInDate: `${previous}-01`, payMonths: 3,
      initialPaymentAmount: 3000,
      feeItems: [rentRule, { name: '网费', type: 'fixed', amount: 50, enabled: false, cycleMode: 'monthly' }],
    });
    const groups = expectOk(await apiCall(app, 'get', '/api/rent/pending', auth));
    expect([...groups.today, ...groups.approaching, ...groups.overdue].some(r => r.roomId === roomId)).toBe(false);
    expect(groups.upcoming.find((r: any) => r.roomId === roomId).nextDueMonth).toBe(dayjs(`${period}-01`).add(2, 'month').format('YYYY-MM'));
  });
});

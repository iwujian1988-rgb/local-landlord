import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Bill } from '../src/modules/bill/bill.entity';
import { Tenant } from '../src/modules/tenant/tenant.entity';
import { feeRuleDueMonths } from '../src/modules/fee/fee-rules';
import { SubscriptionService } from '../src/modules/subscription/subscription.service';
import { createTestApp, loginAsLandlord, createProperty, createRoom, createTenant, createBill, apiCall, expectOk } from './helpers/app';

describe('Collection target and edited tenancy billing regression', () => {
  let app: INestApplication;
  let db: DataSource;
  const current = '2026-09';
  const prior = '2026-08';
  beforeAll(async () => {
    app = await createTestApp(); db = app.get(DataSource);
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    jest.setSystemTime(new Date('2026-09-19T12:00:00+08:00'));
  });
  afterAll(async () => { jest.useRealTimers(); await app?.close(); });
  async function setup() {
    const auth = await loginAsLandlord(app);
    const propertyId = await createProperty(app, auth);
    const roomId = await createRoom(app, auth, propertyId);
    const tenantId = await createTenant(app, auth, roomId, { moveInDate: `${prior}-01`, rentDay: 28, payMonths: 1 });
    const first = await db.getRepository(Bill).findOneByOrFail({ tenantId });
    return { auth, roomId, tenantId, first };
  }
  it('overdue collection must target the old unpaid bill, not this month future bill', async () => {
    const { auth, roomId, tenantId, first } = await setup();
    const currentId = await createBill(app, auth, roomId, { tenantId, period: current });
    const buckets = expectOk(await apiCall(app, 'get', '/api/rent/pending', auth));
    expect(buckets.overdue[0].billId).toBe(first.id);
    expect(buckets.overdue[0].daysUntil).toBe(0);
    expect(buckets.overdue[0].overdueDays).toBe(22);
    // Follow the returned action target: settle August, leaving September alone.
    expectOk(await apiCall(app, 'put', `/api/bills/${buckets.overdue[0].billId}/confirm`, auth, {}));
    expect((await db.getRepository(Bill).findOneByOrFail({ id: currentId })).status).toBe(0);
    const after = expectOk(await apiCall(app, 'get', '/api/rent/pending', auth));
    expect(after.overdue).toHaveLength(0);
    expect(after.upcoming[0].billId).toBe(currentId);
  });
  it('editing from monthly to quarterly using the miniapp payload must retain first paid coverage', async () => {
    const { auth, tenantId, first } = await setup();
    expectOk(await apiCall(app, 'put', `/api/bills/${first.id}/confirm`, auth, {}));
    expectOk(await apiCall(app, 'put', `/api/tenants/${tenantId}`, auth, {
      payMonths: 3,
      feeItems: [{ name: '房租', type: 'fixed', amount: 2000, isRent: true, enabled: true,
        cycleMode: 'rent', collectionTiming: 'advance', billingMonths: 3, initialMonths: 3 }],
    }));
    const tenant = await db.getRepository(Tenant).findOneByOrFail({ id: tenantId });
    const rule = tenant.feeRules!.find(item => !!item.isRent)!;
    const monthsDue = feeRuleDueMonths(rule, tenant.payMonths, tenant.moveInDate, current);
    expect(monthsDue).toBe(3);
    expect(rule.initialMonths).toBe(1);
    expect((await db.getRepository(Bill).findOneByOrFail({ id: first.id })).periodEnd).toBe(prior);
    // Reload and save once more: the historical 1-month / new 3-month pair is valid.
    const reloaded = expectOk(await apiCall(app, 'get', `/api/tenants/${tenantId}`, auth));
    expectOk(await apiCall(app, 'put', `/api/tenants/${tenantId}`, auth, { feeItems: reloaded.feeItems }));
    jest.setSystemTime(new Date('2026-09-28T12:00:00+08:00'));
    const subscription = app.get(SubscriptionService);
    const notify = jest.spyOn(subscription as any, 'sendAutoBillNotifications').mockResolvedValue({ sent: 0, failed: 0, skipped: 0 });
    try {
      await subscription.autoGenerateBills();
      const issued = await db.getRepository(Bill).findOneByOrFail({ tenantId, period: current });
      expect(Number(issued.totalAmount)).toBe(6000);
      expect(issued.periodEnd).toBe('2026-11');
      await subscription.autoGenerateBills();
      expect(await db.getRepository(Bill).countBy({ tenantId, period: current })).toBe(1);
    } finally {
      notify.mockRestore();
      jest.setSystemTime(new Date('2026-09-19T12:00:00+08:00'));
    }
  });
  it('the room fee editor also preserves historical coverage, even after a rent label change', async () => {
    const { auth, roomId, tenantId } = await setup();
    const result = expectOk(await apiCall(app, 'post', `/api/rooms/${roomId}/fee-items`, auth, {
      fees: [{ name: '租金', type: 'fixed', amount: 2200, isRent: true, enabled: true,
        cycleMode: 'rent', billingMonths: 3, initialMonths: 3 }],
    }));
    expect(result[0].initialMonths).toBe(1);
    const tenant = await db.getRepository(Tenant).findOneByOrFail({ id: tenantId });
    expect(feeRuleDueMonths(tenant.feeRules![0], tenant.payMonths, tenant.moveInDate, current)).toBe(3);
  });
  it('changing from quarterly to monthly does not shorten the paid first quarter', async () => {
    const auth = await loginAsLandlord(app);
    const propertyId = await createProperty(app, auth);
    const roomId = await createRoom(app, auth, propertyId);
    const tenantId = await createTenant(app, auth, roomId, { moveInDate: `${prior}-01`, payMonths: 3 });
    const bill = await db.getRepository(Bill).findOneByOrFail({ tenantId });
    expectOk(await apiCall(app, 'put', `/api/bills/${bill.id}/confirm`, auth, {}));
    expectOk(await apiCall(app, 'put', `/api/tenants/${tenantId}`, auth, {
      payMonths: 1, feeItems: [{ name: '房租', type: 'fixed', amount: 2000, isRent: true,
        billingMonths: 1, initialMonths: 1 }],
    }));
    const tenant = await db.getRepository(Tenant).findOneByOrFail({ id: tenantId });
    const rule = tenant.feeRules![0];
    expect(rule.initialMonths).toBe(3);
    expect(feeRuleDueMonths(rule, 1, tenant.moveInDate, '2026-09')).toBe(0);
    expect(feeRuleDueMonths(rule, 1, tenant.moveInDate, '2026-10')).toBe(0);
    expect(feeRuleDueMonths(rule, 1, tenant.moveInDate, '2026-11')).toBe(1);
    expect((await db.getRepository(Bill).findOneByOrFail({ id: bill.id })).periodEnd).toBe('2026-10');
  });
});

import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createTestApp, loginAsLandlord, loginAsAdmin, apiCall, expectOk, createProperty, createRoom, createTenant, createBill } from './helpers/app';
import { Bill } from '../src/modules/bill/bill.entity';
import { RentRecord } from '../src/modules/rent/rent-record.entity';
import { Landlord } from '../src/modules/landlord/landlord.entity';
import { SubscriptionService } from '../src/modules/subscription/subscription.service';
import { ShareService } from '../src/modules/share/share.service';

describe('Domain daily-business regressions', () => {
  let app: INestApplication;
  let db: DataSource;
  let admin: () => { Authorization: string };

  beforeAll(async () => {
    app = await createTestApp();
    db = app.get(DataSource);
    admin = await loginAsAdmin(app);
  });
  afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });
  afterAll(async () => { await app?.close(); });

  async function setup(period = '2031-01', rentDay = 15) {
    const auth = await loginAsLandlord(app);
    const landlord = expectOk(await apiCall(app, 'get', '/api/auth/me', auth));
    const propertyId = await createProperty(app, auth);
    const roomId = await createRoom(app, auth, propertyId);
    const tenantId = await createTenant(app, auth, roomId, { rentDay });
    const billId = await createBill(app, auth, roomId, { period, tenantId });
    return { auth, landlordId: landlord.id, roomId, tenantId, billId };
  }

  it.each(['single', 'batch'])('%s admin confirmation collects only the balance and dates the cash correctly', async mode => {
    const { auth, billId } = await setup();
    expectOk(await apiCall(app, 'put', `/api/bills/${billId}/confirm`, auth, { actualAmount: 750 }));
    const paidAt = '2031-02-05T12:00:00.000Z';
    const result = mode === 'single'
      ? await apiCall(app, 'put', `/api/admin/bills/${billId}/confirm`, admin, { paidAt })
      : await apiCall(app, 'post', '/api/admin/bills/batch-confirm', admin, { ids: [billId, billId], paidAt });
    expectOk(result);
    const records = await db.getRepository(RentRecord).find({ where: { billId, type: 1 }, order: { id: 'ASC' } });
    expect(records.map(r => Number(r.amount))).toEqual([750, 1250]);
    expect(records[1].paymentAt?.toISOString()).toBe(paidAt);
    const bill = await db.getRepository(Bill).findOneByOrFail({ id: billId });
    expect(bill.status).toBe(1);
    expect(Number(bill.paidAmount)).toBe(2000);
    const { token } = await app.get(ShareService).generateForBill(billId);
    expect(await app.get(ShareService).resolveBill(token)).toMatchObject({ isPaid: true, outstandingAmount: 0, paidAmount: 2000 });
  });

  it('single admin confirmation refuses a cancelled move-out bill', async () => {
    const { billId } = await setup();
    await db.getRepository(Bill).update(billId, { status: 4 });
    expect((await apiCall(app, 'put', `/api/admin/bills/${billId}/confirm`, admin, {})).status).toBe(400);
    expect((await db.getRepository(Bill).findOneByOrFail({ id: billId })).status).toBe(4);
    expect(await db.getRepository(RentRecord).countBy({ billId, type: 1 })).toBe(0);
  });

  it('batch confirmation skips paid/cancelled bills and duplicate IDs', async () => {
    const a = await setup(); const b = await setup();
    await db.getRepository(Bill).update(b.billId, { status: 4 });
    const result = expectOk(await apiCall(app, 'post', '/api/admin/bills/batch-confirm', admin, { ids: [a.billId, b.billId, a.billId] }));
    expect(result.count).toBe(1);
    expect((await db.getRepository(Bill).findOneByOrFail({ id: b.billId })).status).toBe(4);
    expect(await db.getRepository(RentRecord).countBy({ billId: b.billId, type: 1 })).toBe(0);
  });

  it('cancelled bills do not appear as successfully reminded; partial reminders show the balance', async () => {
    const a = await setup(); const b = await setup();
    await db.getRepository(Bill).update(a.billId, { status: 4 });
    expectOk(await apiCall(app, 'put', `/api/bills/${b.billId}/confirm`, b.auth, { actualAmount: 750 }));
    const result = expectOk(await apiCall(app, 'post', '/api/admin/bills/batch-remind', admin, { ids: [a.billId, b.billId] }));
    expect(result.results[0].reminded).toBe(false);
    expect(result.results[1]).toMatchObject({ reminded: true, amount: 1250 });
    expect(await db.getRepository(RentRecord).countBy({ billId: a.billId, type: 3 })).toBe(0);
  });

  it('contracts uploaded from either app appear in both contract lists, receipts remain separate', async () => {
    const { auth, roomId } = await setup();
    const mobile = expectOk(await apiCall(app, 'post', `/api/rooms/${roomId}/documents`, auth, { type: 0, name: 'Mobile lease', imageUrl: '/uploads/mobile.png' }));
    const receipt = expectOk(await apiCall(app, 'post', `/api/rooms/${roomId}/documents`, auth, { type: 1, name: 'Receipt', imageUrl: '/uploads/receipt.png' }));
    const desktop = expectOk(await apiCall(app, 'post', '/api/admin/contracts/upload', admin, { roomId, name: 'Admin lease', imageUrl: '/uploads/admin.png' }));
    const contracts = expectOk(await apiCall(app, 'get', `/api/admin/contracts?roomId=${roomId}`, admin));
    expect(contracts.list.map((d: any) => d.id).sort()).toEqual([mobile.id, desktop.id].sort());
    expect(contracts.list.map((d: any) => d.id)).not.toContain(receipt.id);
    const documents = expectOk(await apiCall(app, 'get', `/api/rooms/${roomId}/documents?type=0`, auth));
    expect(documents.map((d: any) => d.id).sort()).toEqual([mobile.id, desktop.id].sort());
  });

  it.each([
    { period: '2026-09', dueDate: '2026-09-28', rentDay: 10, status: 0, paidAmount: 0, expected: '2000' },
    { period: '2026-09', dueDate: '2026-09-28', rentDay: 28, status: 3, paidAmount: 750, expected: '1250' },
    { period: '2026-10', dueDate: '2026-10-01', rentDay: 1, status: 0, paidAmount: 0, expected: '2000' },
  ])('rent reminder uses bill date and balance: %j', async scenario => {
    const { billId, roomId } = await setup(scenario.period, scenario.rentDay);
    await db.getRepository(Bill).update(billId, { dueDate: scenario.dueDate, status: scenario.status, paidAmount: scenario.paidAmount });
    const service = app.get(SubscriptionService);
    const send = jest.spyOn(service as any, 'sendSubscribeMessage').mockResolvedValue(true);
    jest.useFakeTimers({ now: new Date('2026-09-28T04:00:00Z'), doNotFake: ['nextTick', 'setImmediate'] });
    await service.sendRentReminders();
    const call = send.mock.calls.find(c => c[3] === `pages/bill/index?roomId=${roomId}&billId=${billId}`);
    expect(call).toBeDefined();
    expect((call?.[2] as any)?.amount6.value).toBe(scenario.expected);
  });

  it('reminders stop after landlord account is disabled', async () => {
    const { landlordId, billId, roomId } = await setup('2026-09', 28);
    await db.getRepository(Bill).update(billId, { dueDate: '2026-09-28' });
    await db.getRepository(Landlord).update(landlordId, { status: 0 });
    const service = app.get(SubscriptionService);
    const send = jest.spyOn(service as any, 'sendSubscribeMessage').mockResolvedValue(true);
    jest.useFakeTimers({ now: new Date('2026-09-28T04:00:00Z'), doNotFake: ['nextTick', 'setImmediate'] });
    await service.sendRentReminders();
    expect(send.mock.calls.find(c => c[3] === `pages/bill/index?roomId=${roomId}&billId=${billId}`)).toBeUndefined();
    const landlord = await db.getRepository(Landlord).findOneByOrFail({ id: landlordId });
    await (service as any).sendAutoBillNotifications(new Map([[landlordId, { count: 1, total: 2000 }]]));
    jest.setSystemTime(new Date('2026-09-30T04:00:00Z'));
    await service.sendMonthlySummary();
    expect(send.mock.calls.some(c => c[0] === landlord.openId)).toBe(false);
  });

  it('a fully covered legacy bill does not trigger a zero-amount overdue reminder', async () => {
    const { billId } = await setup('2026-09');
    await db.getRepository(Bill).update(billId, { dueDate: '2026-09-27', paidAmount: 2000, status: 3 });
    jest.useFakeTimers({ now: new Date('2026-09-28T04:00:00Z'), doNotFake: ['nextTick', 'setImmediate'] });
    const result = await app.get(SubscriptionService).sendOverdueReminders(true);
    expect(result.dryRunCandidates?.some(c => c.billId === billId)).toBe(false);
  });
});

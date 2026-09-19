import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Bill } from '../src/modules/bill/bill.entity';
import { RentRecord } from '../src/modules/rent/rent-record.entity';
import { Room } from '../src/modules/room/room.entity';
import { SubscriptionService } from '../src/modules/subscription/subscription.service';
import { apiCall, createProperty, createRoom, createTenant, createTestApp, expectOk, loginAsLandlord } from './helpers/app';

describe('Product safety regressions', () => {
  let app: INestApplication;
  let db: DataSource;
  beforeAll(async () => { app = await createTestApp(); db = app.get(DataSource); });
  afterAll(async () => app?.close());

  async function setup(moveInDate = '2026-09-01', rentDay = 10) {
    const auth = await loginAsLandlord(app);
    const propertyId = await createProperty(app, auth);
    const roomId = await createRoom(app, auth, propertyId);
    const tenantId = await createTenant(app, auth, roomId, { moveInDate, rentDay, payMonths: 1 });
    const bill = await db.getRepository(Bill).findOneByOrFail({ tenantId });
    return { auth, propertyId, roomId, tenantId, bill };
  }

  it('keeps move-out debt visible and separate from the next tenant', async () => {
    const { auth, roomId, tenantId, bill } = await setup();
    expectOk(await apiCall(app, 'delete', `/api/tenants/${tenantId}`, auth, { debtAction: 'keep' }));
    expect((await db.getRepository(Bill).findOneByOrFail({ id: bill.id })).status).toBe(0);
    const debts = expectOk(await apiCall(app, 'get', '/api/rent/departed-debts', auth));
    expect(debts).toEqual(expect.arrayContaining([expect.objectContaining({ billId: bill.id, tenantName: expect.any(String) })]));
    const nextTenantId = await createTenant(app, auth, roomId, { moveInDate: '2026-10-01' });
    expect(nextTenantId).not.toBe(tenantId);
    expect((await db.getRepository(Bill).findOneByOrFail({ id: bill.id })).tenantId).toBe(tenantId);
  });

  it('waives debt only with an explicit reason and writes an audit record', async () => {
    const { auth, tenantId, bill } = await setup();
    const rejected = await apiCall(app, 'delete', `/api/tenants/${tenantId}`, auth, { debtAction: 'waive' });
    expect(rejected.status).toBe(400);
    expectOk(await apiCall(app, 'delete', `/api/tenants/${tenantId}`, auth,
      { debtAction: 'waive', debtReason: '双方协商免除尾款' }));
    expect((await db.getRepository(Bill).findOneByOrFail({ id: bill.id })).status).toBe(4);
    expect(await db.getRepository(RentRecord).countBy({ billId: null as any, type: 8 })).toBeGreaterThan(0);
  });

  it('corrects cumulative receipts through append-only ledger entries', async () => {
    const { auth, bill } = await setup();
    expectOk(await apiCall(app, 'put', `/api/bills/${bill.id}/confirm`, auth, { actualAmount: 800 }));
    expectOk(await apiCall(app, 'put', `/api/bills/${bill.id}/correct-payment`, auth,
      { paidAmount: 500, expectedPaidAmount: 800, reason: '录入金额写错' }));
    const saved = await db.getRepository(Bill).findOneByOrFail({ id: bill.id });
    expect(Number(saved.paidAmount)).toBe(500);
    expect(saved.status).toBe(3);
    const records = await db.getRepository(RentRecord).findBy({ billId: bill.id, type: 1 });
    expect(records.reduce((sum, row) => sum + Number(row.amount), 0)).toBe(500);
    const stale = await apiCall(app, 'put', `/api/bills/${bill.id}/correct-payment`, auth,
      { paidAmount: 300, expectedPaidAmount: 800, reason: '重复提交' });
    expect(stale.status).toBe(400);
  });

  it('archives rooms without deleting history and supports restore', async () => {
    const { auth, roomId, tenantId, bill } = await setup();
    expectOk(await apiCall(app, 'delete', `/api/tenants/${tenantId}`, auth, { debtAction: 'keep' }));
    expectOk(await apiCall(app, 'put', `/api/rooms/${roomId}`, auth, { action: 'archive' }));
    expect((await db.getRepository(Room).findOneByOrFail({ id: roomId })).status).toBe(2);
    expect((expectOk(await apiCall(app, 'get', '/api/rooms', auth)) as any[]).some(r => r.id === roomId)).toBe(false);
    expect((expectOk(await apiCall(app, 'get', '/api/rooms?includeArchived=true', auth)) as any[]).some(r => r.id === roomId)).toBe(true);
    expect((await db.getRepository(Bill).findOneByOrFail({ id: bill.id })).id).toBe(bill.id);
    expect((await apiCall(app, 'delete', `/api/rooms/${roomId}`, auth)).status).toBe(400);
    expectOk(await apiCall(app, 'put', `/api/rooms/${roomId}`, auth, { action: 'restore' }));
  });

  it('creates a next-month bill when its advance-reminder day arrives', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    jest.setSystemTime(new Date('2026-10-29T08:00:00+08:00'));
    try {
      const { tenantId } = await setup('2026-09-01', 1);
      const service = app.get(SubscriptionService);
      jest.spyOn(service as any, 'configuredRemindDays').mockResolvedValue(3);
      jest.spyOn(service as any, 'sendAutoBillNotifications').mockResolvedValue({ sent: 0, failed: 0, skipped: 0 });
      await service.autoGenerateBills();
      expect(await db.getRepository(Bill).findOneBy({ tenantId, period: '2026-11' })).not.toBeNull();
    } finally { jest.useRealTimers(); }
  });

  it('previews revised fees and rejects a stale preview token', async () => {
    const { auth, tenantId } = await setup();
    const payload = { payMonths: 3, feeItems: [{ name: '房租', type: 'fixed', amount: 2200,
      enabled: true, isRent: true, cycleMode: 'rent', collectionTiming: 'advance', billingMonths: 3, initialMonths: 3 }] };
    const preview = expectOk(await apiCall(app, 'post', `/api/tenants/${tenantId}/fee-preview`, auth, payload));
    expect(preview.rows[0]).toEqual(expect.objectContaining({ name: '房租', period: expect.stringMatching(/^\d{4}-\d{2}$/) }));
    const stale = await apiCall(app, 'put', `/api/tenants/${tenantId}`, auth, { ...payload, feePreviewToken: 'stale' });
    expect(stale.status).toBe(400);
    expectOk(await apiCall(app, 'put', `/api/tenants/${tenantId}`, auth, { ...payload, feePreviewToken: preview.token }));
  });
});

import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import dayjs from 'dayjs';
import { Bill } from '../src/modules/bill/bill.entity';
import { RentRecord } from '../src/modules/rent/rent-record.entity';
import { Tenant } from '../src/modules/tenant/tenant.entity';
import { TenantService } from '../src/modules/tenant/tenant.service';
import { apiCall, createProperty, createRoom, createTenant, createTestApp, expectOk, loginAsLandlord } from './helpers/app';

describe('Room everyday business review', () => {
  let app: INestApplication;
  let db: DataSource;
  beforeAll(async () => { app = await createTestApp(); db = app.get(DataSource); });
  afterAll(async () => { if (app) await app.close(); });
  afterEach(() => jest.useRealTimers());

  async function fixture(moveInDate = '2026-09-01', payMonths = 1, rentDay = 28) {
    const auth = await loginAsLandlord(app);
    const propertyId = await createProperty(app, auth);
    const roomId = await createRoom(app, auth, propertyId, { rent: 3000 });
    const tenantId = await createTenant(app, auth, roomId, { moveInDate, payMonths, rentDay });
    const bill = await db.getRepository(Bill).findOneByOrFail({ tenantId });
    return { auth, propertyId, roomId, tenantId, bill };
  }

  it('room checkout records the refund in collected cash just like tenant checkout', async () => {
    const { auth, roomId, bill } = await fixture();
    expectOk(await apiCall(app, 'put', `/api/bills/${bill.id}/confirm`, auth, {}));
    expectOk(await apiCall(app, 'put', `/api/rooms/${roomId}`, auth, { action: 'checkout', prepaidRefundAmount: 400 }));
    const records = await db.getRepository(RentRecord).findBy({ roomId, type: 6 });
    expect(records).toHaveLength(1);
    expect(Number(records[0].amount)).toBe(-400);
    expectOk(await apiCall(app, 'put', `/api/rooms/${roomId}`, auth, { action: 'checkout', prepaidRefundAmount: 400 }));
    expect(await db.getRepository(RentRecord).countBy({ roomId, type: 6 })).toBe(1);
  });

  it('checkout preview uses the paid historical rent even after the room price changes', async () => {
    jest.useFakeTimers({ now: new Date('2026-09-19T12:00:00+08:00'), doNotFake: ['nextTick', 'setImmediate'] });
    const { auth, roomId, tenantId, bill } = await fixture('2026-09-01', 3);
    expectOk(await apiCall(app, 'put', `/api/bills/${bill.id}/confirm`, auth, {}));
    expectOk(await apiCall(app, 'put', `/api/rooms/${roomId}`, auth, { rent: 6000 }));
    const detail = expectOk(await apiCall(app, 'get', `/api/rooms/${roomId}`, auth));
    const tenant = await db.getRepository(Tenant).findOneByOrFail({ id: tenantId });
    const expected = await app.get(TenantService).computePrepaidRefund({ ...tenant, moveOutDate: dayjs().format('YYYY-MM-DD') });
    expect(detail.moveOutPreview.prepaidRefund).toBe(expected);
    expect(detail.moveOutPreview.prepaidRefund).toBeLessThanOrEqual(9000);
  });

  it('last month unpaid rent stays overdue in all room views before this month rent day', async () => {
    jest.useFakeTimers({ now: new Date('2026-09-19T12:00:00+08:00'), doNotFake: ['nextTick', 'setImmediate'] });
    const { auth, roomId, propertyId } = await fixture('2026-08-01');
    const all = expectOk(await apiCall(app, 'get', '/api/rooms', auth));
    const property = expectOk(await apiCall(app, 'get', `/api/properties/${propertyId}/rooms`, auth));
    const detail = expectOk(await apiCall(app, 'get', `/api/rooms/${roomId}`, auth));
    expect(all.find((r: any) => r.id === roomId).displayStatus).toBe('overdue');
    expect(property.list.find((r: any) => r.id === roomId).displayStatus).toBe('overdue');
    expect(detail.displayStatus).toBe('overdue');
  });

  it('fully paid prepaid rent does not become approaching again each month', async () => {
    jest.useFakeTimers({ now: new Date('2026-09-27T12:00:00+08:00'), doNotFake: ['nextTick', 'setImmediate'] });
    const { auth, roomId, propertyId, bill } = await fixture('2026-08-01', 3);
    expectOk(await apiCall(app, 'put', `/api/bills/${bill.id}/confirm`, auth, {}));
    const all = expectOk(await apiCall(app, 'get', '/api/rooms', auth));
    const property = expectOk(await apiCall(app, 'get', `/api/properties/${propertyId}/rooms`, auth));
    const detail = expectOk(await apiCall(app, 'get', `/api/rooms/${roomId}`, auth));
    expect(all.find((r: any) => r.id === roomId).displayStatus).toBe('rented');
    expect(property.list.find((r: any) => r.id === roomId).displayStatus).toBe('rented');
    expect(detail.displayStatus).toBe('rented');
  });
});

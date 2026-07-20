import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createTestApp, apiCall, createProperty, createRoom, createTenant, expectOk, loginAsLandlord } from './helpers/app';
import { Property } from '../src/modules/property/property.entity';
import { Room } from '../src/modules/room/room.entity';
import { Tenant } from '../src/modules/tenant/tenant.entity';
import { Bill } from '../src/modules/bill/bill.entity';
import { BillItem } from '../src/modules/bill/bill-item.entity';
import { FeeItem } from '../src/modules/fee/fee-item.entity';
import { Document } from '../src/modules/document/document.entity';
import { PaymentQr } from '../src/modules/payment-qr/payment-qr.entity';

describe('Test data reset (e2e)', () => {
  let app: INestApplication;
  let auth: () => { Authorization: string };
  let dataSource: DataSource;

  beforeAll(async () => {
    app = await createTestApp();
    auth = await loginAsLandlord(app);
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  it('TC-RESET-001: clears only the current account business data and keeps login valid', async () => {
    const propertyId = await createProperty(app, auth);
    const roomId = await createRoom(app, auth, propertyId);
    await createTenant(app, auth, roomId);
    expectOk(await apiCall(app, 'post', `/api/rooms/${roomId}/fee-items`, auth, {
      name: '测试收费项', type: 0, amount: 20, enabled: 1,
    }));
    expectOk(await apiCall(app, 'post', `/api/rooms/${roomId}/documents`, auth, {
      type: 0, name: '测试合同.pdf', imageUrl: '/uploads/test-reset.pdf',
    }));
    expectOk(await apiCall(app, 'post', '/api/payment-qr', auth, {
      label: '测试收款码', imageUrl: '/uploads/test-reset.png', type: 'wechat',
    }));

    const createdBill = await dataSource.getRepository(Bill).findOne({ where: { roomId } });
    expect(createdBill?.id).toBeTruthy();
    const me = expectOk(await apiCall(app, 'get', '/api/auth/me', auth));
    const reset = await apiCall(app, 'delete', '/api/auth/test-data', auth);
    expectOk(reset);

    expect(await dataSource.getRepository(Property).count({ where: { landlordId: me.id } })).toBe(0);
    expect(await dataSource.getRepository(Room).count({ where: { propertyId } })).toBe(0);
    expect(await dataSource.getRepository(Tenant).count({ where: { roomId } })).toBe(0);
    expect(await dataSource.getRepository(Bill).count({ where: { roomId } })).toBe(0);
    expect(await dataSource.getRepository(BillItem).count({ where: { billId: createdBill!.id } })).toBe(0);
    expect(await dataSource.getRepository(FeeItem).count({ where: { roomId } })).toBe(0);
    expect(await dataSource.getRepository(Document).count({ where: { roomId } })).toBe(0);
    expect(await dataSource.getRepository(PaymentQr).count({ where: { landlordId: me.id } })).toBe(0);

    // The token and landlord account are deliberately still usable after reset.
    expectOk(await apiCall(app, 'get', '/api/auth/me', auth));
  });
});

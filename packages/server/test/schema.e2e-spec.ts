import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  createTestApp,
  loginAsLandlord,
  apiCall,
  createProperty,
  createRoom,
  createTenant,
  createBill,
  currentMonthStr,
} from './helpers/app';
import { Landlord } from '../src/modules/landlord/landlord.entity';
import { Property } from '../src/modules/property/property.entity';
import { Room } from '../src/modules/room/room.entity';
import { Tenant } from '../src/modules/tenant/tenant.entity';
import { Bill } from '../src/modules/bill/bill.entity';
import { BillItem } from '../src/modules/bill/bill-item.entity';
import { FeeItem } from '../src/modules/fee/fee-item.entity';
import { Document } from '../src/modules/document/document.entity';
import { PaymentQr } from '../src/modules/payment-qr/payment-qr.entity';
import { RentRecord } from '../src/modules/rent/rent-record.entity';
import { SingleCharge } from '../src/modules/rent/single-charge.entity';
import { Admin } from '../src/modules/system/admin.entity';
import { SystemConfig } from '../src/modules/system/system-config.entity';

/**
 * Schema sanity test — exercises one insert + read for every entity in the
 * codebase. Catches TypeORM entity definition bugs that synchronize=true
 * silently masks when each entity is only tested in isolation.
 *
 * No migration system exists — TypeORM synchronize=true generates the schema
 * from entity metadata in dev/test. This test ensures every entity's column
 * types map cleanly to SQLite without runtime errors.
 */
describe('Schema sanity (e2e)', () => {
  let app: INestApplication;
  let auth: () => { Authorization: string };
  let landlordId: number;
  let propertyId: number;
  let roomId: number;
  let tenantId: number;
  let billId: number;

  beforeAll(async () => {
    app = await createTestApp();
    auth = await loginAsLandlord(app, `dev_schema_${Date.now()}`);

    // Get landlord id via /auth/me
    const me = await apiCall(app, 'get', '/api/auth/me', auth);
    landlordId = me.body?.data?.id;

    propertyId = await createProperty(app, auth);
    roomId = await createRoom(app, auth, propertyId, { rent: 2000, name: 'schema-room' });
    tenantId = await createTenant(app, auth, roomId, {
      name: 'schema',
      phone: '13900099988',
      moveInDate: `${currentMonthStr()}-01`,
    });
    billId = await createBill(app, auth, roomId, {
      period: '2099-06',
      items: [{ feeName: '房租', amount: 1000 }],
      totalAmount: 1000,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // Helper: resolve a repo from the Nest app. Returns Repository<any> to keep
  // entity-shape details out of the test — we just want to verify the schema
  // accepts writes/reads without runtime errors.
  function repo(entity: any): Repository<any> {
    return app.get(getRepositoryToken(entity)) as Repository<any>;
  }

  it('TC-SCHEMA-001: landlord 实体可读写', async () => {
    const r = repo(Landlord);
    const found = await r.findOne({ where: { id: landlordId } });
    expect(found).toBeTruthy();
    expect(found?.id).toBe(landlordId);
  });

  it('TC-SCHEMA-002: property 实体可读写', async () => {
    const r = repo(Property);
    const found = await r.findOne({ where: { id: propertyId } });
    expect(found).toBeTruthy();
    expect(found?.landlordId).toBe(landlordId);
  });

  it('TC-SCHEMA-003: room 实体可读写', async () => {
    const r = repo(Room);
    const found = await r.findOne({ where: { id: roomId } });
    expect(found).toBeTruthy();
    expect(Number(found?.rent)).toBe(2000);
  });

  it('TC-SCHEMA-004: tenant 实体可读写', async () => {
    const r = repo(Tenant);
    const found = await r.findOne({ where: { id: tenantId } });
    expect(found).toBeTruthy();
    expect(found?.status).toBe(1);
  });

  it('TC-SCHEMA-005: bill 实体可读写', async () => {
    const r = repo(Bill);
    const found = await r.findOne({ where: { id: billId } });
    expect(found).toBeTruthy();
    expect(found?.period).toBe('2099-06');
  });

  it('TC-SCHEMA-006: bill_item 实体可读写', async () => {
    const r = repo(BillItem);
    const items = await r.find({ where: { billId } });
    expect(items.length).toBeGreaterThan(0);
    expect(Number(items[0].amount)).toBe(1000);
  });

  it('TC-SCHEMA-007: fee_item 实体可写入并按 sortOrder 排序读出', async () => {
    const r = repo(FeeItem);
    const created = r.create({
      roomId,
      name: '卫生费',
      type: 0,
      amount: 30,
      enabled: 1,
      cycleMode: 'monthly',
      sortOrder: 5,
    } as any);
    await r.save(created);
    const found = await r.findOne({ where: { roomId, name: '卫生费' } });
    expect(found).toBeTruthy();
    expect(found?.sortOrder).toBe(5);
  });

  it('TC-SCHEMA-008: document 实体可写入并读出', async () => {
    const r = repo(Document);
    const created = r.create({
      roomId,
      type: 0,
      name: 'schema-test-doc',
      imageUrl: '/uploads/schema.pdf',
    } as any);
    await r.save(created);
    const found = await r.findOne({ where: { roomId, name: 'schema-test-doc' } });
    expect(found).toBeTruthy();
  });

  it('TC-SCHEMA-009: payment_qr 实体可写入并读出', async () => {
    const r = repo(PaymentQr);
    const created = r.create({
      landlordId,
      imageUrl: '/uploads/qr.png',
      type: 0,
      payeeName: '微信',
      isDefault: 0,
    } as any);
    await r.save(created);
    const found = await r.findOne({ where: { landlordId, payeeName: '微信' } });
    expect(found).toBeTruthy();
  });

  it('TC-SCHEMA-010: rent_record 实体 — confirm 一笔账单后应自动写入', async () => {
    // Confirm the bill to trigger rent_record creation
    await apiCall(app, 'put', `/api/bills/${billId}/confirm`, auth, { actualAmount: 1000 });
    const r = repo(RentRecord);
    const records = await r.find({ where: { roomId, billId } });
    expect(records.length).toBeGreaterThan(0);
  });

  it('TC-SCHEMA-011: single_charge 实体可写入并读出', async () => {
    const r = repo(SingleCharge);
    const created = r.create({
      roomId,
      tenantId,
      feeType: '水费',
      amount: 50,
      status: 0,
    } as any);
    await r.save(created);
    const found = await r.findOne({ where: { roomId, feeType: '水费' } });
    expect(found).toBeTruthy();
  });

  it('TC-SCHEMA-012: admin 实体至少有一条记录（首次启动种子）', async () => {
    const r = repo(Admin);
    const count = await r.count();
    expect(count).toBeGreaterThan(0);
  });

  it('TC-SCHEMA-013: system_config 实体可写入并读出', async () => {
    const r = repo(SystemConfig);
    const key = `test-key-${Date.now()}`;
    const created = r.create({
      key,
      value: JSON.stringify({ foo: 'bar' }),
      category: 'test',
    } as any);
    await r.save(created);
    const found = await r.findOne({ where: { key } });
    expect(found).toBeTruthy();
    expect(found?.value).toContain('bar');
  });

  it('TC-SCHEMA-014: bill 字段类型正确 — paidAmount 默认 0，status 默认 0', async () => {
    const r = repo(Bill);
    const entity = r.create({
      roomId,
      tenantId,
      period: '2099-12',
      periodEnd: '2099-12',
      totalAmount: 500,
    } as any);
    const saved = await r.save(entity);
    const reloaded = await r.findOne({ where: { id: saved.id } });
    expect(Number(reloaded?.paidAmount)).toBe(0);
    expect(reloaded?.status).toBe(0);
    // photos column is nullable — when not set, sqljs persists NULL.
    // The service layer always initializes photos to [] when creating bills
    // (see BillService.create). Repository-level create here just verifies
    // the column doesn't blow up.
    expect(reloaded?.photos == null || Array.isArray(reloaded?.photos)).toBe(true);
  });

  it('TC-SCHEMA-015: photos 字段（JSON 列）能存数组', async () => {
    const r = repo(Bill);
    const entity = r.create({
      roomId,
      tenantId,
      period: '2098-11',
      periodEnd: '2098-11',
      totalAmount: 100,
      photos: ['/uploads/a.png', '/uploads/b.png'],
    } as any);
    const saved = await r.save(entity);
    const reloaded = await r.findOne({ where: { id: saved.id } });
    expect(reloaded?.photos).toEqual(['/uploads/a.png', '/uploads/b.png']);
  });
});

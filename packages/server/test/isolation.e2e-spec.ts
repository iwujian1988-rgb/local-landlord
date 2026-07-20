import { INestApplication } from '@nestjs/common';
import {
  createTestApp,
  loginAsLandlord,
  apiCall,
  expectOk,
  createProperty,
  createRoom,
  createTenant,
  createBill,
  currentMonthStr,
} from './helpers/app';

/**
 * Cross-landlord data isolation. The system is multi-tenant — landlords must
 * never see, edit, or delete each other's data. This suite exercises every
 * endpoint that takes a roomId/tenantId/billId/propertyId in the path and
 * confirms landlord B cannot touch landlord A's resources.
 *
 * A previous incident (2025-Q3) had a tenant leak between accounts because
 * verifyTenantOwnership was missing on a GET. This is the regression net.
 */
describe('Cross-landlord isolation (e2e)', () => {
  let app: INestApplication;
  let authA: () => { Authorization: string };
  let authB: () => { Authorization: string };
  let propA: number;
  let roomA: number;
  let tenantA: number;
  let billA: number;

  beforeAll(async () => {
    app = await createTestApp();
    authA = await loginAsLandlord(app, `dev_iso_A_${Date.now()}`);
    authB = await loginAsLandlord(app, `dev_iso_B_${Date.now()}`);

    propA = await createProperty(app, authA, { name: 'A的房源', address: 'A地址' });
    roomA = await createRoom(app, authA, propA, { rent: 2000, name: 'A的房间' });
    tenantA = await createTenant(app, authA, roomA, {
      name: 'A租客',
      phone: '13900000001',
      moveInDate: `${currentMonthStr()}-01`,
    });
    billA = await createBill(app, authA, roomA, { period: '2099-01' });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('property', () => {
    it('TC-ISO-001: B 不能读 A 的 property', async () => {
      const res = await apiCall(app, 'get', `/api/properties/${propA}`, authB);
      expect(res.body?.code).not.toBe(0);
    });

    it('TC-ISO-002: B 不能改 A 的 property', async () => {
      const res = await apiCall(app, 'put', `/api/properties/${propA}`, authB, {
        name: 'B改了A的',
      });
      expect(res.body?.code).not.toBe(0);
    });

    it('TC-ISO-003: B 不能删 A 的 property', async () => {
      const res = await apiCall(app, 'delete', `/api/properties/${propA}`, authB);
      expect(res.body?.code).not.toBe(0);
    });

    it('TC-ISO-004: A 自己可以读自己的 property', async () => {
      const res = await apiCall(app, 'get', `/api/properties/${propA}`, authA);
      expect(res.body?.code).toBe(0);
    });
  });

  describe('room', () => {
    it('TC-ISO-005: B 不能读 A 的 room', async () => {
      const res = await apiCall(app, 'get', `/api/rooms/${roomA}`, authB);
      expect(res.body?.code).not.toBe(0);
    });

    it('TC-ISO-006: B 不能在 A 的 property 下创建 room', async () => {
      const res = await apiCall(app, 'post', `/api/properties/${propA}/rooms`, authB, {
        name: 'B偷建房间',
        rent: 1000,
      });
      expect(res.body?.code).not.toBe(0);
    });

    it('TC-ISO-007: B 不能改/删 A 的 room', async () => {
      const putRes = await apiCall(app, 'put', `/api/rooms/${roomA}`, authB, { name: 'B改' });
      expect(putRes.body?.code).not.toBe(0);
      const delRes = await apiCall(app, 'delete', `/api/rooms/${roomA}`, authB);
      expect(delRes.body?.code).not.toBe(0);
    });

    it('TC-ISO-008: B 不能给 A 的 room 加账单', async () => {
      const res = await apiCall(app, 'post', `/api/rooms/${roomA}/bills`, authB, {
        period: '2099-02',
        items: [{ feeName: '房租', amount: 1 }],
      });
      expect(res.body?.code).not.toBe(0);
    });
  });

  describe('tenant', () => {
    it('TC-ISO-009: B 不能读 A 的 tenant', async () => {
      const res = await apiCall(app, 'get', `/api/tenants/${tenantA}`, authB);
      expect(res.body?.code).not.toBe(0);
    });

    it('TC-ISO-010: B 不能改 A 的 tenant', async () => {
      const res = await apiCall(app, 'put', `/api/tenants/${tenantA}`, authB, { note: 'B改的' });
      expect(res.body?.code).not.toBe(0);
    });

    it('TC-ISO-011: B 不能退租 A 的 tenant', async () => {
      const res = await apiCall(app, 'delete', `/api/tenants/${tenantA}`, authB, {
        moveOutDate: '2099-12-31',
      });
      expect(res.body?.code).not.toBe(0);
    });
  });

  describe('bill', () => {
    it('TC-ISO-012: B 不能读 A 的 bill', async () => {
      const res = await apiCall(app, 'get', `/api/bills/${billA}`, authB);
      expect(res.body?.code).not.toBe(0);
    });

    it('TC-ISO-013: B 不能确认 A 的账单', async () => {
      const res = await apiCall(app, 'put', `/api/bills/${billA}/confirm`, authB, {
        actualAmount: 100,
      });
      expect(res.body?.code).not.toBe(0);
    });
  });

  describe('rent', () => {
    it('TC-ISO-014: B 不能给 A 的 room 创建单独收款', async () => {
      const res = await apiCall(app, 'post', `/api/rooms/${roomA}/single-charge`, authB, {
        feeType: '水费',
        amount: 50,
      });
      expect(res.body?.code).not.toBe(0);
    });

    it('TC-ISO-015: B 不能给 A 的 room 发催收提醒', async () => {
      const res = await apiCall(app, 'post', `/api/rooms/${roomA}/remind`, authB, {});
      expect(res.body?.code).not.toBe(0);
    });
  });

  describe('A 的列表只看到自己的数据', () => {
    it('TC-ISO-016: A 的 /properties 不包含 B 的房源', async () => {
      await createProperty(app, authB, { name: 'B的房源' });
      const res = await apiCall(app, 'get', '/api/properties', authA);
      const data = expectOk(res);
      const list = data.list || data || [];
      const names = list.map((p: any) => p.name);
      expect(names).toContain('A的房源');
      expect(names).not.toContain('B的房源');
    });

    it('TC-ISO-017: A 的 /rooms 不包含 B 的房间', async () => {
      const res = await apiCall(app, 'get', '/api/rooms', authA);
      const data = expectOk(res);
      const list = data.list || data || [];
      const ids = list.map((r: any) => r.id);
      expect(ids).toContain(roomA);
      // B's room shouldn't appear — verify by creating one for B first
      const propB = await createProperty(app, authB, { name: 'B-prop2' });
      const roomB = await createRoom(app, authB, propB, { name: 'B的房间' });
      const res2 = await apiCall(app, 'get', '/api/rooms', authA);
      const data2 = expectOk(res2);
      const list2 = data2.list || data2 || [];
      const ids2 = list2.map((r: any) => r.id);
      expect(ids2).not.toContain(roomB);
    });
  });
});

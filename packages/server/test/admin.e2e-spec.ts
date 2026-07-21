import { INestApplication } from '@nestjs/common';
import {
  createTestApp,
  loginAsLandlord,
  loginAsAdmin,
  apiCall,
  createProperty,
  createRoom,
  createTenant,
  currentMonthStr,
} from './helpers/app';

/**
 * Admin module — SystemController exposes ~30 admin-only endpoints
 * (CRUD for properties/rooms/tenants/landlords/admins + dashboard + bills
 * + stats + settings + contracts). All require role=0.
 *
 * This suite covers:
 *  - admin-only access (landlord gets 403)
 *  - list endpoints return sane shape
 *  - create/update/delete on a few resources
 *  - dashboard summary doesn't crash on empty data
 */
describe('Admin module (e2e)', () => {
  let app: INestApplication;
  let adminAuth: () => { Authorization: string };
  let landlordAuth: () => { Authorization: string };
  let landlordId: number;

  beforeAll(async () => {
    app = await createTestApp();
    adminAuth = await loginAsAdmin(app);
    landlordAuth = await loginAsLandlord(app, `dev_admin_${Date.now()}`);
    const me = await apiCall(app, 'get', '/api/auth/me', landlordAuth);
    landlordId = me.body?.data?.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('access control', () => {
    it('TC-ADMIN-LOCK-001: 普通房东调 /api/admin/properties → 403', async () => {
      const res = await apiCall(app, 'get', '/api/admin/properties', landlordAuth);
      expect(res.body?.code).not.toBe(0);
    });

    it('TC-ADMIN-LOCK-002: 未登录调 /api/admin/properties → 401', async () => {
      const res = await apiCall(app, 'get', '/api/admin/properties', null);
      expect(res.body?.code).not.toBe(0);
    });

    it('TC-ADMIN-LOCK-003: admin 调 /api/admin/properties → 0', async () => {
      const res = await apiCall(app, 'get', '/api/admin/properties', adminAuth);
      expect(res.body?.code).toBe(0);
    });
  });

  describe('property 管理（admin 视角）', () => {
    let adminPropId: number;

    it('TC-ADMIN-PROP-001: admin 创建 property', async () => {
      const res = await apiCall(app, 'post', '/api/admin/properties', adminAuth, {
        name: `admin房产-${Date.now()}`,
        address: 'admin地址',
        landlordId,
      });
      expect(res.body?.code).toBe(0);
      adminPropId = res.body.data?.id;
      expect(adminPropId).toBeGreaterThan(0);
    });

    it('TC-ADMIN-PROP-002: 列表带分页', async () => {
      const res = await apiCall(app, 'get', '/api/admin/properties?page=1&pageSize=10', adminAuth);
      expect(res.body?.code).toBe(0);
    });

    it('TC-ADMIN-PROP-003: 列表带 keyword 搜索', async () => {
      const res = await apiCall(app, 'get', '/api/admin/properties?keyword=test', adminAuth);
      expect(res.body?.code).toBe(0);
    });
  });

  describe('rooms / tenants / landlords 列表', () => {
    it('TC-ADMIN-LIST-001: /api/admin/rooms', async () => {
      const res = await apiCall(app, 'get', '/api/admin/rooms', adminAuth);
      expect(res.body?.code).toBe(0);
    });

    it('TC-ADMIN-LIST-002: /api/admin/tenants', async () => {
      const res = await apiCall(app, 'get', '/api/admin/tenants', adminAuth);
      expect(res.body?.code).toBe(0);
    });

    it('TC-ADMIN-LIST-003: /api/admin/landlords', async () => {
      const res = await apiCall(app, 'get', '/api/admin/landlords', adminAuth);
      expect(res.body?.code).toBe(0);
    });

    it('TC-ADMIN-LIST-004: /api/admin/admins', async () => {
      const res = await apiCall(app, 'get', '/api/admin/admins', adminAuth);
      expect(res.body?.code).toBe(0);
    });
  });

  describe('dashboard / stats', () => {
    it('TC-ADMIN-DASH-001: /api/admin/dashboard/summary', async () => {
      const res = await apiCall(app, 'get', '/api/admin/dashboard/summary', adminAuth);
      expect(res.body?.code).toBe(0);
    });

    it('TC-ADMIN-DASH-002: /api/admin/stats/rent', async () => {
      const res = await apiCall(app, 'get', '/api/admin/stats/rent', adminAuth);
      expect(res.body?.code).toBe(0);
    });

    it('TC-ADMIN-DASH-003: /api/admin/stats/occupancy', async () => {
      const res = await apiCall(app, 'get', '/api/admin/stats/occupancy', adminAuth);
      expect(res.body?.code).toBe(0);
    });

    it('TC-ADMIN-DASH-004: /api/admin/stats/activity', async () => {
      const res = await apiCall(app, 'get', '/api/admin/stats/activity', adminAuth);
      expect(res.body?.code).toBe(0);
    });
  });

  describe('bills 管理', () => {
    it('TC-ADMIN-BILL-001: /api/admin/bills 列表', async () => {
      const res = await apiCall(app, 'get', '/api/admin/bills', adminAuth);
      expect(res.body?.code).toBe(0);
    });

    it('TC-ADMIN-BILL-002: /api/admin/bills/overdue', async () => {
      const res = await apiCall(app, 'get', '/api/admin/bills/overdue', adminAuth);
      expect(res.body?.code).toBe(0);
    });

    it('TC-ADMIN-BILL-003: batch-remind 空列表应不崩', async () => {
      const res = await apiCall(app, 'post', '/api/admin/bills/batch-remind', adminAuth, {
        billIds: [],
      });
      // Empty array may be rejected by validation (400) — accept any non-5xx.
      expect([0, 400, 1000, 1001, 1002]).toContain(res.body?.code ?? -1);
    });
  });

  describe('settings', () => {
    it('TC-ADMIN-SETTING-001: GET notification settings', async () => {
      const res = await apiCall(app, 'get', '/api/admin/settings/notifications', adminAuth);
      expect(res.body?.code).toBe(0);
    });

    it('TC-ADMIN-SETTING-002: GET system params', async () => {
      const res = await apiCall(app, 'get', '/api/admin/settings/params', adminAuth);
      expect(res.body?.code).toBe(0);
    });

    it('TC-ADMIN-SETTING-003: PUT system params', async () => {
      const res = await apiCall(app, 'put', '/api/admin/settings/params', adminAuth, {
        params: {},
      });
      // Body shape may vary — accept 0 OR validation error (400)
      expect([0, 400, 1000, 1001, 1002]).toContain(res.body?.code ?? -1);
    });
  });

  describe('contracts', () => {
    it('TC-ADMIN-CONTRACT-001: 列表', async () => {
      const res = await apiCall(app, 'get', '/api/admin/contracts', adminAuth);
      expect(res.body?.code).toBe(0);
    });
  });

  describe('admin 自管理', () => {
    it('TC-ADMIN-SELF-001: 列出 admins（应至少有自己）', async () => {
      const res = await apiCall(app, 'get', '/api/admin/admins', adminAuth);
      const data = res.body?.data;
      const list = Array.isArray(data) ? data : (data?.list || []);
      expect(list.length).toBeGreaterThan(0);
    });
  });

  describe('admin 查房东数据 - 不修改只读', () => {
    let propId: number;
    let roomId: number;
    let tenantId: number;

    beforeAll(async () => {
      // Use landlord to create data
      propId = await createProperty(app, landlordAuth, { name: '房东房产-admin查' });
      roomId = await createRoom(app, landlordAuth, propId, { rent: 2000, name: '房东房间' });
      tenantId = await createTenant(app, landlordAuth, roomId, {
        name: '房东租客',
        phone: '13900003333',
        moveInDate: `${currentMonthStr()}-01`,
      });
    });

    it('TC-ADMIN-READ-001: admin 房源列表能看见房东的 property', async () => {
      // URL-encode Chinese keyword — supertest doesn't auto-encode.
      const kw = encodeURIComponent('房东房产-admin查');
      const res = await apiCall(app, 'get', `/api/admin/properties?keyword=${kw}`, adminAuth);
      const list = res.body?.data?.list || res.body?.data || [];
      const ids = list.map((p: any) => p.id);
      expect(ids).toContain(propId);
    });

    it('TC-ADMIN-READ-002: admin 房间列表能看见房东的 room', async () => {
      const kw = encodeURIComponent('房东房间');
      const res = await apiCall(app, 'get', `/api/admin/rooms?keyword=${kw}`, adminAuth);
      const list = res.body?.data?.list || res.body?.data || [];
      const ids = list.map((r: any) => r.id);
      expect(ids).toContain(roomId);
    });
  });
});

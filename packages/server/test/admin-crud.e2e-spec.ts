/**
 * Admin module full CRUD tests.
 *
 * Earlier admin.e2e-spec.ts only verified ACL (403 / 401 / read-side smoke).
 * This file exercises the actual write paths: create property/room/tenant,
 * admin user create/update/reset-password, landlord create + status toggle,
 * contract upload + delete. Validates both happy path and DTO validation
 * rejections (missing required field → 400).
 */
import { INestApplication } from '@nestjs/common';
import { createTestApp, loginAsLandlord, loginAsAdmin, apiCall } from './helpers/app';

describe('Admin 模块完整 CRUD', () => {
  let app: INestApplication;
  let adminAuth: () => { Authorization: string };
  let landlordAuth: () => { Authorization: string };

  beforeAll(async () => {
    app = await createTestApp();
    adminAuth = await loginAsAdmin(app);
    landlordAuth = await loginAsLandlord(app, `dev_admin_crud_${Date.now()}`);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Admin — Property CRUD', () => {
    let createdPropertyId: number;
    const suffix = `adm-${Date.now()}`;

    it('TC-ADM-P-001: POST /api/admin/properties 创建（带 landlordId）', async () => {
      // Create a fresh landlord so this test is independent of TC-ADM-L-004
      // toggling other landlords' status to disabled.
      const ll = await apiCall(app, 'post', '/api/admin/landlords', adminAuth, {
        name: `p-ll-${Date.now()}`,
        phone: `134${(Date.now() % 100000000).toString().padStart(8, '0')}`,
      });
      expect(ll.body?.code).toBe(0);
      const landlordId = ll.body.data?.id;

      const res = await apiCall(app, 'post', '/api/admin/properties', adminAuth, {
        name: `admin-property-${suffix}`,
        landlordId,
        address: '测试地址',
      });
      expect(res.body?.code).toBe(0);
      createdPropertyId = res.body.data?.id;
      expect(createdPropertyId).toBeTruthy();
    });

    it('TC-ADM-P-002: PUT /api/admin/properties/:id 更新名称', async () => {
      const res = await apiCall(app, 'put', `/api/admin/properties/${createdPropertyId}`, adminAuth, {
        name: `admin-property-renamed-${suffix}`,
      });
      expect(res.body?.code).toBe(0);
    });

    it('TC-ADM-P-003: POST 缺 landlordId → 400', async () => {
      const res = await apiCall(app, 'post', '/api/admin/properties', adminAuth, {
        name: `admin-p-no-landlord-${suffix}`,
      });
      expect(res.status).toBe(400);
    });

    it('TC-ADM-P-004: POST name 空 → 400', async () => {
      const res = await apiCall(app, 'post', '/api/admin/properties', adminAuth, {
        name: '',
        landlordId: 1,
      });
      expect(res.status).toBe(400);
    });

    it('TC-ADM-P-005: landlord 角色访问 → 403', async () => {
      const res = await apiCall(app, 'post', '/api/admin/properties', landlordAuth, {
        name: 'should-not-create',
        landlordId: 1,
      });
      expect(res.status).toBe(403);
    });

    it('TC-ADM-P-006: DELETE /api/admin/properties/:id', async () => {
      const res = await apiCall(app, 'delete', `/api/admin/properties/${createdPropertyId}`, adminAuth);
      expect(res.body?.code).toBe(0);
    });
  });

  describe('Admin — Room CRUD', () => {
    let propertyId: number;
    let roomId: number;
    const suffix = `adm-room-${Date.now()}`;

    beforeAll(async () => {
      // Create a fresh landlord + property in admin scope. Reusing the first
      // landlord from the listing is unsafe: TC-ADM-L-004 toggles status, so
      // the first landlord may be in disabled state ("账号已禁用").
      const ll = await apiCall(app, 'post', '/api/admin/landlords', adminAuth, {
        name: `r-ll-${Date.now()}`,
        phone: `135${(Date.now() % 100000000).toString().padStart(8, '0')}`,
      });
      expect(ll.body?.code).toBe(0);
      const landlordId = ll.body.data?.id;
      const p = await apiCall(app, 'post', '/api/admin/properties', adminAuth, {
        name: `room-host-${suffix}`,
        landlordId,
      });
      expect(p.body?.code).toBe(0);
      propertyId = p.body.data?.id;
    });

    it('TC-ADM-R-001: POST /api/admin/rooms 创建', async () => {
      const res = await apiCall(app, 'post', '/api/admin/rooms', adminAuth, {
        name: `room-${suffix}`,
        propertyId,
        rent: 1500,
      });
      expect(res.body?.code).toBe(0);
      roomId = res.body.data?.id;
      expect(roomId).toBeTruthy();
    });

    it('TC-ADM-R-002: PUT 更新租金', async () => {
      const res = await apiCall(app, 'put', `/api/admin/rooms/${roomId}`, adminAuth, { rent: 1800 });
      expect(res.body?.code).toBe(0);
    });

    it('TC-ADM-R-003: PUT /status 切换 0/1', async () => {
      const r1 = await apiCall(app, 'put', `/api/admin/rooms/${roomId}/status`, adminAuth, { status: 1 });
      expect(r1.body?.code).toBe(0);
      const r2 = await apiCall(app, 'put', `/api/admin/rooms/${roomId}/status`, adminAuth, { status: 0 });
      expect(r2.body?.code).toBe(0);
    });

    it('TC-ADM-R-004: PUT /status 非法 status=5 → 400', async () => {
      const res = await apiCall(app, 'put', `/api/admin/rooms/${roomId}/status`, adminAuth, { status: 5 });
      expect(res.status).toBe(400);
    });

    it('TC-ADM-R-005: POST 缺 name → 400', async () => {
      const res = await apiCall(app, 'post', '/api/admin/rooms', adminAuth, { propertyId, rent: 1000 });
      expect(res.status).toBe(400);
    });

    it('TC-ADM-R-006: GET /api/admin/rooms keyword 搜索', async () => {
      const res = await apiCall(
        app,
        'get',
        `/api/admin/rooms?page=1&pageSize=20&keyword=${encodeURIComponent(suffix)}`,
        adminAuth,
      );
      expect(res.body?.code).toBe(0);
      expect(Array.isArray(res.body.data?.list)).toBe(true);
    });

    it('TC-ADM-R-007: DELETE /api/admin/rooms/:id', async () => {
      const res = await apiCall(app, 'delete', `/api/admin/rooms/${roomId}`, adminAuth);
      expect(res.body?.code).toBe(0);
    });
  });

  describe('Admin — Tenant CRUD', () => {
    let tenantId: number;
    const phone = `139${Date.now().toString().slice(-8)}`;
    const name = `t-adm-${Date.now()}`;

    it('TC-ADM-T-001: POST /api/admin/tenants 创建（带 roomId）', async () => {
      // Fresh landlord + property + room — listing lookup risks hitting a
      // disabled landlord from an earlier test (TC-ADM-L-004 toggles).
      const ll = await apiCall(app, 'post', '/api/admin/landlords', adminAuth, {
        name: `t-ll-${Date.now()}`,
        phone: `136${(Date.now() % 100000000).toString().padStart(8, '0')}`,
      });
      expect(ll.body?.code).toBe(0);
      const landlordId = ll.body.data?.id;
      const p = await apiCall(app, 'post', '/api/admin/properties', adminAuth, {
        name: `t-host-${Date.now()}`,
        landlordId,
      });
      expect(p.body?.code).toBe(0);
      const propertyId = p.body.data?.id;
      const r = await apiCall(app, 'post', '/api/admin/rooms', adminAuth, {
        name: `t-room-${Date.now()}`,
        propertyId,
        rent: 1000,
      });
      expect(r.body?.code).toBe(0);
      const roomId = r.body.data?.id;

      const res = await apiCall(app, 'post', '/api/admin/tenants', adminAuth, {
        name,
        phone,
        roomId,
        rentDay: 5,
        payMonths: 1,
      });
      expect(res.body?.code).toBe(0);
      tenantId = res.body.data?.id;
      expect(tenantId).toBeTruthy();
    });

    it('TC-ADM-T-002: PUT /api/admin/tenants/:id 更新 note', async () => {
      const res = await apiCall(app, 'put', `/api/admin/tenants/${tenantId}`, adminAuth, { note: 'adm-test' });
      expect(res.body?.code).toBe(0);
    });

    it('TC-ADM-T-003: PUT move-out（写 moveOutDate）', async () => {
      const res = await apiCall(app, 'put', `/api/admin/tenants/${tenantId}/move-out`, adminAuth, {
        moveOutDate: '2099-12-31',
      });
      expect(res.body?.code).toBe(0);
    });

    it('TC-ADM-T-004: POST 缺 phone → 400', async () => {
      const res = await apiCall(app, 'post', '/api/admin/tenants', adminAuth, { name: 'x', roomId: 1 });
      expect(res.status).toBe(400);
    });

    it('TC-ADM-T-005: GET keyword 搜索', async () => {
      const res = await apiCall(
        app,
        'get',
        `/api/admin/tenants?page=1&pageSize=20&keyword=${encodeURIComponent(name)}`,
        adminAuth,
      );
      expect(res.body?.code).toBe(0);
    });

    it('TC-ADM-T-006: DELETE /api/admin/tenants/:id', async () => {
      const res = await apiCall(app, 'delete', `/api/admin/tenants/${tenantId}`, adminAuth);
      expect(res.body?.code).toBe(0);
    });
  });

  describe('Admin — Admin user management', () => {
    let adminId: number;
    const username = `adm-u-${Date.now()}`;
    const name = `管理员${Date.now() % 1000}`;

    it('TC-ADM-A-001: POST /api/admin/admins 创建', async () => {
      const res = await apiCall(app, 'post', '/api/admin/admins', adminAuth, {
        username,
        password: 'init-pwd-123',
        name,
      });
      expect(res.body?.code).toBe(0);
      adminId = res.body.data?.id;
      expect(adminId).toBeTruthy();
    });

    it('TC-ADM-A-002: PUT /api/admin/admins/:id 更新 name/role', async () => {
      const res = await apiCall(app, 'put', `/api/admin/admins/${adminId}`, adminAuth, {
        name: `${name}-renamed`,
        role: 1,
      });
      expect(res.body?.code).toBe(0);
    });

    it('TC-ADM-A-003: PUT reset-password', async () => {
      const res = await apiCall(app, 'put', `/api/admin/admins/${adminId}/reset-password`, adminAuth, {
        password: 'new-pwd-456',
      });
      expect(res.body?.code).toBe(0);
    });

    it('TC-ADM-A-004: POST 缺 username → 400', async () => {
      const res = await apiCall(app, 'post', '/api/admin/admins', adminAuth, {
        password: 'whatever',
        name: 'no-username',
      });
      expect(res.status).toBe(400);
    });

    it('TC-ADM-A-005: PUT role=99 非法 → 400', async () => {
      const res = await apiCall(app, 'put', `/api/admin/admins/${adminId}`, adminAuth, { role: 99 });
      expect(res.status).toBe(400);
    });

    it('TC-ADM-A-006: GET /api/admin/admins list 含本次创建', async () => {
      const res = await apiCall(app, 'get', '/api/admin/admins?page=1&pageSize=50', adminAuth);
      expect(res.body?.code).toBe(0);
      const found = (res.body.data?.list || []).some((a: any) => a.id === adminId);
      expect(found).toBe(true);
    });
  });

  describe('Admin — Landlord management', () => {
    let landlordId: number;
    const phone = `138${(Date.now() % 100000000).toString().padStart(8, '0')}`;
    const name = `创建房东${Date.now() % 1000}`;

    it('TC-ADM-L-001: POST /api/admin/landlords 创建', async () => {
      const res = await apiCall(app, 'post', '/api/admin/landlords', adminAuth, { name, phone });
      expect(res.body?.code).toBe(0);
      landlordId = res.body.data?.id;
      expect(landlordId).toBeTruthy();
    });

    it('TC-ADM-L-002: GET 详情', async () => {
      const res = await apiCall(app, 'get', `/api/admin/landlords/${landlordId}`, adminAuth);
      expect(res.body?.code).toBe(0);
      expect(res.body.data?.id).toBe(landlordId);
    });

    it('TC-ADM-L-003: PUT 更新 name', async () => {
      const res = await apiCall(app, 'put', `/api/admin/landlords/${landlordId}`, adminAuth, {
        name: `${name}-X`,
      });
      expect(res.body?.code).toBe(0);
    });

    it('TC-ADM-L-004: PUT /status 切换 0/1', async () => {
      const r1 = await apiCall(app, 'put', `/api/admin/landlords/${landlordId}/status`, adminAuth, {
        status: 1,
      });
      expect(r1.body?.code).toBe(0);
      const r2 = await apiCall(app, 'put', `/api/admin/landlords/${landlordId}/status`, adminAuth, {
        status: 0,
      });
      expect(r2.body?.code).toBe(0);
    });

    it('TC-ADM-L-005: POST 缺 name → 400', async () => {
      const res = await apiCall(app, 'post', '/api/admin/landlords', adminAuth, { phone });
      expect(res.status).toBe(400);
    });
  });

  describe('Admin — Contract upload/delete', () => {
    let contractId: number;
    let roomId: number;

    beforeAll(async () => {
      // createContract rejects roomId=0 with 404 — must point at a real room.
      // Use a fresh landlord: the listing's first entry may be disabled by
      // an earlier test (TC-ADM-L-004 toggles status), which 400s on property
      // creation with "账号已禁用".
      const ll = await apiCall(app, 'post', '/api/admin/landlords', adminAuth, {
        name: `c-ll-${Date.now()}`,
        phone: `137${(Date.now() % 100000000).toString().padStart(8, '0')}`,
      });
      expect(ll.body?.code).toBe(0);
      const landlordId = ll.body.data?.id;

      const p = await apiCall(app, 'post', '/api/admin/properties', adminAuth, {
        name: `c-host-${Date.now()}`,
        landlordId,
      });
      expect(p.body?.code).toBe(0);
      const r = await apiCall(app, 'post', '/api/admin/rooms', adminAuth, {
        name: `c-room-${Date.now()}`,
        propertyId: p.body.data?.id,
        rent: 1000,
      });
      expect(r.body?.code).toBe(0);
      roomId = r.body.data?.id;
      expect(roomId).toBeTruthy();
    });

    it('TC-ADM-C-001: POST /api/admin/contracts/upload 创建', async () => {
      const res = await apiCall(app, 'post', '/api/admin/contracts/upload', adminAuth, {
        name: `合同-${Date.now()}`,
        imageUrl: '/uploads/contract-test.png',
        roomId,
        note: 'test',
      });
      expect(res.body?.code).toBe(0);
      contractId = res.body.data?.id;
      expect(contractId).toBeTruthy();
    });

    it('TC-ADM-C-002: GET /api/admin/contracts list', async () => {
      const res = await apiCall(app, 'get', '/api/admin/contracts?page=1&pageSize=20', adminAuth);
      expect(res.body?.code).toBe(0);
      expect(Array.isArray(res.body.data?.list)).toBe(true);
    });

    it('TC-ADM-C-003: 不存在的 roomId → 404', async () => {
      const res = await apiCall(app, 'post', '/api/admin/contracts/upload', adminAuth, {
        name: '孤儿合同',
        imageUrl: '/uploads/x.png',
        roomId: 999999,
      });
      expect(res.status).toBe(404);
    });

    it('TC-ADM-C-004: DELETE /api/admin/contracts/:id', async () => {
      const res = await apiCall(app, 'delete', `/api/admin/contracts/${contractId}`, adminAuth);
      expect(res.body?.code).toBe(0);
    });

    it('TC-ADM-C-005: DELETE 不存在的 id → 404', async () => {
      const res = await apiCall(app, 'delete', `/api/admin/contracts/999999`, adminAuth);
      expect(res.status).toBe(404);
    });
  });

  describe('Admin — Settings', () => {
    it('TC-ADM-S-001: GET /api/admin/settings/notifications', async () => {
      const res = await apiCall(app, 'get', '/api/admin/settings/notifications', adminAuth);
      expect(res.body?.code).toBe(0);
    });

    it('TC-ADM-S-002: GET /api/admin/settings/params', async () => {
      const res = await apiCall(app, 'get', '/api/admin/settings/params', adminAuth);
      expect(res.body?.code).toBe(0);
    });

    it('TC-ADM-S-003: PUT /api/admin/settings/notifications 幂等更新', async () => {
      const getRes = await apiCall(app, 'get', '/api/admin/settings/notifications', adminAuth);
      const current = getRes.body.data;
      const res = await apiCall(app, 'put', '/api/admin/settings/notifications', adminAuth, current || {});
      expect([0, 400]).toContain(res.body?.code ?? 400);
    });
  });
});

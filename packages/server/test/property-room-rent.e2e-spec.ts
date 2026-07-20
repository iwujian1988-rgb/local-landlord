import { INestApplication } from '@nestjs/common';
import {
  createTestApp,
  loginAsLandlord,
  apiCall,
  expectOk,
  createProperty,
  createRoom,
  createTenant,
  currentMonthStr,
} from './helpers/app';

/**
 * Property + Room + Rent edge cases: validation, soft delete, status machine,
 * single-charge flow.
 */
describe('Property / Room / Rent edge cases (e2e)', () => {
  let app: INestApplication;
  let auth: () => { Authorization: string };
  let propertyId: number;

  beforeAll(async () => {
    app = await createTestApp();
    auth = await loginAsLandlord(app);
    propertyId = await createProperty(app, auth);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('property 边界', () => {
    it('TC-PROP-EDGE-001: 缺 name → 400', async () => {
      const res = await apiCall(app, 'post', '/api/properties', auth, { address: '没名字' });
      expect(res.body?.code).not.toBe(0);
    });

    it('TC-PROP-EDGE-002: name 超长（>64 字符）→ 400', async () => {
      const res = await apiCall(app, 'post', '/api/properties', auth, {
        name: 'A'.repeat(100),
      });
      expect(res.body?.code).not.toBe(0);
    });

    it('TC-PROP-EDGE-003: 改不存在的 property → 404', async () => {
      const res = await apiCall(app, 'put', '/api/properties/99999', auth, { name: '新名' });
      expect(res.body?.code).not.toBe(0);
    });

    it('TC-PROP-EDGE-004: 删不存在的 property → 404', async () => {
      const res = await apiCall(app, 'delete', '/api/properties/99999', auth);
      expect(res.body?.code).not.toBe(0);
    });

    it('TC-PROP-EDGE-005: emoji + 中文 name 应允许', async () => {
      const res = await apiCall(app, 'post', '/api/properties', auth, {
        name: '🏠我的家',
      });
      expect(res.body?.code).toBe(0);
    });

    it('TC-PROP-EDGE-006: 重复 name 应允许（业务上不同房源可以同名）', async () => {
      const r1 = await apiCall(app, 'post', '/api/properties', auth, { name: '阳光小区' });
      const r2 = await apiCall(app, 'post', '/api/properties', auth, { name: '阳光小区' });
      expect(r1.body?.code).toBe(0);
      expect(r2.body?.code).toBe(0);
      expect(r1.body.data.id).not.toBe(r2.body.data.id);
    });
  });

  describe('room 边界', () => {
    it('TC-ROOM-EDGE-001: rent 为负数 → 400', async () => {
      const res = await apiCall(app, 'post', `/api/properties/${propertyId}/rooms`, auth, {
        name: '负租金',
        rent: -100,
      });
      expect(res.body?.code).not.toBe(0);
    });

    it('TC-ROOM-EDGE-002: rent 超大（>999999）→ 400', async () => {
      const res = await apiCall(app, 'post', `/api/properties/${propertyId}/rooms`, auth, {
        name: '巨租',
        rent: 1000000,
      });
      expect(res.body?.code).not.toBe(0);
    });

    it('TC-ROOM-EDGE-003: 缺 name → 400', async () => {
      const res = await apiCall(app, 'post', `/api/properties/${propertyId}/rooms`, auth, {
        rent: 2000,
      });
      expect(res.body?.code).not.toBe(0);
    });

    it('TC-ROOM-EDGE-004: 缺 rent → 400', async () => {
      const res = await apiCall(app, 'post', `/api/properties/${propertyId}/rooms`, auth, {
        name: '无租金',
      });
      expect(res.body?.code).not.toBe(0);
    });

    it('TC-ROOM-EDGE-005: status 只能是 0 或 1', async () => {
      const res = await apiCall(app, 'post', `/api/properties/${propertyId}/rooms`, auth, {
        name: '非法状态',
        rent: 2000,
        status: 5,
      });
      expect(res.body?.code).not.toBe(0);
    });

    it('TC-ROOM-EDGE-006: rent = 0 应允许（免费房间，比如亲戚住）', async () => {
      const res = await apiCall(app, 'post', `/api/properties/${propertyId}/rooms`, auth, {
        name: '免费房',
        rent: 0,
      });
      expect(res.body?.code).toBe(0);
    });

    it('TC-ROOM-EDGE-007: 删除空房间 → 应成功', async () => {
      const rId = await createRoom(app, auth, propertyId, { name: '要删的' });
      const res = await apiCall(app, 'delete', `/api/rooms/${rId}`, auth);
      expect(res.body?.code).toBe(0);
    });

    it('TC-ROOM-EDGE-008: 删除已租房间 → 应保护（拒绝或自动退租）', async () => {
      const rId = await createRoom(app, auth, propertyId, { name: '有租客的' });
      await createTenant(app, auth, rId, {
        name: '占着',
        phone: '13911111111',
        moveInDate: `${currentMonthStr()}-01`,
      });
      const res = await apiCall(app, 'delete', `/api/rooms/${rId}`, auth);
      // Either 400 (reject) or 0 (cascade) — log to spot check; main thing is
      // it doesn't corrupt state. Assert code !== 0 OR if 0, room list excludes it.
      // Currently expecting rejection to be safe.
      // (Property spec captures real behavior; if this changes, update both.)
      // Throws BadRequestException → 400 in body envelope.
      expect(res.body?.code).not.toBe(0);
    });
  });

  describe('rent 单独收款', () => {
    let rentRoomId: number;

    beforeAll(async () => {
      rentRoomId = await createRoom(app, auth, propertyId, { name: '收款测试', rent: 2000 });
      await createTenant(app, auth, rentRoomId, {
        name: '收款人',
        phone: '13922222222',
        moveInDate: `${currentMonthStr()}-01`,
      });
    });

    it('TC-RENT-EDGE-001: 创建单独收款', async () => {
      const res = await apiCall(app, 'post', `/api/rooms/${rentRoomId}/single-charge`, auth, {
        feeType: '水费',
        amount: 50,
      });
      expect(res.body?.code).toBe(0);
    });

    it('TC-RENT-EDGE-002: amount 为负 → 400', async () => {
      const res = await apiCall(app, 'post', `/api/rooms/${rentRoomId}/single-charge`, auth, {
        feeType: '负数',
        amount: -10,
      });
      expect(res.body?.code).not.toBe(0);
    });

    it('TC-RENT-EDGE-003: 缺 feeType → 400', async () => {
      const res = await apiCall(app, 'post', `/api/rooms/${rentRoomId}/single-charge`, auth, {
        amount: 50,
      });
      expect(res.body?.code).not.toBe(0);
    });

    it('TC-RENT-EDGE-004: 获取 room 的 records 列表', async () => {
      const res = await apiCall(app, 'get', `/api/rooms/${rentRoomId}/records`, auth);
      expect(res.body?.code).toBe(0);
    });

    it('TC-RENT-EDGE-005: 待处理收租列表', async () => {
      const res = await apiCall(app, 'get', '/api/rent/pending', auth);
      expect(res.body?.code).toBe(0);
    });
  });

  describe('upload 边界', () => {
    it('TC-UPLOAD-EDGE-001: 无文件上传 → 400', async () => {
      const res = await apiCall(app, 'post', '/api/upload', auth, {});
      expect(res.status).not.toBe(201);
    });

    it('TC-UPLOAD-EDGE-002: base64 缺 data → 400', async () => {
      const res = await apiCall(app, 'post', '/api/upload/base64', auth, {});
      expect(res.body?.code).not.toBe(0);
    });

    it('TC-UPLOAD-EDGE-003: base64 非图片 MIME → 400', async () => {
      const res = await apiCall(app, 'post', '/api/upload/base64', auth, {
        data: 'data:application/pdf;base64,JVBERi0xJj',
      });
      expect(res.body?.code).not.toBe(0);
    });

    it('TC-UPLOAD-EDGE-004: cloud-path 缺 cloudPath → 400', async () => {
      const res = await apiCall(app, 'post', '/api/upload/cloud-path', auth, {});
      expect(res.body?.code).not.toBe(0);
    });

    it('TC-UPLOAD-EDGE-005: cloud-path 有效输入 → 返回 URL', async () => {
      const res = await apiCall(app, 'post', '/api/upload/cloud-path', auth, {
        cloudPath: 'uploads/test.png',
      });
      expect(res.body?.code).toBe(0);
      expect(res.body?.data?.url).toBeTruthy();
    });
  });
});

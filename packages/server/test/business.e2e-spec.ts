import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, loginAsLandlord, loginAsAdmin } from './helpers/app';

describe('Business API (e2e)', () => {
  let app: INestApplication;
  let auth: () => { Authorization: string };      // landlord (role=1) — for property/room
  let adminAuth: () => { Authorization: string }; // admin (role=0) — for /admin/*

  beforeAll(async () => {
    app = await createTestApp();
    auth = await loginAsLandlord(app);
    adminAuth = await loginAsAdmin(app);
  });

  afterAll(async () => {
    await app.close();
  });

  // ===================== 房源测试 =====================
  describe('房源模块', () => {
    let propertyId: number;

    it('TC-PROP-001: 创建房源', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/properties')
        .set(auth())
        .send({ name: '测试房源', address: '测试地址100号' });
      expect(res.body.code).toBe(0);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.name).toBe('测试房源');
      propertyId = res.body.data.id;
    });

    it('TC-PROP-002: 创建房源缺少必填字段', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/properties')
        .set(auth())
        .send({});
      expect(res.status).not.toBe(201);
    });

    it('TC-PROP-003: 获取房源列表', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/properties')
        .set(auth());
      expect(res.body.code).toBe(0);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('TC-PROP-004: 获取房源详情', async () => {
      if (!propertyId) return;
      const res = await request(app.getHttpServer())
        .get(`/api/properties/${propertyId}`)
        .set(auth());
      expect(res.body.code).toBe(0);
      expect(res.body.data.name).toBe('测试房源');
    });

    it('TC-PROP-005: 更新房源', async () => {
      if (!propertyId) return;
      const res = await request(app.getHttpServer())
        .put(`/api/properties/${propertyId}`)
        .set(auth())
        .send({ name: '已更新房源' });
      expect(res.body.code).toBe(0);
      expect(res.body.data.name).toBe('已更新房源');
    });
  });

  // ===================== 房间测试 =====================
  describe('房间模块', () => {
    let roomId: number;

    it('TC-ROOM-001: 创建房间', async () => {
      const props = await request(app.getHttpServer()).get('/api/properties').set(auth());
      const list = props.body.data?.list || props.body.data;
      const pid = list?.[0]?.id;
      if (!pid) return;

      const res = await request(app.getHttpServer())
        .post(`/api/properties/${pid}/rooms`)
        .set(auth())
        .send({ name: '测试房间101', rent: 3500, area: '25', floor: '1', orientation: '南' });
      if (res.body.code === 0) {
        roomId = res.body.data.id;
        expect(res.body.data.name).toBe('测试房间101');
      }
    });

    it('TC-ROOM-002: 获取房间详情', async () => {
      if (!roomId) return;
      const res = await request(app.getHttpServer())
        .get(`/api/rooms/${roomId}`)
        .set(auth());
      expect(res.body.code).toBe(0);
    });
  });

  // ===================== 管理员后台测试 =====================
  describe('管理员后台', () => {
    it('TC-ADMIN-001: 获取房源列表', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/properties')
        .set(adminAuth());
      expect(res.body.code).toBe(0);
    });

    it('TC-ADMIN-002: 获取房间列表', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/rooms')
        .set(adminAuth());
      expect(res.body.code).toBe(0);
    });

    it('TC-ADMIN-003: 获取租客列表', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/tenants')
        .set(adminAuth());
      expect(res.body.code).toBe(0);
    });

    it('TC-ADMIN-004: 无权限访问管理员接口', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/admins');
      expect(res.status).toBe(401);
    });
  });

  // ===================== 收租测试 =====================
  describe('收租模块', () => {
    it('TC-RENT-001: 获取待处理收租', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/rent/pending')
        .set(auth());
      expect(res.body.code).toBe(0);
    });

    it('TC-RENT-002: 获取收租统计', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/stats/rent?period=month')
        .set(auth());
      expect(res.body.code).toBe(0);
    });
  });

  // ===================== 上传测试 =====================
  describe('文件上传', () => {
    it('TC-UPLOAD-001: 无文件上传返回错误', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/upload')
        .set(auth());
      expect(res.status).not.toBe(201);
    });
  });
});

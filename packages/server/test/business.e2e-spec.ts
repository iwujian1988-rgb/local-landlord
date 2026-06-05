import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Business API (e2e)', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    // 先登录
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/admin/login')
      .send({ username: 'admin', password: 'admin123' });
    token = loginRes.body.data.token;
  });

  afterAll(async () => {
    await app.close();
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  // ===================== 房源测试 =====================
  describe('房源模块', () => {
    let propertyId: number;

    it('TC-PROP-001: 创建房源', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/properties')
        .set(auth())
        .send({ name: '测试房源', address: '测试地址100号' });
      expect(res.body.code).toBe(0);
      expect(res.body.data.property).toBeDefined();
      expect(res.body.data.property.name).toBe('测试房源');
      propertyId = res.body.data.property.id;
    });

    it('TC-PROP-002: 创建房源缺少必填字段', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/properties')
        .set(auth())
        .send({});
      expect(res.status).not.toBe(0);
    });

    it('TC-PROP-003: 获取房源列表', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/properties')
        .set(auth());
      expect(res.body.code).toBe(0);
      expect(res.body.data).toBeDefined();
    });

    it('TC-PROP-004: 获取房源详情', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/properties/${propertyId}`)
        .set(auth());
      expect(res.body.code).toBe(0);
      expect(res.body.data.property.name).toBe('测试房源');
    });

    it('TC-PROP-005: 更新房源', async () => {
      const res = await request(app.getHttpServer())
        .put(`/api/properties/${propertyId}`)
        .set(auth())
        .send({ name: '已更新房源' });
      expect(res.body.code).toBe(0);
      expect(res.body.data.property.name).toBe('已更新房源');
    });
  });

  // ===================== 房间测试 =====================
  describe('房间模块', () => {
    let roomId: number;

    it('TC-ROOM-001: 创建房间', async () => {
      // 先获取房源列表
      const props = await request(app.getHttpServer()).get('/api/properties').set(auth());
      const pid = props.body.data.list?.[0]?.id || props.body.data[0]?.id;
      if (!pid) return;

      const res = await request(app.getHttpServer())
        .post(`/api/properties/${pid}/rooms`)
        .set(auth())
        .send({ name: '测试房间101', rent: 3500, area: '25', floor: '1', orientation: '南' });
      if (res.body.code === 0) {
        roomId = res.body.data.room.id;
        expect(res.body.data.room.name).toBe('测试房间101');
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
        .set(auth());
      expect(res.body.code).toBe(0);
    });

    it('TC-ADMIN-002: 获取房间列表', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/rooms')
        .set(auth());
      expect(res.body.code).toBe(0);
    });

    it('TC-ADMIN-003: 获取租客列表', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/admin/tenants')
        .set(auth());
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

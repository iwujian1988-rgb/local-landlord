import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('管理员认证', () => {
    it('TC-AUTH-001: 登录成功获取 token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/admin/login')
        .send({ username: 'admin', password: 'admin123' });
      expect(res.body.code).toBe(0);
      token = res.body.data.token;
    });

    it('TC-AUTH-002: 错误密码登录失败', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/admin/login')
        .send({ username: 'admin', password: 'wrong123' });
      expect(res.body.code).not.toBe(0);
    });

    it('TC-AUTH-003: 获取当前管理员信息', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/auth/admin/me')
        .set('Authorization', `Bearer ${token}`);
      expect(res.body.code).toBe(0);
      expect(res.body.data.admin).toBeDefined();
    });

    it('TC-AUTH-004: 无 token 访问受保护接口', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/auth/admin/me');
      expect(res.status).toBe(401);
    });

    it('TC-AUTH-005: 无效 token 访问受保护接口', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/auth/admin/me')
        .set('Authorization', 'Bearer invalid_token_xyz');
      expect(res.status).toBe(401);
    });
  });

  describe('微信登录', () => {
    it('TC-WX-001: 微信登录模拟', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/wechat/login')
        .send({ code: 'mock_wechat_code_001' });
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.landlord).toBeDefined();
    });
  });
});

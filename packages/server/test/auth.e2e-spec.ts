import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, loginAsAdmin } from './helpers/app';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let auth: () => { Authorization: string };

  beforeAll(async () => {
    app = await createTestApp();
    auth = await loginAsAdmin(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('管理员认证', () => {
    it('TC-AUTH-001: 登录成功获取 token', async () => {
      // Already logged in via beforeAll; assert shape only.
      const res = await request(app.getHttpServer())
        .post('/api/auth/admin/login')
        .send({ username: 'admin', password: process.env.ADMIN_DEFAULT_PASSWORD || 'admin123' });
      expect(res.body.code).toBe(0);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.username).toBe('admin');
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
        .set(auth());
      expect(res.body.code).toBe(0);
      expect(res.body.data.username).toBe('admin');
      expect(res.body.data.isAdmin).toBe(true);
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

  describe('微信登录（dev bypass）', () => {
    it('TC-WX-001: dev_ 前缀绕过真实微信', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/wechat/login')
        .send({ code: `dev_e2e_${Date.now()}` });
      expect(res.body.code).toBe(0);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.openId).toMatch(/^dev_/);
    });
  });
});

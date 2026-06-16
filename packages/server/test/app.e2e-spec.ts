import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, loginAsAdmin } from './helpers/app';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/auth/admin/login - 管理员登录成功', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/admin/login')
      .send({ username: 'admin', password: process.env.ADMIN_DEFAULT_PASSWORD || 'admin123' });

    expect(res.status).toBe(201);
    expect(res.body.code).toBe(0);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user).toBeDefined();
    expect(res.body.data.user.username).toBe('admin');
  });

  it('POST /api/auth/admin/login - 密码错误返回401', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/admin/login')
      .send({ username: 'admin', password: 'definitely_wrong_password' });

    expect(res.body.code).not.toBe(0);
  });

  it('GET /api/auth/admin/me - 未登录返回401', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/auth/admin/me');

    expect(res.status).toBe(401);
  });

  it('GET /api/auth/admin/me - 登录后返回当前管理员', async () => {
    const auth = await loginAsAdmin(app);
    const res = await request(app.getHttpServer())
      .get('/api/auth/admin/me')
      .set(auth());

    expect(res.body.code).toBe(0);
    expect(res.body.data.isAdmin).toBe(true);
  });
});

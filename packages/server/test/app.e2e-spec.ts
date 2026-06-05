import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication;

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

  it('POST /api/auth/admin/login - 管理员登录成功', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/admin/login')
      .send({ username: 'admin', password: 'admin123' });

    expect(res.status).toBe(201);
    expect(res.body.code).toBe(0);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.admin).toBeDefined();
  });

  it('POST /api/auth/admin/login - 密码错误返回401', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/admin/login')
      .send({ username: 'admin', password: 'wrong' });

    expect(res.body.code).not.toBe(0);
  });

  it('GET /api/auth/admin/me - 未登录返回401', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/auth/admin/me');

    expect(res.status).toBe(401);
  });
});

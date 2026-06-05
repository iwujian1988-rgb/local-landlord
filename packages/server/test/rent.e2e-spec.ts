import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Rent (e2e)', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    const loginRes = await request(app.getHttpServer()).post('/api/auth/admin/login').send({ username: 'admin', password: 'admin123' });
    token = loginRes.body.data.token;
  });

  afterAll(async () => { await app.close(); });
  const auth = () => ({ Authorization: `Bearer ${token}` });

  it('TC-RENT-001: 创建单独收款', async () => {
    const props = await request(app.getHttpServer()).get('/api/properties').set(auth());
    const pid = props.body.data.list?.[0]?.id || props.body.data[0]?.id;
    if (!pid) return;
    const rooms = await request(app.getHttpServer()).get(`/api/properties/${pid}/rooms`).set(auth());
    const roomId = rooms.body.data.list?.[0]?.id;
    if (!roomId) return;
    const res = await request(app.getHttpServer())
      .post(`/api/rooms/${roomId}/single-charge`).set(auth())
      .send({ feeType: '维修费', amount: 200, note: '修水管' });
    expect(res.body.code).toBe(0);
  });

  it('TC-RENT-002: 获取收租记录', async () => {
    const props = await request(app.getHttpServer()).get('/api/properties').set(auth());
    const pid = props.body.data.list?.[0]?.id || props.body.data[0]?.id;
    if (!pid) return;
    const rooms = await request(app.getHttpServer()).get(`/api/properties/${pid}/rooms`).set(auth());
    const roomId = rooms.body.data.list?.[0]?.id;
    if (!roomId) return;
    const res = await request(app.getHttpServer()).get(`/api/rooms/${roomId}/records`).set(auth());
    expect(res.body.code).toBe(0);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('TC-RENT-003: 提醒租客', async () => {
    const props = await request(app.getHttpServer()).get('/api/properties').set(auth());
    const pid = props.body.data.list?.[0]?.id || props.body.data[0]?.id;
    if (!pid) return;
    const rooms = await request(app.getHttpServer()).get(`/api/properties/${pid}/rooms`).set(auth());
    const roomId = rooms.body.data.list?.[0]?.id;
    if (!roomId) return;
    const res = await request(app.getHttpServer())
      .post(`/api/rooms/${roomId}/remind`).set(auth())
      .send({ tenantId: '1', method: 'copy' });
    expect(res.body.code).toBe(0);
  });

  it('TC-RENT-004: 获取待处理收租列表', async () => {
    const res = await request(app.getHttpServer()).get('/api/rent/pending').set(auth());
    expect(res.body.code).toBe(0);
    expect(res.body.data).toBeDefined();
  });

  it('TC-RENT-005: 无认证访问被拒绝', async () => {
    const res = await request(app.getHttpServer()).get('/api/rent/pending');
    expect(res.status).toBe(401);
  });
});

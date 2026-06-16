import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, loginAsLandlord } from './helpers/app';

describe('Rent (e2e)', () => {
  let app: INestApplication;
  let auth: () => { Authorization: string };

  beforeAll(async () => {
    app = await createTestApp();
    auth = await loginAsLandlord(app);
  });

  afterAll(async () => { await app.close(); });

  it('TC-RENT-001: 创建单独收款', async () => {
    const props = await request(app.getHttpServer()).get('/api/properties').set(auth());
    const list = props.body.data?.list || props.body.data;
    const pid = list?.[0]?.id;
    if (!pid) return;
    const rooms = await request(app.getHttpServer()).get(`/api/properties/${pid}/rooms`).set(auth());
    const roomList = rooms.body.data?.list || rooms.body.data;
    const roomId = roomList?.[0]?.id;
    if (!roomId) return;
    const res = await request(app.getHttpServer())
      .post(`/api/rooms/${roomId}/single-charge`).set(auth())
      .send({ feeType: '维修费', amount: 200, note: '修水管' });
    expect(res.body.code).toBe(0);
  });

  it('TC-RENT-002: 获取收租记录', async () => {
    const props = await request(app.getHttpServer()).get('/api/properties').set(auth());
    const list = props.body.data?.list || props.body.data;
    const pid = list?.[0]?.id;
    if (!pid) return;
    const rooms = await request(app.getHttpServer()).get(`/api/properties/${pid}/rooms`).set(auth());
    const roomList = rooms.body.data?.list || rooms.body.data;
    const roomId = roomList?.[0]?.id;
    if (!roomId) return;
    const res = await request(app.getHttpServer()).get(`/api/rooms/${roomId}/records`).set(auth());
    expect(res.body.code).toBe(0);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('TC-RENT-003: 提醒租客', async () => {
    const props = await request(app.getHttpServer()).get('/api/properties').set(auth());
    const list = props.body.data?.list || props.body.data;
    const pid = list?.[0]?.id;
    if (!pid) return;
    const rooms = await request(app.getHttpServer()).get(`/api/properties/${pid}/rooms`).set(auth());
    const roomList = rooms.body.data?.list || rooms.body.data;
    const roomId = roomList?.[0]?.id;
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

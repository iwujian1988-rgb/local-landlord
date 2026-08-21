import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp, loginAsLandlord, createProperty, createRoom, createTenant, createBill, currentMonthStr } from './helpers/app';

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

  it('TC-RENT-006: 获取本月全部账单（含未确认单独收款）', async () => {
    const pid = await createProperty(app, auth);
    const roomId = await createRoom(app, auth, pid, { name: 'rent-bills-房间' });
    await createTenant(app, auth, roomId);
    await createBill(app, auth, roomId, { period: currentMonthStr(), totalAmount: 2000 });
    const charge = await request(app.getHttpServer())
      .post(`/api/rooms/${roomId}/single-charge`).set(auth())
      .send({ feeType: '维修费', amount: 200, note: '修水管' });
    expect(charge.body.code).toBe(0);

    const res = await request(app.getHttpServer()).get('/api/rent/bills').set(auth());
    expect(res.body.code).toBe(0);
    expect(res.body.data.period).toBe(currentMonthStr());
    expect(Array.isArray(res.body.data.bills)).toBe(true);
    expect(Array.isArray(res.body.data.singleCharges)).toBe(true);

    // 本月创建的账单必须列出（无论状态）——这是"全部账单"接口的本职。
    const bill = res.body.data.bills.find((b: any) => b.roomId === roomId);
    expect(bill).toBeDefined();
    expect(Number(bill.totalAmount)).toBe(2000);
    expect(bill.roomName).toBe('rent-bills-房间');

    // 未确认的单独收款必须出现 —— 统计页把它算进"待收"而旧界面无处可看，
    // 本接口就是为消除这个盲区。
    const pending = res.body.data.singleCharges.filter((s: any) => s.status === 0);
    expect(pending.length).toBeGreaterThanOrEqual(1);
    expect(Number(pending[0].amount)).toBe(200);
    expect(pending[0].feeType).toBe('维修费');
  });

  it('TC-RENT-007: 全部账单接口无认证被拒绝', async () => {
    const res = await request(app.getHttpServer()).get('/api/rent/bills');
    expect(res.status).toBe(401);
  });
});

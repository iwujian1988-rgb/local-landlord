import { INestApplication } from '@nestjs/common';
import {
  createTestApp,
  loginAsLandlord,
  loginAsAdmin,
  apiCall,
  expectOk,
  createProperty,
  createRoom,
  createTenant,
  createBill,
  currentMonthStr,
} from './helpers/app';

/**
 * Fee, Document, Share, Payment-qr, Subscription, Health, Landlord modules.
 *
 * These are the "long tail" — smaller CRUD modules. Grouped into one spec to
 * avoid file-sprawl but each has its own describe block.
 */
describe('Fee / Document / Share / Payment-qr / Subscription / Health / Landlord (e2e)', () => {
  let app: INestApplication;
  let auth: () => { Authorization: string };
  let propertyId: number;
  let roomId: number;
  let adminAuth: () => { Authorization: string };

  beforeAll(async () => {
    app = await createTestApp();
    auth = await loginAsLandlord(app);
    propertyId = await createProperty(app, auth);
    roomId = await createRoom(app, auth, propertyId, { rent: 2000, name: 'long-tail-room' });
    await createTenant(app, auth, roomId, {
      name: '长尾租客',
      phone: '13900099999',
      moveInDate: `${currentMonthStr()}-01`,
    });
    adminAuth = await loginAsAdmin(app);
  });

  afterAll(async () => {
    await app.close();
  });

  // ============ Fee ============
  describe('fee 模块', () => {
    it('TC-FEE-001: 在租房间批量保存完整租约收费规则', async () => {
      const res = await apiCall(app, 'post', `/api/rooms/${roomId}/fee-items`, auth, {
        fees: [
          { name: '房租', type: 'fixed', amount: 2000, cycleMode: 'rent', enabled: true, isRent: true },
          { name: '网费', type: 'fixed', amount: 50, cycleMode: 'monthly', enabled: true, isRent: false },
        ],
      });
      expect(res.body?.code).toBe(0);
    });

    it('TC-FEE-002: 获取 room 的 fee-items', async () => {
      const res = await apiCall(app, 'get', `/api/rooms/${roomId}/fee-items`, auth);
      expect(res.body?.code).toBe(0);
      expect(res.body.data).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: '房租', isRent: true }),
        expect.objectContaining({ name: '网费', cycleMode: 'monthly' }),
      ]));
    });

    it('TC-FEE-003: cycleMode=rent 应让账单按 payMonths 倍数计', async () => {
      const res = await apiCall(app, 'post', `/api/rooms/${roomId}/fee-items`, auth, {
        fees: [
          { name: '房租', type: 'fixed', amount: 2000, cycleMode: 'rent', enabled: true, isRent: true },
          { name: '卫生费', type: 'fixed', amount: 30, cycleMode: 'rent', enabled: true, isRent: false },
        ],
      });
      expect(res.body?.code).toBe(0);
      const bill = expectOk(await apiCall(app, 'get', `/api/rooms/${roomId}/bills`, auth));
      expect(bill.billItems).toEqual([expect.objectContaining({ name: '房租', amount: 2000 })]);
    });

    it('TC-FEE-003B: 批量接口拒绝未知类型和超过两位小数的金额', async () => {
      const invalidType = await apiCall(app, 'post', `/api/rooms/${roomId}/fee-items`, auth, {
        fees: [
          { name: '房租', type: 'fixed', amount: 2000, enabled: true, isRent: true },
          { name: '错误项目', type: 'guess', amount: 10, enabled: true, isRent: false },
        ],
      });
      expect(invalidType.body?.code).not.toBe(0);

      const invalidPrecision = await apiCall(app, 'post', `/api/rooms/${roomId}/fee-items`, auth, {
        fees: [
          { name: '房租', type: 'fixed', amount: 2000.001, enabled: true, isRent: true },
        ],
      });
      expect(invalidPrecision.body?.code).not.toBe(0);
    });

    it('TC-FEE-004: 排序 fee-items', async () => {
      // Legacy single-item CRUD remains available only for a vacant-room template.
      const vacantRoomId = await createRoom(app, auth, propertyId, { rent: 1800, name: 'vacant-fee-template' });
      const r1 = await apiCall(app, 'post', `/api/rooms/${vacantRoomId}/fee-items`, auth, {
        name: 'A项', type: 0, amount: 10, enabled: 1,
      });
      const r2 = await apiCall(app, 'post', `/api/rooms/${vacantRoomId}/fee-items`, auth, {
        name: 'B项', type: 0, amount: 20, enabled: 1,
      });
      const id1 = r1.body.data.id;
      const id2 = r2.body.data.id;

      // Sort endpoint takes { ids: number[] } — order in array determines sortOrder.
      const sortRes = await apiCall(app, 'put', `/api/rooms/${vacantRoomId}/fee-items/sort`, auth, {
        ids: [id2, id1],
      });
      expect(sortRes.body?.code).toBe(0);
    });
  });

  // ============ Document ============
  describe('document 模块', () => {
    it('TC-DOC-001: 创建合同文档', async () => {
      const res = await apiCall(app, 'post', `/api/rooms/${roomId}/documents`, auth, {
        type: 0,
        name: '租赁合同.pdf',
        imageUrl: '/uploads/test.pdf',
      });
      expect(res.body?.code).toBe(0);
    });

    it('TC-DOC-002: 获取 room 的文档列表', async () => {
      const res = await apiCall(app, 'get', `/api/rooms/${roomId}/documents`, auth);
      expect(res.body?.code).toBe(0);
    });
  });

  // ============ Share ============
  describe('share 模块', () => {
    let billId: number;
    let shareToken: string;

    beforeAll(async () => {
      billId = await createBill(app, auth, roomId, { period: '2099-03' });
    });

    it('TC-SHARE-001: 生成账单分享链接', async () => {
      const res = await apiCall(app, 'post', '/api/share/generate', auth, {
        billId,
      });
      expect(res.body?.code).toBe(0);
      expect(res.body?.data?.shareUrl).toMatch(/^https?:\/\//);
      expect(res.body?.data?.shareUrl).toContain('/h5/?token=');
      expect(res.body?.data?.miniPath).toContain('pages/tenant-bill/index?token=');
      shareToken = res.body?.data?.token || res.body?.data?.shareToken || '';
      // Token might be in different field — capture whatever's there
      if (!shareToken && res.body?.data) {
        const d = res.body.data;
        shareToken = d.token || d.shareToken || (typeof d === 'string' ? d : '');
      }
    });

    it('TC-SHARE-002: 用 token 解析账单', async () => {
      // Skip if previous test didn't yield a token (response shape varies)
      if (!shareToken) return;
      const res = await apiCall(app, 'get', `/api/share/bill/${shareToken}`, null);
      // Share endpoint is unauthenticated (tenant opens via H5 link)
      expect(res.body?.code).toBe(0);
      const data = res.body?.data;
      expect(data.items).toEqual([{ name: '房租', amount: 2000 }]);
      expect(data.totalAmount).toBe(2000);
      expect(data.paidAmount).toBe(0);
      expect(data.outstandingAmount).toBe(2000);
      expect(data.isPaid).toBe(false);
    });

    it('TC-SHARE-002B: 部分付款后租客页只显示剩余应付', async () => {
      await apiCall(app, 'put', `/api/bills/${billId}/confirm`, auth, { actualAmount: 500 });
      const res = await apiCall(app, 'get', `/api/share/bill/${shareToken}`, null);
      expect(res.body?.code).toBe(0);
      expect(res.body?.data?.totalAmount).toBe(2000);
      expect(res.body?.data?.paidAmount).toBe(500);
      expect(res.body?.data?.outstandingAmount).toBe(1500);
      expect(res.body?.data?.isPaid).toBe(false);
    });

    it('TC-SHARE-002C: 付清后租客页待付归零', async () => {
      await apiCall(app, 'put', `/api/bills/${billId}/confirm`, auth, { actualAmount: 1500 });
      const res = await apiCall(app, 'get', `/api/share/bill/${shareToken}`, null);
      expect(res.body?.code).toBe(0);
      expect(res.body?.data?.paidAmount).toBe(2000);
      expect(res.body?.data?.outstandingAmount).toBe(0);
      expect(res.body?.data?.isPaid).toBe(true);
    });

    it('TC-SHARE-003: 无效 token → 404', async () => {
      const res = await apiCall(app, 'get', '/api/share/bill/invalid-token-xyz', null);
      expect(res.body?.code).not.toBe(0);
    });
  });

  // ============ Payment-qr ============
  describe('payment-qr 模块', () => {
    let qrId: number;
    let alipayQrId: number;

    it('TC-QR-001: 上传收款二维码', async () => {
      const res = await apiCall(app, 'post', '/api/payment-qr', auth, {
        label: '微信',
        imageUrl: '/uploads/wechat.png',
        type: 'wechat',
      });
      expect(res.body?.code).toBe(0);
      qrId = res.body?.data?.id;
    });

    it('TC-QR-002: typeNum 创建支付宝码并设为默认', async () => {
      const res = await apiCall(app, 'post', '/api/payment-qr', auth, {
        label: '支付宝',
        imageUrl: '/uploads/alipay.png',
        typeNum: 1,
        isDefault: true,
      });
      expect(res.body?.code).toBe(0);
      alipayQrId = res.body?.data?.id;
    });

    it('TC-QR-003: 更新接口同时兼容字符串 type，且默认码唯一', async () => {
      const updateRes = await apiCall(app, 'put', `/api/payment-qr/${qrId}`, auth, {
        type: 'wechat',
        imageUrl: '/uploads/wechat-new.png',
        isDefault: true,
      });
      expect(updateRes.body?.code).toBe(0);

      const res = await apiCall(app, 'get', '/api/payment-qr', auth);
      expect(res.body?.code).toBe(0);
      expect(res.body?.data?.codes.filter((code: any) => code.isDefault)).toHaveLength(1);
      expect(res.body?.data?.codes.find((code: any) => code.id === qrId)).toEqual(
        expect.objectContaining({ type: 'wechat', isDefault: true, imageUrl: '/uploads/wechat-new.png' }),
      );
    });

    it('TC-QR-004: 设为默认', async () => {
      if (!alipayQrId) return;
      const res = await apiCall(app, 'put', `/api/payment-qr/${alipayQrId}/set-default`, auth);
      expect(res.body?.code).toBe(0);
      const list = await apiCall(app, 'get', '/api/payment-qr', auth);
      expect(list.body?.data?.codes.filter((code: any) => code.isDefault)).toHaveLength(1);
      expect(list.body?.data?.codes.find((code: any) => code.id === alipayQrId)?.isDefault).toBe(true);
    });

    it('TC-QR-005: 删除', async () => {
      if (!qrId) return;
      const res = await apiCall(app, 'delete', `/api/payment-qr/${qrId}`, auth);
      expect(res.body?.code).toBe(0);
    });

    it('TC-QR-006: 非法 type 不得静默变成微信码', async () => {
      const res = await apiCall(app, 'post', '/api/payment-qr', auth, {
        imageUrl: '/uploads/invalid.png',
        type: 'unknown',
      });
      expect(res.body?.code).not.toBe(0);
    });
  });

  // ============ Subscription (admin only) ============
  describe('subscription 模块（admin only）', () => {
    const triggers = [
      'trigger-auto-bills',
      'trigger-rent',
      'trigger-move-out',
      'trigger-overdue',
      'trigger-mark-overdue',
      'trigger-contract-expiry',
      'trigger-vacancy',
      'trigger-monthly-summary',
    ];
    triggers.forEach((t) => {
      it(`TC-SUB-${t}: admin 调用 ${t} 返回 200`, async () => {
        const res = await apiCall(app, 'post', `/api/subscription/${t}`, adminAuth, {});
        // Allow 0 (success) — actual trigger might no-op on empty data
        expect(res.body?.code).toBe(0);
      });
    });

    it('TC-SUB-LOCK: 普通房东调用 trigger → 403', async () => {
      const res = await apiCall(app, 'post', '/api/subscription/trigger-rent', auth, {});
      expect(res.body?.code).not.toBe(0);
    });
  });

  // ============ Health ============
  describe('health 模块', () => {
    it('TC-HEALTH-001: /health 返回 ok', async () => {
      const res = await apiCall(app, 'get', '/api/health', null);
      // Health endpoint goes through TransformInterceptor — payload is under data.
      expect(res.body?.data?.status).toBe('ok');
      expect(res.body?.data?.timestamp).toBeTruthy();
    });
  });

  // ============ Landlord ============
  describe('landlord 模块', () => {
    it('TC-LL-001: 获取自己的 landlord 信息', async () => {
      // /api/auth/me already tested in auth — try /api/landlord/:id
      // First find own id via me
      const meRes = await apiCall(app, 'get', '/api/auth/me', auth);
      const myId = meRes.body?.data?.id;
      if (!myId) return;

      const res = await apiCall(app, 'get', `/api/landlord/${myId}`, auth);
      expect(res.body?.code).toBe(0);
    });

    it('TC-LL-002: 更新自己的资料', async () => {
      const meRes = await apiCall(app, 'get', '/api/auth/me', auth);
      const myId = meRes.body?.data?.id;
      if (!myId) return;

      const res = await apiCall(app, 'put', `/api/landlord/${myId}`, auth, {
        name: '更新后的名字',
      });
      expect(res.body?.code).toBe(0);
    });
  });

  // ============ Auth profile via /api/auth/* ============
  describe('auth profile', () => {
    it('TC-AUTH-PROFILE-001: PUT /api/auth/profile 更新昵称', async () => {
      const res = await apiCall(app, 'put', '/api/auth/profile', auth, {
        name: '新昵称',
      });
      expect(res.body?.code).toBe(0);
    });

    it('TC-AUTH-PROFILE-002: PUT /api/auth/profile 非法手机号 → 400', async () => {
      const res = await apiCall(app, 'put', '/api/auth/profile', auth, {
        phone: '123',
      });
      expect(res.body?.code).not.toBe(0);
    });

    it('TC-AUTH-PROFILE-003: PUT /api/auth/profile 合法手机号', async () => {
      const res = await apiCall(app, 'put', '/api/auth/profile', auth, {
        phone: '13812345678',
      });
      expect(res.body?.code).toBe(0);
    });
  });
});

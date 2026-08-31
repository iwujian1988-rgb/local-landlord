import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Bill } from '../src/modules/bill/bill.entity';
import {
  createTestApp,
  loginAsLandlord,
  apiCall,
  expectOk,
  createProperty,
  createRoom,
  createTenant,
  currentMonthStr,
} from './helpers/app';

/**
 * Bill module e2e.
 *
 * Critical paths covered:
 * - Manual bill creation (status=0, items saved)
 * - Payment confirmation: full → status=1, partial → status=3, over-payment rejected
 * - Idempotency: re-confirm paid bill rejected
 * - Send bill updates sentAt
 * - Cross-landlord isolation
 */
describe('Bill module (e2e)', () => {
  let app: INestApplication;
  let auth: () => { Authorization: string };
  let propertyId: number;
  let roomId: number;
  let tenantId: number;

  beforeAll(async () => {
    app = await createTestApp();
    auth = await loginAsLandlord(app);
    propertyId = await createProperty(app, auth);
    roomId = await createRoom(app, auth, propertyId, { rent: 2000, name: 'bill-room' });
    tenantId = await createTenant(app, auth, roomId, {
      name: '账单租客',
      phone: '13900000001',
      moveInDate: `${currentMonthStr()}-01`,
      payMonths: 1,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  /** Create a manual bill in next month (so it doesn't collide with auto first bill). */
  async function createManualBill(rId: number, period?: string): Promise<number> {
    const nextMonth = period || nextMonthStr();
    const res = await apiCall(app, 'post', `/api/rooms/${rId}/bills`, auth, {
      period: nextMonth,
      items: [{ feeName: '房租', amount: 2000 }, { feeName: '水费', amount: 50 }],
    });
    const data = expectOk(res);
    return data.id;
  }

  function nextMonthStr(): string {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  describe('创建账单', () => {
    it('TC-BILL-001: 创建手动账单', async () => {
      const billId = await createManualBill(roomId);
      expect(billId).toBeGreaterThan(0);

      const detailRes = await apiCall(app, 'get', `/api/bills/${billId}`, auth);
      const detail = expectOk(detailRes);
      expect(detail.period).toBe(nextMonthStr());
      expect(detail.status).toBe(0);
      expect(detail.items.length).toBe(2);
      expect(Number(detail.totalAmount)).toBe(2050);
    });

    it('TC-BILL-002: 同周期重复创建 → 400', async () => {
      const rId = await createRoom(app, auth, propertyId, { rent: 2000, name: 'bill-002' });
      await createTenant(app, auth, rId, {
        name: '重复账单',
        phone: '13900000002',
        moveInDate: `${currentMonthStr()}-01`,
      });
      const period = `${currentMonthStr()}-dup`; // invalid format would fail differently; use real next month
      const nextMonth = nextMonthStr();
      await createManualBill(rId, nextMonth);
      const res = await apiCall(app, 'post', `/api/rooms/${rId}/bills`, auth, {
        period: nextMonth,
        items: [{ feeName: '房租', amount: 2000 }],
      });
      expect(res.body?.code).not.toBe(0);
    });

    it('TC-BILL-003: 缺 items → 400', async () => {
      const res = await apiCall(app, 'post', `/api/rooms/${roomId}/bills`, auth, {
        period: nextMonthStr(),
        items: [],
      });
      expect(res.body?.code).not.toBe(0);
    });

    it('TC-BILL-004: 房间没租客 → 400', async () => {
      const emptyRoom = await createRoom(app, auth, propertyId, { rent: 2000, name: 'bill-empty' });
      const res = await apiCall(app, 'post', `/api/rooms/${emptyRoom}/bills`, auth, {
        period: nextMonthStr(),
        items: [{ feeName: '房租', amount: 2000 }],
      });
      expect(res.body?.code).not.toBe(0);
    });
  });

  describe('确认收款', () => {
    it('TC-BILL-005: 全额收款 → status=1', async () => {
      const rId = await createRoom(app, auth, propertyId, { rent: 2000, name: 'bill-005' });
      await createTenant(app, auth, rId, {
        name: '全额',
        phone: '13900000005',
        moveInDate: `${currentMonthStr()}-01`,
      });
      const billId = await createManualBill(rId);

      const res = await apiCall(app, 'put', `/api/bills/${billId}/confirm`, auth, {
        actualAmount: 2050,
      });
      const data = expectOk(res);
      expect(data.status).toBe(1);
      expect(Number(data.paidAmount)).toBe(2050);
      expect(data.paidAt).toBeTruthy();
    });

    it('TC-BILL-006: 部分收款 → status=3', async () => {
      const rId = await createRoom(app, auth, propertyId, { rent: 2000, name: 'bill-006' });
      await createTenant(app, auth, rId, {
        name: '部分',
        phone: '13900000006',
        moveInDate: `${currentMonthStr()}-01`,
      });
      const billId = await createManualBill(rId);

      const res = await apiCall(app, 'put', `/api/bills/${billId}/confirm`, auth, {
        actualAmount: 1000,
      });
      const data = expectOk(res);
      expect(data.status).toBe(3);
      expect(Number(data.paidAmount)).toBe(1000);
    });

    it('TC-BILL-007: 重复确认已付账单 → 400', async () => {
      const rId = await createRoom(app, auth, propertyId, { rent: 2000, name: 'bill-007' });
      await createTenant(app, auth, rId, {
        name: '重复确认',
        phone: '13900000007',
        moveInDate: `${currentMonthStr()}-01`,
      });
      const billId = await createManualBill(rId);
      await apiCall(app, 'put', `/api/bills/${billId}/confirm`, auth, { actualAmount: 2050 });

      const res = await apiCall(app, 'put', `/api/bills/${billId}/confirm`, auth, {
        actualAmount: 100,
      });
      expect(res.body?.code).not.toBe(0);
    });

    it('TC-BILL-008: 超额收款 → 400', async () => {
      const rId = await createRoom(app, auth, propertyId, { rent: 2000, name: 'bill-008' });
      await createTenant(app, auth, rId, {
        name: '超额',
        phone: '13900000008',
        moveInDate: `${currentMonthStr()}-01`,
      });
      const billId = await createManualBill(rId);

      const res = await apiCall(app, 'put', `/api/bills/${billId}/confirm`, auth, {
        actualAmount: 9999,
      });
      expect(res.body?.code).not.toBe(0);
    });

    it('TC-BILL-009: 部分付款后无法编辑账单项', async () => {
      const rId = await createRoom(app, auth, propertyId, { rent: 2000, name: 'bill-009' });
      await createTenant(app, auth, rId, {
        name: '锁定',
        phone: '13900000009',
        moveInDate: `${currentMonthStr()}-01`,
      });
      const billId = await createManualBill(rId);
      await apiCall(app, 'put', `/api/bills/${billId}/confirm`, auth, { actualAmount: 1000 });

      // Try to send + edit items — should be rejected
      const res = await apiCall(app, 'put', `/api/bills/${billId}/send`, auth, {
        items: [{ feeName: '房租', amount: 9999 }],
      });
      expect(res.body?.code).not.toBe(0);
    });
  });

  describe('发送账单', () => {
    it('TC-BILL-010: 发送账单（更新 sentAt）', async () => {
      const rId = await createRoom(app, auth, propertyId, { rent: 2000, name: 'bill-010' });
      await createTenant(app, auth, rId, {
        name: '发送',
        phone: '13900000010',
        moveInDate: `${currentMonthStr()}-01`,
      });
      const billId = await createManualBill(rId);

      const res = await apiCall(app, 'put', `/api/bills/${billId}/send`, auth, {});
      const data = expectOk(res);
      expect(data.sentAt).toBeTruthy();
    });
  });

  describe('权限隔离', () => {
    it('TC-BILL-011: 跨房东访问账单 → 403', async () => {
      const rId = await createRoom(app, auth, propertyId, { rent: 2000, name: 'bill-011' });
      await createTenant(app, auth, rId, {
        name: '跨房东',
        phone: '13900000011',
        moveInDate: `${currentMonthStr()}-01`,
      });
      const billId = await createManualBill(rId);

      const authB = await loginAsLandlord(app, `dev_billB_${Date.now()}`);
      const res = await apiCall(app, 'get', `/api/bills/${billId}`, authB);
      expect(res.body?.code).not.toBe(0);
    });
  });

  describe('分享页金额判定', () => {
    it('TC-BILL-012: 已付≥明细合计但<账单总额 → 不得判定已付清（隐藏收款码回归）', async () => {
      const rId = await createRoom(app, auth, propertyId, { rent: 2000, name: 'bill-012' });
      await createTenant(app, auth, rId, {
        name: '金额漂移',
        phone: '13900000012',
        moveInDate: `${currentMonthStr()}-01`,
      });
      const billId = await createManualBill(rId); // items 房租2000+水费50 = 2050

      // Simulate legacy total/items drift: stored total higher than item sum.
      const billRepo = app.get(getRepositoryToken(Bill));
      await billRepo.update(billId, { totalAmount: 2500 });

      // Pay exactly the item sum — previously this made the share page render
      // isPaid=true (QR hidden) even though 450 was still outstanding.
      await apiCall(app, 'put', `/api/bills/${billId}/confirm`, auth, { actualAmount: 2050 });

      const genRes = await apiCall(app, 'post', '/api/share/generate', auth, { billId });
      const token = expectOk(genRes).token;

      const shareRes = await apiCall(app, 'get', `/api/share/bill/${token}`, null);
      const data = expectOk(shareRes);
      expect(data.isPaid).toBe(false);
      expect(Number(data.totalAmount)).toBe(2500);
      expect(Number(data.paidAmount)).toBe(2050);
      expect(Number(data.outstandingAmount)).toBe(450);
    });
  });
});

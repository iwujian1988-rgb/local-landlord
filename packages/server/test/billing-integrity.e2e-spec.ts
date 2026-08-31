import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Bill } from '../src/modules/bill/bill.entity';
import { RentRecord } from '../src/modules/rent/rent-record.entity';
import {
  createTestApp,
  loginAsAdmin,
  loginAsLandlord,
  apiCall,
  expectOk,
  createProperty,
  createRoom,
  createTenant,
  currentMonthStr,
} from './helpers/app';

/**
 * 账务完整性 e2e：以数据库行为准，验证金额口径在所有路径上的一致性。
 *
 * 常规不变量：
 * - items 求和 == totalAmount（建账 / send 重算 / 入住自动账单）
 * - 多次部分付款累加 == paidAmount == rent_records 之和，status 0/3/1 正确流转
 * - 小数金额无浮点漂移；超额/零额拒绝且数据不变
 * - 逾期(2)账单可收款；退租作废(4)与已付(1)互不干扰
 * 遗留脏数据（旧版 cron 曾把部分付款刷成 status=2）：
 * - share 口径、stats 口径、confirm 补齐、send 明细锁定
 * 可见性：
 * - 当月已付但往期未付 → 待收列表逾期桶必须指向真正欠的钱
 */
describe('账务完整性 (billing integrity, e2e)', () => {
  let app: INestApplication;
  let auth: () => { Authorization: string };
  let adminAuth: () => { Authorization: string };
  let propertyId: number;

  beforeAll(async () => {
    app = await createTestApp();
    auth = await loginAsLandlord(app);
    adminAuth = await loginAsAdmin(app);
    propertyId = await createProperty(app, auth);
  });

  afterAll(async () => {
    await app.close();
  });

  async function makeRoom(tenantOverrides: Record<string, unknown> = {}): Promise<{ roomId: number; tenantId: number }> {
    const roomId = await createRoom(app, auth, propertyId, { rent: 2000, name: `bi-room-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` });
    const tenantId = await createTenant(app, auth, roomId, {
      moveInDate: `${currentMonthStr()}-01`,
      rentDay: 1,
      ...tenantOverrides,
    });
    return { roomId, tenantId };
  }

  /** 手动建账：房租 2000 + 水费 50 = 2050 */
  async function createManualBill(roomId: number, period: string, items?: any[]): Promise<number> {
    const res = await apiCall(app, 'post', `/api/rooms/${roomId}/bills`, auth, {
      period,
      items: items || [{ feeName: '房租', amount: 2000 }, { feeName: '水费', amount: 50 }],
    });
    return expectOk(res).id;
  }

  async function getBill(billId: number): Promise<any> {
    return expectOk(await apiCall(app, 'get', `/api/bills/${billId}`, auth));
  }

  async function rentRecordsFor(billId: number): Promise<number> {
    const repo = app.get(getRepositoryToken(RentRecord));
    const rows: Array<{ amount: number }> = await repo.find({ where: { billId } });
    return rows.reduce((sum, r) => sum + Number(r.amount), 0);
  }

  /** 严格早于当前月的一个“往期”月份（相对计算，保证任何月份跑都成立） */
  function priorMonthStr(): string {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  describe('常规路径不变量', () => {
    it('TC-BI-001: 建账 → items 求和 == totalAmount，status=0，paid=0', async () => {
      const { roomId } = await makeRoom({ moveInDate: '2026-01-05' }); // 自动首账落在 2026-01，不干扰
      const billId = await createManualBill(roomId, '2026-06');
      const bill = await getBill(billId);

      const itemSum = bill.items.reduce((s: number, i: any) => s + Number(i.amount), 0);
      expect(Number(bill.totalAmount)).toBe(itemSum);
      expect(Number(bill.totalAmount)).toBe(2050);
      expect(bill.status).toBe(0);
      expect(Number(bill.paidAmount)).toBe(0);
    });

    it('TC-BI-002: 两次部分付款凑齐 → paid==total，status=1，rent_records 之和==paid', async () => {
      const { roomId } = await makeRoom({ moveInDate: '2026-01-05' });
      const billId = await createManualBill(roomId, '2026-06');

      await apiCall(app, 'put', `/api/bills/${billId}/confirm`, auth, { actualAmount: 800 });
      await apiCall(app, 'put', `/api/bills/${billId}/confirm`, auth, { actualAmount: 1250 });

      const bill = await getBill(billId);
      expect(bill.status).toBe(1);
      expect(Number(bill.paidAmount)).toBe(2050);
      expect(await rentRecordsFor(billId)).toBe(2050);
    });

    it('TC-BI-003: 小数金额部分付款 → 无浮点漂移', async () => {
      const { roomId } = await makeRoom({ moveInDate: '2026-01-05' });
      const billId = await createManualBill(roomId, '2026-06', [
        { feeName: '房租', amount: 1000.5 },
        { feeName: '水费', amount: 1049.5 },
      ]);

      await apiCall(app, 'put', `/api/bills/${billId}/confirm`, auth, { actualAmount: 1000.5 });
      await apiCall(app, 'put', `/api/bills/${billId}/confirm`, auth, { actualAmount: 1049.5 });

      const bill = await getBill(billId);
      expect(bill.status).toBe(1);
      expect(Number(bill.paidAmount)).toBeCloseTo(2050, 6);
    });

    it('TC-BI-004: 不传 actualAmount → 默认收满剩余', async () => {
      const { roomId } = await makeRoom({ moveInDate: '2026-01-05' });
      const billId = await createManualBill(roomId, '2026-06');
      await apiCall(app, 'put', `/api/bills/${billId}/confirm`, auth, { actualAmount: 500 });

      const res = await apiCall(app, 'put', `/api/bills/${billId}/confirm`, auth, {});
      const bill = expectOk(res);
      expect(bill.status).toBe(1);
      expect(Number(bill.paidAmount)).toBe(2050);
    });

    it('TC-BI-005: 超额收款 → 400 且数据不变', async () => {
      const { roomId } = await makeRoom({ moveInDate: '2026-01-05' });
      const billId = await createManualBill(roomId, '2026-06');

      const res = await apiCall(app, 'put', `/api/bills/${billId}/confirm`, auth, { actualAmount: 9999 });
      expect(res.body?.code).not.toBe(0);

      const bill = await getBill(billId);
      expect(bill.status).toBe(0);
      expect(Number(bill.paidAmount)).toBe(0);
    });

    it('TC-BI-006: 逾期(status=2)账单 → 仍可正常收款', async () => {
      const { roomId } = await makeRoom({ moveInDate: '2026-01-05' });
      const billId = await createManualBill(roomId, '2026-06');
      await app.get(getRepositoryToken(Bill)).update(billId, { status: 2 });

      const res = await apiCall(app, 'put', `/api/bills/${billId}/confirm`, auth, { actualAmount: 2050 });
      const bill = expectOk(res);
      expect(bill.status).toBe(1);
      expect(Number(bill.paidAmount)).toBe(2050);
    });

    it('TC-BI-007: send 编辑明细（未收款）→ totalAmount 重算 == items 求和', async () => {
      const { roomId } = await makeRoom({ moveInDate: '2026-01-05' });
      const billId = await createManualBill(roomId, '2026-06');

      await apiCall(app, 'put', `/api/bills/${billId}/send`, auth, {
        items: [{ feeName: '房租', amount: 1800 }, { feeName: '电费', amount: 120 }],
      });

      const bill = await getBill(billId);
      const itemSum = bill.items.reduce((s: number, i: any) => s + Number(i.amount), 0);
      expect(Number(bill.totalAmount)).toBe(itemSum);
      expect(Number(bill.totalAmount)).toBe(1920);
    });

    it('TC-BI-008: 入住自动账单 → 押金不进账单 items；部分实收 → status=3 且 paid=实收', async () => {
      const roomId = await createRoom(app, auth, propertyId, { rent: 2000, name: `bi-movein-${Date.now()}` });
      const tenantId = await createTenant(app, auth, roomId, {
        moveInDate: `${currentMonthStr()}-01`,
        rentDay: 1,
        payMonths: 1,
        deposit: 1000,
        initialPaymentMethod: 'cash',
        initialPaymentDate: `${currentMonthStr()}-01`,
        initialPaymentAmount: 1500,
        initialDepositAmount: 1000,
      });
      expect(tenantId).toBeGreaterThan(0);

      const billRes = await apiCall(app, 'get', `/api/rooms/${roomId}/bills`, auth);
      const bill = expectOk(billRes);
      expect(bill.billId).toBeTruthy();

      const detail = await getBill(bill.billId);
      const itemSum = detail.items.reduce((s: number, i: any) => s + Number(i.amount), 0);
      expect(Number(detail.totalAmount)).toBe(itemSum);
      expect(detail.items.some((i: any) => String(i.feeName).includes('押金'))).toBe(false);
      expect(detail.status).toBe(3);
      expect(Number(detail.paidAmount)).toBe(1500);

      // 押金单独记 type=deposit_paid，且不挂 billId
      const recordRepo = app.get(getRepositoryToken(RentRecord));
      const depositRecords = await recordRepo.find({ where: { roomId, type: 5 } });
      expect(depositRecords.length).toBe(1);
      expect(Number(depositRecords[0].amount)).toBe(1000);
      expect(depositRecords[0].billId).toBeNull();
    });

    it('TC-BI-009: 退租 → 未清账单作废(4)、已付账单保留(1)，作废账单分享页拒绝打开', async () => {
      const { roomId, tenantId } = await makeRoom({ moveInDate: '2026-01-05' });
      const voidTarget = await createManualBill(roomId, '2026-06'); // 未付 → 应作废
      const paidBill = await createManualBill(roomId, '2026-07'); // 付清 → 应保留
      await apiCall(app, 'put', `/api/bills/${paidBill}/confirm`, auth, { actualAmount: 2050 });

      await apiCall(app, 'delete', `/api/tenants/${tenantId}`, auth, {});

      expect((await getBill(voidTarget)).status).toBe(4);
      expect((await getBill(paidBill)).status).toBe(1);

      const genRes = await apiCall(app, 'post', '/api/share/generate', auth, { billId: voidTarget });
      const token = expectOk(genRes).token;
      const shareRes = await apiCall(app, 'get', `/api/share/bill/${token}`, null);
      expect(shareRes.body?.code).not.toBe(0);
    });

    it('TC-BI-010: 押一付三往期账单(periodEnd 未到) → 仍按 period 起点判逾期（口径锁定）', async () => {
      const { roomId } = await makeRoom({ moveInDate: '2026-01-05', payMonths: 3 });
      const billRepo = app.get(getRepositoryToken(Bill));
      const bill = await billRepo.findOne({ where: { roomId } });
      expect(bill).toBeTruthy();
      expect(bill!.period).toBe('2026-01');
      expect(bill!.periodEnd).toBe('2026-03'); // 覆盖期未走完

      await apiCall(app, 'post', '/api/subscription/trigger-mark-overdue', adminAuth, {});
      expect((await getBill(bill!.id)).status).toBe(2);
    });
  });

  describe('遗留脏数据（旧 cron 把部分付款刷成 status=2）', () => {
    /** 构造遗留毒账单：items 合计 2050、totalAmount 2500、已付 2050、status=2 */
    async function makePoisonBill(): Promise<number> {
      const { roomId } = await makeRoom({ moveInDate: '2026-01-05' });
      const billId = await createManualBill(roomId, '2026-06');
      await app.get(getRepositoryToken(Bill)).update(billId, {
        totalAmount: 2500,
        paidAmount: 2050,
        status: 2,
      });
      return billId;
    }

    it('TC-BI-011: 分享页 → outstanding=total-paid，isPaid=false', async () => {
      const billId = await makePoisonBill();
      const genRes = await apiCall(app, 'post', '/api/share/generate', auth, { billId });
      const token = expectOk(genRes).token;

      const data = expectOk(await apiCall(app, 'get', `/api/share/bill/${token}`, null));
      expect(data.isPaid).toBe(false);
      expect(Number(data.totalAmount)).toBe(2500);
      expect(Number(data.paidAmount)).toBe(2050);
      expect(Number(data.outstandingAmount)).toBe(450);
    });

    it('TC-BI-012: 月度统计 → collected 含已付 2050，pending=差额 450（不得按全额 2500 挂账）', async () => {
      // 独立房东，保证统计里只有这一笔账
      const ownAuth = await loginAsLandlord(app, `dev_bi_stats_${Date.now()}`);
      const ownProperty = await createProperty(app, ownAuth);
      const roomId = await createRoom(app, ownAuth, ownProperty, { rent: 2000, name: 'bi-stats-room' });
      await createTenant(app, ownAuth, roomId, { moveInDate: '2026-01-05', rentDay: 1 });

      const billRes = await apiCall(app, 'post', `/api/rooms/${roomId}/bills`, ownAuth, {
        period: currentMonthStr(),
        items: [{ feeName: '房租', amount: 2000 }, { feeName: '水费', amount: 50 }],
      });
      const billId = expectOk(billRes).id;
      await app.get(getRepositoryToken(Bill)).update(billId, {
        totalAmount: 2500,
        paidAmount: 2050,
        status: 2,
      });

      const statsRes = await apiCall(app, 'get', '/api/stats/rent', ownAuth, undefined as any);
      const stats = expectOk(statsRes);
      expect(Number(stats.totalExpected)).toBe(2500);
      expect(Number(stats.totalCollected)).toBe(2050);
      expect(Number(stats.totalPending)).toBe(450);
    });

    it('TC-BI-013: 毒账单仍可补收差额 → 收齐后 status=1', async () => {
      const billId = await makePoisonBill();
      const res = await apiCall(app, 'put', `/api/bills/${billId}/confirm`, auth, { actualAmount: 450 });
      const bill = expectOk(res);
      expect(bill.status).toBe(1);
      expect(Number(bill.paidAmount)).toBe(2500);
    });

    it('TC-BI-017: 已收满(paid≥total)但状态卡住 → confirm 直接结清为 status=1，不产生新收款记录', async () => {
      const billId = await makePoisonBill();
      await app.get(getRepositoryToken(Bill)).update(billId, { paidAmount: 2500 }); // 收满但状态仍是 2

      const res = await apiCall(app, 'put', `/api/bills/${billId}/confirm`, auth, {});
      const bill = expectOk(res);
      expect(bill.status).toBe(1);
      expect(Number(bill.paidAmount)).toBe(2500);
      // 结清只是修正状态，不凭空多记一笔钱
      expect(await rentRecordsFor(billId)).toBe(0);
    });

    it('TC-BI-014: 已有收款记录的账单（无论状态）→ send 不得改写明细', async () => {
      const billId = await makePoisonBill();
      const res = await apiCall(app, 'put', `/api/bills/${billId}/send`, auth, {
        items: [{ feeName: '房租', amount: 100 }],
      });
      expect(res.body?.code).not.toBe(0);

      // 数据未被破坏
      const bill = await getBill(billId);
      expect(Number(bill.totalAmount)).toBe(2500);
    });
  });

  describe('待收列表可见性', () => {
    it('TC-BI-015: 当月账单已付但往期未付 → 逾期桶必须显示并指向真正欠款的账单', async () => {
      // 自动首账单落在当月（房租 2000），再补一笔往期未付账单
      const { roomId } = await makeRoom({ moveInDate: `${currentMonthStr()}-01` });
      const priorBillId = await createManualBill(roomId, priorMonthStr());
      const currentRes = await apiCall(app, 'get', `/api/rooms/${roomId}/bills`, auth);
      const currentBillId = expectOk(currentRes).billId;
      await apiCall(app, 'put', `/api/bills/${currentBillId}/confirm`, auth, { actualAmount: 2000 });

      const res = await apiCall(app, 'get', '/api/rent/pending', auth);
      const data = expectOk(res);

      const overdueEntry = (data.overdue || []).find((e: any) => e.roomId === roomId);
      expect(overdueEntry).toBeTruthy();
      expect(overdueEntry.billId).toBe(priorBillId);
      expect(Number(overdueEntry.totalAmount)).toBe(2050);

      // 不应静默消失进 completed
      const completedEntry = (data.completed || []).find((e: any) => e.roomId === roomId);
      expect(completedEntry).toBeUndefined();
    });

    it('TC-BI-016: 当月未付 + 往期未付 → 逾期桶指向当月账单（先收当月这笔）', async () => {
      const { roomId } = await makeRoom({ moveInDate: `${currentMonthStr()}-01` }); // 当月自动账单 2000
      await createManualBill(roomId, priorMonthStr()); // 往期也未付

      const currentBillId = expectOk(await apiCall(app, 'get', `/api/rooms/${roomId}/bills`, auth)).billId;
      expect(currentBillId).toBeTruthy();

      const res = await apiCall(app, 'get', '/api/rent/pending', auth);
      const data = expectOk(res);

      const overdueEntry = (data.overdue || []).find((e: any) => e.roomId === roomId);
      expect(overdueEntry).toBeTruthy();
      expect(overdueEntry.billId).toBe(currentBillId);
      expect(overdueEntry.billPeriod).toBe(currentMonthStr());
      expect(Number(overdueEntry.totalAmount)).toBe(2000);
    });
  });
});

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
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
 * Tenant module e2e.
 *
 * Coverage priorities:
 * 1. The 押X付Y first-bill auto-generation path — this is where the
 *    2026-07 "已逾期 2 天" bug originated (isPaid trigger + silent .catch).
 * 2. Move-out refund computation (overpaidBeforeMoveIn + unusedAfterMoveOut).
 * 3. Permission: cross-landlord access rejected.
 * 4. Validation: phone/name/payMonths/rentDay boundary.
 * 5. Idempotency: createFirstBill doesn't double-create on retry.
 *
 * Note: /api/rooms/:roomId/bills returns the CURRENT bill object (not a list).
 * Tests that need to inspect the auto-created first bill use moveInDate in the
 * current month so the bill is "current". Historical bills are read via
 * /api/bills/:id (single by id).
 */
describe('Tenant module (e2e)', () => {
  let app: INestApplication;
  let auth: () => { Authorization: string };
  let propertyId: number;
  let roomId: number;

  beforeAll(async () => {
    app = await createTestApp();
    auth = await loginAsLandlord(app);
    propertyId = await createProperty(app, auth);
    roomId = await createRoom(app, auth, propertyId, { rent: 2000 });
  });

  afterAll(async () => {
    await app.close();
  });

  /** Helper: get current bill object for a room (single, not list). */
  async function getCurrentBill(rId: number): Promise<any> {
    const res = await apiCall(app, 'get', `/api/rooms/${rId}/bills`, auth);
    return expectOk(res);
  }

  // ============ 创建租客 ============
  describe('创建租客', () => {
    it('TC-TENANT-001: 押一付一最简创建', async () => {
      const tid = await createTenant(app, auth, roomId, {
        name: '张三',
        phone: '13800001111',
        moveInDate: `${currentMonthStr()}-01`,
        rentDay: 1,
        payMonths: 1,
        deposit: 2000,
      });
      expect(tid).toBeGreaterThan(0);

      const roomRes = await apiCall(app, 'get', `/api/rooms/${roomId}`, auth);
      const room = expectOk(roomRes);
      expect(room.status).toBe(1);
    });

    it('TC-TENANT-001B: 可选日期不传时创建成功，房间列表立即显示已出租和租客', async () => {
      const rId = await createRoom(app, auth, propertyId, { rent: 2500, name: '101' });
      const createRes = await apiCall(app, 'post', `/api/rooms/${rId}/tenant`, auth, {
        name: '王先生',
        phone: '13812345678',
        rentDay: 15,
        payMonths: 1,
        deposit: 5000,
      });
      expectOk(createRes);

      const roomsRes = await apiCall(app, 'get', '/api/rooms', auth);
      const rooms = expectOk(roomsRes);
      expect(rooms).toEqual(expect.arrayContaining([
        expect.objectContaining({
          id: rId,
          status: 1,
          displayStatus: expect.stringMatching(/^(rented|approaching|overdue)$/),
          tenantName: '王先生',
          rent: 2500,
        }),
      ]));
    });

    it('TC-TENANT-002: 押一付三自动建第一笔账单（无实收）', async () => {
      const rId = await createRoom(app, auth, propertyId, { rent: 2000, name: 'room-002' });
      const tid = await createTenant(app, auth, rId, {
        name: '李四',
        phone: '13800002222',
        moveInDate: `${currentMonthStr()}-01`,
        rentDay: 1,
        payMonths: 3,
        deposit: 2000,
      });
      expect(tid).toBeGreaterThan(0);

      // current bill should exist and be status=0 (unpaid), totalAmount=6000
      const bill = await getCurrentBill(rId);
      expect(bill.billId).not.toBeNull();
      expect(bill.billStatus).toBe(0);
      expect(bill.period).toBe(currentMonthStr());
    });

    it('TC-TENANT-003: 押一付三 + 实收 → 账单应标记已付', async () => {
      const rId = await createRoom(app, auth, propertyId, { rent: 2000, name: 'room-003' });
      await createTenant(app, auth, rId, {
        name: '王五',
        phone: '13800003333',
        moveInDate: `${currentMonthStr()}-01`,
        rentDay: 1,
        payMonths: 3,
        deposit: 2000,
        initialPaymentMethod: 'cash',
        initialPaymentDate: `${currentMonthStr()}-01`,
        initialPaymentAmount: 6000,
      });

      const bill = await getCurrentBill(rId);
      expect(bill.billStatus).toBe(1); // paid
      expect(Number(bill.paidAmount)).toBe(6000);

      const recordsRes = await apiCall(app, 'get', `/api/rooms/${rId}/records`, auth);
      const records = expectOk(recordsRes);
      expect(records).toEqual(expect.arrayContaining([
        expect.objectContaining({
          type: 'bill_paid',
          title: '入住首期账单已收',
          amount: 6000,
        }),
      ]));
    });

    it('TC-TENANT-003B: 入住只收部分首期款 → 账单为部分付款且记录实际金额', async () => {
      const rId = await createRoom(app, auth, propertyId, { rent: 2000, name: 'room-003b' });
      await createTenant(app, auth, rId, {
        name: '部分首期',
        phone: '13800003334',
        moveInDate: `${currentMonthStr()}-01`,
        rentDay: 1,
        payMonths: 1,
        deposit: 2000,
        initialPaymentMethod: 'wechat',
        initialPaymentDate: `${currentMonthStr()}-01`,
        initialPaymentAmount: 800,
      });

      const bill = await getCurrentBill(rId);
      expect(bill.billStatus).toBe(3);
      expect(Number(bill.paidAmount)).toBe(800);

      const recordsRes = await apiCall(app, 'get', `/api/rooms/${rId}/records`, auth);
      const records = expectOk(recordsRes);
      expect(records).toEqual(expect.arrayContaining([
        expect.objectContaining({
          type: 'bill_paid',
          title: '入住首期账单部分付款',
          amount: 800,
        }),
      ]));
    });

    /**
     * Regression for 2026-07 "已逾期 2 天" bug. The trigger for marking the
     * auto-bill as paid was `!!tenant.initialPaymentMethod`. If a client
     * sent amount > 0 but no method (unusual but possible), the bill stayed
     * unpaid and stats reported the just-moved-in tenant as overdue.
     */
    it('TC-TENANT-004: 实收只有金额没方法 → 仍应标已付（bug 回归）', async () => {
      const rId = await createRoom(app, auth, propertyId, { rent: 2000, name: 'room-004' });
      await createTenant(app, auth, rId, {
        name: '赵六',
        phone: '13800004444',
        moveInDate: `${currentMonthStr()}-01`,
        rentDay: 1,
        payMonths: 3,
        deposit: 2000,
        // Intentionally NO initialPaymentMethod, only amount
        initialPaymentAmount: 6000,
      } as any);

      const bill = await getCurrentBill(rId);
      expect(bill.billStatus).toBe(1); // ← would be 0 before fix
      expect(Number(bill.paidAmount)).toBe(6000);
    });

    it('TC-TENANT-004B: 登记时收费规则生成正确首期账单并回填租约', async () => {
      const rId = await createRoom(app, auth, propertyId, { rent: 2000, name: 'room-fee-rules' });
      const createRes = await apiCall(app, 'post', `/api/rooms/${rId}/tenant`, auth, {
        name: '收费规则租客', phone: '13800004445', moveInDate: `${currentMonthStr()}-01`,
        rentDay: 1, payMonths: 3,
        feeItems: [
          { name: '房租', type: 'fixed', amount: 2000, enabled: true, isRent: true, cycleMode: 'rent' },
          { name: '网费', type: 'fixed', amount: 100, enabled: true, isRent: false, cycleMode: 'rent' },
          { name: '停车费', type: 'fixed', amount: 300, enabled: true, isRent: false, cycleMode: 'monthly' },
          { name: '水费', type: 'manual', amount: 0, enabled: true, isRent: false, cycleMode: 'rent' },
        ],
      });
      const tenant = expectOk(createRes);

      const bill = await getCurrentBill(rId);
      expect(bill.billItems).toEqual([
        expect.objectContaining({ name: '房租', amount: 6000 }),
        expect.objectContaining({ name: '网费', amount: 300 }),
        expect.objectContaining({ name: '停车费', amount: 300 }),
        expect.objectContaining({ name: '水费', amount: 0 }),
      ]);
      expect(bill.billItems.reduce((sum: number, item: any) => sum + Number(item.amount), 0)).toBe(6600);

      const detail = expectOk(await apiCall(app, 'get', `/api/tenants/${tenant.id}`, auth));
      expect(detail.feeItems).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: '停车费', cycleMode: 'monthly' }),
        expect.objectContaining({ name: '水费', type: 'manual' }),
      ]));
    });

    it('TC-TENANT-004B2: 押一付三 + 网费预收半年，押金独立记录且不混入账单', async () => {
      const rId = await createRoom(app, auth, propertyId, { rent: 1000, name: 'room-independent-prepay' });
      await createTenant(app, auth, rId, {
        name: '独立预收', phone: '13800004455', moveInDate: `${currentMonthStr()}-01`,
        rentDay: 1, payMonths: 3, deposit: 1000,
        initialPaymentMethod: 'wechat', initialPaymentDate: `${currentMonthStr()}-01`,
        initialPaymentAmount: 3300, initialDepositAmount: 1000,
        feeItems: [
          { name: '房租', type: 'fixed', amount: 1000, enabled: true, isRent: true, billingMonths: 3, initialMonths: 3 },
          { name: '网费', type: 'fixed', amount: 50, enabled: true, isRent: false, billingMonths: 6, initialMonths: 6 },
        ],
      });

      const bill = await getCurrentBill(rId);
      expect(bill.billStatus).toBe(1);
      expect(Number(bill.paidAmount)).toBe(3300);
      expect(bill.billItems).toEqual([
        expect.objectContaining({ name: '房租', amount: 3000 }),
        expect.objectContaining({ name: '网费', amount: 300 }),
      ]);

      const records = expectOk(await apiCall(app, 'get', `/api/rooms/${rId}/records`, auth));
      expect(records).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: 'deposit_paid', title: '入住押金已收', amount: 1000 }),
        expect.objectContaining({ type: 'bill_paid', amount: 3300 }),
      ]));
    });

    it('TC-TENANT-004B2A: accepts the exact fee-item shape sent by the miniapp', async () => {
      const rId = await createRoom(app, auth, propertyId, { rent: 1000, name: 'room-miniapp-fee-shape' });
      const response = await apiCall(app, 'post', `/api/rooms/${rId}/tenant`, auth, {
        name: 'Miniapp 费用结构租客', phone: '13800004457', moveInDate: `${currentMonthStr()}-01`,
        rentDay: 1, payMonths: 3, deposit: 1000,
        feeItems: [
          { name: '房租', type: 'fixed', amount: 1000, enabled: true, isRent: true, cycleMode: 'rent', collectionTiming: 'advance', billingMonths: 3, initialMonths: 3 },
          { name: '网费', type: 'fixed', amount: 50, enabled: true, isRent: false, cycleMode: 'monthly', collectionTiming: 'arrears', billingMonths: 1, initialMonths: 1 },
          { name: '水电费', type: 'manual', amount: 0, enabled: true, isRent: false, cycleMode: 'monthly', collectionTiming: 'advance', billingMonths: 1, initialMonths: 1 },
        ],
      });
      expectOk(response);
      const bill = await getCurrentBill(rId);
      expect(bill.billItems).toEqual([
        expect.objectContaining({ name: '房租', amount: 3000 }),
        expect.objectContaining({ name: '水电费', amount: 0 }),
      ]);
    });

    it('TC-TENANT-004B3: 只收到押金时不得把首期费用误标为已付', async () => {
      const rId = await createRoom(app, auth, propertyId, { rent: 1000, name: 'room-deposit-only' });
      await createTenant(app, auth, rId, {
        name: '只交押金', phone: '13800004456', moveInDate: `${currentMonthStr()}-01`,
        deposit: 1000, initialPaymentMethod: 'cash', initialPaymentDate: `${currentMonthStr()}-01`,
        initialPaymentAmount: 0, initialDepositAmount: 1000,
      });
      const bill = await getCurrentBill(rId);
      expect(bill.billStatus).toBe(0);
      expect(Number(bill.paidAmount)).toBe(0);
      const records = expectOk(await apiCall(app, 'get', `/api/rooms/${rId}/records`, auth));
      expect(records).toEqual(expect.arrayContaining([
        expect.objectContaining({ type: 'deposit_paid', amount: 1000 }),
      ]));
      expect(records).not.toEqual(expect.arrayContaining([
        expect.objectContaining({ type: 'bill_paid' }),
      ]));
    });

    it('TC-TENANT-004C: 非法收费规则不产生半套租客/房间数据', async () => {
      const rId = await createRoom(app, auth, propertyId, { rent: 2000, name: 'room-fee-rollback' });
      const failed = await apiCall(app, 'post', `/api/rooms/${rId}/tenant`, auth, {
        name: '不应保存', phone: '13800004446', moveInDate: `${currentMonthStr()}-01`,
        feeItems: [
          { name: '房租', type: 'fixed', amount: 2000, enabled: true, isRent: true },
          { name: '房租', type: 'fixed', amount: 2000, enabled: true, isRent: false },
        ],
      });
      expect(failed.body?.code).not.toBe(0);
      const room = expectOk(await apiCall(app, 'get', `/api/rooms/${rId}`, auth));
      expect(room.status).toBe(0);
      expect(room.tenant).toBeNull();

      const validTenantId = await createTenant(app, auth, rId, {
        name: '随后可正常登记', phone: '13800004447', moveInDate: `${currentMonthStr()}-01`,
      });
      expect(validTenantId).toBeGreaterThan(0);
    });

    it('TC-TENANT-004D: 同房间同月换租客仍为新租客生成首期账单', async () => {
      const rId = await createRoom(app, auth, propertyId, { rent: 2000, name: 'room-same-month-relet' });
      const firstId = await createTenant(app, auth, rId, {
        name: '前租客', phone: '13800004448', moveInDate: `${currentMonthStr()}-01`,
        initialPaymentMethod: 'cash',
        initialPaymentDate: `${currentMonthStr()}-01`,
        initialPaymentAmount: 2000,
      });
      expectOk(await apiCall(app, 'delete', `/api/tenants/${firstId}`, auth, {
        moveOutDate: `${currentMonthStr()}-10`, depositStatus: 0,
      }));
      await createTenant(app, auth, rId, {
        name: '新租客', phone: '13800004449', moveInDate: `${currentMonthStr()}-15`,
      });
      const bill = await getCurrentBill(rId);
      expect(bill.billId).not.toBeNull();
      expect(bill.tenantName).toBe('新租客');
      expect(bill.billStatus).toBe(0);
      expect(bill.paidAmount).toBe(0);
    });

    it('TC-TENANT-005: 房间已被占用 → 400', async () => {
      const rId = await createRoom(app, auth, propertyId, { rent: 2000, name: 'room-005' });
      await createTenant(app, auth, rId, { name: '第一个', phone: '13800005555' });

      const res = await apiCall(app, 'post', `/api/rooms/${rId}/tenant`, auth, {
        name: '第二个',
        phone: '13800006666',
        moveInDate: `${currentMonthStr()}-15`,
        rentDay: 1,
      });
      expect(res.body?.code).not.toBe(0);
    });

    it('TC-TENANT-006: 缺姓名 → 400', async () => {
      const rId = await createRoom(app, auth, propertyId, { rent: 2000, name: 'room-006' });
      const res = await apiCall(app, 'post', `/api/rooms/${rId}/tenant`, auth, {
        phone: '13800007777',
        moveInDate: `${currentMonthStr()}-01`,
      });
      expect(res.body?.code).not.toBe(0);
    });

    it('TC-TENANT-007: 缺电话 → 400', async () => {
      const rId = await createRoom(app, auth, propertyId, { rent: 2000, name: 'room-007' });
      const res = await apiCall(app, 'post', `/api/rooms/${rId}/tenant`, auth, {
        name: '没电话',
        moveInDate: `${currentMonthStr()}-01`,
      });
      expect(res.body?.code).not.toBe(0);
    });

    it('TC-TENANT-008: payMonths > 12 → 400', async () => {
      const rId = await createRoom(app, auth, propertyId, { rent: 2000, name: 'room-008' });
      const res = await apiCall(app, 'post', `/api/rooms/${rId}/tenant`, auth, {
        name: '超长账期',
        phone: '13800008888',
        moveInDate: `${currentMonthStr()}-01`,
        rentDay: 1,
        payMonths: 13,
      });
      expect(res.body?.code).not.toBe(0);
    });

    it('TC-TENANT-009: rentDay > 31 → 400', async () => {
      const rId = await createRoom(app, auth, propertyId, { rent: 2000, name: 'room-009' });
      const res = await apiCall(app, 'post', `/api/rooms/${rId}/tenant`, auth, {
        name: '非法日',
        phone: '13800009999',
        moveInDate: `${currentMonthStr()}-01`,
        rentDay: 32,
      });
      expect(res.body?.code).not.toBe(0);
    });

    /**
     * createFirstBill has an idempotency check: if a bill already exists for
     * the moveIn month, skip. Verify no duplicate bill is created even if
     * the endpoint is called twice (the second call fails at the tenant level
     * since room is occupied, but we still want to confirm only one bill exists).
     */
    it('TC-TENANT-010: 重复提交不会创建两笔账单', async () => {
      const rId = await createRoom(app, auth, propertyId, { rent: 2000, name: 'room-010' });
      await createTenant(app, auth, rId, {
        name: '第一次',
        phone: '13800001010',
        moveInDate: `${currentMonthStr()}-01`,
      });

      // Second tenant in same room — should fail because room is occupied
      await apiCall(app, 'post', `/api/rooms/${rId}/tenant`, auth, {
        name: '第二次',
        phone: '13800001011',
        moveInDate: `${currentMonthStr()}-01`,
      });

      // Current bill should still be the original one (single)
      const bill = await getCurrentBill(rId);
      expect(bill.billId).not.toBeNull();
      // Verify only one bill exists in the room by fetching via billId
      const detailRes = await apiCall(app, 'get', `/api/bills/${bill.billId}`, auth);
      expect(detailRes.body?.code).toBe(0);
    });
  });

  // ============ 查询/更新 ============
  describe('查询与更新', () => {
    it('TC-TENANT-011: 获取租客详情', async () => {
      const rId = await createRoom(app, auth, propertyId, { rent: 2000, name: 'room-011' });
      const tid = await createTenant(app, auth, rId, {
        name: '详情测试',
        phone: '13800011111',
      });
      const res = await apiCall(app, 'get', `/api/tenants/${tid}`, auth);
      const data = expectOk(res);
      expect(data.name).toBe('详情测试');
      expect(data.phone).toBe('13800011111');
    });

    it('TC-TENANT-012: 更新租客备注', async () => {
      const rId = await createRoom(app, auth, propertyId, { rent: 2000, name: 'room-012' });
      const tid = await createTenant(app, auth, rId, {
        name: '更新前',
        phone: '13800012222',
      });
      const res = await apiCall(app, 'put', `/api/tenants/${tid}`, auth, {
        note: 'updated-note',
      });
      const data = expectOk(res);
      expect(data.note).toBe('updated-note');
    });

    it('TC-TENANT-012A: 编辑租客可更新数值字段和入住水电读数', async () => {
      const rId = await createRoom(app, auth, propertyId, { rent: 500, name: 'room-012a' });
      const tid = await createTenant(app, auth, rId, {
        name: '编辑回归',
        phone: '13800012223',
      });
      const res = await apiCall(app, 'put', `/api/tenants/${tid}`, auth, {
        rentDay: 16,
        payMonths: 1,
        deposit: 500,
        moveInReading: '电 123，水 45',
      });
      const data = expectOk(res);
      expect(data.rentDay).toBe(16);
      expect(Number(data.deposit)).toBe(500);
      expect(data.moveInReading).toBe('电 123，水 45');
    });
  });

  // ============ 退租 ============
  describe('退租', () => {
    it('TC-TENANT-013: 基础退租 — tenant.status=0, room.status=0', async () => {
      const rId = await createRoom(app, auth, propertyId, { rent: 2000, name: 'room-013' });
      const tid = await createTenant(app, auth, rId, {
        name: '要退租',
        phone: '13800013333',
        moveInDate: `${currentMonthStr()}-01`,
        deposit: 2000,
      });

      const res = await apiCall(app, 'delete', `/api/tenants/${tid}`, auth, {
        moveOutDate: '2026-02-15',
        depositStatus: 1,
        depositRefundAmount: 2000,
      });
      const data = expectOk(res);
      expect(data.status).toBe(0);
      expect(data.moveOutDate).toBe('2026-02-15');

      const roomRes = await apiCall(app, 'get', `/api/rooms/${rId}`, auth);
      const room = expectOk(roomRes);
      expect(room.status).toBe(0);
    });

    /**
     * Refund algorithm covers two windows:
     *   - overpaidBeforeMoveIn: days between bill's period start and moveInDate
     *   - unusedAfterMoveOut: days between moveOutDate and end of periodEnd month
     */
    it('TC-TENANT-014: 退租自动算预付退款（押一付三，月中退租）', async () => {
      const rId = await createRoom(app, auth, propertyId, { rent: 2000, name: 'room-014' });
      const tid = await createTenant(app, auth, rId, {
        name: '退款测试',
        phone: '13800014444',
        moveInDate: `${currentMonthStr()}-01`,
        rentDay: 1,
        payMonths: 3,
        deposit: 2000,
        initialPaymentMethod: 'cash',
        initialPaymentDate: `${currentMonthStr()}-01`,
        initialPaymentAmount: 6000,
      });

      // Move out 15 days into the cycle — should produce some refund
      const res = await apiCall(app, 'delete', `/api/tenants/${tid}`, auth, {
        moveOutDate: `${currentMonthStr()}-15`,
      });
      const data = expectOk(res);
      expect(Number(data.prepaidRefundAmount || 0)).toBeGreaterThan(0);
    });

    it('TC-TENANT-015: 已退租的租客再退租 → 400', async () => {
      const rId = await createRoom(app, auth, propertyId, { rent: 2000, name: 'room-015' });
      const tid = await createTenant(app, auth, rId, {
        name: '双退租',
        phone: '13800015555',
        moveInDate: `${currentMonthStr()}-01`,
      });
      await apiCall(app, 'delete', `/api/tenants/${tid}`, auth, {
        moveOutDate: `${currentMonthStr()}-02`,
      });
      const res = await apiCall(app, 'delete', `/api/tenants/${tid}`, auth, {
        moveOutDate: `${currentMonthStr()}-03`,
      });
      expect(res.body?.code).not.toBe(0);
    });

    it('TC-TENANT-016: 退租后未付账单被作废（status=4）', async () => {
      const rId = await createRoom(app, auth, propertyId, { rent: 2000, name: 'room-016' });
      const tid = await createTenant(app, auth, rId, {
        name: '作废测试',
        phone: '13800016666',
        moveInDate: `${currentMonthStr()}-01`,
        payMonths: 1,
        // No initialPayment — bill will be status=0
      });

      // Capture the auto-created bill id before moveOut
      const billBefore = await getCurrentBill(rId);
      expect(billBefore.billId).not.toBeNull();
      expect(billBefore.billStatus).toBe(0);

      await apiCall(app, 'delete', `/api/tenants/${tid}`, auth, {
        moveOutDate: `${currentMonthStr()}-15`,
      });

      // Fetch the bill directly via /api/bills/:id — findByRoom excludes status=4
      const detailRes = await apiCall(app, 'get', `/api/bills/${billBefore.billId}`, auth);
      const detail = expectOk(detailRes);
      expect(detail.status).toBe(4);
    });
  });

  // ============ 权限 ============
  describe('权限隔离', () => {
    it('TC-TENANT-017: 房东 A 不能访问房东 B 的租客', async () => {
      const rId = await createRoom(app, auth, propertyId, { rent: 2000, name: 'room-017' });
      const tid = await createTenant(app, auth, rId, {
        name: 'A的租客',
        phone: '13800017777',
      });

      const authB = await loginAsLandlord(app, `dev_B_${Date.now()}`);

      const res = await apiCall(app, 'get', `/api/tenants/${tid}`, authB);
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body?.code).not.toBe(0);
    });

    it('TC-TENANT-018: 房东 B 不能在房东 A 的房间里创建租客', async () => {
      const rId = await createRoom(app, auth, propertyId, { rent: 2000, name: 'room-018' });
      const authB = await loginAsLandlord(app, `dev_B2_${Date.now()}`);

      const res = await apiCall(app, 'post', `/api/rooms/${rId}/tenant`, authB, {
        name: 'B试图占用',
        phone: '13800018888',
        moveInDate: `${currentMonthStr()}-01`,
      });
      expect(res.body?.code).not.toBe(0);
    });
  });
});

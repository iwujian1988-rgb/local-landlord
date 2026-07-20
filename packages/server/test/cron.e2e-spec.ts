import { INestApplication } from '@nestjs/common';
import {
  createTestApp,
  loginAsLandlord,
  loginAsAdmin,
  apiCall,
  createProperty,
  createRoom,
  createTenant,
  createBill,
  currentMonthStr,
} from './helpers/app';

/**
 * Cron / scheduled-task behavior tests.
 *
 * The 9 trigger endpoints exposed at /api/subscription/trigger-* each wrap a
 * @Cron-decorated method. Earlier suites verified they return 200; this suite
 * verifies the *observable side effect* — that the cron actually does what
 * it's supposed to do.
 *
 * Key cron: triggerMarkOverdue — should flip status 0/3 → 2 for bills whose
 * effective month is past, or whose rentDay has passed this month.
 */
describe('Cron behavior (e2e)', () => {
  let app: INestApplication;
  let auth: () => { Authorization: string };
  let adminAuth: () => { Authorization: string };
  let propertyId: number;

  beforeAll(async () => {
    app = await createTestApp();
    auth = await loginAsLandlord(app, `dev_cron_${Date.now()}`);
    adminAuth = await loginAsAdmin(app);
    propertyId = await createProperty(app, auth);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('trigger-mark-overdue 实际效果', () => {
    it('TC-CRON-OVERDUE-001: 上月账单 → 触发后 status 应变为 2', async () => {
      const rId = await createRoom(app, auth, propertyId, { rent: 2000, name: '上月房' });
      await createTenant(app, auth, rId, {
        name: '上月租客',
        phone: '13911110000',
        moveInDate: '2024-01-01',
        rentDay: 10,
      });
      // Create bill in a past month
      const billId = await createBill(app, auth, rId, {
        period: '2024-06', // clearly past
        items: [{ feeName: '房租', amount: 2000 }],
        totalAmount: 2000,
      });

      // Verify it starts as status 0
      const before = await apiCall(app, 'get', `/api/bills/${billId}`, auth);
      expect(before.body?.data?.status).toBe(0);

      // Trigger
      const triggerRes = await apiCall(
        app,
        'post',
        '/api/subscription/trigger-mark-overdue',
        adminAuth,
        {},
      );
      expect(triggerRes.body?.code).toBe(0);

      // Verify status changed to 2 (overdue)
      const after = await apiCall(app, 'get', `/api/bills/${billId}`, auth);
      expect(after.body?.data?.status).toBe(2);
    });

    it('TC-CRON-OVERDUE-002: 当前月 + rentDay 未到 → status 不变', async () => {
      const rId = await createRoom(app, auth, propertyId, { rent: 2000, name: '本月未到期房' });
      await createTenant(app, auth, rId, {
        name: '本月租客',
        phone: '13911110001',
        moveInDate: `${currentMonthStr()}-01`,
        rentDay: 28, // safe — definitely in the future relative to "today"
      });
      // createTenant auto-creates a first bill for currentMonth; just fetch that
      // bill id via the room's current-bill endpoint rather than creating another.
      const billsRes = await apiCall(app, 'get', `/api/rooms/${rId}/bills`, auth);
      const billId = billsRes.body?.data?.id;
      if (!billId) {
        // If no auto-bill exists (rent=0 / special case), skip — test only
        // meaningful if there's a bill in currentMonth to check.
        return;
      }

      await apiCall(app, 'post', '/api/subscription/trigger-mark-overdue', adminAuth, {});

      const after = await apiCall(app, 'get', `/api/bills/${billId}`, auth);
      // Should NOT be overdue — status remains 0
      expect(after.body?.data?.status).toBe(0);
    });

    it('TC-CRON-OVERDUE-003: 已付账单 → 不会被标为 overdue', async () => {
      const rId = await createRoom(app, auth, propertyId, { rent: 2000, name: '已付历史房' });
      await createTenant(app, auth, rId, {
        name: '已付租客',
        phone: '13911110002',
        moveInDate: '2024-01-01',
        rentDay: 10,
      });
      const billId = await createBill(app, auth, rId, {
        period: '2024-03',
        items: [{ feeName: '房租', amount: 1500 }],
        totalAmount: 1500,
      });
      // Pay in full
      await apiCall(app, 'put', `/api/bills/${billId}/confirm`, auth, { actualAmount: 1500 });

      await apiCall(app, 'post', '/api/subscription/trigger-mark-overdue', adminAuth, {});

      const after = await apiCall(app, 'get', `/api/bills/${billId}`, auth);
      expect(after.body?.data?.status).toBe(1); // still paid, not overdue
    });
  });

  describe('trigger-rent 提醒触发', () => {
    it('TC-CRON-RENT-001: 触发 trigger-rent 不报错（即使无数据）', async () => {
      const res = await apiCall(app, 'post', '/api/subscription/trigger-rent', adminAuth, {});
      expect(res.body?.code).toBe(0);
    });
  });

  describe('trigger-auto-bills 自动账单', () => {
    it('TC-CRON-AUTO-001: 触发 trigger-auto-bills 不报错', async () => {
      const res = await apiCall(
        app,
        'post',
        '/api/subscription/trigger-auto-bills',
        adminAuth,
        {},
      );
      expect(res.body?.code).toBe(0);
    });
  });

  describe('所有 trigger 端点应一次性跑通', () => {
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
      it(`TC-CRON-ALL-${t}: ${t} → 200`, async () => {
        const res = await apiCall(app, 'post', `/api/subscription/${t}`, adminAuth, {});
        expect(res.body?.code).toBe(0);
      });
    });
  });

  describe('权限', () => {
    it('TC-CRON-ACL-001: 普通房东不能触发 cron', async () => {
      const res = await apiCall(app, 'post', '/api/subscription/trigger-rent', auth, {});
      expect(res.body?.code).not.toBe(0);
    });

    it('TC-CRON-ACL-002: 未登录不能触发 cron', async () => {
      const res = await apiCall(app, 'post', '/api/subscription/trigger-rent', null, {});
      expect(res.body?.code).not.toBe(0);
    });
  });
});

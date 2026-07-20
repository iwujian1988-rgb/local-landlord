import { INestApplication } from '@nestjs/common';
import {
  createTestApp,
  loginAsLandlord,
  apiCall,
  expectOk,
  createProperty,
  createRoom,
  createTenant,
  createBill,
  currentMonthStr,
} from './helpers/app';

/**
 * Stats module e2e — focused on the overdue logic that produced the
 * 2026-07-03 "已逾期 2 天" bug for a tenant who just moved in.
 *
 * Each test pins the tenant's rentDay relative to TODAY so the assertion
 * is stable regardless of when the test runs:
 *   - rentDay = today  → "今天该收"
 *   - rentDay = today+2 → "还有 X 天"
 *   - rentDay = today-2 (clamped to >=1) → "已逾期"
 */
describe('Stats module — overdue logic (e2e)', () => {
  let app: INestApplication;
  let auth: () => { Authorization: string };

  beforeAll(async () => {
    app = await createTestApp();
    auth = await loginAsLandlord(app);
  });

  afterAll(async () => {
    await app.close();
  });

  function todayDay(): number {
    return new Date().getDate();
  }

  /** Clamp rentDay to valid range [1, 28] so it never collides with month-end math. */
  function clampDay(n: number): number {
    return Math.max(1, Math.min(28, n));
  }

  /** Get /stats/home response. */
  async function getHome(): Promise<any> {
    const res = await apiCall(app, 'get', '/api/stats/home', auth);
    return expectOk(res);
  }

  /** Setup: create a fresh landlord with a rented room and given tenant params. */
  async function setupRentedRoom(opts: {
    rentDay: number;
    payMonths?: number;
    moveInDate?: string;
    paid?: boolean;
  }): Promise<{ roomName: string }> {
    const freshAuth = await loginAsLandlord(app, `dev_stats_${Date.now()}_${Math.random().toString(36).slice(2,6)}`);
    const propId = await createProperty(app, freshAuth);
    const roomName = `stats-${Math.random().toString(36).slice(2,6)}`;
    const rId = await createRoom(app, freshAuth, propId, { rent: 2000, name: roomName, status: 1 });
    await createTenant(app, freshAuth, rId, {
      name: '统计租客',
      phone: '13900000000',
      moveInDate: opts.moveInDate || `${currentMonthStr()}-01`,
      rentDay: opts.rentDay,
      payMonths: opts.payMonths ?? 1,
      ...(opts.paid
        ? {
            initialPaymentMethod: 'cash',
            initialPaymentDate: `${currentMonthStr()}-01`,
            initialPaymentAmount: 2000 * (opts.payMonths ?? 1),
          }
        : {}),
    });

    // Replace the suite-level auth with the new landlord's auth — each test
    // gets its own landlord so they don't pollute each other's stats.
    auth = freshAuth;
    return { roomName };
  }

  it('TC-STATS-001: 没有房间的新房东 → todoCount=0', async () => {
    const freshAuth = await loginAsLandlord(app, `dev_stats_empty_${Date.now()}`);
    const res = await apiCall(app, 'get', '/api/stats/home', freshAuth);
    const data = expectOk(res);
    expect(data.todoCount).toBe(0);
    expect(data.showRoomGuide).toBe(true);
  });

  it('TC-STATS-002: 空房间不算待收', async () => {
    const freshAuth = await loginAsLandlord(app, `dev_stats_vacant_${Date.now()}`);
    const propId = await createProperty(app, freshAuth);
    await createRoom(app, freshAuth, propId, { rent: 2000, name: 'vacant-room', status: 0 });

    const res = await apiCall(app, 'get', '/api/stats/home', freshAuth);
    const data = expectOk(res);
    expect(data.todoCount).toBe(0);
    expect(data.showTenantGuide).toBe(true);
  });

  it('TC-STATS-003: 已租+已付账单 → 不在待收列表', async () => {
    await setupRentedRoom({ rentDay: clampDay(todayDay() + 5), paid: true });
    const data = await getHome();
    expect(data.todoCount).toBe(0);
    expect(data.pendingDesc || '').not.toContain('已逾期');
    expect(data.pendingDesc || '').not.toContain('今天该收');
  });

  /**
   * This is the regression for the 2026-07 bug: tenant moved in on the 3rd,
   * rentDay=1, bill auto-created as paid → should NOT show as overdue.
   * Pre-fix: isPaid trigger was wrong, bill was unpaid, stats showed 已逾期 2 天.
   */
  it('TC-STATS-004: 实收租客 rentDay 已过 → 不应显示逾期（bug 回归）', async () => {
    await setupRentedRoom({
      rentDay: clampDay(todayDay() - 1), // rent day already passed
      paid: true, // bill should be status=1, not overdue
    });
    const data = await getHome();
    expect(data.todoCount).toBe(0);
    expect(data.pendingDesc || '').not.toContain('已逾期');
  });

  it('TC-STATS-005: 已租+未付+rentDay=today → "今天该收"', async () => {
    await setupRentedRoom({ rentDay: clampDay(todayDay()) });
    const data = await getHome();
    expect(data.todoCount).toBe(1);
    expect(data.pendingDesc).toContain('今天该收');
  });

  it('TC-STATS-006: 已租+未付+rentDay=today+2 → "还有 2 天"', async () => {
    await setupRentedRoom({ rentDay: clampDay(todayDay() + 2) });
    const data = await getHome();
    expect(data.todoCount).toBe(1);
    expect(data.pendingDesc).toContain('还有');
  });

  it('TC-STATS-007: 已租+未付+rentDay=today-2 → "已逾期"', async () => {
    await setupRentedRoom({ rentDay: clampDay(todayDay() - 2) });
    const data = await getHome();
    expect(data.todoCount).toBe(1);
    expect(data.pendingDesc).toContain('已逾期');
  });

  /**
   * Multi-month cycle (押一付三): tenant pays every 3 months. Stats should
   * only count them as "due" when current month is the start of a cycle.
   */
  it('TC-STATS-008: 押一付三 不在当月周期 → 不算待收', async () => {
    // Move in 1 month ago — monthsSinceMoveIn=1, 1 % 3 !== 0, skip
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const lastMonthStr = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
    await setupRentedRoom({
      rentDay: clampDay(todayDay() - 5), // would be overdue if checked
      payMonths: 3,
      moveInDate: `${lastMonthStr}-01`,
    });
    const data = await getHome();
    // Tenant is mid-cycle, should NOT appear in today's todo
    expect(data.pendingDesc || '').not.toContain('已逾期');
  });

  it('TC-STATS-009: 已收月度统计包含本月已付账单', async () => {
    await setupRentedRoom({ rentDay: clampDay(todayDay() + 10), paid: true });
    const data = await getHome();
    expect(Number(data.monthlyCollected || 0)).toBeGreaterThanOrEqual(2000);
  });

  it('TC-STATS-010: /stats/rent 默认月度返回 200', async () => {
    const freshAuth = await loginAsLandlord(app, `dev_stats_rent_${Date.now()}`);
    const res = await apiCall(app, 'get', '/api/stats/rent?period=month', freshAuth);
    expect(res.body?.code).toBe(0);
    expect(res.body?.data).toBeDefined();
  });

  it('TC-STATS-011: 月度统计 — 年度范围也合法', async () => {
    const freshAuth = await loginAsLandlord(app, `dev_stats_year_${Date.now()}`);
    const res = await apiCall(app, 'get', '/api/stats/rent?period=year', freshAuth);
    expect(res.body?.code).toBe(0);
  });
});

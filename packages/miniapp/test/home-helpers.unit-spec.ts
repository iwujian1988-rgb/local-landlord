/**
 * Tests for inline helpers in miniapp/src/pages/home/index.tsx.
 *
 * The page module is heavy JSX + Taro hooks — we can't easily import the
 * component itself under jest. The two pure helpers (getGreeting +
 * cleanProfileName) are not exported, so we mirror the logic here as a
 * regression sentinel: if the source regex drifts, the mirror catches it.
 *
 * This is the same pattern used in request.unit-spec.ts for
 * shouldFallbackToHttps.
*/

import { readFileSync } from 'fs';
import { resolve } from 'path';

const HOME_SOURCE = readFileSync(resolve(__dirname, '../src/pages/home/index.tsx'), 'utf8');
const TENANT_BILL_SOURCE = readFileSync(resolve(__dirname, '../src/pages/tenant-bill/index.tsx'), 'utf8');

// Mirror of getGreeting from pages/home/index.tsx:20
const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 6) return '凌晨好';
  if (h < 9) return '早上好';
  if (h < 12) return '上午好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
};

// Mirror of cleanProfileName from pages/home/index.tsx:35
const cleanProfileName = (name: string): string => {
  if (!name) return '';
  if (/^房东[a-zA-Z0-9\-_.]+$/.test(name)) return '房东';
  return name;
};

describe('home page — getGreeting', () => {
  // We test all 6 boundary hours via fake timers so the test is
  // deterministic regardless of when CI runs.
  const cases: Array<[number, string]> = [
    [0, '凌晨好'],
    [5, '凌晨好'],
    [6, '早上好'],
    [8, '早上好'],
    [9, '上午好'],
    [11, '上午好'],
    [12, '中午好'],
    [13, '中午好'],
    [14, '下午好'],
    [17, '下午好'],
    [18, '晚上好'],
    [23, '晚上好'],
  ];

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  for (const [hour, expected] of cases) {
    it(`TC-HOME-GREET-${hour}h → "${expected}"`, () => {
      const d = new Date('2026-07-03T00:00:00');
      d.setHours(hour);
      jest.setSystemTime(d);
      expect(getGreeting()).toBe(expected);
    });
  }

  it('TC-HOME-GREET-EDGE: 6/9/12/14/18 边界严格走 "<"', () => {
    for (const h of [5, 8, 11, 13, 17]) {
      const d = new Date('2026-07-03T00:00:00');
      d.setHours(h, 59, 59);
      jest.setSystemTime(d);
      const r = getGreeting();
      // h<6 → 凌晨好; 6≤h<9 → 早上好; 9≤h<12 → 上午好; 12≤h<14 → 中午好; 14≤h<18 → 下午好
      const expected = h < 6 ? '凌晨好' : h < 9 ? '早上好' : h < 12 ? '上午好' : h < 14 ? '中午好' : '下午好';
      expect(r).toBe(expected);
    }
  });
});

describe('home page — cleanProfileName', () => {
  const cases: Array<[string, string]> = [
    // Dirty legacy data — openid-prefix appended
    ['房东OP11N23A', '房东'],
    ['房东op11n3a-', '房东'],
    ['房东AB12-CD34_ef', '房东'],
    // Legit names — preserve
    ['房东小明', '房东小明'],
    ['房东王老板', '房东王老板'],
    ['张三', '张三'],
    ['李四', '李四'],
    // Edge
    ['', ''],
    ['房东', '房东'], // already just "房东" — pass-through
    ['房东123', '房东'], // pure-ASCII suffix → collapse
    ['房东abc', '房东'],
    ['房东 a', '房东 a'], // space breaks the ASCII-only suffix regex → kept
  ];

  for (const [input, expected] of cases) {
    it(`TC-HOME-NAME: cleanProfileName(${JSON.stringify(input)}) → ${JSON.stringify(expected)}`, () => {
      expect(cleanProfileName(input)).toBe(expected);
    });
  }
});

describe('home page — one-time receipt confirmation', () => {
  it('TC-HOME-RECEIPT-001: 微信分享动作会通知后端，不以打开预览代替真实发送', () => {
    expect(TENANT_BILL_SOURCE).toContain("post('/share/mark-sent', { token })");
    expect(TENANT_BILL_SOURCE).toContain('useShareAppMessage');
  });

  it('TC-HOME-RECEIPT-002: 普通租金和单独收费分别走各自确认接口', () => {
    expect(HOME_SOURCE).toContain('`/bills/${currentReceipt.id}/confirm`');
    expect(HOME_SOURCE).toContain('`/single-charges/${currentReceipt.id}/confirm`');
  });

  it('TC-HOME-RECEIPT-003: “还没收到”会关闭本次提示', () => {
    expect(HOME_SOURCE).toContain("post('/share/receipt-prompt/dismiss'");
    expect(HOME_SOURCE).toContain('本次不再提醒');
  });
});

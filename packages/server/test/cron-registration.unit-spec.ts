/**
 * Cron registration verification.
 *
 * The 9 @Cron-decorated methods across the codebase are the system's heartbeat
 * (auto-bills, reminders, overdue marking, account purge, etc.). If a refactor
 * accidentally drops the @Cron decorator or changes the schedule expression
 * to something invalid, the cron silently stops firing — the trigger-*
 * endpoints we test elsewhere still work, but the daily auto run never happens.
 *
 * This suite parses the @Cron metadata directly off the source files to verify
 * each method is registered with a valid cron expression.
 */
import * as fs from 'fs';
import * as path from 'path';

const SERVER_ROOT = path.resolve(__dirname, '..');
const SRC_ROOT = path.join(SERVER_ROOT, 'src');

/** Find all .ts files under src/modules that contain @Cron decorators. */
function findCronFiles(): { file: string; content: string }[] {
  const out: { file: string; content: string }[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.ts')) {
        const content = fs.readFileSync(full, 'utf8');
        if (content.includes('@Cron(')) {
          out.push({ file: path.relative(SRC_ROOT, full).replace(/\\/g, '/'), content });
        }
      }
    }
  };
  walk(SRC_ROOT);
  return out;
}

/** Extract all @Cron('expr') decorator expressions from a source file. */
function extractCronExpressions(content: string): { expr: string; method: string }[] {
  const results: { expr: string; method: string }[] = [];
  // Match @Cron('xxx') or @Cron(CronExpression.X) followed by async method()
  const regex = /@Cron\((['"`])([^'"`]+)\1\)\s*(?:async\s+)?(\w+)\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    const m = match;
    results.push({ expr: m[2], method: m[3] });
  }
  // Also match @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT) (enum reference)
  const enumRegex = /@Cron\((CronExpression\.\w+)\)\s*(?:async\s+)?(\w+)\s*\(/g;
  while ((match = enumRegex.exec(content)) !== null) {
    const m = match; // narrow non-null for TS
    if (!results.find(r => r.method === m[2])) {
      results.push({ expr: m[1], method: m[2] });
    }
  }
  return results;
}

/** Validate a 5-field cron expression syntactically. */
function isValidCron(expr: string): boolean {
  // Allow enum references (resolved by nest/schedule at runtime)
  if (expr.startsWith('CronExpression.')) return true;
  // 5-field cron: minute hour day-of-month month day-of-week
  // Each field can be: *, number, range (1-5), list (1,2,3), step (*/5)
  const fields = expr.trim().split(/\s+/);
  if (fields.length !== 5 && fields.length !== 6) return false;
  const fieldRegex = /^(\*|\d+|\d+-\d+|\d+(,\d+)*|\*\/\d+|\d+\/\d+)$/;
  return fields.every(f => fieldRegex.test(f));
}

describe('Cron 注册校验', () => {
  const cronFiles = findCronFiles();
  const allCrons: { file: string; expr: string; method: string }[] = [];
  for (const { file, content } of cronFiles) {
    for (const { expr, method } of extractCronExpressions(content)) {
      allCrons.push({ file, expr, method });
    }
  }

  it('TC-CRON-REG-001: 至少能找到 9 个 @Cron 装饰器（auth:1 + subscription:7 + bill:1）', () => {
    // Update this number if you intentionally add/remove crons.
    expect(allCrons.length).toBeGreaterThanOrEqual(9);
  });

  it.each(allCrons)('TC-CRON-REG-VALID: $file → $method() 表达式合法', ({ expr, method, file }) => {
    expect(isValidCron(expr)).toBe(true);
  });

  describe('关键调度时刻', () => {
    const expectedSchedules: { method: string; expr: string; fileSuffix: string }[] = [
      { method: 'autoGenerateBills', expr: '0 8 * * *', fileSuffix: 'subscription.service.ts' },
      { method: 'markOverdueBills', expr: 'CronExpression.EVERY_DAY_AT_MIDNIGHT', fileSuffix: 'bill.service.ts' },
      { method: 'purgeDeletedAccounts', expr: '17 2 * * *', fileSuffix: 'auth.service.ts' },
    ];

    it.each(expectedSchedules)(
      'TC-CRON-REG-EXPECTED: $method 应该在 $expr 调度 ($fileSuffix)',
      ({ method, expr, fileSuffix }) => {
        const found = allCrons.find(
          c => c.method === method && c.file.endsWith(fileSuffix),
        );
        expect(found).toBeTruthy();
        expect(found?.expr).toBe(expr);
      },
    );
  });

  describe('ScheduleModule 注册', () => {
    it('TC-CRON-SCHED-001: app.module.ts 必须 import ScheduleModule.forRoot()', () => {
      const content = fs.readFileSync(path.join(SRC_ROOT, 'app.module.ts'), 'utf8');
      expect(content).toContain('ScheduleModule.forRoot()');
    });
  });
});

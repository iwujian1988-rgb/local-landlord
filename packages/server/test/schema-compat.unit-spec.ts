/**
 * SchemaCompatService unit tests.
 *
 * The service runs on application bootstrap and reconciles missing MySQL
 * columns. It must:
 *   - Run only against MySQL (skip on sqljs/sqlite)
 *   - Query INFORMATION_SCHEMA once per expected column
 *   - Issue ALTER TABLE only for the columns not present
 *   - Be idempotent — a second run with everything present issues zero ALTERs
 *
 * We don't boot a real DB; instead we inject a fake DataSource that records
 * every query and lets each test decide which columns "exist".
 */
import { SchemaCompatService } from '../src/common/schema-compat.service';
import { DataSource } from 'typeorm';

// Pull the column spec out of the source via regex so the test fails if
// someone deletes a column without updating the assertions.
import { readFileSync } from 'fs';
import { join } from 'path';
const SRC = readFileSync(join(__dirname, '../src/common/schema-compat.service.ts'), 'utf8');
const COLUMN_COUNT = (SRC.match(ColumnSpecLineRegex()) || []).length;
function ColumnSpecLineRegex() {
  return /\{\s*table:\s*'[a-z_]+'/g;
}

class FakeDataSource {
  public options: { type: any; database: string };
  public queryLog: Array<{ sql: string; params: any[] }> = [];
  public alters: string[] = [];
  // Per-(table,column) presence map — tests populate this.
  public existingColumns = new Set<string>();
  public duplicateAlterOnce = false;

  constructor(type: any) {
    this.options = { type, database: 'test_db' };
  }

  async query(sql: string, params?: any[]): Promise<any[]> {
    this.queryLog.push({ sql, params: params || [] });
    // SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS ...
    if (/INFORMATION_SCHEMA\.COLUMNS/i.test(sql)) {
      const table = params?.[1] as string;
      const col = params?.[2] as string;
      const key = `${table}:${col}`;
      return this.existingColumns.has(key) ? [{ COLUMN_NAME: col }] : [];
    }
    // ALTER TABLE `xxx` ADD COLUMN ...
    if (/^ALTER\s+TABLE/i.test(sql)) {
      this.alters.push(sql);
      if (this.duplicateAlterOnce) {
        this.duplicateAlterOnce = false;
        const error: any = new Error('Duplicate column');
        error.code = 'ER_DUP_FIELDNAME';
        error.errno = 1060;
        throw error;
      }
      return [];
    }
    return [];
  }
}

function makeService(ds: FakeDataSource) {
  return new SchemaCompatService(ds as unknown as DataSource);
}

describe('SchemaCompatService — DB type gating', () => {
  it('TC-SCHEMA-001: MySQL — 进入 ensureMysqlColumns', async () => {
    const ds = new FakeDataSource('mysql');
    const svc = makeService(ds);
    await svc.onApplicationBootstrap();
    expect(ds.queryLog.length).toBeGreaterThan(0);
    expect(ds.alters.length).toBeGreaterThan(0);
  });

  it('TC-SCHEMA-002: sqljs — 直接 return，不查 INFORMATION_SCHEMA', async () => {
    const ds = new FakeDataSource('sqljs');
    const svc = makeService(ds);
    await svc.onApplicationBootstrap();
    expect(ds.queryLog).toHaveLength(0);
    expect(ds.alters).toHaveLength(0);
  });

  it('TC-SCHEMA-003: sqlite — 同样跳过', async () => {
    const ds = new FakeDataSource('sqlite');
    const svc = makeService(ds);
    await svc.onApplicationBootstrap();
    expect(ds.queryLog).toHaveLength(0);
  });

  it('TC-SCHEMA-004: database 字段缺失 → 不查询（防御性 early return）', async () => {
    const ds = new FakeDataSource('mysql');
    (ds.options as any).database = '';
    const svc = makeService(ds);
    await svc.onApplicationBootstrap();
    expect(ds.queryLog).toHaveLength(0);
  });
});

describe('SchemaCompatService — 查询/ALTER 行为', () => {
  it('TC-SCHEMA-005: 全部列缺失 → 每列 1 次 INFORMATION_SCHEMA 查询 + N 次 ALTER', async () => {
    const ds = new FakeDataSource('mysql');
    const svc = makeService(ds);
    await svc.onApplicationBootstrap();

    const selectCount = ds.queryLog.filter((q) => /INFORMATION_SCHEMA/i.test(q.sql)).length;
    expect(selectCount).toBe(COLUMN_COUNT);
    expect(ds.alters.length).toBe(COLUMN_COUNT);

    // Each SELECT carries [database, table, column] params
    for (const q of ds.queryLog) {
      if (/INFORMATION_SCHEMA/i.test(q.sql)) {
        expect(q.params).toHaveLength(3);
        expect(q.params[0]).toBe('test_db');
      }
    }
  });

  it('TC-SCHEMA-006: 全部列已存在 → 0 ALTER，只发 SELECT', async () => {
    const ds = new FakeDataSource('mysql');
    // Mark every column the service will check as present.
    // We do this by reading the spec from the source.
    const specs = parseColumnSpecs();
    for (const s of specs) ds.existingColumns.add(`${s.table}:${s.column}`);

    const svc = makeService(ds);
    await svc.onApplicationBootstrap();

    expect(ds.alters).toHaveLength(0);
    const selectCount = ds.queryLog.filter((q) => /INFORMATION_SCHEMA/i.test(q.sql)).length;
    expect(selectCount).toBe(COLUMN_COUNT);
  });

  it('TC-SCHEMA-007: 部分缺失 — 只 ALTER 缺的那几列', async () => {
    const ds = new FakeDataSource('mysql');
    const specs = parseColumnSpecs();
    // Leave the first 3 missing, mark the rest present.
    for (const s of specs.slice(3)) ds.existingColumns.add(`${s.table}:${s.column}`);

    const svc = makeService(ds);
    await svc.onApplicationBootstrap();

    expect(ds.alters).toHaveLength(3);
    // ALTER statements should mention the missing columns
    for (let i = 0; i < 3; i++) {
      expect(ds.alters[i]).toContain(`\`${specs[i].table}\``);
      expect(ds.alters[i]).toContain(specs[i].column);
    }
  });

  it('TC-SCHEMA-008: 幂等 — 同一实例跑两次，第二次不 ALTER', async () => {
    const ds = new FakeDataSource('mysql');
    const svc = makeService(ds);

    await svc.onApplicationBootstrap();
    const firstRunAlters = ds.alters.length;

    // Mark every column from the spec as now present (simulating ALTERs landed)
    const specs = parseColumnSpecs();
    for (const s of specs) ds.existingColumns.add(`${s.table}:${s.column}`);

    await svc.onApplicationBootstrap();
    expect(ds.alters.length).toBe(firstRunAlters); // no new ALTERs
  });

  it('TC-SCHEMA-009: ALTER 语句使用反引号转义表名', async () => {
    const ds = new FakeDataSource('mysql');
    const svc = makeService(ds);
    await svc.onApplicationBootstrap();

    for (const sql of ds.alters) {
      expect(sql).toMatch(/^ALTER\s+TABLE\s+`[a-z_]+`\s+ADD\s+COLUMN\s+/i);
    }
  });

  it('TC-SCHEMA-010: COLUMN_COUNT ≥ 38（保证未来不会偷懒删一列）', () => {
    // The historical baseline is 38 columns across property/room/tenant/
    // fee_item/bill/payment_qr/single_charge/document. If this drops, someone
    // likely removed a column without removing the entity field that needs it.
    expect(COLUMN_COUNT).toBeGreaterThanOrEqual(38);
  });

  it('TC-SCHEMA-011: CloudRun 并发启动时重复列不应导致实例启动失败', async () => {
    const ds = new FakeDataSource('mysql');
    ds.duplicateAlterOnce = true;
    const svc = makeService(ds);
    await expect(svc.onApplicationBootstrap()).resolves.toBeUndefined();
    expect(ds.alters.length).toBe(COLUMN_COUNT);
  });
});

/**
 * Parse the column specs from source so the assertions track the source
 * ( brittle, but intentionally so — drift should fail loudly here ).
 */
function parseColumnSpecs(): Array<{ table: string; column: string }> {
  const re = /\{\s*table:\s*'([a-z_]+)',\s*column:\s*'([a-z_]+)'/g;
  const out: Array<{ table: string; column: string }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(SRC)) !== null) {
    out.push({ table: m[1], column: m[2] });
  }
  return out;
}

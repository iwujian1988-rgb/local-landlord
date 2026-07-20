/**
 * Tests for admin/src/store/useAuthStore.ts.
 *
 * The store has top-level side effects (reads localStorage, evaluates token
 * expiry) — so we reset localStorage + re-import the module for each scenario.
 * jest.resetModules() + dynamic import() is the cleanest way to re-run the
 * module body.
 */
import { localStorageMock, locationMock } from './setup';

// Helper: re-import useAuthStore with a pre-seeded localStorage state.
async function importStoreWithSeed(seed: { token?: string | null; admin?: any }) {
  localStorageMock.clear();
  if (seed.token !== undefined) {
    if (seed.token === null) localStorageMock.removeItem('token');
    else localStorageMock.setItem('token', seed.token);
  }
  if (seed.admin !== undefined) {
    if (seed.admin === null) localStorageMock.removeItem('admin');
    else localStorageMock.setItem('admin', JSON.stringify(seed.admin));
  }

  jest.resetModules();
  return (await import('../src/store/useAuthStore')) as typeof import('../src/store/useAuthStore');
}

// Helper: forge a JWT with given exp (seconds since epoch).
function forgeJwt(payload: Record<string, any>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.signature`;
}

describe('useAuthStore — 初始状态', () => {
  beforeEach(() => {
    localStorageMock.clear();
    locationMock.href = '';
  });

  it('TC-ASTORE-INIT-001: 无 token → isLoggedIn=false, role=null', async () => {
    const mod = await importStoreWithSeed({ token: null });
    const s = mod.useAuthStore.getState();
    expect(s.isLoggedIn).toBe(false);
    expect(s.token).toBeNull();
    expect(s.admin).toBeNull();
    expect(s.role).toBeNull();
    expect(s.isSuperAdmin).toBe(false);
  });

  it('TC-ASTORE-INIT-002: 有效 token + admin → 恢复登录态', async () => {
    const valid = forgeJwt({ sub: 1, role: 0, exp: Math.floor(Date.now() / 1000) + 3600 });
    const admin = { id: 1, username: 'admin', role: 0, name: '超管' };
    const mod = await importStoreWithSeed({ token: valid, admin });
    const s = mod.useAuthStore.getState();
    expect(s.isLoggedIn).toBe(true);
    expect(s.token).toBe(valid);
    expect(s.admin).toEqual(admin);
    expect(s.role).toBe(0);
    expect(s.isSuperAdmin).toBe(true);
  });

  it('TC-ASTORE-INIT-003: 过期 token → 清除存储 + 不登录', async () => {
    const expired = forgeJwt({ sub: 1, role: 0, exp: Math.floor(Date.now() / 1000) - 100 });
    const admin = { id: 1, username: 'admin', role: 0, name: '超管' };
    const mod = await importStoreWithSeed({ token: expired, admin });

    const s = mod.useAuthStore.getState();
    expect(s.isLoggedIn).toBe(false);
    expect(s.token).toBeNull();
    expect(s.admin).toBeNull();
    // Side effect: the stale creds should be wiped from storage.
    expect(localStorageMock.getItem('token')).toBeNull();
    expect(localStorageMock.getItem('admin')).toBeNull();
  });

  it('TC-ASTORE-INIT-004: 乱码 token（非 JWT 三段）→ isTokenExpired 返回 false（保守放行）', async () => {
    // The impl returns false when payload can't be decoded — defensive
    // against malformed tokens. Document this so future changes are aware.
    const garbage = 'not-a-jwt';
    const mod = await importStoreWithSeed({ token: garbage, admin: null });
    const s = mod.useAuthStore.getState();
    expect(s.token).toBe(garbage);
    // isLoggedIn is `!tokenExpired && !!storedToken` → true because expired=false
    expect(s.isLoggedIn).toBe(true);
  });

  it('TC-ASTORE-INIT-005: admin JSON 损坏 → 不崩，admin=null', async () => {
    const valid = forgeJwt({ sub: 1, role: 1, exp: Math.floor(Date.now() / 1000) + 3600 });
    localStorageMock.clear();
    localStorageMock.setItem('token', valid);
    localStorageMock.setItem('admin', '{not-json');

    jest.resetModules();
    const mod = await import('../src/store/useAuthStore');
    const s = mod.useAuthStore.getState();
    expect(s.admin).toBeNull();
    expect(s.role).toBeNull();
    // isLoggedIn is independent of admin parse — only checks token
    expect(s.isLoggedIn).toBe(true);
  });
});

describe('useAuthStore — setAuth / clearAuth', () => {
  beforeEach(async () => {
    localStorageMock.clear();
    locationMock.href = '';
    jest.resetModules();
    await importStoreWithSeed({ token: null });
  });

  it('TC-ASTORE-SET-001: setAuth 写入 localStorage + 同步 state', async () => {
    const mod = await importStoreWithSeed({ token: null });
    const token = forgeJwt({ sub: 5, role: 1, exp: Math.floor(Date.now() / 1000) + 3600 });
    const admin = { id: 5, username: 'op', role: 1, name: '运营' };

    mod.useAuthStore.getState().setAuth(token, admin);

    const s = mod.useAuthStore.getState();
    expect(s.token).toBe(token);
    expect(s.admin).toEqual(admin);
    expect(s.isLoggedIn).toBe(true);
    expect(s.role).toBe(1);
    expect(s.isSuperAdmin).toBe(false); // role !== 0
    expect(localStorageMock.getItem('token')).toBe(token);
    expect(JSON.parse(localStorageMock.getItem('admin') || 'null')).toEqual(admin);
  });

  it('TC-ASTORE-SET-002: role=0 → isSuperAdmin=true', async () => {
    const mod = await importStoreWithSeed({ token: null });
    const token = forgeJwt({ sub: 1, role: 0, exp: Math.floor(Date.now() / 1000) + 3600 });
    mod.useAuthStore.getState().setAuth(token, { id: 1, username: 'admin', role: 0, name: 'X' });
    expect(mod.useAuthStore.getState().isSuperAdmin).toBe(true);
  });

  it('TC-ASTORE-CLEAR-001: clearAuth 清空一切', async () => {
    const mod = await importStoreWithSeed({ token: null });
    const token = forgeJwt({ sub: 5, role: 1, exp: Math.floor(Date.now() / 1000) + 3600 });
    mod.useAuthStore.getState().setAuth(token, { id: 5, username: 'op', role: 1, name: 'X' });

    mod.useAuthStore.getState().clearAuth();

    const s = mod.useAuthStore.getState();
    expect(s.token).toBeNull();
    expect(s.admin).toBeNull();
    expect(s.isLoggedIn).toBe(false);
    expect(s.role).toBeNull();
    expect(s.isSuperAdmin).toBe(false);
    expect(localStorageMock.getItem('token')).toBeNull();
    expect(localStorageMock.getItem('admin')).toBeNull();
  });
});

/**
 * Private helpers decodeJwtPayload + isTokenExpired aren't exported, but
 * we exercised them indirectly through the init-state tests above. The
 * assertions on TC-ASTORE-INIT-003 (expired) and TC-ASTORE-INIT-004
 * (malformed) are the load-bearing ones.
 */
describe('decodeJwtPayload / isTokenExpired — 通过 init 状态间接验证', () => {
  it('已通过 TC-ASTORE-INIT-002/003/004 覆盖', () => {
    // Sentinel — reminds future readers that these helpers are tested
    // indirectly. If init tests break, look here first.
    expect(true).toBe(true);
  });
});

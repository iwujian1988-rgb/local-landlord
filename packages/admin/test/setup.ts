/**
 * Test env shims for browser globals used by admin source.
 *
 * useAuthStore reads localStorage at module-load time (top-level side effect).
 * services/request.ts assigns window.location.href in the 401 path.
 *
 * We don't pull in jest-environment-jsdom just for these two — we hand-roll
 * minimal stubs so the test setup stays light and fast.
 */

class LocalStorageMock {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  get length(): number {
    return this.store.size;
  }
}

const localStorageMock = new LocalStorageMock();

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true,
});

// window.location.href is assignable in jsdom; under node we need a setter.
const locationMock = {
  href: '',
  pathname: '/',
  search: '',
  hash: '',
  origin: 'http://localhost',
  assign: jest.fn(),
  replace: jest.fn(),
  reload: jest.fn(),
};

Object.defineProperty(globalThis, 'window', {
  value: {
    location: locationMock,
    localStorage: localStorageMock,
  },
  writable: true,
  configurable: true,
});

// atob/btoa are used by useAuthStore's decodeJwtPayload
if (typeof globalThis.atob !== 'function') {
  globalThis.atob = (s: string) => Buffer.from(s, 'base64').toString('binary');
}
if (typeof globalThis.btoa !== 'function') {
  globalThis.btoa = (s: string) => Buffer.from(s, 'binary').toString('base64');
}

export { localStorageMock, locationMock };

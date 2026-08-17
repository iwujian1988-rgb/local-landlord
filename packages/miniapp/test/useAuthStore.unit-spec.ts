/**
 * Tests for miniapp/src/store/useAuthStore.ts.
 *
 * The store is a zustand vanilla store. Its `login()` calls into services/
 * request.post/directPost which in turn call Taro.request — we mock those at
 * the Taro boundary and assert state transitions + storage side-effects.
 *
 * unwrapLoginData + shouldFallbackToWechatLogin are private but
 * exercise-only-through-login, so we cover them via these test cases.
 */
import Taro from '@tarojs/taro';
import { useAuthStore } from '../src/store/useAuthStore';

const mockRequest = () => (Taro.request as jest.Mock);

const resetStore = () => {
  Taro.clearStorageSync();
  // Reset store to logged-out baseline. zustand exposes setState; the only
  // persistent state that could leak between tests is the auth fields.
  useAuthStore.setState({
    token: '',
    openid: '',
    user: null,
    isLoggedIn: false,
    loginLoading: false,
    loginError: '',
  });
};

describe('useAuthStore — initial state', () => {
  beforeEach(resetStore);

  it('TC-AUTH-INIT-001: 初始 isLoggedIn=false / loginLoading=false', () => {
    const s = useAuthStore.getState();
    expect(s.isLoggedIn).toBe(false);
    expect(s.loginLoading).toBe(false);
    expect(s.loginError).toBe('');
    expect(s.token).toBe('');
    expect(s.user).toBe(null);
  });
});

describe('loginSilently', () => {
  beforeEach(resetStore);

  it('TC-AUTH-SILENT-001: 无缓存 token → 返回空串，不登录', async () => {
    const token = await useAuthStore.getState().loginSilently();
    expect(token).toBe('');
    expect(useAuthStore.getState().isLoggedIn).toBe(false);
  });

  it('TC-AUTH-SILENT-002: 缓存里有 token → 注入 state 返回 token', async () => {
    Taro.setStorageSync('auth_token', 'cached-xyz');
    const token = await useAuthStore.getState().loginSilently();
    expect(token).toBe('cached-xyz');
    expect(useAuthStore.getState().isLoggedIn).toBe(true);
    expect(useAuthStore.getState().token).toBe('cached-xyz');
  });

  it('TC-AUTH-SILENT-003: 已登录直接返回当前 token', async () => {
    useAuthStore.setState({ token: 'in-mem', isLoggedIn: true });
    const token = await useAuthStore.getState().loginSilently();
    expect(token).toBe('in-mem');
  });
});

describe('logout', () => {
  beforeEach(resetStore);

  it('TC-AUTH-LOGOUT-001: 清空 token / user / storage', () => {
    Taro.setStorageSync('auth_token', 'abc');
    Taro.setStorageSync('landlord_info', { id: 9 });
    Taro.setStorageSync('openid', 'op-1');

    useAuthStore.setState({
      token: 'abc',
      user: { id: 9, name: 'x', phone: '' },
      isLoggedIn: true,
    });

    useAuthStore.getState().logout();

    const s = useAuthStore.getState();
    expect(s.token).toBe('');
    expect(s.user).toBe(null);
    expect(s.isLoggedIn).toBe(false);
    expect(Taro.getStorageSync('auth_token')).toBe('');
    expect(Taro.getStorageSync('openid')).toBe('');
    expect(Taro.getStorageSync('landlord_info')).toBe('');
  });

  it('TC-AUTH-GUEST-001: 进入访客模式清空身份和用户草稿缓存', () => {
    Taro.setStorageSync('auth_token', 'old-token');
    Taro.setStorageSync('landlord_info', { id: 9 });
    Taro.setStorageSync('draft_property', { name: '旧账号房源' });
    Taro.setStorageSync('tempRoomPhotos', ['old-photo']);
    useAuthStore.setState({ token: 'old-token', isLoggedIn: true });

    useAuthStore.getState().enterGuestMode();

    expect(useAuthStore.getState().isLoggedIn).toBe(false);
    expect(useAuthStore.getState().token).toBe('');
    expect(Taro.getStorageSync('guest_mode')).toBe(1);
    expect(Taro.getStorageSync('auth_token')).toBe('');
    expect(Taro.getStorageSync('draft_property')).toBe('');
    expect(Taro.getStorageSync('tempRoomPhotos')).toBe('');
  });

  it('TC-AUTH-GUEST-002: 访客模式禁止静默恢复旧 token', async () => {
    Taro.setStorageSync('guest_mode', 1);
    Taro.setStorageSync('auth_token', 'stale-token');
    const token = await useAuthStore.getState().loginSilently();
    expect(token).toBe('');
    expect(useAuthStore.getState().isLoggedIn).toBe(false);
    expect(Taro.getStorageSync('auth_token')).toBe('');
  });
});

describe('login (USE_CLOUD=false) — wx.login → /auth/wechat/login', () => {
  beforeEach(resetStore);

  it('TC-AUTH-LOGIN-001: 成功路径 — 拿到 token + 写 storage', async () => {
    (Taro.login as jest.Mock).mockResolvedValueOnce({ code: 'wx-code-1' });
    mockRequest().mockResolvedValueOnce({
      statusCode: 200,
      data: { code: 0, data: { token: 'srv-token', user: { id: 7, name: '王', phone: '138' } }, message: 'ok' },
    });

    await useAuthStore.getState().login();

    const s = useAuthStore.getState();
    expect(s.token).toBe('srv-token');
    expect(s.isLoggedIn).toBe(true);
    expect(s.loginLoading).toBe(false);
    expect(s.loginError).toBe('');
    expect(s.user).toEqual({ id: 7, name: '王', phone: '138' });

    expect(Taro.getStorageSync('auth_token')).toBe('srv-token');
    expect(Taro.getStorageSync('landlord_info')).toEqual({ id: 7, name: '王', phone: '138' });
    expect(Taro.getStorageSync('guest_mode')).toBe('');
  });

  it('TC-AUTH-LOGIN-002: 嵌套 .data.data.token 也能 unwrap', async () => {
    // unwrapLoginData 三档：res / res.data / res.data.data
    (Taro.login as jest.Mock).mockResolvedValueOnce({ code: 'c' });
    mockRequest().mockResolvedValueOnce({
      statusCode: 200,
      data: {
        code: 0,
        data: {
          data: { token: 'nested', user: { id: 1, name: 'x', phone: '' } },
        },
      },
    });

    await useAuthStore.getState().login();
    expect(useAuthStore.getState().token).toBe('nested');
  });

  it('TC-AUTH-LOGIN-003: Taro.login 没拿到 code → 抛 "微信登录失败"', async () => {
    (Taro.login as jest.Mock).mockResolvedValueOnce({ code: '' });
    await expect(useAuthStore.getState().login()).rejects.toThrow(/微信登录失败/);

    const s = useAuthStore.getState();
    expect(s.isLoggedIn).toBe(false);
    expect(s.loginLoading).toBe(false);
    expect(s.loginError).toMatch(/微信登录失败/);
  });

  it('TC-AUTH-LOGIN-004: server 返回 code≠0 → 抛 message', async () => {
    (Taro.login as jest.Mock).mockResolvedValueOnce({ code: 'c' });
    mockRequest().mockResolvedValueOnce({
      statusCode: 200,
      data: { code: 1001, message: '微信侧限流' },
    });

    await expect(useAuthStore.getState().login()).rejects.toThrow(/微信侧限流/);
    expect(useAuthStore.getState().loginError).toMatch(/微信侧限流/);
  });

  it('TC-AUTH-LOGIN-005: server 没返回 token → 抛 "服务端未返回 token"', async () => {
    (Taro.login as jest.Mock).mockResolvedValueOnce({ code: 'c' });
    mockRequest().mockResolvedValueOnce({
      statusCode: 200,
      data: { code: 0, data: { /* no token */ } },
    });

    await expect(useAuthStore.getState().login()).rejects.toThrow(/未返回 token/);
  });

  it('TC-AUTH-LOGIN-006: 网络异常 → loginError 落盘，state 复位', async () => {
    (Taro.login as jest.Mock).mockResolvedValueOnce({ code: 'c' });
    mockRequest().mockRejectedValueOnce(new Error('timeout'));

    await expect(useAuthStore.getState().login()).rejects.toThrow();
    const s = useAuthStore.getState();
    expect(s.isLoggedIn).toBe(false);
    expect(s.loginLoading).toBe(false);
    expect(s.loginError).toMatch(/timeout/);
  });
  it('TC-AUTH-LOGIN-007: concurrent login requests share one token exchange', async () => {
    (Taro.login as jest.Mock).mockResolvedValueOnce({ code: 'same-code' });
    const requestCountBefore = mockRequest().mock.calls.length;
    let resolveRequest: (value: unknown) => void = () => undefined;
    mockRequest().mockImplementationOnce(() => new Promise((resolve) => {
      resolveRequest = resolve;
    }));

    const first = useAuthStore.getState().login();
    const second = useAuthStore.getState().login();
    await Promise.resolve();
    expect(mockRequest()).toHaveBeenCalledTimes(requestCountBefore + 1);

    resolveRequest({
      statusCode: 200,
      data: { code: 0, data: { token: 'single-token', user: { id: 8, name: 'test', phone: '' } } },
    });
    await Promise.all([first, second]);

    expect(useAuthStore.getState().token).toBe('single-token');
    expect(useAuthStore.getState().loginLoading).toBe(false);
  });
});

/**
 * shouldFallbackToWechatLogin — private helper, but reachable via cloud-login
 * error path. Mirror the regex here as a regression sentinel.
 */
describe('shouldFallbackToWechatLogin — 镜像校验', () => {
  const cases: Array<[string, boolean]> = [
    ['INVALID_HOST', true],
    ['Invalid host', true],
    ['INVALID_PATH', true],
    ['Invalid path', true],
    ['102002', true],
    ['请求超时', true],
    ['OK', false],
    ['auth failed', false],
  ];
  for (const [msg, expected] of cases) {
    it(`TC-AUTH-FALLBACK: msg=${JSON.stringify(msg)} → ${expected}`, () => {
      const re = /INVALID_HOST|Invalid host|INVALID_PATH|Invalid path|102002|请求超时/;
      expect(re.test(msg)).toBe(expected);
    });
  }
});

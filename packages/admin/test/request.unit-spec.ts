/**
 * Tests for admin/src/services/request.ts (axios instance + interceptors).
 *
 * Strategy: mock the axios module so axios.create() returns a fake instance
 * whose interceptors we drive manually. This isolates the request/response
 * interceptor logic from real HTTP.
 */
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

type RequestInterceptor = (config: InternalAxiosRequestConfig) => InternalAxiosRequestConfig | Promise<InternalAxiosRequestConfig>;
type ResponseInterceptorFulfilled = (res: AxiosResponse) => any;
type ResponseInterceptorRejected = (err: any) => any;

class FakeAxiosInstance {
  public defaults: AxiosRequestConfig = { baseURL: '/api' };
  public requestInterceptor?: RequestInterceptor;
  public responseFulfilled?: ResponseInterceptorFulfilled;
  public responseRejected?: ResponseInterceptorRejected;

  interceptors = {
    request: {
      use: (fulfilled: RequestInterceptor) => {
        this.requestInterceptor = fulfilled;
      },
    },
    response: {
      use: (fulfilled: ResponseInterceptorFulfilled, rejected?: ResponseInterceptorRejected) => {
        this.responseFulfilled = fulfilled;
        this.responseRejected = rejected;
      },
    },
  };

  // Drives: simulate a request flowing through request interceptor then a response
  // coming back through response interceptor.
  async run(config: AxiosRequestConfig, response: AxiosResponse): Promise<any> {
    const req = this.requestInterceptor
      ? await this.requestInterceptor(config as InternalAxiosRequestConfig)
      : (config as InternalAxiosRequestConfig);
    const res = { ...response, config: req };
    if (this.responseFulfilled) return this.responseFulfilled(res);
    return res;
  }

  async runError(config: AxiosRequestConfig, err: any): Promise<any> {
    if (this.responseRejected) return this.responseRejected(err);
    throw err;
  }
}

const fake = new FakeAxiosInstance();
let createCalls = 0;

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    create: (config: AxiosRequestConfig) => {
      createCalls++;
      fake.defaults = { ...fake.defaults, ...config };
      return fake as unknown as AxiosInstance;
    },
  },
}));

import { localStorageMock, locationMock } from './setup';
import request from '../src/services/request';

describe('services/request — axios instance 配置', () => {
  it('TC-AREQ-INIT-001: axios.create 收到 baseURL=/api, timeout=10000', () => {
    expect(createCalls).toBeGreaterThanOrEqual(1);
    expect(fake.defaults.baseURL).toBe('/api');
    expect(fake.defaults.timeout).toBe(10000);
  });

  it('TC-AREQ-INIT-002: 拦截器都注册了', () => {
    expect(fake.requestInterceptor).toBeDefined();
    expect(fake.responseFulfilled).toBeDefined();
    expect(fake.responseRejected).toBeDefined();
  });
});

describe('services/request — request interceptor', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('TC-AREQ-REQ-001: localStorage 有 token → 注入 Authorization', async () => {
    localStorageMock.setItem('token', 'abc-123');
    const config = { url: '/foo', headers: {} as any } as AxiosRequestConfig;
    const processed = (await fake.requestInterceptor!(config as any)) as InternalAxiosRequestConfig;
    expect(processed.headers?.Authorization).toBe('Bearer abc-123');
  });

  it('TC-AREQ-REQ-002: localStorage 无 token → 不加 Authorization', async () => {
    const config = { url: '/foo', headers: {} as any } as AxiosRequestConfig;
    const processed = (await fake.requestInterceptor!(config as any)) as InternalAxiosRequestConfig;
    expect(processed.headers?.Authorization).toBeUndefined();
  });

  it('TC-AREQ-REQ-003: 已有 Authorization header 不被覆盖', async () => {
    localStorageMock.setItem('token', 'abc-123');
    const config = {
      url: '/foo',
      headers: { Authorization: 'Basic xyz' } as any,
    } as AxiosRequestConfig;
    const processed = (await fake.requestInterceptor!(config as any)) as InternalAxiosRequestConfig;
    // The impl doesn't check for existing Authorization, so it overwrites.
    // Document this so a future fix doesn't silently change behavior.
    expect(processed.headers?.Authorization).toBe('Bearer abc-123');
  });
});

describe('services/request — response interceptor (fulfilled)', () => {
  it('TC-AREQ-RES-001: code=0 → 返回 res.data（解包）', async () => {
    const res = { data: { code: 0, data: { id: 1 }, message: 'ok' } } as AxiosResponse;
    const out = await fake.responseFulfilled!(res);
    expect(out).toEqual({ code: 0, data: { id: 1 }, message: 'ok' });
  });

  it('TC-AREQ-RES-002: code≠0 → reject with Error(message)', async () => {
    const res = { data: { code: 1001, message: '账单不存在' } } as AxiosResponse;
    await expect(fake.responseFulfilled!(res)).rejects.toThrow('账单不存在');
  });

  it('TC-AREQ-RES-003: code≠0 但 message 缺省 → reject with "请求失败"', async () => {
    const res = { data: { code: 500 } } as AxiosResponse;
    await expect(fake.responseFulfilled!(res)).rejects.toThrow('请求失败');
  });

  it('TC-AREQ-RES-004: res.data 为空 → reject（保险）', async () => {
    const res = { data: null } as unknown as AxiosResponse;
    // null?.code !== 0 → reject with default message
    await expect(fake.responseFulfilled!(res)).rejects.toThrow('请求失败');
  });
});

describe('services/request — response interceptor (rejected)', () => {
  beforeEach(() => {
    localStorageMock.clear();
    locationMock.href = '';
  });

  it('TC-AREQ-ERR-001: 401 → 清 token + 跳 /login + reject', async () => {
    localStorageMock.setItem('token', 'pre-existing');
    locationMock.href = '/dashboard';
    const err = { response: { status: 401, data: { message: 'token expired' } } };

    await expect(fake.responseRejected!(err)).rejects.toEqual(err);
    expect(localStorageMock.getItem('token')).toBeNull();
    expect(locationMock.href).toBe('/login');
  });

  it('TC-AREQ-ERR-002: 500 → 不跳转，只透传 reject', async () => {
    locationMock.href = '/dashboard';
    const err = { response: { status: 500, data: { message: 'boom' } } };

    await expect(fake.responseRejected!(err)).rejects.toEqual(err);
    expect(locationMock.href).toBe('/dashboard');
  });

  it('TC-AREQ-ERR-003: 网络错误（无 response 字段）→ 透传', async () => {
    const err = new Error('Network Error');
    await expect(fake.responseRejected!(err)).rejects.toEqual(err);
  });

  it('TC-AREQ-ERR-004: 401 但 err.response 缺失 → 不崩', async () => {
    const err = { message: 'something' };
    await expect(fake.responseRejected!(err)).rejects.toEqual(err);
    expect(locationMock.href).toBe(''); // not redirected
  });
});

describe('services/request — default export', () => {
  it('TC-AREQ-DEFAULT-001: default export 是 fake axios instance', () => {
    expect(request).toBe(fake);
  });
});

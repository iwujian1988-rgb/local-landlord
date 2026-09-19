import Taro from '@tarojs/taro';
import { API_BASE_URL, CLOUD_ENV_ID, CLOUD_SVC, USE_CLOUD } from '../config';
import { useAuthStore } from '../store/useAuthStore';

export interface ApiResponse<T = unknown> {
  code: number;
  data: T;
  message: string;
}

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function tryReLogin(): Promise<boolean> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }
  isRefreshing = true;
  refreshPromise = useAuthStore
    .getState()
    .login()
    .then(() => true)
    .catch(() => false)
    .finally(() => {
      isRefreshing = false;
      refreshPromise = null;
    });
  return refreshPromise;
}

export const directRequest = async <T = unknown>(
  options: Taro.request.Option,
  header: Record<string, string> = {},
): Promise<ApiResponse<T>> => {
  const res = await Taro.request({
    timeout: 15000,
    ...options,
    url: `${API_BASE_URL}${options.url}`,
    header: {
      'Content-Type': 'application/json',
      ...header,
      ...((options.header as Record<string, string>) || {}),
    },
  });
  return readResponse<T>(res);
};

function readResponse<T>(res: { statusCode?: number; data: unknown }): ApiResponse<T> {
  const data = typeof res.data === 'string' ? safeJsonParse(res.data) : res.data;
  const body = data as ApiResponse<T> | null;
  if (res.statusCode === 401) {
    return { code: 401, data: null as T, message: body?.message || '登录已过期' };
  }
  if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
    throw new Error(body?.message || `请求失败（${res.statusCode}）`);
  }
  if (!body || typeof body !== 'object' || typeof body.code !== 'number') {
    throw new Error('服务端返回格式错误，请稍后重试');
  }
  return body;
}

const request = async <T = unknown>(
  options: Taro.request.Option,
  allowRelogin = true,
): Promise<ApiResponse<T>> => {
  const token = useAuthStore.getState().token || Taro.getStorageSync('auth_token') || '';

  const mergedHeader: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options.header as Record<string, string>) || {}),
  };

  try {
    let data: ApiResponse<T>;

    if (USE_CLOUD) {
      data = await callContainerCompat<T>(options, mergedHeader);
    } else {
      data = await directRequest<T>(options, mergedHeader);
    }

    if (data.code === 401) {
      const guestMode = !!Taro.getStorageSync('guest_mode');
      // Never silently exchange wx.login for a landlord token while the user
      // explicitly chose guest mode. That would expose the previous WeChat
      // account's cloud data without a visible login action.
      if (!guestMode && allowRelogin && !options.url.startsWith('/auth/')
        && (isRefreshing || !useAuthStore.getState().loginLoading)) {
        const ok = await tryReLogin();
        if (ok) {
          return request<T>(options, false);
        }
      }
      if (!guestMode) {
        Taro.removeStorageSync('auth_token');
        useAuthStore.getState().logout();
        Taro.reLaunch({ url: '/pages/home/index' });
        throw new Error('登录已过期，请重新登录');
      }
      throw new Error('访客模式不能查看账号数据，请先登录');
    }

    // Taro.request and cloud.callContainer resolve normally for HTTP 4xx/5xx.
    // Reject non-success envelopes so mutation pages cannot report false success.
    if (data.code !== 0) {
      throw new Error(data.message || `请求失败（${data.code}）`);
    }

    return data;
  } catch (err: any) {
    const msg = err?.errMsg || err?.message || '';
    if (msg.includes('timeout')) {
      Taro.showToast({ title: '网络较慢，请稍后再试', icon: 'none', duration: 2000 });
    } else if (msg.includes('fail') || msg.includes('network')) {
      Taro.showToast({ title: '网络连接失败，请检查网络', icon: 'none', duration: 2000 });
    }
    throw err;
  }
};

function callContainerCompat<T>(
  options: Taro.request.Option,
  header: Record<string, string>,
): Promise<ApiResponse<T>> {
  const path = `/api${options.url || ''}`.replace(/\/{2,}/g, '/');
  const containerHeader = {
    ...header,
    'X-WX-SERVICE': CLOUD_SVC,
  };

  return new Promise((resolve, reject) => {
    (wx as any).cloud.callContainer({
      config: { env: CLOUD_ENV_ID },
      svc: CLOUD_SVC,
      path,
      method: options.method || 'GET',
      data: options.data,
      header: containerHeader,
      success: (res: any) => {
        try {
          resolve(readResponse<T>(res));
        } catch (error) {
          reject(error);
        }
      },
      fail: (err: any) => {
        const msg = err.errMsg || 'callContainer 请求失败';
        // Let cloud identity login retry a cold-start failure before it falls
        // back to code2Session. This prevents a single tap from issuing two
        // different login flows concurrently.
        if (options.url !== '/auth/cloud-login' && shouldFallbackToHttps(msg)) {
          directRequest<T>(options, header)
            .then(resolve)
            .catch((fallbackErr) => {
              reject(new Error(fallbackErr.errMsg || fallbackErr.message || msg));
            });
          return;
        }
        reject(new Error(msg));
      },
    });
  });
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function shouldFallbackToHttps(msg: string): boolean {
  return (
    msg.includes('INVALID_PATH') ||
    msg.includes('Invalid path') ||
    msg.includes('INVALID_HOST') ||
    msg.includes('Invalid host') ||
    msg.includes('102002') ||
    msg.includes('请求超时')
  );
}

export const directPost = <T = unknown>(
  url: string,
  data?: Record<string, unknown>,
  header?: Record<string, string>,
): Promise<ApiResponse<T>> => directRequest<T>({ url, method: 'POST', data }, header);

function callContainer<T>(
  options: Taro.request.Option,
  header: Record<string, string>,
): Promise<ApiResponse<T>> {
  return new Promise((resolve, reject) => {
    (wx as any).cloud.callContainer({
      config: { env: CLOUD_ENV_ID },
      svc: CLOUD_SVC,
      path: `/api${options.url}`,
      method: options.method || 'GET',
      data: options.data,
      header,
      success: (res: any) => {
        resolve(res.data as ApiResponse<T>);
      },
      fail: (err: any) => {
        reject(new Error(err.errMsg || 'callContainer 请求失败'));
      },
    });
  });
}

export const get = <T = unknown>(url: string, data?: Record<string, unknown>): Promise<ApiResponse<T>> =>
  request<T>({ url, method: 'GET', data });

export const post = <T = unknown>(url: string, data?: Record<string, unknown>): Promise<ApiResponse<T>> =>
  request<T>({ url, method: 'POST', data });

export const put = <T = unknown>(url: string, data?: Record<string, unknown>): Promise<ApiResponse<T>> =>
  request<T>({ url, method: 'PUT', data });

export const del = <T = unknown>(url: string, data?: Record<string, unknown>): Promise<ApiResponse<T>> =>
  request<T>({ url, method: 'DELETE', data });

export default request;

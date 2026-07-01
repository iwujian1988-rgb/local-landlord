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
      const res = await Taro.request({
        timeout: 10000,
        ...options,
        url: `${API_BASE_URL}${options.url}`,
        header: mergedHeader,
      });
      data = res.data as ApiResponse<T>;
    }

    if (data.code === 401) {
      if (allowRelogin && !useAuthStore.getState().loginLoading) {
        const ok = await tryReLogin();
        if (ok) {
          return request<T>(options, false);
        }
      }
      Taro.removeStorageSync('auth_token');
      useAuthStore.getState().logout();
      Taro.reLaunch({ url: '/pages/home/index' });
      throw new Error('登录已过期，请重新登录');
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
        const raw = typeof res.data === 'string' ? safeJsonParse(res.data) : res.data;
        resolve(raw as ApiResponse<T>);
      },
      fail: (err: any) => {
        const msg = err.errMsg || 'callContainer 请求失败';
        if (msg.includes('INVALID_PATH') || msg.includes('Invalid path')) {
          Taro.request({
            timeout: 15000,
            ...options,
            url: `${API_BASE_URL}${options.url}`,
            header,
            success: (res) => {
              const raw = typeof res.data === 'string' ? safeJsonParse(res.data) : res.data;
              resolve(raw as ApiResponse<T>);
            },
            fail: (fallbackErr) => {
              reject(new Error(fallbackErr.errMsg || msg));
            },
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

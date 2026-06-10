import Taro from '@tarojs/taro';
import { API_BASE_URL, CLOUD_ENV_ID, USE_CLOUD } from '../config';
import { useAuthStore } from '../store/useAuthStore';

export interface ApiResponse<T = unknown> {
  code: number;
  data: T;
  message: string;
}

const request = async <T = unknown>(
  options: Taro.request.Option,
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
      data = await callContainer<T>(options, mergedHeader);
    } else {
      const res = await Taro.request({
        timeout: 5000,
        ...options,
        url: `${API_BASE_URL}${options.url}`,
        header: mergedHeader,
      });
      data = res.data as ApiResponse<T>;
    }

    if (data.code === 401) {
      Taro.removeStorageSync('auth_token');
      useAuthStore.getState().logout();
      Taro.reLaunch({ url: '/pages/home/index' });
      throw new Error('未登录');
    }

    return data;
  } catch (err: any) {
    throw err;
  }
};

function callContainer<T>(
  options: Taro.request.Option,
  header: Record<string, string>,
): Promise<ApiResponse<T>> {
  return new Promise((resolve, reject) => {
    (wx as any).cloud.callContainer({
      config: { env: CLOUD_ENV_ID },
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

import Taro from '@tarojs/taro';
import { API_BASE } from '../config';
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
    const res = await Taro.request({
      ...options,
      url: `${API_BASE}${options.url}`,
      header: mergedHeader,
    });

    const data = res.data as ApiResponse<T>;

    if (data.code === 401) {
      Taro.removeStorageSync('auth_token');
      useAuthStore.getState().logout();
      Taro.reLaunch({ url: '/pages/home/index' });
      throw new Error('未登录');
    }

    return data;
  } catch (err: any) {
    // Re-throw so pages can catch and show ErrorState
    throw err;
  }
};

export const get = <T = unknown>(url: string, data?: Record<string, unknown>): Promise<ApiResponse<T>> =>
  request<T>({ url, method: 'GET', data });

export const post = <T = unknown>(url: string, data?: Record<string, unknown>): Promise<ApiResponse<T>> =>
  request<T>({ url, method: 'POST', data });

export const put = <T = unknown>(url: string, data?: Record<string, unknown>): Promise<ApiResponse<T>> =>
  request<T>({ url, method: 'PUT', data });

export const del = <T = unknown>(url: string, data?: Record<string, unknown>): Promise<ApiResponse<T>> =>
  request<T>({ url, method: 'DELETE', data });

export default request;

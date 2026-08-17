import { create } from 'zustand';
import Taro from '@tarojs/taro';
import { USE_CLOUD } from '../config';
import { directPost, post } from '../services/request';
import { clearUserSessionCaches } from '../utils/storage';

const CLOUD_LOGIN_RETRY_DELAY_MS = 1500;
let activeLoginPromise: Promise<void> | null = null;

interface AuthState {
  token: string;
  openid: string;
  user: { id: number; name: string; phone: string; avatar?: string } | null;
  isLoggedIn: boolean;
  loginLoading: boolean;
  loginError: string;
  loginSilently: () => Promise<string>;
  login: () => Promise<void>;
  logout: () => void;
  enterGuestMode: () => void;
}

function clearStoredIdentity(): void {
  Taro.removeStorageSync('auth_token');
  Taro.removeStorageSync('openid');
  Taro.removeStorageSync('landlord_info');
  clearUserSessionCaches();
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: Taro.getStorageSync('auth_token') || '',
  openid: Taro.getStorageSync('openid') || '',
  user: Taro.getStorageSync('landlord_info') || null,
  isLoggedIn: !!Taro.getStorageSync('auth_token'),
  loginLoading: false,
  loginError: '',

  loginSilently: async () => {
    if (Taro.getStorageSync('guest_mode')) {
      clearStoredIdentity();
      set({ token: '', openid: '', user: null, isLoggedIn: false });
      return '';
    }
    const { token, isLoggedIn } = get();
    if (isLoggedIn && token) return token;

    const savedToken = Taro.getStorageSync('auth_token');
    if (savedToken) {
      set({ token: savedToken, isLoggedIn: true });
      return savedToken;
    }
    return '';
  },

  login: async () => {
    if (activeLoginPromise) return activeLoginPromise;

    let resolveActiveLogin!: () => void;
    let rejectActiveLogin!: (reason?: unknown) => void;
    const currentLoginPromise = new Promise<void>((resolve, reject) => {
      resolveActiveLogin = resolve;
      rejectActiveLogin = reject;
    });
    // The caller of this async action observes the original error. This catch
    // prevents the internal shared promise from becoming an unhandled reject.
    currentLoginPromise.catch(() => undefined);
    activeLoginPromise = currentLoginPromise;

    set({ loginLoading: true, loginError: '' });
    try {
      let data: any;

      if (USE_CLOUD) {
        // Cloud hosting: callContainer auto-injects X-WX-OPENID
        try {
          data = await loginByCloudIdentity();
        } catch {
          data = await loginByWechatCode();
        }
      } else {
        // wx.login → code → server verifies via code2Session
        const { code } = await Taro.login();
        if (!code) {
          throw new Error('微信登录失败，请检查微信后重试');
        }
        const resp = await post<any>('/auth/wechat/login', { code });
        if (resp.code !== 0) {
          throw new Error(resp.message || '微信登录失败，请稍后重试');
        }
        data = unwrapLoginData(resp);
      }

      if (!data.token) throw new Error('服务端未返回 token');

      Taro.setStorageSync('auth_token', data.token);
      Taro.removeStorageSync('guest_mode');
      if (data.user) {
        Taro.setStorageSync('landlord_info', data.user);
      }

      set({
        token: data.token,
        user: data.user || null,
        isLoggedIn: true,
        loginLoading: false,
      });
      resolveActiveLogin();
    } catch (err: any) {
      set({
        loginLoading: false,
        loginError: err.message || '登录失败',
        isLoggedIn: false,
      });
      rejectActiveLogin(err);
      throw err;
    } finally {
      if (activeLoginPromise === currentLoginPromise) {
        activeLoginPromise = null;
      }
    }
  },

  logout: () => {
    clearStoredIdentity();
    Taro.removeStorageSync('guest_mode');
    set({
      token: '',
      openid: '',
      user: null,
      isLoggedIn: false,
    });
  },

  enterGuestMode: () => {
    clearStoredIdentity();
    Taro.setStorageSync('guest_mode', 1);
    set({
      token: '',
      openid: '',
      user: null,
      isLoggedIn: false,
      loginLoading: false,
      loginError: '',
    });
  },
}));

function unwrapLoginData(res: any) {
  if (res?.token) return res;
  if (res?.data?.token) return res.data;
  if (res?.data?.data?.token) return res.data.data;
  return res?.data || res;
}

async function loginByCloudIdentity() {
  try {
    return await requestCloudIdentity();
  } catch (error) {
    if (!isCloudColdStartError(error)) throw error;
    await delay(CLOUD_LOGIN_RETRY_DELAY_MS);
    return requestCloudIdentity();
  }
}

async function requestCloudIdentity() {
  const res = await post<any>('/auth/cloud-login', {});
  const data = unwrapLoginData(res);
  if (res?.code !== 0 || !data?.token) {
    throw new Error(res?.message || 'cloud-login did not return token');
  }
  return data;
}

function isCloudColdStartError(error: unknown): boolean {
  const message = String((error as any)?.errMsg || (error as any)?.message || error || '').toLowerCase();
  return message.includes('102002')
    || message.includes('timeout')
    || message.includes('请求超时')
    || message.includes('service unavailable')
    || message.includes('503');
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loginByWechatCode() {
  const { code } = await Taro.login();
  if (!code) {
    throw new Error('微信登录失败，请检查微信后重试');
  }
  const resp = await directPost<any>('/auth/wechat/login', { code });
  if (resp.code !== 0) {
    throw new Error(resp.message || '微信登录失败，请稍后重试');
  }
  return unwrapLoginData(resp);
}

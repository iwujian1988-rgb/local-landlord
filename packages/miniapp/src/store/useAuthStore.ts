import { create } from 'zustand';
import Taro from '@tarojs/taro';
import { USE_CLOUD } from '../config';
import { directPost, post } from '../services/request';
import { clearUserSessionCaches } from '../utils/storage';

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
    set({ loginLoading: true, loginError: '' });
    try {
      let data: any;

      if (USE_CLOUD) {
        // Cloud hosting: callContainer auto-injects X-WX-OPENID
        try {
          const res = await post<any>('/auth/cloud-login', {});
          data = unwrapLoginData(res);
          if (res?.code !== 0 || !data?.token) {
            throw new Error(res?.message || 'cloud-login did not return token');
          }
        } catch (cloudErr: any) {
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
    } catch (err: any) {
      set({
        loginLoading: false,
        loginError: err.message || '登录失败',
        isLoggedIn: false,
      });
      throw err;
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

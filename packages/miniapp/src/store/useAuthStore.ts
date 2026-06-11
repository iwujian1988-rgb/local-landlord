import { create } from 'zustand';
import Taro from '@tarojs/taro';
import { USE_CLOUD } from '../config';
import { post } from '../services/request';

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
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: Taro.getStorageSync('auth_token') || '',
  openid: Taro.getStorageSync('openid') || '',
  user: Taro.getStorageSync('landlord_info') || null,
  isLoggedIn: !!Taro.getStorageSync('auth_token'),
  loginLoading: false,
  loginError: '',

  loginSilently: async () => {
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
        const res = await post<any>('/auth/cloud-login', {});
        data = res.data || res;
      } else {
        // wx.login → code → server verifies, fallback to dev login
        try {
          const { code } = await Taro.login();
          if (!code) throw new Error('wx.login 失败');

          const resp = await post<any>('/auth/wechat/login', { code });
          data = resp.data || resp;
        } catch {
          // Fallback: use dev login for testing
          const resp = await post<any>('/auth/wechat/login', { code: 'dev_test' });
          data = resp.data || resp;
        }
      }

      if (!data.token) throw new Error('服务端未返回 token');

      Taro.setStorageSync('auth_token', data.token);
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
    Taro.removeStorageSync('auth_token');
    Taro.removeStorageSync('openid');
    Taro.removeStorageSync('landlord_info');
    set({
      token: '',
      openid: '',
      user: null,
      isLoggedIn: false,
    });
  },
}));

import { create } from 'zustand';
import Taro from '@tarojs/taro';
import { API_BASE } from '../config';

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

  /**
   * 静默登录：从 storage 恢复 token，不阻塞启动
   */
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

  /**
   * 微信登录：wx.login() → Server /auth/wechat/login → 存 JWT
   */
  login: async () => {
    set({ loginLoading: true, loginError: '' });
    try {
      // 1. 调微信 wx.login 获取临时 code
      const loginRes = await Taro.login();
      if (!loginRes.code) throw new Error('wx.login 失败');

      // 2. 发 POST 到 Server 换取 JWT
      const resp = await Taro.request({
        url: `${API_BASE}/auth/wechat/login`,
        method: 'POST',
        data: { code: loginRes.code },
      });
      const data = resp.data as { token: string; landlord: any };

      if (!data.token) throw new Error('服务端未返回 token');

      // 3. 存储 token
      Taro.setStorageSync('auth_token', data.token);
      if (data.landlord) {
        Taro.setStorageSync('landlord_info', data.landlord);
      }

      set({
        token: data.token,
        user: data.landlord || null,
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

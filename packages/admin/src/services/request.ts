import axios from 'axios';
import { useAuthStore } from '../store/useAuthStore';

function expireSession() {
  useAuthStore.getState().clearAuth();
  window.location.href = '/login';
}

const request = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

request.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

request.interceptors.response.use(
  (res) => {
    if (res.data?.code === 401) expireSession();
    if (res.data?.code !== 0) {
      return Promise.reject(new Error(res.data?.message || '请求失败'));
    }
    return res.data;
  },
  (err) => {
    if (err.response?.status === 401) {
      expireSession();
    }
    return Promise.reject(err);
  },
);

export default request;

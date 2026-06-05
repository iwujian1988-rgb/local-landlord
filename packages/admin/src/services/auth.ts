import request from './request';
import type { Admin } from '@local-landlord/shared';

export async function login(username: string, password: string) {
  const res = await request.post('/auth/admin/login', { username, password });
  const { token, admin } = res.data;
  localStorage.setItem('token', token);
  localStorage.setItem('admin', JSON.stringify(admin));
  return { token, admin };
}

export async function getMe() {
  const res = await request.get('/auth/admin/me');
  return res.data.admin as Admin;
}

export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('admin');
  window.location.href = '/login';
}

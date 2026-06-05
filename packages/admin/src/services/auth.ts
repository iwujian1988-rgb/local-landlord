import request from './request';
import type { Admin, ApiResponse } from '@local-landlord/shared';

interface LoginResponse {
  token: string;
  user: Admin;
}

export async function login(username: string, password: string): Promise<{ token: string; admin: Admin }> {
  const res: ApiResponse<LoginResponse> = await request.post('/auth/admin/login', { username, password });
  return { token: res.data.token, admin: res.data.user };
}

export async function getMe(): Promise<Admin> {
  const res: ApiResponse<{ admin: Admin }> = await request.get('/auth/admin/me');
  return res.data.admin;
}

export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('admin');
  window.location.href = '/login';
}

import { create } from 'zustand';
import type { Admin } from '@local-landlord/shared';

interface AuthState {
  token: string | null;
  admin: Admin | null;
  isLoggedIn: boolean;
  role: number | null;
  isSuperAdmin: boolean;
  setAuth: (token: string, admin: Admin) => void;
  clearAuth: () => void;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function isTokenExpired(token: string | null): boolean {
  if (!token) return true;
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') return false;
  // exp is in seconds, Date.now() is in milliseconds
  return Date.now() >= payload.exp * 1000;
}

let storedAdmin: Admin | null = null;
try {
  storedAdmin = JSON.parse(localStorage.getItem('admin') || 'null');
} catch {
  storedAdmin = null;
}

const storedToken = localStorage.getItem('token');
const tokenExpired = isTokenExpired(storedToken);

// If token is expired, clean up stored credentials
if (tokenExpired && storedToken) {
  localStorage.removeItem('token');
  localStorage.removeItem('admin');
  storedAdmin = null;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: tokenExpired ? null : storedToken,
  admin: tokenExpired ? null : storedAdmin,
  isLoggedIn: !tokenExpired && !!storedToken,
  role: tokenExpired ? null : storedAdmin?.role ?? null,
  isSuperAdmin: !tokenExpired && storedAdmin?.role === 0,

  setAuth: (token: string, admin: Admin) => {
    localStorage.setItem('token', token);
    localStorage.setItem('admin', JSON.stringify(admin));
    set({ token, admin, isLoggedIn: true, role: admin?.role ?? null, isSuperAdmin: admin?.role === 0 });
  },

  clearAuth: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('admin');
    set({ token: null, admin: null, isLoggedIn: false, role: null, isSuperAdmin: false });
  },
}));

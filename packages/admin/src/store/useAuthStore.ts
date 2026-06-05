import { create } from 'zustand';

interface AuthState {
  token: string | null;
  admin: any | null;
  isLoggedIn: boolean;
  role: number | null;
  isSuperAdmin: boolean;
  setAuth: (token: string, admin: any) => void;
  clearAuth: () => void;
}

const storedAdmin = JSON.parse(localStorage.getItem('admin') || 'null');

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('token'),
  admin: storedAdmin,
  isLoggedIn: !!localStorage.getItem('token'),
  role: storedAdmin?.role ?? null,
  isSuperAdmin: storedAdmin?.role === 0,

  setAuth: (token: string, admin: any) => {
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

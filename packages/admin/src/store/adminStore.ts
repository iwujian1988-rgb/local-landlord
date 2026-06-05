import { create } from 'zustand';

interface AdminState {
  isAuthenticated: boolean;
  adminUser: { username: string; role: 'super' | 'operator' } | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

export const useAdminStore = create<AdminState>((set) => ({
  isAuthenticated: !!localStorage.getItem('admin_token'),
  adminUser: null,

  login: async (username: string, _password: string) => {
    // Mock authentication - replace with real API call later
    return new Promise((resolve) => {
      setTimeout(() => {
        if (username === 'admin' || username === 'operator') {
          const role = username === 'admin' ? 'super' as const : 'operator' as const;
          localStorage.setItem('admin_token', 'mock-token-123');
          set({
            isAuthenticated: true,
            adminUser: { username, role },
          });
          resolve(true);
        } else {
          resolve(false);
        }
      }, 500);
    });
  },

  logout: () => {
    localStorage.removeItem('admin_token');
    set({
      isAuthenticated: false,
      adminUser: null,
    });
  },
}));

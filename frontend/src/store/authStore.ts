import { create } from 'zustand';
import type { User } from '../types/auth';

interface AuthStore {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
  updateUser: (user: User) => void;
  setInitializing: (value: boolean) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  // Access token yalnızca memory'de tutulur — localStorage XSS saldırılarına açıktır.
  // Sayfa yenilenmesinde refresh token ile yeniden alınır.
  accessToken: null,
  // Refresh token localStorage'da kalır; kalıcı oturum için gereklidir.
  refreshToken: localStorage.getItem('refresh_token'),
  isAuthenticated: !!localStorage.getItem('refresh_token'),
  isInitializing: !!localStorage.getItem('refresh_token'),

  setAuth: (user, accessToken, refreshToken) => {
    localStorage.setItem('refresh_token', refreshToken);
    set({ user, accessToken, refreshToken, isAuthenticated: true });
  },

  clearAuth: () => {
    localStorage.removeItem('refresh_token');
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
  },

  updateUser: (user) => set({ user }),
  setInitializing: (value) => set({ isInitializing: value }),
}));

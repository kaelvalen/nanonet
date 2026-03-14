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

// Helper functions for localStorage with user persistence
const loadAuthFromLocalStorage = () => {
  const refreshToken = localStorage.getItem('refresh_token');
  const userJson = localStorage.getItem('auth_user');
  let user: User | null = null;
  
  try {
    if (userJson) {
      user = JSON.parse(userJson);
    }
  } catch (e) {
    console.error('Failed to parse stored user:', e);
    localStorage.removeItem('auth_user');
  }
  
  return { refreshToken, user };
};

const { refreshToken: initialRefreshToken, user: initialUser } = loadAuthFromLocalStorage();

export const useAuthStore = create<AuthStore>((set) => ({
  user: initialUser,
  // Access token yalnızca memory'de tutulur — localStorage XSS saldırılarına açıktır.
  // Sayfa yenilenmesinde refresh token ile yeniden alınır.
  accessToken: null,
  // Refresh token localStorage'da kalır; kalıcı oturum için gereklidir.
  refreshToken: initialRefreshToken,
  isAuthenticated: !!initialRefreshToken,
  // Start initializing only if we have a refresh token to restore
  isInitializing: !!initialRefreshToken,

  setAuth: (user, accessToken, refreshToken) => {
    localStorage.setItem('refresh_token', refreshToken);
    localStorage.setItem('auth_user', JSON.stringify(user));
    set({ user, accessToken, refreshToken, isAuthenticated: true });
  },

  clearAuth: () => {
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('auth_user');
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
  },

  updateUser: (user) => {
    localStorage.setItem('auth_user', JSON.stringify(user));
    set({ user });
  },
  setInitializing: (value) => set({ isInitializing: value }),
}));

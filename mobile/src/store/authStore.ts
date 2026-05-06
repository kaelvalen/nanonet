import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { setAccessTokenCache, SECURE_KEY_REFRESH } from "../api/client";
import type { User } from "@nanonet/shared-types";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  setAuth: (user: User, accessToken: string, refreshToken: string) => Promise<void>;
  clearAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,

  setAuth: async (user, accessToken, refreshToken) => {
    setAccessTokenCache(accessToken);
    await SecureStore.setItemAsync(SECURE_KEY_REFRESH, refreshToken);
    set({ user, isAuthenticated: true });
  },

  clearAuth: async () => {
    setAccessTokenCache(null);
    await SecureStore.deleteItemAsync(SECURE_KEY_REFRESH);
    set({ user: null, isAuthenticated: false });
  },
}));

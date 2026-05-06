import axios, { type InternalAxiosRequestConfig } from "axios";
import * as SecureStore from "expo-secure-store";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

export const SECURE_KEY_REFRESH = "nn_refresh_token";

let _accessTokenCache: string | null = null;

export function setAccessTokenCache(token: string | null) {
  _accessTokenCache = token;
}

export function getAccessToken(): string | null {
  return _accessTokenCache;
}

export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 15000,
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (_accessTokenCache) {
    config.headers.Authorization = `Bearer ${_accessTokenCache}`;
  }
  return config;
});

let isRefreshing = false;
let pendingResolvers: Array<(token: string) => void> = [];
let pendingRejectors: Array<(err: unknown) => void> = [];

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }
    originalRequest._retry = true;

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingResolvers.push((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          resolve(apiClient(originalRequest));
        });
        pendingRejectors.push(reject);
      });
    }

    isRefreshing = true;
    try {
      const refreshToken = await SecureStore.getItemAsync(SECURE_KEY_REFRESH);
      if (!refreshToken) throw new Error("no refresh token");

      const { data } = await axios.post(`${API_URL}/auth/refresh`, {
        refresh_token: refreshToken,
      });
      const payload = data.data ?? data;
      const newAccess: string = payload.tokens?.access_token ?? payload.access_token;
      const newRefresh: string = payload.refresh_token ?? payload.tokens?.refresh_token;

      setAccessTokenCache(newAccess);
      await SecureStore.setItemAsync(SECURE_KEY_REFRESH, newRefresh);

      pendingResolvers.forEach((r) => r(newAccess));
      originalRequest.headers.Authorization = `Bearer ${newAccess}`;
      return apiClient(originalRequest);
    } catch (err) {
      pendingRejectors.forEach((r) => r(err));
      setAccessTokenCache(null);
      await SecureStore.deleteItemAsync(SECURE_KEY_REFRESH);
      return Promise.reject(err);
    } finally {
      isRefreshing = false;
      pendingResolvers = [];
      pendingRejectors = [];
    }
  }
);

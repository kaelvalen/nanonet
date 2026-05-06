import axios, { type InternalAxiosRequestConfig } from "axios";
import * as SecureStore from "expo-secure-store";

export const SECURE_KEY_REFRESH = "nn_refresh_token";
const SECURE_KEY_API = "nn_server_api_base_url";
const SECURE_KEY_WS = "nn_server_ws_dashboard_url";

let _accessTokenCache: string | null = null;
/** Axios base URL, örn: https://api.example.com/api/v1 (sondaki / yok) */
let _apiBaseUrl = normalizeApiBase(process.env.EXPO_PUBLIC_API_URL ?? "");
/** Tam WebSocket URL, örn: wss://api.example.com/ws/dashboard (token query hook’ta eklenir) */
let _wsDashboardUrl = normalizeWsDashboard(process.env.EXPO_PUBLIC_WS_URL ?? "");

if (_wsDashboardUrl === "" && _apiBaseUrl !== "") {
  _wsDashboardUrl = deriveWsDashboardUrl(_apiBaseUrl);
}

export function setAccessTokenCache(token: string | null) {
  _accessTokenCache = token;
}

export function getAccessToken(): string | null {
  return _accessTokenCache;
}

export function getApiBaseUrl(): string {
  return _apiBaseUrl;
}

export function getWsDashboardUrl(): string {
  return _wsDashboardUrl;
}

function normalizeApiBase(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

/** Frontend ile uyum: VITE_WS_URL = ws://host:8080/ws → .../ws/dashboard */
export function normalizeWsDashboard(raw: string): string {
  const t = raw.trim().replace(/\/+$/, "");
  if (!t) return "";
  if (t.endsWith("/dashboard")) return t;
  if (t.endsWith("/ws")) return `${t}/dashboard`;
  return `${t}/ws/dashboard`;
}

/** REST tabanından mobil dashboard WebSocket adresini çıkarır (aynı host, /ws/dashboard). */
export function deriveWsDashboardUrl(apiBaseUrl: string): string {
  const trimmed = normalizeApiBase(apiBaseUrl);
  if (!trimmed) return "";
  let raw = trimmed;
  if (!raw.includes("://")) raw = `https://${raw}`;
  try {
    const u = new URL(raw);
    const wsProto =
      u.protocol === "https:" ? "wss:" : u.protocol === "http:" ? "ws:" : "ws:";
    const port = u.port ? `:${u.port}` : "";
    return `${wsProto}//${u.hostname}${port}/ws/dashboard`;
  } catch {
    return "";
  }
}

function applyToAxios() {
  apiClient.defaults.baseURL = _apiBaseUrl;
}

export const apiClient = axios.create({
  baseURL: _apiBaseUrl,
  timeout: 15000,
});

/** Uygulama açılışında SecureStore’daki sunucu adreslerini yükler. */
export async function hydrateServerEndpointsFromStorage(): Promise<void> {
  const storedApi = await SecureStore.getItemAsync(SECURE_KEY_API).catch(() => null);
  const storedWs = await SecureStore.getItemAsync(SECURE_KEY_WS).catch(() => null);

  if (storedApi?.trim()) {
    _apiBaseUrl = normalizeApiBase(storedApi);
  }

  if (storedWs?.trim()) {
    _wsDashboardUrl = normalizeWsDashboard(storedWs);
  } else if (_apiBaseUrl) {
    _wsDashboardUrl = deriveWsDashboardUrl(_apiBaseUrl);
  }

  applyToAxios();
}

/**
 * Giriş / ayarlardan REST ve (isteğe bağlı) WS adresini kaydeder.
 * WS boş ise API’ye göre otomatik üretilir.
 */
export async function saveServerEndpoints(apiRaw: string, wsRaw?: string): Promise<void> {
  const api = normalizeApiBase(apiRaw);
  _apiBaseUrl = api;

  if (wsRaw?.trim()) {
    _wsDashboardUrl = normalizeWsDashboard(wsRaw);
    await SecureStore.setItemAsync(SECURE_KEY_WS, _wsDashboardUrl);
  } else {
    _wsDashboardUrl = api ? deriveWsDashboardUrl(api) : normalizeWsDashboard(process.env.EXPO_PUBLIC_WS_URL ?? "");
    await SecureStore.deleteItemAsync(SECURE_KEY_WS).catch(() => {});
  }

  applyToAxios();
  await SecureStore.setItemAsync(SECURE_KEY_API, api);
}

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

    const base = getApiBaseUrl();
    if (!base) {
      return Promise.reject(error);
    }

    isRefreshing = true;
    try {
      const refreshToken = await SecureStore.getItemAsync(SECURE_KEY_REFRESH);
      if (!refreshToken) throw new Error("no refresh token");

      const { data } = await axios.post(`${base}/auth/mobile/refresh`, {
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

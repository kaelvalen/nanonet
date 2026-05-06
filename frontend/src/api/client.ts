import axios, { type InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "../store/authStore";
import { readCookie } from "../utils/cookies";

const CSRF_COOKIE = "nn_csrf";
const MUTATING_METHODS = new Set(["post", "put", "patch", "delete"]);

const apiClient = axios.create({
	baseURL: import.meta.env.VITE_API_URL,
	timeout: 15000,
	// Cookie tabanlı auth: backend nn_refresh + nn_csrf cookie set ediyor;
	// withCredentials olmadan tarayıcı bunları cross-origin fetch'lerde
	// yollamaz. Aynı origin proxy kullanılsa bile zarar vermez.
	withCredentials: true,
});

apiClient.interceptors.request.use(
	(config: InternalAxiosRequestConfig) => {
		// Access token memory'den (Zustand store) okunur — localStorage'dan değil
		const token = useAuthStore.getState().accessToken;
		if (token) {
			config.headers.Authorization = `Bearer ${token}`;
		}

		// Mutating verb'lerde X-CSRF-Token header'ı: cookie'de varsa eşleştir.
		// Backend double-submit cookie pattern bekliyor; cookie yoksa header
		// göndermeyiz (CSRFMiddleware bu durumu pass-through yapar — bearer
		// tabanlı API client'lar için).
		const method = (config.method ?? "get").toLowerCase();
		if (MUTATING_METHODS.has(method)) {
			const csrf = readCookie(CSRF_COOKIE);
			if (csrf) {
				config.headers["X-CSRF-Token"] = csrf;
			}
		}
		return config;
	},
	(error) => Promise.reject(error),
);

// Refresh akışı: aynı anda gelen birden fazla 401'in tek bir refresh
// çağrısını paylaşmasını sağlar. Pending istekler refresh sonucuna abone olur.
let isRefreshing = false;
let pendingRequests: Array<{
	resolve: (token: string) => void;
	reject: (error: unknown) => void;
}> = [];

async function refreshAccessToken(): Promise<string> {
	const response = await axios.post(
		`${import.meta.env.VITE_API_URL}/auth/refresh`,
		undefined,
		{ withCredentials: true },
	);
	const data = response.data?.data ?? {};
	const tokens = data.tokens ?? data;
	const accessToken = tokens?.access_token;
	if (!accessToken) {
		throw new Error("Geçersiz token yenileme yanıtı");
	}
	const store = useAuthStore.getState();
	if (store.user) {
		store.setAuth(store.user, accessToken);
	}
	return accessToken as string;
}

apiClient.interceptors.response.use(
	(response) => response,
	async (error) => {
		const originalRequest = error.config;

		if (error.response?.status === 401 && !originalRequest?._retry) {
			const { clearAuth } = useAuthStore.getState();

			if (isRefreshing) {
				return new Promise((resolve, reject) => {
					pendingRequests.push({
						resolve: (token: string) => {
							originalRequest.headers.Authorization = `Bearer ${token}`;
							resolve(apiClient(originalRequest));
						},
						reject,
					});
				});
			}

			originalRequest._retry = true;
			isRefreshing = true;

			try {
				const access_token = await refreshAccessToken();

				pendingRequests.forEach(({ resolve }) => {
					resolve(access_token);
				});
				pendingRequests = [];

				originalRequest.headers.Authorization = `Bearer ${access_token}`;
				return apiClient(originalRequest);
			} catch (refreshError) {
				pendingRequests.forEach(({ reject }) => {
					reject(refreshError);
				});
				pendingRequests = [];
				clearAuth();
				if (typeof window !== "undefined") {
					window.location.href = "/login";
				}
				return Promise.reject(refreshError);
			} finally {
				isRefreshing = false;
			}
		}

		return Promise.reject(error);
	},
);

export default apiClient;

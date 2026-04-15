import axios from "axios";
import { useAuthStore } from "../store/authStore";

async function refreshAccessToken(refreshToken: string): Promise<string> {
	const response = await axios.post(
		`${import.meta.env.VITE_API_URL}/auth/refresh`,
		{ refresh_token: refreshToken },
	);
	const data = response.data?.data;
	if (!data?.access_token) {
		throw new Error("Geçersiz token yenileme yanıtı");
	}
	const store = useAuthStore.getState();
	if (store.user) {
		store.setAuth(
			store.user,
			data.access_token,
			data.refresh_token ?? refreshToken,
		);
	}
	return data.access_token as string;
}

const apiClient = axios.create({
	baseURL: import.meta.env.VITE_API_URL,
	timeout: 15000,
});

apiClient.interceptors.request.use(
	(config) => {
		// Access token memory'den (Zustand store) okunur — localStorage'dan değil
		const token = useAuthStore.getState().accessToken;
		if (token) {
			config.headers.Authorization = `Bearer ${token}`;
		}
		return config;
	},
	(error) => Promise.reject(error),
);

let isRefreshing = false;
let pendingRequests: Array<{
	resolve: (token: string) => void;
	reject: (error: unknown) => void;
}> = [];

apiClient.interceptors.response.use(
	(response) => response,
	async (error) => {
		const originalRequest = error.config;

		if (error.response?.status === 401 && !originalRequest._retry) {
			const { refreshToken, clearAuth } = useAuthStore.getState();

			if (!refreshToken) {
				clearAuth();
				window.location.href = "/login";
				return Promise.reject(error);
			}

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
				const access_token = await refreshAccessToken(refreshToken);

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
				window.location.href = "/login";
				return Promise.reject(refreshError);
			} finally {
				isRefreshing = false;
			}
		}

		return Promise.reject(error);
	},
);

export default apiClient;

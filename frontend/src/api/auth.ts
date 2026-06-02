import type {
	AuthResponse,
	LoginRequest,
	RegisterRequest,
	TokenResponse,
} from "../types/auth";
import apiClient from "./client";

export const authApi = {
	register: async (data: RegisterRequest): Promise<AuthResponse> => {
		const response = await apiClient.post("/auth/register", data);
		return response.data.data;
	},

	login: async (data: LoginRequest): Promise<AuthResponse> => {
		const response = await apiClient.post("/auth/login", data);
		return response.data.data;
	},

	/**
	 * Refresh — refresh token artık HttpOnly cookie üzerinden taşındığı için
	 * gövdeye token koymuyoruz. Sunucu cookie'yi okur, yeni access token
	 * + (varsa rotated) cookie + csrf_token döner.
	 */
	refresh: async (): Promise<TokenResponse & { csrf_token?: string }> => {
		const response = await apiClient.post("/auth/refresh");
		const data = response.data?.data ?? {};
		return { ...(data.tokens ?? data), csrf_token: data.csrf_token };
	},

	me: async (): Promise<import("../types/auth").User> => {
		const response = await apiClient.get("/auth/me");
		return response.data.data;
	},

	logout: async (): Promise<void> => {
		await apiClient.post("/auth/logout");
	},

	forgotPassword: async (email: string): Promise<void> => {
		await apiClient.post("/auth/forgot-password", { email });
	},

	resetPassword: async (token: string, newPassword: string): Promise<void> => {
		await apiClient.post("/auth/reset-password", {
			token,
			new_password: newPassword,
		});
	},

	createAgentToken: async (serviceId: string): Promise<string> => {
		const response = await apiClient.post("/auth/agent-token", {
			service_id: serviceId,
		});
		return (response.data.data?.agent_token ?? response.data.data?.token) as string;
	},
};

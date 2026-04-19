import apiClient from "./client";

export interface ApiToken {
	id: string;
	user_id: string;
	name: string;
	prefix: string;
	scopes: string[];
	last_used_at?: string | null;
	created_at: string;
	expires_at?: string | null;
	revoked_at?: string | null;
}

export interface CreateApiTokenInput {
	name: string;
	scopes: string[];
	expires_in_days?: number;
}

export interface CreateApiTokenResponse {
	token: ApiToken;
	secret: string;
}

export interface ListApiTokensResponse {
	tokens: ApiToken[];
	available_scopes: string[];
}

export const apiTokensApi = {
	list: async (): Promise<ListApiTokensResponse> => {
		const res = await apiClient.get("/api-tokens");
		return res.data.data;
	},
	create: async (
		input: CreateApiTokenInput,
	): Promise<CreateApiTokenResponse> => {
		const res = await apiClient.post("/api-tokens", input);
		return res.data.data;
	},
	revoke: async (id: string): Promise<void> => {
		await apiClient.delete(`/api-tokens/${id}`);
	},
};

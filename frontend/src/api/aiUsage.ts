import apiClient from "./client";

export interface AiUsageSummary {
	month_spend_usd: number;
	month_input_tokens: number;
	month_output_tokens: number;
	month_call_count: number;
	month_cache_hits: number;
	budget_usd?: number | null;
	budget_used_pct?: number | null;
	budget_remaining_usd?: number | null;
	window_start: string;
}

export interface AiUsageRow {
	id: string;
	user_id: string;
	service_id?: string | null;
	model: string;
	kind: string;
	input_tokens: number;
	output_tokens: number;
	cost_usd: number;
	cache_hit: boolean;
	latency_ms: number;
	created_at: string;
}

export const aiUsageApi = {
	summary: async (): Promise<AiUsageSummary> => {
		const res = await apiClient.get("/ai/usage");
		return res.data.data;
	},
	recent: async (limit = 50): Promise<AiUsageRow[]> => {
		const res = await apiClient.get("/ai/usage/recent", { params: { limit } });
		return res.data.data.calls ?? [];
	},
};

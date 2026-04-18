import apiClient from "./client";

export type SLIType = "availability" | "latency" | "error_rate";

export interface SLO {
	id: string;
	user_id: string;
	service_id: string;
	name: string;
	sli_type: SLIType;
	threshold?: number | null;
	target: number;
	window_days: number;
	enabled: boolean;
	created_at: string;
	updated_at: string;
}

export interface BurndownPoint {
	timestamp: string;
	budget_remaining: number;
	sli: number;
}

export interface Compliance {
	slo: SLO;
	window_start: string;
	window_end: string;
	total_samples: number;
	good_samples: number;
	bad_samples: number;
	current_sli: number;
	error_budget_used: number;
	burn_rate: number;
	healthy: boolean;
	burndown: BurndownPoint[];
}

export interface CreateSLOInput {
	service_id: string;
	name: string;
	sli_type: SLIType;
	threshold?: number | null;
	target: number;
	window_days: number;
}

export const sloApi = {
	list: async (serviceId?: string): Promise<SLO[]> => {
		const r = await apiClient.get("/slos", {
			params: serviceId ? { service_id: serviceId } : undefined,
		});
		return r.data.data?.slos ?? [];
	},
	create: async (input: CreateSLOInput): Promise<SLO> => {
		const r = await apiClient.post("/slos", input);
		return r.data.data;
	},
	update: async (id: string, patch: Partial<CreateSLOInput> & { enabled?: boolean }): Promise<SLO> => {
		const r = await apiClient.put(`/slos/${id}`, patch);
		return r.data.data;
	},
	remove: async (id: string): Promise<void> => {
		await apiClient.delete(`/slos/${id}`);
	},
	compliance: async (id: string): Promise<Compliance> => {
		const r = await apiClient.get(`/slos/${id}/compliance`);
		return r.data.data;
	},
};

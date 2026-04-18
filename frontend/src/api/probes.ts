import apiClient from "./client";

export type ProbeKind = "http" | "tcp";
export type ProbeStatus = "up" | "down" | "degraded";

export interface Probe {
	id: string;
	user_id: string;
	name: string;
	kind: ProbeKind;
	target: string;
	method: string;
	expected_status: number;
	body_contains?: string | null;
	interval_seconds: number;
	timeout_seconds: number;
	enabled: boolean;
	created_at: string;
	updated_at: string;
	last_run_at?: string | null;
	last_status?: ProbeStatus | null;
	last_latency_ms?: number | null;
	last_error?: string | null;
	consecutive_failures: number;
}

export interface ProbeRun {
	id: number;
	probe_id: string;
	ran_at: string;
	status: ProbeStatus;
	latency_ms: number;
	http_status?: number | null;
	error?: string | null;
}

export interface CreateProbeInput {
	name: string;
	kind: ProbeKind;
	target: string;
	method?: string;
	expected_status?: number;
	body_contains?: string | null;
	interval_seconds: number;
	timeout_seconds: number;
	enabled?: boolean;
}

export const probesApi = {
	list: async (): Promise<Probe[]> => {
		const r = await apiClient.get("/probes");
		return r.data?.data?.probes ?? [];
	},
	create: async (input: CreateProbeInput): Promise<Probe> => {
		const r = await apiClient.post("/probes", input);
		return r.data?.data?.probe;
	},
	update: async (id: string, input: Partial<CreateProbeInput>): Promise<Probe> => {
		const r = await apiClient.put(`/probes/${id}`, input);
		return r.data?.data?.probe;
	},
	remove: async (id: string): Promise<void> => {
		await apiClient.delete(`/probes/${id}`);
	},
	runs: async (id: string, limit = 100): Promise<ProbeRun[]> => {
		const r = await apiClient.get(`/probes/${id}/runs`, { params: { limit } });
		return r.data?.data?.runs ?? [];
	},
};

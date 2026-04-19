import apiClient from "./client";

export type RunbookAction =
	| "restart"
	| "stop"
	| "start"
	| "exec"
	| "scale"
	| "webhook";
export type Severity = "info" | "warn" | "crit";

export interface Runbook {
	id: string;
	user_id: string;
	name: string;
	service_id?: string | null;
	alert_type: string;
	min_severity: Severity;
	action: RunbookAction;
	args: Record<string, unknown>;
	enabled: boolean;
	cooldown_seconds: number;
	max_per_hour: number;
	last_fired_at?: string | null;
	fire_count: number;
	created_at: string;
	updated_at: string;
}

export interface RunbookFire {
	id: number;
	runbook_id: string;
	service_id: string;
	alert_id?: string | null;
	fired_at: string;
	status: "dispatched" | "skipped_cooldown" | "skipped_rate" | "failed";
	note?: string | null;
}

export interface CreateRunbookInput {
	name: string;
	service_id?: string | null;
	alert_type: string;
	min_severity: Severity;
	action: RunbookAction;
	args?: Record<string, unknown>;
	enabled?: boolean;
	cooldown_seconds: number;
	max_per_hour: number;
}

export const runbooksApi = {
	list: async (): Promise<Runbook[]> => {
		const r = await apiClient.get("/runbooks");
		return r.data?.data?.runbooks ?? [];
	},
	create: async (input: CreateRunbookInput): Promise<Runbook> => {
		const r = await apiClient.post("/runbooks", input);
		return r.data?.data?.runbook;
	},
	update: async (
		id: string,
		patch: Partial<CreateRunbookInput>,
	): Promise<Runbook> => {
		const r = await apiClient.put(`/runbooks/${id}`, patch);
		return r.data?.data?.runbook;
	},
	remove: async (id: string): Promise<void> => {
		await apiClient.delete(`/runbooks/${id}`);
	},
	fires: async (id: string, limit = 50): Promise<RunbookFire[]> => {
		const r = await apiClient.get(`/runbooks/${id}/fires`, {
			params: { limit },
		});
		return r.data?.data?.fires ?? [];
	},
};

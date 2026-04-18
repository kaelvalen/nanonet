import apiClient from "./client";

export interface Incident {
	id: string;
	user_id: string;
	service_id: string;
	title: string;
	severity: "info" | "warn" | "crit";
	summary?: string | null;
	postmortem?: string | null;
	started_at: string;
	resolved_at?: string | null;
	created_at: string;
	updated_at: string;
}

export interface IncidentListItem extends Incident {
	service_name: string;
	alert_count: number;
}

export interface TimelineEvent {
	kind: "alert" | "alert_resolved" | "command" | "status_change";
	timestamp: string;
	title: string;
	detail?: string;
	severity?: string;
}

export interface IncidentDetail {
	incident: Incident;
	service_name: string;
	alert_count: number;
	timeline: TimelineEvent[];
}

export const incidentsApi = {
	list: async (limit = 100): Promise<IncidentListItem[]> => {
		const r = await apiClient.get("/incidents", { params: { limit } });
		return r.data.data?.incidents ?? [];
	},
	get: async (id: string): Promise<IncidentDetail> => {
		const r = await apiClient.get(`/incidents/${id}`);
		return r.data.data;
	},
	update: async (
		id: string,
		patch: { title?: string; summary?: string; postmortem?: string },
	): Promise<Incident> => {
		const r = await apiClient.patch(`/incidents/${id}`, patch);
		return r.data.data;
	},
	resolve: async (id: string): Promise<Incident> => {
		const r = await apiClient.post(`/incidents/${id}/resolve`);
		return r.data.data;
	},
	remove: async (id: string): Promise<void> => {
		await apiClient.delete(`/incidents/${id}`);
	},
};

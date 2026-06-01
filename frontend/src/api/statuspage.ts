import axios from "axios";
import apiClient, { apiBaseUrl } from "./client";

// A bare axios instance for unauthenticated calls — bypasses the auth
// interceptor's redirect-on-401 behaviour, which would yank an anonymous
// visitor off the public status page on a transient backend hiccup.
const publicClient = axios.create({
	baseURL: apiBaseUrl,
	timeout: 15000,
});

export interface StatusPage {
	id: string;
	user_id: string;
	slug: string;
	title: string;
	description?: string | null;
	service_ids: string[];
	enabled: boolean;
	created_at: string;
	updated_at: string;
}

export interface CreateStatusPageInput {
	slug: string;
	title: string;
	description?: string | null;
	service_ids: string[];
	enabled?: boolean;
}

export interface PublicStatusService {
	name: string;
	status: "up" | "degraded" | "down" | "unknown";
	uptime_24h: number;
	uptime_30d: number;
	latency_ms?: number | null;
}

export interface PublicStatusIncident {
	title: string;
	severity: "info" | "warn" | "crit";
	started_at: string;
	resolved: boolean;
}

export interface PublicStatusView {
	title: string;
	description?: string | null;
	generated_at: string;
	overall: "operational" | "degraded" | "down";
	services: PublicStatusService[];
	incidents: PublicStatusIncident[];
}

export const statusPageApi = {
	list: async (): Promise<StatusPage[]> => {
		const r = await apiClient.get("/status-pages");
		return r.data.data?.pages ?? [];
	},
	create: async (input: CreateStatusPageInput): Promise<StatusPage> => {
		const r = await apiClient.post("/status-pages", input);
		return r.data.data;
	},
	update: async (
		id: string,
		input: Partial<CreateStatusPageInput>,
	): Promise<StatusPage> => {
		const r = await apiClient.put(`/status-pages/${id}`, input);
		return r.data.data;
	},
	remove: async (id: string): Promise<void> => {
		await apiClient.delete(`/status-pages/${id}`);
	},
	getPublic: async (slug: string): Promise<PublicStatusView> => {
		const r = await publicClient.get(`/public/status/${slug}`);
		return r.data.data;
	},
};

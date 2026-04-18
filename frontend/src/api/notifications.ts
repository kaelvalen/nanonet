import apiClient from "./client";

export type NotificationChannelType =
	| "slack"
	| "discord"
	| "webhook"
	| "email"
	| "pagerduty";

export type NotificationSeverity = "info" | "warn" | "crit";

export interface NotificationChannel {
	id: string;
	user_id: string;
	name: string;
	type: NotificationChannelType;
	enabled: boolean;
	config: Record<string, unknown>;
	severities: NotificationSeverity[];
	service_ids: string[];
	cooldown_sec: number;
	last_used_at?: string | null;
	last_error?: string | null;
	last_error_at?: string | null;
	created_at: string;
	updated_at: string;
}

export interface CreateChannelInput {
	name: string;
	type: NotificationChannelType;
	enabled?: boolean;
	config: Record<string, unknown>;
	severities?: NotificationSeverity[];
	service_ids?: string[];
	cooldown_sec?: number;
}

export interface UpdateChannelInput {
	name?: string;
	enabled?: boolean;
	config?: Record<string, unknown>;
	severities?: NotificationSeverity[];
	service_ids?: string[];
	cooldown_sec?: number;
}

export interface DeliveryRecord {
	id: string;
	channel_id: string;
	alert_id?: string | null;
	service_id?: string | null;
	status: "success" | "failed" | "skipped_cooldown" | "skipped_filter";
	http_status?: number | null;
	error?: string | null;
	duration_ms?: number | null;
	created_at: string;
}

export const notificationsApi = {
	list: async (): Promise<NotificationChannel[]> => {
		const r = await apiClient.get("/notifications/channels");
		return r.data.data?.channels ?? [];
	},
	create: async (input: CreateChannelInput): Promise<NotificationChannel> => {
		const r = await apiClient.post("/notifications/channels", input);
		return r.data.data;
	},
	update: async (
		id: string,
		input: UpdateChannelInput,
	): Promise<NotificationChannel> => {
		const r = await apiClient.put(`/notifications/channels/${id}`, input);
		return r.data.data;
	},
	remove: async (id: string): Promise<void> => {
		await apiClient.delete(`/notifications/channels/${id}`);
	},
	test: async (id: string): Promise<void> => {
		await apiClient.post(`/notifications/channels/${id}/test`);
	},
	deliveries: async (id: string, limit = 50): Promise<DeliveryRecord[]> => {
		const r = await apiClient.get(
			`/notifications/channels/${id}/deliveries?limit=${limit}`,
		);
		return r.data.data?.deliveries ?? [];
	},
};

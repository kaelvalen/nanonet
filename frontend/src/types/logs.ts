export interface ServiceLog {
	time: string;
	id: string;
	service_id: string;
	level: "debug" | "info" | "warn" | "error";
	source: "agent" | "system" | "k8s" | "health_check" | "command";
	message: string;
	fields?: Record<string, unknown>;
}

export interface LogsResponse {
	logs: ServiceLog[];
	total: number;
	limit: number;
	offset: number;
}

export interface LogQueryParams {
	level?: string;
	source?: string;
	search?: string;
	from?: string;
	to?: string;
	limit?: number;
	offset?: number;
}

export interface AuditLog {
	id: string;
	user_id: string;
	action: string;
	resource_type: string;
	resource_id: string;
	details?: string;
	ip_address?: string;
	created_at: string;
}

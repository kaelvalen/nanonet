export interface Service {
	id: string;
	user_id: string;
	name: string;
	host: string;
	port: number;
	health_endpoint: string;
	poll_interval_sec: number;
	status: "up" | "down" | "degraded" | "unknown";
	agent_id: string | null;
	agent_connected?: boolean;
	agent_version?: string | null;
	agent_status?: "healthy" | "stale" | "down" | "unknown";
	agent_last_heartbeat_at?: string | null;
	/**
	 * Agent tarafından gönderilen statik etiketler (`--labels` ile yapılandırılır).
	 * Örn: `{ region: "eu-west", role: "db" }`. Yoksa undefined.
	 */
	agent_labels?: Record<string, string>;
	/**
	 * Agent imza zorunlu mu çalışıyor? Backend `commands.signing_enforced`
	 * kümesi vasıtasıyla agent /status endpoint'inden öğrenir.
	 */
	agent_signing_enforced?: boolean;
	created_at: string;
	updated_at: string;
}

export interface CreateServiceRequest {
	name: string;
	host: string;
	port: number;
	health_endpoint: string;
	poll_interval_sec: number;
}

export interface UpdateServiceRequest {
	name?: string;
	host?: string;
	port?: number;
	health_endpoint?: string;
	poll_interval_sec?: number;
}

export interface CommandLog {
	id: string;
	service_id: string;
	user_id: string;
	command_id: string;
	action: string;
	status: "queued" | "received" | "success" | "failed" | "timeout";
	payload?: unknown;
	output?: string;
	queued_at: string;
	completed_at?: string;
	duration_ms?: number;
}

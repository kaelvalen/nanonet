export interface Alert {
	id: string;
	service_id: string;
	type: string;
	severity: "info" | "warn" | "crit";
	message: string;
	triggered_at: string;
	resolved_at?: string;
}

export interface AlertRules {
	service_id?: string;
	cpu_threshold: number;
	memory_threshold_mb: number;
	latency_threshold_ms: number;
	error_rate_threshold: number;
	is_default?: boolean;
}

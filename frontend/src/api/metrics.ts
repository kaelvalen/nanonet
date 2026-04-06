import type { ServiceMetrics } from "../types/metrics";
import apiClient from "./client";

export interface AlertRules {
	service_id?: string;
	cpu_threshold: number;
	memory_threshold_mb: number;
	latency_threshold_ms: number;
	error_rate_threshold: number;
	is_default?: boolean;
}

export interface AggregatedMetric {
	bucket: string;
	avg_cpu: number | null;
	avg_latency: number | null;
	max_latency: number | null;
	avg_memory: number | null;
}

export interface Alert {
	id: string;
	service_id: string;
	type: string;
	severity: "info" | "warn" | "crit";
	message: string;
	triggered_at: string;
	resolved_at?: string;
}

export interface AIInsight {
	id: string;
	alert_id: string;
	model: string;
	summary: string;
	root_cause?: string;
	recommendations?: { action: string; priority: string }[];
	created_at: string;
}

export interface AnalysisResult {
	summary: string;
	root_cause: string;
	recommendations: { action: string; priority: string }[];
	confidence?: number;
}

export interface CommandLog {
	id: string;
	service_id: string;
	user_id: string;
	command_id: string;
	action: string;
	status: string;
	queued_at: string;
	completed_at?: string;
	duration_ms?: number;
}

export const metricsApi = {
	getHistory: async (
		serviceId: string,
		duration: string = "1h",
		limit: number = 500,
	): Promise<ServiceMetrics[]> => {
		const response = await apiClient.get(`/services/${serviceId}/metrics`, {
			params: { duration, limit },
		});
		const payload = response.data.data;
		return payload?.metrics ?? payload ?? [];
	},

	getAggregated: async (
		serviceId: string,
		duration: string = "24h",
		bucket: string = "1 minute",
	): Promise<AggregatedMetric[]> => {
		const response = await apiClient.get(
			`/services/${serviceId}/metrics/aggregated`,
			{
				params: { duration, bucket },
			},
		);
		const payload = response.data.data;
		return payload?.metrics ?? payload ?? [];
	},

	getUptime: async (
		serviceId: string,
		duration: string = "24h",
	): Promise<{
		uptime_percent: number;
		service_id: string;
		duration: string;
	}> => {
		const response = await apiClient.get(
			`/services/${serviceId}/metrics/uptime`,
			{
				params: { duration },
			},
		);
		return response.data.data;
	},

	getAlerts: async (
		serviceId: string,
		resolved: boolean = false,
	): Promise<Alert[]> => {
		const response = await apiClient.get(`/services/${serviceId}/alerts`, {
			params: { resolved: resolved.toString() },
		});
		const payload = response.data.data;
		return Array.isArray(payload) ? payload : (payload?.alerts ?? []);
	},

	resolveAlert: async (alertId: string): Promise<void> => {
		await apiClient.post(`/alerts/${alertId}/resolve`);
	},

	snoozeAlert: async (alertId: string, minutes: number): Promise<void> => {
		await apiClient.post(`/alerts/${alertId}/snooze`, { minutes });
	},

	getActiveAlerts: async (): Promise<Alert[]> => {
		const response = await apiClient.get("/alerts");
		return response.data.data || [];
	},

	analyze: async (
		serviceId: string,
		windowMinutes: number = 30,
		deepAnalysis: boolean = false,
	): Promise<AnalysisResult> => {
		const response = await apiClient.post(
			`/services/${serviceId}/analyze`,
			{
				window_minutes: windowMinutes,
				deep_analysis: deepAnalysis,
			},
			{ timeout: 60000 },
		);
		return response.data.data?.insight;
	},

	getInsights: async (
		serviceId: string,
		page: number = 1,
	): Promise<{ insights: AIInsight[]; total: number }> => {
		const response = await apiClient.get(`/services/${serviceId}/insights`, {
			params: { page, limit: 20 },
		});
		return response.data.data || { insights: [], total: 0 };
	},

	getCommands: async (
		serviceId: string,
		page: number = 1,
	): Promise<{ commands: CommandLog[]; total: number }> => {
		const response = await apiClient.get(`/services/${serviceId}/commands`, {
			params: { page, limit: 20 },
		});
		return response.data.data || { commands: [], total: 0 };
	},

	getAlertRules: async (serviceId: string): Promise<AlertRules> => {
		const response = await apiClient.get(`/services/${serviceId}/alert-rules`);
		return response.data.data;
	},

	updateAlertRules: async (
		serviceId: string,
		rules: Omit<AlertRules, "service_id" | "is_default">,
	): Promise<AlertRules> => {
		const response = await apiClient.put(
			`/services/${serviceId}/alert-rules`,
			rules,
		);
		return response.data.data;
	},

	getBulkUptime: async (
		duration: string = "24h",
	): Promise<Record<string, number>> => {
		const response = await apiClient.get("/services/uptime/summary", {
			params: { duration },
		});
		return response.data.data?.uptime ?? {};
	},

	getGlobalSummary: async (): Promise<{
		avg_latency_ms: number | null;
		p95_latency_ms: number | null;
		avg_error_rate: number | null;
		avg_cpu_percent: number | null;
		avg_memory_used_mb: number | null;
	}> => {
		try {
			const response = await apiClient.get("/metrics/summary");
			return (
				response.data.data ?? {
					avg_latency_ms: null,
					p95_latency_ms: null,
					avg_error_rate: null,
					avg_cpu_percent: null,
					avg_memory_used_mb: null,
				}
			);
		} catch {
			return {
				avg_latency_ms: null,
				p95_latency_ms: null,
				avg_error_rate: null,
				avg_cpu_percent: null,
				avg_memory_used_mb: null,
			};
		}
	},

	getAllInsights: async (
		limit: number = 3,
	): Promise<{ insights: AIInsight[]; total: number }> => {
		try {
			const response = await apiClient.get("/insights", {
				params: { limit, page: 1 },
			});
			return response.data.data || { insights: [], total: 0 };
		} catch {
			return { insights: [], total: 0 };
		}
	},
};

export type TimeRange = "1h" | "24h" | "7d" | "30d";

export const TIME_RANGE_LABELS: Record<TimeRange, string> = {
	"1h": "Son 1 Saat",
	"24h": "Son 24 Saat",
	"7d": "Son 7 Gün",
	"30d": "Son 30 Gün",
};

export interface ReportEvent {
	service: string;
	time: string;
	observation: string;
	root_cause: string;
	impact: string;
	action: string;
	outcome: string;
	category: "tamamlandı" | "müdahale_gerekli" | "izleniyor" | "trend";
}

export interface ReportResult {
	period_label: string;
	system_score: "SAĞLIKLI" | "DİKKAT" | "KRİTİK";
	headline: string;
	total_requests?: string;
	critical_events: number;
	resolved_events: number;
	events: ReportEvent[];
	actions: { action: string; priority: string; estimated_impact?: string }[];
	risk_forecast: string;
	confidence?: number;
}

export const aiReportApi = {
	generate: async (
		timeRange: TimeRange,
		serviceId?: string,
	): Promise<ReportResult> => {
		const response = await apiClient.post(
			"/ai/report",
			{ time_range: timeRange, service_id: serviceId ?? "" },
			{ timeout: 90000 },
		);
		return response.data.data?.report;
	},
};

export interface ChatMessage {
	role: "user" | "assistant";
	content: string;
}

export interface ChatResponse {
	reply: string;
	model: string;
	tokens_used?: number;
}

export const aiChatApi = {
	chat: async (
		message: string,
		history: ChatMessage[],
		context: string = "global",
	): Promise<ChatResponse> => {
		const response = await apiClient.post(
			"/ai/chat",
			{ message, history, context },
			{ timeout: 60000 },
		);
		return response.data.data;
	},
};

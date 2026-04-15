import type {
	AIInsight,
	AnalysisResult,
	ChatMessage,
	ChatResponse,
	ReportResult,
	TimeRange,
} from "../types/ai";
import type { Alert, AlertRules } from "../types/alerts";
import type { LogQueryParams, LogsResponse } from "../types/logs";
import type { ServiceMetrics } from "../types/metrics";
import apiClient from "./client";

export type {
	AIInsight,
	AnalysisResult,
	ChatMessage,
	ChatResponse,
	ReportEvent,
	ReportResult,
	TimeRange,
} from "../types/ai";
export type { Alert, AlertRules } from "../types/alerts";
export type {
	AuditLog,
	LogQueryParams,
	LogsResponse,
	ServiceLog,
} from "../types/logs";
export { TIME_RANGE_LABELS } from "../types/ai";

export interface AggregatedMetric {
	bucket: string;
	avg_cpu: number | null;
	avg_latency: number | null;
	max_latency: number | null;
	avg_memory: number | null;
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

export const logsApi = {
	getServiceLogs: async (
		serviceId: string,
		params: LogQueryParams = {},
	): Promise<LogsResponse> => {
		const response = await apiClient.get(`/services/${serviceId}/logs`, {
			params,
		});
		return response.data.data;
	},

	getStats: async (
		serviceId?: string,
		since?: string,
	): Promise<Record<string, number>> => {
		const response = await apiClient.get("/logs/stats", {
			params: { service_id: serviceId, since },
		});
		return response.data.data;
	},

	getAuditLogs: async (
		params: { limit?: number; offset?: number } = {},
	): Promise<{
		logs: unknown[];
		total: number;
		limit: number;
		offset: number;
	}> => {
		const response = await apiClient.get("/audit", { params });
		return response.data.data;
	},
};

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

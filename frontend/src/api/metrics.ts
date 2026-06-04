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
export { TIME_RANGE_LABELS } from "../types/ai";
export type { Alert, AlertRules } from "../types/alerts";
export type {
	AuditLog,
	LogQueryParams,
	LogsResponse,
	ServiceLog,
} from "../types/logs";

export interface AggregatedMetric {
	bucket: string;
	avg_cpu: number | null;
	avg_latency: number | null;
	max_latency: number | null;
	avg_memory: number | null;
}

export interface ForecastPoint {
	timestamp: string;
	value: number;
	lower: number;
	upper: number;
}

export interface ForecastResponse {
	series: ForecastPoint[];
	confidence: number;
	next_value: number | null;
	next_alert_at?: string | null;
	threshold?: number | null;
}

export type ForecastMetric = "cpu" | "memory" | "latency" | "error_rate";

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
		// payload may be { metrics: [...] } or a bare array, or null. Always
		// return an array so consumers can safely iterate.
		if (Array.isArray(payload)) return payload;
		if (Array.isArray(payload?.metrics)) return payload.metrics;
		return [];
	},

	getForecast: async (
		serviceId: string,
		metric: ForecastMetric = "cpu",
		horizon = 12,
		threshold?: number,
	): Promise<{ forecast: ForecastResponse; metric: ForecastMetric }> => {
		const params: Record<string, string | number> = { metric, horizon };
		if (threshold != null) params.threshold = threshold;
		const r = await apiClient.get(`/services/${serviceId}/metrics/forecast`, {
			params,
		});
		return r.data.data;
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
		// payload may be { metrics: [...] } or a bare array, or null. Always
		// return an array so consumers can safely iterate.
		if (Array.isArray(payload)) return payload;
		if (Array.isArray(payload?.metrics)) return payload.metrics;
		return [];
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
		return normalizeLogsResponse(response.data, params);
	},

	searchAll: async (
		params: LogQueryParams & { service_id?: string } = {},
	): Promise<LogsResponse> => {
		const response = await apiClient.get("/logs", { params });
		return normalizeLogsResponse(response.data, params);
	},

	getStats: async (
		serviceId?: string,
		since?: string,
	): Promise<Record<string, number>> => {
		const response = await apiClient.get("/logs/stats", {
			params: { service_id: serviceId, since },
		});
		const payload = response.data?.data ?? response.data;
		const stats = payload?.stats ?? payload ?? {};
		if (Array.isArray(stats)) {
			return stats.reduce<Record<string, number>>((acc, row) => {
				const level = row?.level;
				if (typeof level === "string") {
					acc[level] = Number(row?.count ?? 0);
				}
				return acc;
			}, {});
		}
		return stats;
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

function normalizeLogsResponse(
	raw: unknown,
	params: LogQueryParams = {},
): LogsResponse {
	const payload =
		(raw as { data?: unknown } | undefined)?.data ??
		(raw as { logs?: unknown } | undefined) ??
		{};
	const logs = Array.isArray((payload as { logs?: unknown }).logs)
		? ((payload as { logs: LogsResponse["logs"] }).logs)
		: [];
	const limit =
		typeof (payload as { limit?: unknown }).limit === "number"
			? ((payload as { limit: number }).limit)
			: (params.limit ?? logs.length);
	const offset =
		typeof (payload as { offset?: unknown }).offset === "number"
			? ((payload as { offset: number }).offset)
			: (params.offset ?? 0);
	const total =
		typeof (payload as { total?: unknown }).total === "number"
			? ((payload as { total: number }).total)
			: logs.length;
	return { logs, total, limit, offset };
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

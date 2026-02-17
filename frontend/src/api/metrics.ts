import apiClient from './client';
import type { ServiceMetrics } from '../types/metrics';

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
  severity: 'info' | 'warn' | 'crit';
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
  getHistory: async (serviceId: string, duration: string = '1h'): Promise<ServiceMetrics[]> => {
    const response = await apiClient.get(`/services/${serviceId}/metrics`, {
      params: { duration },
    });
    return response.data.data || [];
  },

  getAggregated: async (serviceId: string, duration: string = '24h', bucket: string = '1 minute'): Promise<AggregatedMetric[]> => {
    const response = await apiClient.get(`/services/${serviceId}/metrics/aggregated`, {
      params: { duration, bucket },
    });
    return response.data.data || [];
  },

  getUptime: async (serviceId: string, duration: string = '24h'): Promise<{ uptime_percent: number }> => {
    const response = await apiClient.get(`/services/${serviceId}/metrics/uptime`, {
      params: { duration },
    });
    return response.data.data;
  },

  getAlerts: async (serviceId: string, resolved: boolean = false): Promise<Alert[]> => {
    const response = await apiClient.get(`/services/${serviceId}/alerts`, {
      params: { resolved: resolved.toString() },
    });
    return response.data.data || [];
  },

  resolveAlert: async (alertId: string): Promise<void> => {
    await apiClient.post(`/alerts/${alertId}/resolve`);
  },

  getActiveAlerts: async (): Promise<Alert[]> => {
    const response = await apiClient.get('/alerts');
    return response.data.data || [];
  },

  analyze: async (serviceId: string, windowMinutes: number = 30): Promise<AnalysisResult> => {
    const response = await apiClient.post(`/services/${serviceId}/analyze`, {
      window_minutes: windowMinutes,
    });
    return response.data.data?.insight;
  },

  getInsights: async (serviceId: string, page: number = 1): Promise<{ insights: AIInsight[]; total: number }> => {
    const response = await apiClient.get(`/services/${serviceId}/insights`, {
      params: { page, limit: 10 },
    });
    return response.data.data || { insights: [], total: 0 };
  },

  getCommands: async (serviceId: string, page: number = 1): Promise<{ commands: CommandLog[]; total: number }> => {
    const response = await apiClient.get(`/services/${serviceId}/commands`, {
      params: { page, limit: 20 },
    });
    return response.data.data || { commands: [], total: 0 };
  },
};

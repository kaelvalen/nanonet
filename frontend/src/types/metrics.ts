export interface ServiceMetrics {
  time: string;
  service_id: string;
  cpu_percent?: number;
  memory_used_mb?: number;
  latency_ms?: number;
  error_rate?: number;
  status: 'up' | 'down' | 'degraded' | 'unknown';
  disk_used_gb?: number;
}

export interface MetricSnapshot {
  time: string;
  status: string;
  cpu_percent?: number | null;
  memory_used_mb?: number | null;
  latency_ms?: number | null;
  error_rate?: number | null;
  disk_used_gb?: number | null;
}

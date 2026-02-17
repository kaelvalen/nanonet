export interface ServiceMetrics {
  time: string;
  service_id: string;
  cpu_percent?: number;
  memory_used_mb?: number;
  latency_ms?: number;
  error_rate?: number;
  status: 'up' | 'down' | 'degraded';
  disk_used_gb?: number;
}

export interface MetricSnapshot {
  time: string;
  cpu_percent: number;
  memory_used_mb: number;
  latency_ms: number;
  error_rate: number;
  status: string;
  disk_used_gb: number;
}

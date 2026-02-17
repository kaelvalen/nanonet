export interface Service {
  id: string;
  user_id: string;
  name: string;
  host: string;
  port: number;
  health_endpoint: string;
  poll_interval_sec: number;
  status: 'up' | 'down' | 'degraded' | 'unknown';
  agent_id: string | null;
  agent_connected?: boolean;
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

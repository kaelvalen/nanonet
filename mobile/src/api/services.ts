import { apiClient } from "./client";
import type { CommandLog, CreateServiceRequest, Service, ServiceMetrics, UpdateServiceRequest } from "@nanonet/shared-types";

interface MetricsHistoryEnvelope {
  metrics?: ServiceMetrics[];
  count?: number;
  duration?: string;
  service_id?: string;
}

export const servicesApi = {
  list: async (): Promise<Service[]> => {
    const { data } = await apiClient.get<{ data: Service[] | { services?: Service[] } }>("/services");
    const inner = data.data;
    if (Array.isArray(inner)) return inner;
    return inner?.services ?? [];
  },

  get: async (id: string): Promise<Service> => {
    const { data } = await apiClient.get<{ data: Service }>(`/services/${id}`);
    return data.data;
  },

  metrics: async (id: string, duration = "1h", limit = 500): Promise<ServiceMetrics[]> => {
    const { data } = await apiClient.get<{ data: MetricsHistoryEnvelope }>(`/services/${id}/metrics`, {
      params: { duration, limit },
    });
    const envelope = data.data;
    const raw = envelope?.metrics ?? (Array.isArray(envelope as unknown as ServiceMetrics[]) ? (envelope as unknown as ServiceMetrics[]) : []);
    return Array.isArray(raw) ? raw : [];
  },

  create: async (body: CreateServiceRequest): Promise<Service> => {
    const { data } = await apiClient.post<{ data: Service }>("/services", body);
    return data.data;
  },

  update: async (id: string, body: UpdateServiceRequest): Promise<Service> => {
    const { data } = await apiClient.put<{ data: Service }>(`/services/${id}`, body);
    return data.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/services/${id}`);
  },

  restart: async (id: string): Promise<{ command_id: string }> => {
    const { data } = await apiClient.post<{ data: { command_id?: string } }>(`/services/${id}/restart`, {
      timeout_sec: 45,
    });
    return { command_id: data.data.command_id ?? "" };
  },

  stop: async (id: string, graceful = true): Promise<{ command_id: string }> => {
    const { data } = await apiClient.post<{ data: { command_id?: string } }>(`/services/${id}/stop`, { graceful });
    return { command_id: data.data.command_id ?? "" };
  },

  start: async (id: string): Promise<{ command_id: string }> => {
    const { data } = await apiClient.post<{ data: { command_id?: string } }>(`/services/${id}/start`, {});
    return { command_id: data.data.command_id ?? "" };
  },

  ping: async (id: string): Promise<unknown> => {
    const { data } = await apiClient.post<{ data: unknown }>(`/services/${id}/ping`, {});
    return data.data;
  },

  commands: async (id: string, page = 1, limit = 15): Promise<{ commands: CommandLog[]; total: number }> => {
    const { data } = await apiClient.get<{ data: { commands: CommandLog[]; total: number } }>(`/services/${id}/commands`, {
      params: { page, limit },
    });
    return data.data ?? { commands: [], total: 0 };
  },
};

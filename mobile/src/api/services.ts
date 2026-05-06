import { apiClient } from "./client";
import type { Service, ServiceMetrics } from "@nanonet/shared-types";

export const servicesApi = {
  list: async (): Promise<Service[]> => {
    const { data } = await apiClient.get<{ data: Service[] }>("/services");
    return Array.isArray(data.data) ? data.data : [];
  },

  get: async (id: string): Promise<Service> => {
    const { data } = await apiClient.get<{ data: Service }>(`/services/${id}`);
    return data.data;
  },

  metrics: async (id: string, range = "1h"): Promise<ServiceMetrics[]> => {
    const { data } = await apiClient.get<{ data: ServiceMetrics[] }>(
      `/metrics/${id}?range=${range}`
    );
    return data.data ?? [];
  },
};

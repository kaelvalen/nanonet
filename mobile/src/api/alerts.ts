import { apiClient } from "./client";
import type { Alert } from "@nanonet/shared-types";

export const alertsApi = {
  list: async (serviceId?: string): Promise<Alert[]> => {
    const params = serviceId ? `?service_id=${serviceId}` : "";
    const { data } = await apiClient.get<{ data: Alert[] }>(`/alerts${params}`);
    return Array.isArray(data.data) ? data.data : [];
  },
};

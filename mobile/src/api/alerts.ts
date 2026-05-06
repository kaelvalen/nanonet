import { apiClient } from "./client";
import type { Alert } from "@nanonet/shared-types";

export const alertsApi = {
  list: async (opts?: { serviceId?: string; includeResolved?: boolean }): Promise<Alert[]> => {
    const params: Record<string, string> = {};
    if (opts?.serviceId) params.service_id = opts.serviceId;
    if (opts?.includeResolved) params.resolved = "true";
    const { data } = await apiClient.get<{ data: { alerts?: Alert[] } | Alert[] }>("/alerts", {
      params: Object.keys(params).length ? params : undefined,
    });
    const inner = data.data;
    if (Array.isArray(inner)) return inner;
    return inner.alerts ?? [];
  },

  resolve: async (alertId: string): Promise<void> => {
    await apiClient.post(`/alerts/${alertId}/resolve`);
  },

  snooze: async (alertId: string, minutes: number): Promise<void> => {
    await apiClient.post(`/alerts/${alertId}/snooze`, { minutes });
  },
};

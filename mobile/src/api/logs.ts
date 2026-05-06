import { apiClient } from "./client";
import type { LogsResponse } from "@nanonet/shared-types";

export const logsApi = {
  list: async (params: { serviceId?: string; limit?: number; offset?: number } = {}): Promise<LogsResponse> => {
    const q = new URLSearchParams();
    if (params.serviceId) q.set("service_id", params.serviceId);
    q.set("limit", String(params.limit ?? 50));
    q.set("offset", String(params.offset ?? 0));
    const { data } = await apiClient.get<{ data: LogsResponse }>(`/logs?${q}`);
    return data.data;
  },
};

import { apiClient } from "./client";

export interface IncidentListItem {
  id: string;
  title: string;
  severity: "info" | "warn" | "crit";
  service_name: string;
  started_at: string;
  resolved_at: string | null;
  alert_count: number;
}

export const incidentsApi = {
  list: async (): Promise<IncidentListItem[]> => {
    const { data } = await apiClient.get<{ data: { incidents: IncidentListItem[] } }>("/incidents");
    return data.data.incidents ?? [];
  },
};

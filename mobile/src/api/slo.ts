import { apiClient } from "./client";

export interface SLO {
  id: string;
  user_id: string;
  service_id: string;
  name: string;
  sli_type: string;
  threshold?: number | null;
  target: number;
  window_days: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

/** GET /slos/:id/compliance — backend `Compliance` */
export interface SLOCompliance {
  slo: SLO;
  window_start: string;
  window_end: string;
  total_samples: number;
  good_samples: number;
  bad_samples: number;
  current_sli: number;
  error_budget_used: number;
  burn_rate: number;
  healthy: boolean;
  burndown: { timestamp: string; budget_remaining: number; sli: number }[];
}

export const sloApi = {
  listDefinitions: async (serviceId?: string): Promise<SLO[]> => {
    const { data } = await apiClient.get<{ data: { slos: SLO[] } }>("/slos", {
      params: serviceId ? { service_id: serviceId } : undefined,
    });
    return data.data.slos ?? [];
  },

  compliance: async (sloId: string): Promise<SLOCompliance> => {
    const { data } = await apiClient.get<{ data: SLOCompliance }>(`/slos/${sloId}/compliance`);
    return data.data;
  },

  /** List SLOs for user (or one service) and attach live compliance per row. */
  listWithCompliance: async (serviceId?: string): Promise<SLOCompliance[]> => {
    const defs = await sloApi.listDefinitions(serviceId);
    const rows = await Promise.all(
      defs.map(async (slo) => {
        try {
          return await sloApi.compliance(slo.id);
        } catch {
          return null;
        }
      }),
    );
    return rows.filter((r): r is SLOCompliance => r != null);
  },
};

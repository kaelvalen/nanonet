import { apiClient } from "./client";

export interface SLO {
  id: string;
  name: string;
  sli_type: string;
  target: number;
  window_days: number;
}

export interface SLOCompliance {
  slo: SLO;
  good_samples: number;
  total_samples: number;
  compliance_pct: number;
  budget_remaining_pct: number;
}

export const sloApi = {
  list: async (): Promise<SLOCompliance[]> => {
    const { data } = await apiClient.get<{ data: { slos: SLOCompliance[] } }>("/slo/compliance");
    return data.data.slos ?? [];
  },
};

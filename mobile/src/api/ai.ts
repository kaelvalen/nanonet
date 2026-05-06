import { apiClient } from "./client";
import type { AIInsight } from "@nanonet/shared-types";

export const aiApi = {
  insights: async (limit = 30): Promise<AIInsight[]> => {
    const { data } = await apiClient.get<{ data: { insights: AIInsight[] } }>("/insights", {
      params: { limit, page: 1 },
    });
    return data.data.insights ?? [];
  },
};

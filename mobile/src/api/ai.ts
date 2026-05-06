import { apiClient } from "./client";
import type { AIInsight } from "@nanonet/shared-types";

export const aiApi = {
  insights: async (): Promise<AIInsight[]> => {
    const { data } = await apiClient.get<{ data: { insights: AIInsight[] } }>("/ai/insights");
    return data.data.insights ?? [];
  },
};

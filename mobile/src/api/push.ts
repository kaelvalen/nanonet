import { apiClient } from "./client";

export interface PushPreference {
  user_id: string;
  enabled: boolean;
  min_severity: "info" | "warn" | "crit";
}

export const pushApi = {
  registerToken: async (token: string, platform: "ios" | "android"): Promise<void> => {
    await apiClient.post("/notifications/push-token", { token, platform });
  },

  deleteToken: async (token: string): Promise<void> => {
    await apiClient.delete("/notifications/push-token", { data: { token } });
  },

  getPreference: async (): Promise<PushPreference> => {
    const { data } = await apiClient.get<{ data: PushPreference }>("/notifications/push-preferences");
    return data.data;
  },

  updatePreference: async (pref: Partial<PushPreference>): Promise<PushPreference> => {
    const { data } = await apiClient.put<{ data: PushPreference }>("/notifications/push-preferences", pref);
    return data.data;
  },
};

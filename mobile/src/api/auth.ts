import { apiClient } from "./client";
import type { User } from "@nanonet/shared-types";

export interface MobileLoginResponse {
  user: User;
  tokens: { access_token: string; refresh_token: string; expires_in: number };
}

export const authApi = {
  login: async (email: string, password: string): Promise<MobileLoginResponse> => {
    const { data } = await apiClient.post<{ data: MobileLoginResponse }>("/auth/login", {
      email,
      password,
    });
    return data.data;
  },

  logout: async (): Promise<void> => {
    await apiClient.post("/auth/logout").catch(() => null);
  },
};

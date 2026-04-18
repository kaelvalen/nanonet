import apiClient from "./client";

export interface DemoSeedResult {
	created_count: number;
	created_service_ids: string[];
}

export const demoApi = {
	seed: async (): Promise<DemoSeedResult> => {
		const response = await apiClient.post("/demo/seed");
		return response.data.data;
	},
};

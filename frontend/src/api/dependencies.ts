import apiClient from "./client";

export interface ServiceDependency {
	id: string;
	service_id: string;
	target_host: string;
	target_port: number;
	protocol: string;
	process_name?: string | null;
	promoted: boolean;
	sample_count: number;
	first_seen_at: string;
	last_seen_at: string;
}

export const dependenciesApi = {
	list: async (serviceId: string): Promise<ServiceDependency[]> => {
		const r = await apiClient.get(`/services/${serviceId}/dependencies`);
		return r.data?.data?.dependencies ?? [];
	},
	promote: async (
		serviceId: string,
		depId: string,
		promoted: boolean,
	): Promise<void> => {
		await apiClient.patch(`/services/${serviceId}/dependencies/${depId}`, {
			promoted,
		});
	},
	remove: async (serviceId: string, depId: string): Promise<void> => {
		await apiClient.delete(`/services/${serviceId}/dependencies/${depId}`);
	},
};

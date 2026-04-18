import apiClient from "./client";

export type GrantRole = "viewer" | "operator" | "admin";

export interface ServiceGrant {
	id: string;
	service_id: string;
	grantee_user_id: string;
	grantee_email: string;
	role: GrantRole;
	created_at: string;
}

export const grantsApi = {
	list: async (serviceId: string): Promise<ServiceGrant[]> => {
		const res = await apiClient.get(`/services/${serviceId}/grants`);
		return res.data.data.grants ?? [];
	},
	create: async (
		serviceId: string,
		input: { email: string; role: GrantRole },
	): Promise<void> => {
		await apiClient.post(`/services/${serviceId}/grants`, input);
	},
	update: async (
		serviceId: string,
		grantId: string,
		role: GrantRole,
	): Promise<void> => {
		await apiClient.patch(`/services/${serviceId}/grants/${grantId}`, { role });
	},
	remove: async (serviceId: string, grantId: string): Promise<void> => {
		await apiClient.delete(`/services/${serviceId}/grants/${grantId}`);
	},
};

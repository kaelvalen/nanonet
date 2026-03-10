import apiClient from './client';

export interface MaintenanceWindow {
  id: string;
  service_id: string;
  starts_at: string;
  ends_at: string;
  reason?: string;
  created_by?: string;
  created_at: string;
}

export interface CreateMaintenanceWindowRequest {
  starts_at: string;
  ends_at: string;
  reason?: string;
}

export const maintenanceApi = {
  list: async (serviceId: string): Promise<MaintenanceWindow[]> => {
    const response = await apiClient.get(`/services/${serviceId}/maintenance`);
    return response.data.data ?? [];
  },

  create: async (serviceId: string, req: CreateMaintenanceWindowRequest): Promise<MaintenanceWindow> => {
    const response = await apiClient.post(`/services/${serviceId}/maintenance`, req);
    return response.data.data;
  },

  delete: async (serviceId: string, windowId: string): Promise<void> => {
    await apiClient.delete(`/services/${serviceId}/maintenance/${windowId}`);
  },
};

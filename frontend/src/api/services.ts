import apiClient from './client';
import type { Service, CreateServiceRequest, UpdateServiceRequest, CommandLog } from '../types/service';

export const servicesApi = {
  list: async (): Promise<Service[]> => {
    const response = await apiClient.get('/services');
    return response.data.data || [];
  },

  get: async (id: string): Promise<Service> => {
    const response = await apiClient.get(`/services/${id}`);
    return response.data.data;
  },

  create: async (data: CreateServiceRequest): Promise<Service> => {
    const response = await apiClient.post('/services', data);
    return response.data.data;
  },

  update: async (id: string, data: UpdateServiceRequest): Promise<Service> => {
    const response = await apiClient.put(`/services/${id}`, data);
    return response.data.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/services/${id}`);
  },

  restart: async (id: string): Promise<void> => {
    await apiClient.post(`/services/${id}/restart`);
  },

  stop: async (id: string): Promise<void> => {
    await apiClient.post(`/services/${id}/stop`);
  },

  exec: async (id: string, command: string, timeoutSec = 30): Promise<{ command_id: string; status: string; queued_at: string }> => {
    const response = await apiClient.post(`/services/${id}/exec`, { command, timeout_sec: timeoutSec });
    return response.data.data;
  },

  start: async (id: string): Promise<{ command_id: string; status: string; queued_at: string }> => {
    const response = await apiClient.post(`/services/${id}/start`);
    return response.data.data;
  },

  scale: async (id: string, instances: number, strategy = 'round_robin'): Promise<{ command_id: string; status: string; instances: number; strategy: string; queued_at: string }> => {
    const response = await apiClient.post(`/services/${id}/scale`, { instances, strategy });
    return response.data.data;
  },

  getCommandHistory: async (id: string, limit = 20, page = 1): Promise<{ commands: CommandLog[]; total: number; page: number }> => {
    const response = await apiClient.get(`/services/${id}/commands`, { params: { limit, page } });
    return response.data.data;
  },
};

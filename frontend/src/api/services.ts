import apiClient from './client';
import type { Service, CreateServiceRequest, UpdateServiceRequest } from '../types/service';

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
};

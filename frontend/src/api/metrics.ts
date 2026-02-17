import apiClient from './client';
import type { ServiceMetrics } from '../types/metrics';

export const metricsApi = {
  getHistory: async (serviceId: string, duration: string = '1h'): Promise<ServiceMetrics[]> => {
    const response = await apiClient.get(`/services/${serviceId}/metrics`, {
      params: { duration },
    });
    return response.data.data;
  },

  analyze: async (serviceId: string, metricsData: string): Promise<unknown> => {
    const response = await apiClient.post(`/services/${serviceId}/analyze`, {
      metrics_data: metricsData,
    });
    return response.data.data;
  },
};

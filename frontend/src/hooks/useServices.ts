import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { servicesApi } from '../api/services';
import { useServiceStore } from '../store/serviceStore';
import type { CreateServiceRequest, UpdateServiceRequest } from '../types/service';
import toast from 'react-hot-toast';

export function useServices() {
  const queryClient = useQueryClient();
  const { setServices, addService, updateService, removeService } = useServiceStore();

  const servicesQuery = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const data = await servicesApi.list();
      setServices(data);
      return data;
    },
    staleTime: 30000,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateServiceRequest) => servicesApi.create(data),
    onSuccess: (newService) => {
      addService(newService);
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast.success('Servis oluşturuldu');
    },
    onError: () => {
      toast.error('Servis oluşturulamadı');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateServiceRequest }) =>
      servicesApi.update(id, data),
    onSuccess: (updatedService) => {
      updateService(updatedService.id, updatedService);
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast.success('Servis güncellendi');
    },
    onError: () => {
      toast.error('Servis güncellenemedi');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => servicesApi.delete(id),
    onSuccess: (_, id) => {
      removeService(id);
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast.success('Servis silindi');
    },
    onError: () => {
      toast.error('Servis silinemedi');
    },
  });

  const restartMutation = useMutation({
    mutationFn: (id: string) => servicesApi.restart(id),
    onSuccess: () => {
      toast.success('Restart komutu gönderildi');
    },
    onError: () => {
      toast.error('Restart komutu gönderilemedi');
    },
  });

  const stopMutation = useMutation({
    mutationFn: (id: string) => servicesApi.stop(id),
    onSuccess: () => {
      toast.success('Stop komutu gönderildi');
    },
    onError: () => {
      toast.error('Stop komutu gönderilemedi');
    },
  });

  return {
    services: servicesQuery.data || [],
    isLoading: servicesQuery.isLoading,
    createService: createMutation.mutate,
    updateService: (id: string, data: UpdateServiceRequest) =>
      updateMutation.mutate({ id, data }),
    deleteService: deleteMutation.mutate,
    restartService: restartMutation.mutate,
    stopService: stopMutation.mutate,
  };
}

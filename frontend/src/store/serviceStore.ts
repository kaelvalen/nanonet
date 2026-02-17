import { create } from 'zustand';
import type { Service } from '../types/service';

interface ServiceStore {
  services: Service[];
  selectedService: Service | null;
  isLoading: boolean;
  error: string | null;
  setServices: (services: Service[]) => void;
  addService: (service: Service) => void;
  updateService: (id: string, updates: Partial<Service>) => void;
  removeService: (id: string) => void;
  selectService: (service: Service | null) => void;
  updateServiceStatus: (id: string, status: Service['status']) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useServiceStore = create<ServiceStore>((set) => ({
  services: [],
  selectedService: null,
  isLoading: false,
  error: null,
  
  setServices: (services) => set({ services }),
  
  addService: (service) => set((state) => ({
    services: [service, ...state.services],
  })),
  
  updateService: (id, updates) => set((state) => ({
    services: state.services.map((s) =>
      s.id === id ? { ...s, ...updates } : s
    ),
    selectedService: state.selectedService?.id === id
      ? { ...state.selectedService, ...updates }
      : state.selectedService,
  })),
  
  removeService: (id) => set((state) => ({
    services: state.services.filter((s) => s.id !== id),
    selectedService: state.selectedService?.id === id ? null : state.selectedService,
  })),
  
  selectService: (service) => set({ selectedService: service }),
  
  updateServiceStatus: (id, status) => set((state) => ({
    services: state.services.map((s) =>
      s.id === id ? { ...s, status } : s
    ),
  })),
  
  setLoading: (isLoading) => set({ isLoading }),
  
  setError: (error) => set({ error }),
}));

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { CreateServiceRequest } from '../../types/service';

const serviceSchema = z.object({
  name: z.string().min(2, 'En az 2 karakter').max(100, 'En fazla 100 karakter'),
  host: z.string().min(1, 'Host gerekli'),
  port: z.number().int().min(1, 'En az 1').max(65535, 'En fazla 65535'),
  health_endpoint: z.string().startsWith('/', 'Slash ile başlamalı'),
  poll_interval_sec: z.number().int().min(5, 'En az 5 saniye').max(300, 'En fazla 300 saniye'),
});

interface ServiceFormProps {
  onSubmit: (data: CreateServiceRequest) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function ServiceForm({ onSubmit, onCancel, isLoading }: ServiceFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateServiceRequest>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      health_endpoint: '/health',
      poll_interval_sec: 10,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">Servis Adı</label>
        <input
          {...register('name')}
          type="text"
          className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Örn: API Gateway"
        />
        {errors.name && (
          <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Host</label>
          <input
            {...register('host')}
            type="text"
            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="localhost veya 192.168.1.1"
          />
          {errors.host && (
            <p className="text-red-500 text-sm mt-1">{errors.host.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Port</label>
          <input
            {...register('port', { valueAsNumber: true })}
            type="number"
            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="8080"
          />
          {errors.port && (
            <p className="text-red-500 text-sm mt-1">{errors.port.message}</p>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Health Endpoint</label>
        <input
          {...register('health_endpoint')}
          type="text"
          className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="/health"
        />
        {errors.health_endpoint && (
          <p className="text-red-500 text-sm mt-1">{errors.health_endpoint.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Poll Interval (saniye)</label>
        <input
          {...register('poll_interval_sec', { valueAsNumber: true })}
          type="number"
          className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="10"
        />
        {errors.poll_interval_sec && (
          <p className="text-red-500 text-sm mt-1">{errors.poll_interval_sec.message}</p>
        )}
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          disabled={isLoading}
          className="flex-1 bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? 'Oluşturuluyor...' : 'Servis Ekle'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-md hover:bg-gray-200"
        >
          İptal
        </button>
      </div>
    </form>
  );
}

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
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
        <label className="block text-sm font-medium text-gray-300 mb-1.5">Servis Adı</label>
        <input
          {...register('name')}
          type="text"
          className="input-field"
          placeholder="Örn: API Gateway"
        />
        {errors.name && (
          <p className="text-red-400 text-xs mt-1.5">{errors.name.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Host</label>
          <input
            {...register('host')}
            type="text"
            className="input-field"
            placeholder="localhost"
          />
          {errors.host && (
            <p className="text-red-400 text-xs mt-1.5">{errors.host.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Port</label>
          <input
            {...register('port', { valueAsNumber: true })}
            type="number"
            className="input-field"
            placeholder="8080"
          />
          {errors.port && (
            <p className="text-red-400 text-xs mt-1.5">{errors.port.message}</p>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">Health Endpoint</label>
        <input
          {...register('health_endpoint')}
          type="text"
          className="input-field font-mono text-sm"
          placeholder="/health"
        />
        {errors.health_endpoint && (
          <p className="text-red-400 text-xs mt-1.5">{errors.health_endpoint.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1.5">Poll Interval (saniye)</label>
        <input
          {...register('poll_interval_sec', { valueAsNumber: true })}
          type="number"
          className="input-field"
          placeholder="10"
        />
        {errors.poll_interval_sec && (
          <p className="text-red-400 text-xs mt-1.5">{errors.poll_interval_sec.message}</p>
        )}
      </div>

      <div className="flex gap-3 pt-3">
        <button
          type="submit"
          disabled={isLoading}
          className="btn-primary flex-1 flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Oluşturuluyor…
            </>
          ) : (
            'Servis Ekle'
          )}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="btn-ghost flex-1"
        >
          İptal
        </button>
      </div>
    </form>
  );
}

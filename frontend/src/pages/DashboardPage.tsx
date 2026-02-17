import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Server, Loader2 } from 'lucide-react';
import { useServices } from '../hooks/useServices';
import ServiceCard from '../components/services/ServiceCard';
import ServiceForm from '../components/services/ServiceForm';
import type { CreateServiceRequest } from '../types/service';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { services, isLoading, createService, restartService, stopService } = useServices();
  const [showForm, setShowForm] = useState(false);

  const handleCreateService = (data: CreateServiceRequest) => {
    createService(data);
    setShowForm(false);
  };

  const upCount = services.filter((s) => s.status === 'up').length;
  const downCount = services.filter((s) => s.status === 'down').length;
  const degradedCount = services.filter((s) => s.status === 'degraded').length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
          <div className="flex items-center gap-4 mt-2 text-sm">
            <span className="text-gray-500">{services.length} servis</span>
            {upCount > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-green-700">{upCount} aktif</span>
              </span>
            )}
            {downCount > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-red-700">{downCount} kapalı</span>
              </span>
            )}
            {degradedCount > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-yellow-500" />
                <span className="text-yellow-700">{degradedCount} sorunlu</span>
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Yeni Servis
        </button>
      </div>

      {services.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="max-w-md mx-auto">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Server className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Henüz servis yok</h3>
            <p className="text-gray-500 mb-6">
              İzlemek istediğiniz ilk servisi ekleyerek başlayın. Agent kurulduktan sonra metrikler otomatik olarak akmaya başlayacak.
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="btn-primary"
            >
              Servis Ekle
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              onRestart={restartService}
              onStop={stopService}
              onClick={(id) => navigate(`/services/${id}`)}
            />
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-md">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Yeni Servis Ekle</h3>
            <ServiceForm
              onSubmit={handleCreateService}
              onCancel={() => setShowForm(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

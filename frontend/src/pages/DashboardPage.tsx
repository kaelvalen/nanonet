import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Server, Loader2, ArrowUp, ArrowDown, AlertTriangle, X } from 'lucide-react';
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

  // Close modal on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowForm(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const upCount = services.filter((s) => s.status === 'up').length;
  const downCount = services.filter((s) => s.status === 'down').length;
  const degradedCount = services.filter((s) => s.status === 'degraded').length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <span className="text-sm text-gray-500">Servisler yükleniyor…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Dashboard</h2>
          <p className="text-sm text-gray-500 mt-1">Servislerinizi gerçek zamanlı izleyin</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Yeni Servis
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Toplam</span>
            <Server className="w-4 h-4 text-gray-600" />
          </div>
          <p className="text-2xl font-bold text-white mt-2 tabular-nums">{services.length}</p>
          <p className="text-xs text-gray-600 mt-1">kayıtlı servis</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-500/80 uppercase tracking-wider">Aktif</span>
            <ArrowUp className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-400 mt-2 tabular-nums">{upCount}</p>
          <p className="text-xs text-gray-600 mt-1">çalışıyor</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-red-500/80 uppercase tracking-wider">Kapalı</span>
            <ArrowDown className="w-4 h-4 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-red-400 mt-2 tabular-nums">{downCount}</p>
          <p className="text-xs text-gray-600 mt-1">yanıt vermiyor</p>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-500/80 uppercase tracking-wider">Sorunlu</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-amber-400 mt-2 tabular-nums">{degradedCount}</p>
          <p className="text-xs text-gray-600 mt-1">performans düşük</p>
        </div>
      </div>

      {/* Service grid */}
      {services.length === 0 ? (
        <div className="card p-16 text-center">
          <div className="max-w-sm mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center mx-auto mb-5 ring-1 ring-indigo-500/20">
              <Server className="w-8 h-8 text-indigo-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Henüz servis yok</h3>
            <p className="text-gray-500 mb-6 text-sm leading-relaxed">
              İzlemek istediğiniz ilk servisi ekleyerek başlayın. Agent kurulduktan sonra metrikler otomatik akmaya başlayacak.
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="btn-primary"
            >
              <Plus className="w-4 h-4 mr-1.5 inline" />
              İlk Servisi Ekle
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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

      {/* Modal */}
      {showForm && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in"
          onClick={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}
        >
          <div className="card p-6 w-full max-w-md animate-scale-in">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-semibold text-white">Yeni Servis Ekle</h3>
              <button
                onClick={() => setShowForm(false)}
                className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-white/5 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
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

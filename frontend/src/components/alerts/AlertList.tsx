import { useState } from 'react';
import AlertCard from './AlertCard';

interface Alert {
  id: string;
  service_id: string;
  type: string;
  severity: 'info' | 'warn' | 'crit';
  message: string;
  triggered_at: string;
  resolved_at?: string;
}

interface AlertListProps {
  alerts: Alert[];
  onResolve: (alertId: string) => void;
  showResolved?: boolean;
}

export default function AlertList({ alerts, onResolve, showResolved = false }: AlertListProps) {
  const [filter, setFilter] = useState<'all' | 'info' | 'warn' | 'crit'>('all');

  const filteredAlerts = alerts.filter((alert) => {
    if (!showResolved && alert.resolved_at) return false;
    if (filter === 'all') return true;
    return alert.severity === filter;
  });

  const activeCount = alerts.filter((a) => !a.resolved_at).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-lg">Alertler</h3>
          {activeCount > 0 && (
            <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded-full">
              {activeCount} aktif
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 text-sm rounded ${
              filter === 'all'
                ? 'bg-gray-800 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Tümü
          </button>
          <button
            onClick={() => setFilter('crit')}
            className={`px-3 py-1 text-sm rounded ${
              filter === 'crit'
                ? 'bg-red-600 text-white'
                : 'bg-red-50 text-red-700 hover:bg-red-100'
            }`}
          >
            Kritik
          </button>
          <button
            onClick={() => setFilter('warn')}
            className={`px-3 py-1 text-sm rounded ${
              filter === 'warn'
                ? 'bg-yellow-600 text-white'
                : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
            }`}
          >
            Uyarı
          </button>
        </div>
      </div>

      {filteredAlerts.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          {filter === 'all' ? 'Henüz alert yok' : `${filter} seviyesinde alert yok`}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map((alert) => (
            <AlertCard
              key={alert.id}
              id={alert.id}
              type={alert.type}
              severity={alert.severity}
              message={alert.message}
              triggeredAt={alert.triggered_at}
              resolvedAt={alert.resolved_at}
              onResolve={onResolve}
            />
          ))}
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { Bell } from 'lucide-react';
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

  const filterBtnClass = (key: string, activeColor: string, inactiveColor: string) =>
    `px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
      filter === key ? activeColor : inactiveColor
    }`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-white">Alertler</h3>
          {activeCount > 0 && (
            <span className="px-2 py-0.5 bg-red-500/10 text-red-400 text-xs rounded-full ring-1 ring-red-500/20">
              {activeCount} aktif
            </span>
          )}
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => setFilter('all')}
            className={filterBtnClass('all', 'bg-white/10 text-white', 'bg-white/5 text-gray-400 hover:bg-white/10')}
          >
            Tümü
          </button>
          <button
            onClick={() => setFilter('crit')}
            className={filterBtnClass('crit', 'bg-red-600 text-white shadow-lg shadow-red-500/20', 'bg-red-500/10 text-red-400 hover:bg-red-500/20')}
          >
            Kritik
          </button>
          <button
            onClick={() => setFilter('warn')}
            className={filterBtnClass('warn', 'bg-amber-600 text-white shadow-lg shadow-amber-500/20', 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20')}
          >
            Uyarı
          </button>
        </div>
      </div>

      {filteredAlerts.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mx-auto mb-3">
            <Bell className="w-6 h-6 text-gray-700" />
          </div>
          <p className="text-sm font-medium text-gray-500">
            {filter === 'all' ? 'Henüz alert yok' : `${filter} seviyesinde alert yok`}
          </p>
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

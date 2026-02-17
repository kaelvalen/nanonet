import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
  status?: 'up' | 'down' | 'degraded' | 'unknown';
}

export default function StatCard({
  title,
  value,
  unit,
  icon: Icon,
  trend,
  trendValue,
  status,
}: StatCardProps) {
  const statusColors = {
    up: 'bg-green-100 text-green-800',
    down: 'bg-red-100 text-red-800',
    degraded: 'bg-yellow-100 text-yellow-800',
    unknown: 'bg-gray-100 text-gray-800',
  };

  const trendColors = {
    up: 'text-green-600',
    down: 'text-red-600',
    stable: 'text-gray-600',
  };

  const noData = value === '-' || value === '' || value === undefined;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</span>
        <Icon className={`w-4 h-4 ${noData ? 'text-gray-300' : 'text-gray-400'}`} />
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={`text-2xl font-bold ${noData ? 'text-gray-300' : 'text-gray-900'}`}>
          {noData ? '—' : value}
        </span>
        {!noData && unit && <span className="text-sm text-gray-400">{unit}</span>}
      </div>
      <div className="mt-2 flex items-center gap-3">
        {trend && trendValue && (
          <span className={`text-xs font-medium ${trendColors[trend]}`}>
            {trend === 'up' && '↑'}
            {trend === 'down' && '↓'}
            {trend === 'stable' && '→'}
            {' '}{trendValue}
          </span>
        )}
        {status && (
          <span className={`px-2 py-0.5 text-xs rounded-full ${statusColors[status]}`}>
            {status}
          </span>
        )}
        {noData && !status && (
          <span className="text-xs text-gray-400">Veri bekleniyor</span>
        )}
      </div>
    </div>
  );
}

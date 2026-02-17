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
  const trendColors = {
    up: 'text-emerald-400',
    down: 'text-red-400',
    stable: 'text-gray-500',
  };

  const noData = value === '-' || value === '' || value === undefined;

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{title}</span>
        <Icon className={`w-4 h-4 ${noData ? 'text-gray-700' : 'text-gray-500'}`} />
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={`text-2xl font-bold tabular-nums ${noData ? 'text-gray-700' : 'text-white'}`}>
          {noData ? '—' : value}
        </span>
        {!noData && unit && <span className="text-sm text-gray-500">{unit}</span>}
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
          <span className={status === 'up' ? 'badge-up' : status === 'down' ? 'badge-down' : status === 'degraded' ? 'badge-degraded' : 'badge-unknown'}>
            {status}
          </span>
        )}
        {noData && !status && (
          <span className="text-xs text-gray-600">Veri bekleniyor</span>
        )}
      </div>
    </div>
  );
}

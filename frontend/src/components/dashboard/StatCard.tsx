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

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-gray-600">{title}</span>
        <Icon className="w-5 h-5 text-gray-400" />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-gray-900">{value}</span>
        {unit && <span className="text-lg text-gray-500">{unit}</span>}
      </div>
      <div className="mt-3 flex items-center gap-3">
        {trend && trendValue && (
          <span className={`text-sm font-medium ${trendColors[trend]}`}>
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
      </div>
    </div>
  );
}

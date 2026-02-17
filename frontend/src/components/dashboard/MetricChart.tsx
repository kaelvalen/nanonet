import { BarChart3 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

interface MetricData {
  time: string;
  cpu_percent?: number;
  memory_used_mb?: number;
  latency_ms?: number;
  error_rate?: number;
}

interface MetricChartProps {
  data: MetricData[];
  metricType: 'cpu' | 'memory' | 'latency' | 'error_rate';
  title: string;
}

export default function MetricChart({ data, metricType, title }: MetricChartProps) {
  const metricConfig = {
    cpu: {
      dataKey: 'cpu_percent',
      color: '#6366f1',
      gradient: ['#6366f1', '#4f46e5'],
      unit: '%',
      label: 'CPU',
    },
    memory: {
      dataKey: 'memory_used_mb',
      color: '#8b5cf6',
      gradient: ['#8b5cf6', '#7c3aed'],
      unit: 'MB',
      label: 'Memory',
    },
    latency: {
      dataKey: 'latency_ms',
      color: '#f59e0b',
      gradient: ['#f59e0b', '#d97706'],
      unit: 'ms',
      label: 'Latency',
    },
    error_rate: {
      dataKey: 'error_rate',
      color: '#ef4444',
      gradient: ['#ef4444', '#dc2626'],
      unit: '%',
      label: 'Error Rate',
    },
  };

  const config = metricConfig[metricType];
  const gradientId = `gradient-${metricType}`;

  const formatTime = (time: string) => {
    const date = new Date(time);
    return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatValue = (value: number) => {
    return `${value.toFixed(2)} ${config.unit}`;
  };

  const hasData = data.length > 0 && data.some((d) => {
    const val = d[config.dataKey as keyof MetricData];
    return val !== undefined && val !== null;
  });

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm text-gray-400">{title}</h3>
        {hasData && (
          <span className="text-xs text-gray-600 tabular-nums">
            {data.length} veri noktası
          </span>
        )}
      </div>
      {hasData ? (
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={config.color} stopOpacity={0.2} />
                <stop offset="95%" stopColor={config.color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis
              dataKey="time"
              tickFormatter={formatTime}
              stroke="#4b5563"
              style={{ fontSize: '11px' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#4b5563"
              style={{ fontSize: '11px' }}
              tickFormatter={(value) => `${value}${config.unit}`}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              formatter={(value: number) => [formatValue(value), config.label]}
              labelFormatter={formatTime}
              contentStyle={{
                backgroundColor: '#1c2333',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '8px',
                fontSize: '12px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                color: '#e2e8f0',
              }}
              itemStyle={{ color: '#e2e8f0' }}
              labelStyle={{ color: '#9ca3af' }}
            />
            <Area
              type="monotone"
              dataKey={config.dataKey}
              stroke={config.color}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={false}
              name={config.label}
              connectNulls
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex flex-col items-center justify-center h-[220px]">
          <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-3">
            <BarChart3 className="w-6 h-6 text-gray-700" />
          </div>
          <p className="text-sm font-medium text-gray-500">Henüz veri yok</p>
          <p className="text-xs text-gray-600 mt-1">Agent bağlandığında metrikler burada görünecek</p>
        </div>
      )}
    </div>
  );
}

import { BarChart3 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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
      color: '#3b82f6',
      unit: '%',
      label: 'CPU',
    },
    memory: {
      dataKey: 'memory_used_mb',
      color: '#8b5cf6',
      unit: 'MB',
      label: 'Memory',
    },
    latency: {
      dataKey: 'latency_ms',
      color: '#f59e0b',
      unit: 'ms',
      label: 'Latency',
    },
    error_rate: {
      dataKey: 'error_rate',
      color: '#ef4444',
      unit: '%',
      label: 'Error Rate',
    },
  };

  const config = metricConfig[metricType];

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
      <h3 className="font-semibold text-sm text-gray-700 mb-3">{title}</h3>
      {hasData ? (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis
              dataKey="time"
              tickFormatter={formatTime}
              stroke="#9ca3af"
              style={{ fontSize: '11px' }}
              tickLine={false}
            />
            <YAxis
              stroke="#9ca3af"
              style={{ fontSize: '11px' }}
              tickFormatter={(value) => `${value}${config.unit}`}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              formatter={(value: number) => [formatValue(value), config.label]}
              labelFormatter={formatTime}
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '12px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              }}
            />
            <Line
              type="monotone"
              dataKey={config.dataKey}
              stroke={config.color}
              strokeWidth={2}
              dot={false}
              name={config.label}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex flex-col items-center justify-center h-[220px] text-gray-400">
          <BarChart3 className="w-10 h-10 mb-2 text-gray-300" />
          <p className="text-sm font-medium">Henüz veri yok</p>
          <p className="text-xs mt-1">Agent bağlandığında metrikler burada görünecek</p>
        </div>
      )}
    </div>
  );
}

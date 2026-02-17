import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

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
    return `${value.toFixed(2)}${config.unit}`;
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h3 className="font-semibold mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="time"
            tickFormatter={formatTime}
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
          />
          <YAxis
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
            tickFormatter={(value) => `${value}${config.unit}`}
          />
          <Tooltip
            formatter={(value: number) => formatValue(value)}
            labelFormatter={formatTime}
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey={config.dataKey}
            stroke={config.color}
            strokeWidth={2}
            dot={false}
            name={config.label}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

import { useState } from 'react';
import { Activity, AlertCircle, BarChart3, X } from 'lucide-react';
import type { Service } from '../../types/service';
import MetricChart from '../dashboard/MetricChart';
import AlertList from '../alerts/AlertList';
import StatCard from '../dashboard/StatCard';

interface ServiceDetailProps {
  service: Service;
  onClose: () => void;
}

export default function ServiceDetail({ service, onClose }: ServiceDetailProps) {
  const [activeTab, setActiveTab] = useState<'metrics' | 'alerts'>('metrics');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">{service.name}</h2>
            <p className="text-gray-500">
              {service.host}:{service.port}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="border-b">
          <div className="flex gap-4 px-6">
            <button
              onClick={() => setActiveTab('metrics')}
              className={`py-3 px-4 border-b-2 font-medium ${
                activeTab === 'metrics'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Metrikler
              </div>
            </button>
            <button
              onClick={() => setActiveTab('alerts')}
              className={`py-3 px-4 border-b-2 font-medium ${
                activeTab === 'alerts'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Alertler
              </div>
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {activeTab === 'metrics' && (
            <div className="space-y-6">
              <div className="grid grid-cols-4 gap-4">
                <StatCard
                  title="CPU"
                  value="0"
                  unit="%"
                  icon={Activity}
                  status={service.status}
                />
                <StatCard
                  title="Memory"
                  value="0"
                  unit="MB"
                  icon={Activity}
                />
                <StatCard
                  title="Latency"
                  value="0"
                  unit="ms"
                  icon={Activity}
                />
                <StatCard
                  title="Error Rate"
                  value="0"
                  unit="%"
                  icon={Activity}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <MetricChart
                  data={[]}
                  metricType="cpu"
                  title="CPU Kullanımı"
                />
                <MetricChart
                  data={[]}
                  metricType="memory"
                  title="Bellek Kullanımı"
                />
                <MetricChart
                  data={[]}
                  metricType="latency"
                  title="Gecikme"
                />
                <MetricChart
                  data={[]}
                  metricType="error_rate"
                  title="Hata Oranı"
                />
              </div>
            </div>
          )}

          {activeTab === 'alerts' && (
            <AlertList
              alerts={[]}
              onResolve={() => {}}
              showResolved={false}
            />
          )}
        </div>
      </div>
    </div>
  );
}

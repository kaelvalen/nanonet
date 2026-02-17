import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Cpu, HardDrive, Clock, Gauge, BarChart3,
  AlertCircle, Brain, Terminal, Wifi, WifiOff, Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { servicesApi } from '../api/services';
import { metricsApi } from '../api/metrics';
import type { AnalysisResult } from '../api/metrics';
import MetricChart from '../components/dashboard/MetricChart';
import StatCard from '../components/dashboard/StatCard';
import AlertList from '../components/alerts/AlertList';
import InsightCard from '../components/ai/InsightCard';
import CommandHistory from '../components/control/CommandHistory';
import CommandButton from '../components/control/CommandButton';

type TabType = 'metrics' | 'alerts' | 'ai' | 'commands';
type TimeRange = '1h' | '6h' | '24h' | '7d';

const timeRangeMap: Record<TimeRange, { duration: string; bucket: string; label: string }> = {
  '1h': { duration: '1h', bucket: '1 minute', label: '1 Saat' },
  '6h': { duration: '6h', bucket: '5 minutes', label: '6 Saat' },
  '24h': { duration: '24h', bucket: '15 minutes', label: '24 Saat' },
  '7d': { duration: '168h', bucket: '1 hour', label: '7 Gün' },
};

export default function ServiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('metrics');
  const [timeRange, setTimeRange] = useState<TimeRange>('1h');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

  const serviceQuery = useQuery({
    queryKey: ['service', id],
    queryFn: () => servicesApi.get(id!),
    enabled: !!id,
  });

  const trConfig = timeRangeMap[timeRange];

  const metricsQuery = useQuery({
    queryKey: ['metrics', id, timeRange],
    queryFn: () => metricsApi.getHistory(id!, trConfig.duration),
    enabled: !!id && activeTab === 'metrics',
    refetchInterval: 15000,
  });

  const uptimeQuery = useQuery({
    queryKey: ['uptime', id],
    queryFn: () => metricsApi.getUptime(id!, '24h'),
    enabled: !!id,
  });

  const alertsQuery = useQuery({
    queryKey: ['alerts', id],
    queryFn: () => metricsApi.getAlerts(id!, true),
    enabled: !!id && activeTab === 'alerts',
  });

  const insightsQuery = useQuery({
    queryKey: ['insights', id],
    queryFn: () => metricsApi.getInsights(id!),
    enabled: !!id && activeTab === 'ai',
  });

  const commandsQuery = useQuery({
    queryKey: ['commands', id],
    queryFn: () => metricsApi.getCommands(id!),
    enabled: !!id && activeTab === 'commands',
  });

  const analyzeMutation = useMutation({
    mutationFn: () => metricsApi.analyze(id!, timeRange === '1h' ? 30 : timeRange === '6h' ? 360 : 1440),
    onSuccess: (result) => {
      setAnalysisResult(result);
      toast.success('AI analizi tamamlandı');
      queryClient.invalidateQueries({ queryKey: ['insights', id] });
    },
    onError: () => {
      toast.error('AI analizi başarısız');
    },
  });

  const restartMutation = useMutation({
    mutationFn: () => servicesApi.restart(id!),
    onSuccess: () => {
      toast.success('Restart komutu gönderildi');
      queryClient.invalidateQueries({ queryKey: ['commands', id] });
    },
    onError: () => toast.error('Restart komutu gönderilemedi'),
  });

  const stopMutation = useMutation({
    mutationFn: () => servicesApi.stop(id!),
    onSuccess: () => {
      toast.success('Stop komutu gönderildi');
      queryClient.invalidateQueries({ queryKey: ['commands', id] });
    },
    onError: () => toast.error('Stop komutu gönderilemedi'),
  });

  const resolveAlertMutation = useMutation({
    mutationFn: (alertId: string) => metricsApi.resolveAlert(alertId),
    onSuccess: () => {
      toast.success('Alert çözümlendi');
      queryClient.invalidateQueries({ queryKey: ['alerts', id] });
    },
    onError: () => toast.error('Alert çözümlenemedi'),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svcData = serviceQuery.data as any;
  const service = svcData?.service ?? svcData;
  const agentConnected: boolean = svcData?.agent_connected ?? false;

  if (serviceQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!service) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 mb-4">Servis bulunamadı</p>
        <button onClick={() => navigate('/dashboard')} className="btn-primary">
          Dashboard'a Dön
        </button>
      </div>
    );
  }

  const latestMetric = metricsQuery.data?.[metricsQuery.data.length - 1];
  const metrics = metricsQuery.data || [];

  const statusColors: Record<string, string> = {
    up: 'bg-green-100 text-green-800',
    down: 'bg-red-100 text-red-800',
    degraded: 'bg-yellow-100 text-yellow-800',
    unknown: 'bg-gray-100 text-gray-800',
  };

  const tabs: { key: TabType; label: string; icon: typeof BarChart3 }[] = [
    { key: 'metrics', label: 'Metrikler', icon: BarChart3 },
    { key: 'alerts', label: 'Alertler', icon: AlertCircle },
    { key: 'ai', label: 'AI Analiz', icon: Brain },
    { key: 'commands', label: 'Komutlar', icon: Terminal },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/dashboard')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{service.name}</h1>
            <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${statusColors[service.status]}`}>
              {service.status.toUpperCase()}
            </span>
            {agentConnected ? (
              <span className="flex items-center gap-1 text-xs text-green-600">
                <Wifi className="w-3 h-3" /> Agent bağlı
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <WifiOff className="w-3 h-3" /> Agent yok
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {service.host}:{service.port} &middot; {service.health_endpoint} &middot; Poll: {service.poll_interval_sec}s
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CommandButton action="restart" onExecute={() => restartMutation.mutate()} isLoading={restartMutation.isPending} disabled={!agentConnected} />
          <CommandButton action="stop" onExecute={() => stopMutation.mutate()} isLoading={stopMutation.isPending} disabled={!agentConnected} />
        </div>
      </div>

      {!agentConnected && (
        <div className="card p-4 border-l-4 border-l-amber-400 bg-amber-50/50">
          <div className="flex items-start gap-3">
            <WifiOff className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-amber-800">Agent Bağlı Değil</h3>
              <p className="text-xs text-amber-700 mt-1">
                Metrik toplamaya başlamak için bu servise bir agent bağlayın. Aşağıdaki komutu sunucunuzda çalıştırın:
              </p>
              <div className="mt-2 relative">
                <div className="p-2.5 bg-gray-900 rounded-lg overflow-x-auto pr-12">
                  <code className="text-xs text-green-400 whitespace-nowrap block">
                    ./nanonet-agent \<br />
                    {'  '}--backend ws://localhost:8080 \<br />
                    {'  '}--service-id {service.id} \<br />
                    {'  '}--token {localStorage.getItem('access_token') || 'YOUR_JWT_TOKEN'} \<br />
                    {'  '}--host {service.host} \<br />
                    {'  '}--port {service.port} \<br />
                    {'  '}--health-endpoint {service.health_endpoint} \<br />
                    {'  '}--poll-interval {service.poll_interval_sec}
                  </code>
                </div>
                <button
                  onClick={() => {
                    const cmd = `./nanonet-agent --backend ws://localhost:8080 --service-id ${service.id} --token ${localStorage.getItem('access_token')} --host ${service.host} --port ${service.port} --health-endpoint ${service.health_endpoint} --poll-interval ${service.poll_interval_sec}`;
                    navigator.clipboard.writeText(cmd);
                    toast.success('Komut kopyalandı');
                  }}
                  className="absolute top-2 right-2 p-1.5 bg-gray-800 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                  title="Kopyala"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          title="CPU"
          value={latestMetric?.cpu_percent?.toFixed(1) ?? '-'}
          unit="%"
          icon={Cpu}
          status={service.status}
        />
        <StatCard
          title="Bellek"
          value={latestMetric?.memory_used_mb?.toFixed(0) ?? '-'}
          unit="MB"
          icon={HardDrive}
        />
        <StatCard
          title="Gecikme"
          value={latestMetric?.latency_ms?.toFixed(1) ?? '-'}
          unit="ms"
          icon={Gauge}
        />
        <StatCard
          title="Uptime"
          value={uptimeQuery.data?.uptime_percent?.toFixed(1) ?? '-'}
          unit="%"
          icon={Clock}
        />
      </div>

      <div className="border-b border-gray-200">
        <div className="flex gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === 'metrics' && (
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            {(Object.keys(timeRangeMap) as TimeRange[]).map((tr) => (
              <button
                key={tr}
                onClick={() => setTimeRange(tr)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  timeRange === tr
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {timeRangeMap[tr].label}
              </button>
            ))}
            {metricsQuery.isFetching && (
              <Loader2 className="w-4 h-4 animate-spin text-gray-400 ml-2" />
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <MetricChart data={metrics} metricType="cpu" title="CPU Kullanımı" />
            <MetricChart data={metrics} metricType="memory" title="Bellek Kullanımı" />
            <MetricChart data={metrics} metricType="latency" title="Gecikme (ms)" />
            <MetricChart data={metrics} metricType="error_rate" title="Hata Oranı" />
          </div>
        </div>
      )}

      {activeTab === 'alerts' && (
        <AlertList
          alerts={alertsQuery.data || []}
          onResolve={(alertId) => resolveAlertMutation.mutate(alertId)}
          showResolved
        />
      )}

      {activeTab === 'ai' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">AI Analiz</h3>
            <button
              onClick={() => analyzeMutation.mutate()}
              disabled={analyzeMutation.isPending}
              className="btn-primary flex items-center gap-2"
            >
              {analyzeMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Brain className="w-4 h-4" />
              )}
              {analyzeMutation.isPending ? 'Analiz ediliyor...' : 'Analiz Et'}
            </button>
          </div>

          {analyzeMutation.isPending && (
            <InsightCard insight={{ summary: '', root_cause: '', recommendations: [] }} isLoading />
          )}

          {analysisResult && !analyzeMutation.isPending && (
            <InsightCard insight={analysisResult} />
          )}

          {insightsQuery.data?.insights && insightsQuery.data.insights.length > 0 && (
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-600">Geçmiş Analizler</h4>
              {insightsQuery.data.insights.map((insight) => (
                <div key={insight.id} className="card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Brain className="w-4 h-4 text-purple-500" />
                    <span className="text-xs text-gray-500">
                      {new Date(insight.created_at).toLocaleString('tr-TR')}
                    </span>
                    <span className="text-xs text-gray-400">{insight.model}</span>
                  </div>
                  <p className="text-sm text-gray-700">{insight.summary}</p>
                  {insight.root_cause && (
                    <p className="text-sm text-amber-700 mt-2">Neden: {insight.root_cause}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {!analysisResult && !analyzeMutation.isPending && (!insightsQuery.data?.insights || insightsQuery.data.insights.length === 0) && (
            <div className="text-center py-12 text-gray-500">
              <Brain className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">Henüz AI analizi yapılmadı</p>
              <p className="text-sm mt-1">"Analiz Et" butonuna tıklayarak servis metriklerini analiz edebilirsiniz</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'commands' && (
        <CommandHistory
          commands={commandsQuery.data?.commands || []}
          isLoading={commandsQuery.isLoading}
        />
      )}
    </div>
  );
}

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Cpu, HardDrive, Clock, Gauge, BarChart3,
  AlertCircle, Brain, Terminal, WifiOff, Loader2,
  Copy, Check
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

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(`${label} kopyalandı`);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 p-1.5 bg-white/5 hover:bg-white/10 rounded-md text-gray-500 hover:text-gray-300 transition-colors"
      title="Kopyala"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

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
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <span className="text-sm text-gray-500">Servis bilgileri yükleniyor…</span>
        </div>
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

  const statusBadgeClass: Record<string, string> = {
    up: 'badge-up',
    down: 'badge-down',
    degraded: 'badge-degraded',
    unknown: 'badge-unknown',
  };

  const tabs: { key: TabType; label: string; icon: typeof BarChart3 }[] = [
    { key: 'metrics', label: 'Metrikler', icon: BarChart3 },
    { key: 'alerts', label: 'Alertler', icon: AlertCircle },
    { key: 'ai', label: 'AI Analiz', icon: Brain },
    { key: 'commands', label: 'Komutlar', icon: Terminal },
  ];

  const token = localStorage.getItem('access_token');

  const installCmd = `curl -sSL http://localhost:8080/install.sh | bash -s -- --backend ws://localhost:8080 --service-id ${service.id} --token ${token} --host ${service.host} --port ${service.port} --health-endpoint ${service.health_endpoint} --poll-interval ${service.poll_interval_sec}`;
  const dockerCmd = `docker run -d --name nanonet-agent --restart unless-stopped nanonet/agent --backend ws://host.docker.internal:8080 --service-id ${service.id} --token ${token} --host ${service.host} --port ${service.port} --health-endpoint ${service.health_endpoint} --poll-interval ${service.poll_interval_sec}`;
  const manualCmd = `./nanonet-agent --backend ws://localhost:8080 --service-id ${service.id} --token ${token} --host ${service.host} --port ${service.port} --health-endpoint ${service.health_endpoint} --poll-interval ${service.poll_interval_sec}`;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <button
          onClick={() => navigate('/dashboard')}
          className="p-2 hover:bg-white/5 rounded-lg transition-colors text-gray-400 hover:text-white self-start"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-white">{service.name}</h1>
            <span className={statusBadgeClass[service.status] || 'badge-unknown'}>
              {service.status.toUpperCase()}
            </span>
            {agentConnected ? (
              <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                Agent bağlı
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-gray-600">
                <WifiOff className="w-3 h-3" /> Agent yok
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1 font-mono">
            {service.host}:{service.port} · {service.health_endpoint} · {service.poll_interval_sec}s
          </p>
        </div>
        <div className="flex items-center gap-2 self-start">
          <CommandButton action="restart" onExecute={() => restartMutation.mutate()} isLoading={restartMutation.isPending} disabled={!agentConnected} />
          <CommandButton action="stop" onExecute={() => stopMutation.mutate()} isLoading={stopMutation.isPending} disabled={!agentConnected} />
        </div>
      </div>

      {/* Agent install banner */}
      {!agentConnected && (
        <div className="card p-5 border-l-2 border-l-amber-500/60">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
              <WifiOff className="w-4 h-4 text-amber-500" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-white">Agent Bağlı Değil</h3>
              <p className="text-xs text-gray-500 mt-1 mb-4">
                Metrik toplamaya başlamak için agent'ı kurun:
              </p>

              <div className="space-y-3">
                {/* Quick Install */}
                <div className="bg-surface-dark rounded-lg p-3 ring-1 ring-white/5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold rounded tracking-wider">ÖNERİLEN</span>
                    <span className="text-xs font-medium text-gray-400">Hızlı Kurulum</span>
                  </div>
                  <div className="relative">
                    <div className="p-2.5 bg-black/40 rounded-md overflow-x-auto pr-10">
                      <code className="text-xs text-emerald-400 font-mono whitespace-nowrap">
                        curl -sSL https://get.nanonet.io | bash -s -- --service-id {service.id.slice(0, 8)}…
                      </code>
                    </div>
                    <CopyButton text={installCmd} label="Kurulum komutu" />
                  </div>
                </div>

                {/* Docker */}
                <div className="bg-surface-dark rounded-lg p-3 ring-1 ring-white/5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium text-gray-400">Docker</span>
                  </div>
                  <div className="relative">
                    <div className="p-2.5 bg-black/40 rounded-md overflow-x-auto pr-10">
                      <code className="text-xs text-indigo-400 font-mono whitespace-nowrap">
                        docker run -d nanonet/agent --service-id {service.id.slice(0, 8)}…
                      </code>
                    </div>
                    <CopyButton text={dockerCmd} label="Docker komutu" />
                  </div>
                </div>

                {/* Manual */}
                <details className="bg-surface-dark rounded-lg ring-1 ring-white/5">
                  <summary className="p-3 cursor-pointer text-xs font-medium text-gray-500 hover:text-gray-300 transition-colors">
                    Manuel Kurulum
                  </summary>
                  <div className="px-3 pb-3 space-y-2">
                    <p className="text-xs text-gray-500"><strong className="text-gray-400">1.</strong> Binary indirin</p>
                    <div className="p-2.5 bg-black/40 rounded-md overflow-x-auto">
                      <code className="text-xs text-purple-400 font-mono">wget https://github.com/nanonet/agent/releases/latest/download/nanonet-agent-linux-x86_64</code>
                    </div>
                    <p className="text-xs text-gray-500"><strong className="text-gray-400">2.</strong> Çalıştırın</p>
                    <div className="relative">
                      <div className="p-2.5 bg-black/40 rounded-md overflow-x-auto pr-10">
                        <code className="text-xs text-purple-400 font-mono whitespace-nowrap">
                          ./nanonet-agent --backend ws://localhost:8080 --service-id {service.id.slice(0, 12)}…
                        </code>
                      </div>
                      <CopyButton text={manualCmd} label="Manuel komut" />
                    </div>
                  </div>
                </details>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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

      {/* Tabs */}
      <div className="border-b border-white/[0.06]">
        <div className="flex gap-1 -mb-px">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-gray-500 hover:text-gray-300 hover:border-white/10'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'metrics' && (
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            {(Object.keys(timeRangeMap) as TimeRange[]).map((tr) => (
              <button
                key={tr}
                onClick={() => setTimeRange(tr)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  timeRange === tr
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-300'
                }`}
              >
                {timeRangeMap[tr].label}
              </button>
            ))}
            {metricsQuery.isFetching && (
              <Loader2 className="w-4 h-4 animate-spin text-gray-600 ml-2" />
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
            <h3 className="font-semibold text-white">AI Analiz</h3>
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
              {analyzeMutation.isPending ? 'Analiz ediliyor…' : 'Analiz Et'}
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
              <h4 className="text-sm font-medium text-gray-500">Geçmiş Analizler</h4>
              {insightsQuery.data.insights.map((insight) => (
                <div key={insight.id} className="card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Brain className="w-4 h-4 text-purple-400" />
                    <span className="text-xs text-gray-500">
                      {new Date(insight.created_at).toLocaleString('tr-TR')}
                    </span>
                    <span className="text-xs text-gray-600 font-mono">{insight.model}</span>
                  </div>
                  <p className="text-sm text-gray-300">{insight.summary}</p>
                  {insight.root_cause && (
                    <p className="text-sm text-amber-400/80 mt-2">Neden: {insight.root_cause}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {!analysisResult && !analyzeMutation.isPending && (!insightsQuery.data?.insights || insightsQuery.data.insights.length === 0) && (
            <div className="text-center py-12">
              <div className="w-14 h-14 rounded-2xl bg-purple-500/10 flex items-center justify-center mx-auto mb-4 ring-1 ring-purple-500/20">
                <Brain className="w-7 h-7 text-purple-400" />
              </div>
              <p className="font-medium text-gray-300">Henüz AI analizi yapılmadı</p>
              <p className="text-sm text-gray-600 mt-1">"Analiz Et" butonuna tıklayarak servis metriklerini analiz edebilirsiniz</p>
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

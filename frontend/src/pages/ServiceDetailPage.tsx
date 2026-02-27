import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Server,
  Activity,
  Cpu,
  HardDrive,
  Clock,
  AlertCircle,
  Sparkles,
  RefreshCw,
  Power,
  Trash2,
  TrendingUp,
  Zap,
  Shield,
  Eye,
  Terminal,
  Send,
  ChevronRight,
  Play,
  Layers,
  CheckCircle2,
  XCircle,
  Loader2,
  History,
  Minus,
  Plus,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { Input } from "@/components/ui/input";
import { servicesApi } from "@/api/services";
import { metricsApi, type Alert, type AnalysisResult } from "@/api/metrics";
import { useServices } from "@/hooks/useServices";
import { toast } from "sonner";

type ExecEntry = {
  command: string;
  command_id: string;
  status: 'queued' | 'received' | 'success' | 'failed' | 'timeout';
  queued_at: string;
  output?: string;
  error?: string;
  duration_ms?: number;
};

function CommandHistoryTab({ serviceId }: { serviceId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['commandHistory', serviceId],
    queryFn: () => servicesApi.getCommandHistory(serviceId, 30, 1),
    enabled: !!serviceId,
    refetchInterval: 15000,
  });

  const logs = data?.commands ?? [];

  const statusIcon = (status: string) => {
    if (status === 'success') return <CheckCircle2 className="w-3.5 h-3.5 text-[#34d399]" />;
    if (status === 'failed' || status === 'timeout') return <XCircle className="w-3.5 h-3.5 text-[#fb7185]" />;
    return <Loader2 className="w-3.5 h-3.5 text-[#fbbf24] animate-spin" />;
  };

  const actionColor: Record<string, string> = {
    restart: 'text-[#39c5bb] bg-[#39c5bb]/10',
    stop:    'text-[#d97706] bg-[#fbbf24]/10',
    start:   'text-[#059669] bg-[#34d399]/10',
    exec:    'text-[#38bdf8] bg-[#38bdf8]/10',
    scale:   'text-[#a78bfa] bg-[#c4b5fd]/10',
    ping:    'text-[#b0bdd5] bg-[#b0bdd5]/10',
  };

  if (isLoading) return (
    <Card className="p-6 bg-white/80 dark:bg-[#0d1c24]/85 border-[#93c5fd]/10 rounded-xl animate-pulse">
      <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-10 bg-[#93c5fd]/5 rounded-lg" />)}</div>
    </Card>
  );

  if (logs.length === 0) return (
    <Card className="p-12 bg-white/80 dark:bg-[#0d1c24]/85 border-[#93c5fd]/10 rounded-xl text-center">
      <History className="w-10 h-10 text-[#b0bdd5] mx-auto mb-3" />
      <p className="text-sm text-[#7c8db5]">Henüz komut geçmişi yok</p>
    </Card>
  );

  return (
    <div className="space-y-2">
      {logs.map((log) => (
        <Card key={log.id} className="p-3 bg-white/80 dark:bg-[#0d1c24]/85 border-[#93c5fd]/10 dark:border-[#93c5fd]/6 rounded-xl">
          <div className="flex items-center gap-3">
            {statusIcon(log.status)}
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full font-mono ${
              actionColor[log.action] ?? 'text-[#7c8db5] bg-[#7c8db5]/10'
            }`}>{log.action}</span>
            <span className="text-xs text-[#3b4563] dark:text-[#d0f4ff] font-mono flex-1 truncate">
              {log.command_id.slice(0, 12)}...
            </span>
            {log.duration_ms != null && (
              <span className="text-[10px] text-[#b0bdd5]">{log.duration_ms}ms</span>
            )}
            <span className="text-[10px] text-[#b0bdd5]">
              {new Date(log.queued_at).toLocaleString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
          {log.output && (
            <pre className="mt-2 ml-6 text-[10px] text-[#64748b] font-mono bg-[#f8fafc] dark:bg-[#0a1520] rounded-lg p-2 border border-[#e2e8f0] dark:border-[#1e3a4a] whitespace-pre-wrap break-all line-clamp-3">{log.output}</pre>
          )}
        </Card>
      ))}
      <p className="text-[10px] text-[#b0bdd5] px-1 text-right">Son {logs.length} komut · 15s yenileme</p>
    </div>
  );
}

export function ServiceDetailPage() {
  const { serviceId } = useParams<{ serviceId: string }>();
  const navigate = useNavigate();
  const { deleteService, restartService, stopService } = useServices();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [metricsDuration, setMetricsDuration] = useState("1h");
  const [execCommand, setExecCommand] = useState("");
  const [execLoading, setExecLoading] = useState(false);
  const [execHistory, setExecHistory] = useState<ExecEntry[]>([]);
  const [startLoading, setStartLoading] = useState(false);
  const [scaleInstances, setScaleInstances] = useState(1);
  const [scaleStrategy, setScaleStrategy] = useState<'round_robin' | 'least_conn' | 'ip_hash'>('round_robin');
  const [scaleLoading, setScaleLoading] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  const { data: service, isLoading: serviceLoading } = useQuery({
    queryKey: ["service", serviceId],
    queryFn: () => servicesApi.get(serviceId!),
    enabled: !!serviceId,
    refetchInterval: 15000,
  });

  const { data: metrics = [], isLoading: metricsLoading } = useQuery({
    queryKey: ["serviceMetrics", serviceId, metricsDuration],
    queryFn: () => metricsApi.getHistory(serviceId!, metricsDuration),
    enabled: !!serviceId,
    refetchInterval: 30000,
  });

  const { data: uptime } = useQuery({
    queryKey: ["serviceUptime", serviceId],
    queryFn: () => metricsApi.getUptime(serviceId!, "24h"),
    enabled: !!serviceId,
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ["serviceAlerts", serviceId],
    queryFn: () => metricsApi.getAlerts(serviceId!, false),
    enabled: !!serviceId,
  });

  const handleDelete = () => {
    if (serviceId) {
      deleteService(serviceId);
      setDeleteDialogOpen(false);
      navigate("/services");
    }
  };

  useEffect(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent<{ command_id: string; status: string; output?: string; error?: string; service_id?: string }>;
      const { command_id, status, output, error } = ev.detail;
      setExecHistory((prev) =>
        prev.map((entry) =>
          entry.command_id === command_id
            ? { ...entry, status: status as ExecEntry['status'], output, error }
            : entry
        )
      );
    };
    window.addEventListener('nanonet:command_result', handler);
    return () => window.removeEventListener('nanonet:command_result', handler);
  }, []);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [execHistory]);

  const handleRestart = () => {
    if (serviceId) restartService(serviceId);
  };

  const handleStop = () => {
    if (serviceId) stopService(serviceId);
  };

  const handleStart = async () => {
    if (!serviceId) return;
    setStartLoading(true);
    try {
      await servicesApi.start(serviceId);
      toast.success('Start komutu gönderildi');
    } catch {
      toast.error('Start komutu gönderilemedi');
    } finally {
      setStartLoading(false);
    }
  };

  const handleScale = async () => {
    if (!serviceId) return;
    setScaleLoading(true);
    try {
      await servicesApi.scale(serviceId, scaleInstances, scaleStrategy);
      toast.success(`Scale komutu gönderildi: ${scaleInstances} instance`);
    } catch {
      toast.error('Scale komutu gönderilemedi');
    } finally {
      setScaleLoading(false);
    }
  };

  const handleExec = async () => {
    if (!serviceId || !execCommand.trim()) return;
    const cmd = execCommand.trim();
    setExecLoading(true);
    setExecCommand("");
    try {
      const result = await servicesApi.exec(serviceId, cmd);
      setExecHistory((prev) => [
        ...prev,
        { command: cmd, ...result, status: result.status as ExecEntry['status'] },
      ]);
    } catch {
      toast.error("Komut gönderilemedi");
    } finally {
      setExecLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!serviceId) return;
    setAnalyzeLoading(true);
    try {
      const result = await metricsApi.analyze(serviceId);
      setAnalysisResult(result);
    } catch {
      toast.error("AI analiz başarısız oldu");
    } finally {
      setAnalyzeLoading(false);
    }
  };

  const handleResolveAlert = async (alertId: string) => {
    try {
      await metricsApi.resolveAlert(alertId);
      toast.success("Alert çözüldü");
    } catch {
      toast.error("Alert çözülemedi");
    }
  };

  const chartData = metrics.map((m) => ({
    time: new Date(m.time).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
    cpu: m.cpu_percent,
    memory: m.memory_used_mb,
    latency: m.latency_ms,
    error_rate: m.error_rate,
    disk: m.disk_used_gb,
  }));

  const latestMetric = metrics.length > 0 ? metrics[metrics.length - 1] : null;

  if (serviceLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-[#39c5bb]/10 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-4 bg-white/80 dark:bg-[#0d1c24]/85 border-[#39c5bb]/10 dark:border-[#00e6ff]/8 rounded-xl animate-pulse">
              <div className="h-4 w-20 bg-[#39c5bb]/10 rounded mb-2" />
              <div className="h-6 w-16 bg-[#39c5bb]/10 rounded" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="text-center py-20">
        <Server className="w-16 h-16 text-[#b0bdd5] mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-[#3b4563] dark:text-[#d0f4ff]">Servis bulunamadı</h2>
        <Link to="/services" className="text-sm text-[#39c5bb] hover:underline mt-2 inline-block">
          ← Servislere dön
        </Link>
      </div>
    );
  }

  const statusColor =
    service.status === "up" ? "text-[#34d399]" :
    service.status === "degraded" ? "text-[#fbbf24]" : "text-[#fb7185]";

  const statusBg =
    service.status === "up" ? "bg-[#a7f3d0]/20 text-[#059669] border-[#a7f3d0]/40" :
    service.status === "degraded" ? "bg-[#fef3c7]/30 text-[#d97706] border-[#fbbf24]/30" :
    "bg-[#fda4af]/15 text-[#e11d48] border-[#fda4af]/30";

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate("/services")} className="p-2 rounded-lg hover:bg-[#39c5bb]/10 text-[#7c8db5] hover:text-[#39c5bb] transition-all">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-[#3b4563] dark:text-[#d0f4ff] truncate">{service?.name ?? ''}</h1>
              <Badge className={`text-[10px] font-([--font-mono]) px-2 py-0.5 rounded-full border ${statusBg}`}>
                {service?.status?.toUpperCase() ?? 'UNKNOWN'}
              </Badge>
            </div>
            <p className="text-xs text-[#b0bdd5] font-([--font-mono]) mt-0.5">
              {service?.host}:{service?.port} · {service?.health_endpoint} · {service?.poll_interval_sec}s poll
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleStart} disabled={startLoading} className="border-[#34d399]/20 text-[#059669] rounded-lg text-xs h-8 hover:bg-[#34d399]/10">
              {startLoading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Play className="w-3 h-3 mr-1" />} Start
            </Button>
            <Button variant="outline" size="sm" onClick={handleRestart} className="border-[#39c5bb]/20 text-[#39c5bb] rounded-lg text-xs h-8 hover:bg-[#39c5bb]/10">
              <RefreshCw className="w-3 h-3 mr-1" /> Restart
            </Button>
            <Button variant="outline" size="sm" onClick={handleStop} className="border-[#fbbf24]/20 text-[#d97706] rounded-lg text-xs h-8 hover:bg-[#fbbf24]/10">
              <Power className="w-3 h-3 mr-1" /> Stop
            </Button>
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="border-[#fda4af]/20 text-[#e11d48] rounded-lg text-xs h-8 hover:bg-[#fda4af]/10">
                  <Trash2 className="w-3 h-3" />
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-white dark:bg-[#0a161e] border-[#fda4af]/20 dark:border-[#fda4af]/15 rounded-2xl">
                <DialogHeader>
                  <DialogTitle className="text-[#e11d48]">Servisi Sil</DialogTitle>
                  <DialogDescription className="text-[#7c8db5] dark:text-[#527a8a]">
                    <strong>{service?.name}</strong> servisini silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} className="rounded-xl">İptal</Button>
                  <Button onClick={handleDelete} className="bg-[#e11d48] text-white rounded-xl hover:bg-[#be123c]">Sil</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </motion.div>

      {/* Quick Stats Row */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* CPU */}
          <Card className="p-4 bg-white/80 dark:bg-[#0d1c24]/85 border-[#39c5bb]/10 dark:border-[#00e6ff]/8 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-[#39c5bb]" />
                <span className="text-[10px] text-[#7c8db5] uppercase tracking-wider">CPU</span>
              </div>
              {latestMetric && (
                <span className={`text-[10px] font-medium ${(latestMetric.cpu_percent ?? 0) > 80 ? "text-[#e11d48]" : (latestMetric.cpu_percent ?? 0) > 60 ? "text-[#d97706]" : "text-[#059669]"}`}>
                  {(latestMetric.cpu_percent ?? 0) > 80 ? "High" : (latestMetric.cpu_percent ?? 0) > 60 ? "Mod" : "OK"}
                </span>
              )}
            </div>
            <p className="text-xl font-bold text-[#3b4563] dark:text-[#d0f4ff] mb-2">
              {latestMetric ? `${latestMetric.cpu_percent?.toFixed(1)}%` : "—"}
            </p>
            <div className="h-1 rounded-full bg-[#e2e8f0] dark:bg-[#162534] overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${!latestMetric ? "w-0" : (latestMetric.cpu_percent ?? 0) > 80 ? "bg-[#fb7185]" : (latestMetric.cpu_percent ?? 0) > 60 ? "bg-[#fbbf24]" : "bg-[#39c5bb]"}`}
                initial={{ width: 0 }}
                animate={{ width: latestMetric ? `${Math.min(latestMetric.cpu_percent ?? 0, 100)}%` : "0%" }}
                transition={{ duration: 0.7, delay: 0.2 }}
              />
            </div>
          </Card>
          {/* Memory */}
          <Card className="p-4 bg-white/80 dark:bg-[#0d1c24]/85 border-[#93c5fd]/10 dark:border-[#00b4d8]/8 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-[#93c5fd]" />
                <span className="text-[10px] text-[#7c8db5] uppercase tracking-wider">Memory</span>
              </div>
            </div>
            <p className="text-xl font-bold text-[#3b4563] dark:text-[#d0f4ff] mb-2">
              {latestMetric ? `${latestMetric.memory_used_mb?.toFixed(0)} MB` : "—"}
            </p>
            <div className="h-1 rounded-full bg-[#e2e8f0] dark:bg-[#162534] overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-[#93c5fd]"
                initial={{ width: 0 }}
                animate={{ width: latestMetric ? `${Math.min(((latestMetric.memory_used_mb ?? 0) / 4096) * 100, 100)}%` : "0%" }}
                transition={{ duration: 0.7, delay: 0.25 }}
              />
            </div>
          </Card>
          {/* Latency */}
          <Card className="p-4 bg-white/80 dark:bg-[#0d1c24]/85 border-[#c4b5fd]/10 dark:border-[#a78bfa]/8 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-[#c4b5fd]" />
                <span className="text-[10px] text-[#7c8db5] uppercase tracking-wider">Latency</span>
              </div>
              {latestMetric && (
                <span className={`text-[10px] font-medium ${(latestMetric.latency_ms ?? 0) > 500 ? "text-[#e11d48]" : (latestMetric.latency_ms ?? 0) > 200 ? "text-[#d97706]" : "text-[#059669]"}`}>
                  {(latestMetric.latency_ms ?? 0) > 500 ? "Slow" : (latestMetric.latency_ms ?? 0) > 200 ? "Mod" : "Fast"}
                </span>
              )}
            </div>
            <p className="text-xl font-bold text-[#3b4563] dark:text-[#d0f4ff] mb-2">
              {latestMetric ? `${latestMetric.latency_ms?.toFixed(0)} ms` : "—"}
            </p>
            <div className="h-1 rounded-full bg-[#e2e8f0] dark:bg-[#162534] overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${!latestMetric ? "w-0" : (latestMetric.latency_ms ?? 0) > 500 ? "bg-[#fb7185]" : (latestMetric.latency_ms ?? 0) > 200 ? "bg-[#fbbf24]" : "bg-[#c4b5fd]"}`}
                initial={{ width: 0 }}
                animate={{ width: latestMetric ? `${Math.min(((latestMetric.latency_ms ?? 0) / 1000) * 100, 100)}%` : "0%" }}
                transition={{ duration: 0.7, delay: 0.3 }}
              />
            </div>
          </Card>
          {/* Uptime */}
          <Card className="p-4 bg-white/80 dark:bg-[#0d1c24]/85 border-[#34d399]/10 dark:border-[#34d399]/8 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-[#34d399]" />
                <span className="text-[10px] text-[#7c8db5] uppercase tracking-wider">Uptime</span>
              </div>
            </div>
            <p className="text-xl font-bold text-[#3b4563] dark:text-[#d0f4ff] mb-2">
              {uptime ? `${uptime.uptime_percent.toFixed(1)}%` : "—"}
            </p>
            <div className="h-1 rounded-full bg-[#e2e8f0] dark:bg-[#162534] overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${!uptime ? "w-0" : uptime.uptime_percent >= 99 ? "bg-[#34d399]" : uptime.uptime_percent >= 95 ? "bg-[#fbbf24]" : "bg-[#fb7185]"}`}
                initial={{ width: 0 }}
                animate={{ width: uptime ? `${uptime.uptime_percent}%` : "0%" }}
                transition={{ duration: 0.8, delay: 0.35 }}
              />
            </div>
          </Card>
        </div>
      </motion.div>

      {/* Tabs: Charts, Alerts, AI */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
        <Tabs defaultValue="metrics" className="space-y-4">
          <div className="flex items-center justify-between">
            <TabsList className="bg-white/80 dark:bg-[#0d1c24]/85 border border-[#39c5bb]/10 dark:border-[#00e6ff]/8 rounded-xl p-1">
              <TabsTrigger value="metrics" className="rounded-lg text-xs data-[state=active]:bg-[#39c5bb]/10 data-[state=active]:text-[#2da89e]">
                <TrendingUp className="w-3 h-3 mr-1" /> Metrics
              </TabsTrigger>
              <TabsTrigger value="alerts" className="rounded-lg text-xs data-[state=active]:bg-[#fda4af]/10 data-[state=active]:text-[#e11d48]">
                <AlertCircle className="w-3 h-3 mr-1" /> Alerts ({alerts.length})
              </TabsTrigger>
              <TabsTrigger value="ai" className="rounded-lg text-xs data-[state=active]:bg-[#c4b5fd]/10 data-[state=active]:text-[#7c3aed]">
                <Sparkles className="w-3 h-3 mr-1" /> AI Analysis
              </TabsTrigger>
              <TabsTrigger value="terminal" className="rounded-lg text-xs data-[state=active]:bg-[#1e293b]/80 dark:data-[state=active]:bg-[#0f172a]/80 data-[state=active]:text-[#38bdf8]">
                <Terminal className="w-3 h-3 mr-1" /> Terminal
              </TabsTrigger>
              <TabsTrigger value="scale" className="rounded-lg text-xs data-[state=active]:bg-[#34d399]/10 data-[state=active]:text-[#059669]">
                <Layers className="w-3 h-3 mr-1" /> Load Balancing
              </TabsTrigger>
              <TabsTrigger value="history" className="rounded-lg text-xs data-[state=active]:bg-[#93c5fd]/10 data-[state=active]:text-[#3b82f6]">
                <History className="w-3 h-3 mr-1" /> History
              </TabsTrigger>
            </TabsList>

            {/* Duration picker for metrics */}
            <div className="flex items-center gap-1">
              {["15m", "1h", "6h", "24h"].map((d) => (
                <button
                  key={d}
                  onClick={() => setMetricsDuration(d)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-all ${
                    metricsDuration === d
                      ? "bg-[#39c5bb]/15 text-[#2da89e] border border-[#39c5bb]/20"
                      : "text-[#7c8db5] dark:text-[#527a8a] hover:bg-[#f5f8ff] dark:hover:bg-[#0f1e28] border border-transparent"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Metrics Tab */}
          <TabsContent value="metrics" className="space-y-4">
            {metricsLoading ? (
              <Card className="p-8 bg-white/80 dark:bg-[#0d1c24]/85 border-[#39c5bb]/10 dark:border-[#00e6ff]/8 rounded-xl animate-pulse">
                <div className="h-64 bg-[#39c5bb]/5 rounded-lg" />
              </Card>
            ) : chartData.length === 0 ? (
              <Card className="p-12 bg-white/80 dark:bg-[#0d1c24]/85 border-[#39c5bb]/10 dark:border-[#00e6ff]/8 rounded-xl text-center">
                <Activity className="w-10 h-10 text-[#b0bdd5] mx-auto mb-3" />
                <p className="text-sm text-[#7c8db5]">Bu zaman aralığında metrik verisi yok</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* CPU Chart */}
                <Card className="p-4 bg-white/80 dark:bg-[#0d1c24]/85 border-[#39c5bb]/10 dark:border-[#00e6ff]/8 rounded-xl">
                  <h3 className="text-xs text-[#7c8db5] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Cpu className="w-3 h-3 text-[#39c5bb]" /> CPU Usage (%)
                  </h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#39c5bb" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#39c5bb" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="#b0bdd5" />
                      <YAxis tick={{ fontSize: 10 }} stroke="#b0bdd5" domain={[0, 100]} />
                      <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #39c5bb22", fontSize: 11 }} />
                      <Area type="monotone" dataKey="cpu" stroke="#39c5bb" fill="url(#cpuGrad)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </Card>

                {/* Memory Chart */}
                <Card className="p-4 bg-white/80 dark:bg-[#0d1c24]/85 border-[#93c5fd]/10 dark:border-[#00b4d8]/8 rounded-xl">
                  <h3 className="text-xs text-[#7c8db5] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <HardDrive className="w-3 h-3 text-[#93c5fd]" /> Memory (MB)
                  </h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="memGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#93c5fd" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#93c5fd" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="#b0bdd5" />
                      <YAxis tick={{ fontSize: 10 }} stroke="#b0bdd5" />
                      <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #93c5fd22", fontSize: 11 }} />
                      <Area type="monotone" dataKey="memory" stroke="#93c5fd" fill="url(#memGrad)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </Card>

                {/* Latency Chart */}
                <Card className="p-4 bg-white/80 dark:bg-[#0d1c24]/85 border-[#c4b5fd]/10 dark:border-[#a78bfa]/8 rounded-xl">
                  <h3 className="text-xs text-[#7c8db5] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-[#c4b5fd]" /> Latency (ms)
                  </h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="latGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#c4b5fd" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#c4b5fd" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="#b0bdd5" />
                      <YAxis tick={{ fontSize: 10 }} stroke="#b0bdd5" />
                      <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #c4b5fd22", fontSize: 11 }} />
                      <Area type="monotone" dataKey="latency" stroke="#c4b5fd" fill="url(#latGrad)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </Card>

                {/* Error Rate Chart */}
                <Card className="p-4 bg-white/80 dark:bg-[#0d1c24]/85 border-[#fda4af]/10 dark:border-[#fda4af]/8 rounded-xl">
                  <h3 className="text-xs text-[#7c8db5] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Zap className="w-3 h-3 text-[#fda4af]" /> Error Rate (%)
                  </h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="errGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#fda4af" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#fda4af" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="#b0bdd5" />
                      <YAxis tick={{ fontSize: 10 }} stroke="#b0bdd5" domain={[0, "auto"]} />
                      <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #fda4af22", fontSize: 11 }} />
                      <Area type="monotone" dataKey="error_rate" stroke="#fda4af" fill="url(#errGrad)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Alerts Tab */}
          <TabsContent value="alerts" className="space-y-3">
            {alerts.length === 0 ? (
              <Card className="p-12 bg-white/80 dark:bg-[#0d1c24]/85 border-[#39c5bb]/10 dark:border-[#00e6ff]/8 rounded-xl text-center">
                <Shield className="w-10 h-10 text-[#34d399] mx-auto mb-3" />
                <p className="text-sm text-[#7c8db5]">Aktif alert yok — tüm sistemler çalışıyor</p>
              </Card>
            ) : (
              alerts.map((alert, index) => (
                <motion.div key={alert.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.05 }}>
                  <Card className={`p-4 bg-white/80 dark:bg-[#0d1c24]/85 border rounded-xl ${
                    alert.severity === "crit" ? "border-[#fda4af]/30" :
                    alert.severity === "warn" ? "border-[#fbbf24]/25" :
                    "border-[#93c5fd]/20"
                  }`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                          alert.severity === "crit" ? "bg-[#fb7185]" :
                          alert.severity === "warn" ? "bg-[#fbbf24]" :
                          "bg-[#93c5fd]"
                        }`} />
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className={`text-[9px] px-1.5 py-0 rounded-full border uppercase font-([--font-mono]) ${
                              alert.severity === "crit" ? "bg-[#fda4af]/15 text-[#e11d48] border-[#fda4af]/30" :
                              alert.severity === "warn" ? "bg-[#fef3c7]/30 text-[#d97706] border-[#fbbf24]/20" :
                              "bg-[#93c5fd]/15 text-[#3b82f6] border-[#93c5fd]/20"
                            }`}>
                              {alert.severity}
                            </Badge>
                            <span className="text-[10px] text-[#b0bdd5]">{alert.type}</span>
                          </div>
                          <p className="text-xs text-[#3b4563] dark:text-[#d0f4ff]">{alert.message}</p>
                          <p className="text-[10px] text-[#b0bdd5] mt-1">
                            {new Date(alert.triggered_at).toLocaleString("tr-TR")}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleResolveAlert(alert.id)}
                        className="text-[10px] border-[#34d399]/20 text-[#059669] rounded-lg h-7 hover:bg-[#34d399]/10"
                      >
                        Çöz
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              ))
            )}
          </TabsContent>

          {/* Terminal Tab */}
          <TabsContent value="terminal" className="space-y-3">
            <Card className="bg-[#0a0f1a] border-[#1e293b] rounded-xl overflow-hidden shadow-xl">
              {/* Title bar */}
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#1e293b] bg-[#0d1525]">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
                </div>
                <span className="text-[10px] text-[#475569] font-mono ml-2">{service?.name ?? 'terminal'} — exec</span>
                <div className="ml-auto flex items-center gap-2">
                  {execHistory.length > 0 && (
                    <button onClick={() => setExecHistory([])} className="text-[10px] text-[#475569] hover:text-[#94a3b8] transition-colors">
                      clear
                    </button>
                  )}
                </div>
              </div>
              {/* Output area */}
              <div className="p-4 h-80 overflow-y-auto space-y-3 font-mono text-xs">
                {execHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3 select-none">
                    <Terminal className="w-10 h-10 text-[#1e3a4a]" />
                    <p className="text-[#334155] text-[11px]">Komut girin ve Enter'a basın</p>
                    <div className="flex flex-wrap gap-2 mt-1 justify-center">
                      {['uptime', 'ps aux', 'df -h', 'free -m'].map((s) => (
                        <button key={s} onClick={() => setExecCommand(s)}
                          className="px-2 py-1 rounded bg-[#1e293b] text-[#38bdf8] text-[10px] hover:bg-[#253347] transition-colors">
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    {execHistory.map((entry, i) => (
                      <div key={i} className="space-y-1">
                        {/* Command line */}
                        <div className="flex items-center gap-1.5">
                          <span className="text-[#22d3ee] shrink-0">$</span>
                          <span className="text-[#e2e8f0]">{entry.command}</span>
                          <span className="ml-auto text-[#334155] text-[10px]">
                            {new Date(entry.queued_at).toLocaleTimeString('tr-TR')}
                          </span>
                        </div>
                        {/* Status indicator */}
                        <div className="flex items-center gap-1.5 pl-3">
                          {entry.status === 'queued' || entry.status === 'received' ? (
                            <><Loader2 className="w-3 h-3 text-[#fbbf24] animate-spin" />
                            <span className="text-[#fbbf24] text-[10px]">{entry.status}...</span></>
                          ) : entry.status === 'success' ? (
                            <><CheckCircle2 className="w-3 h-3 text-[#34d399]" />
                            <span className="text-[#34d399] text-[10px]">success</span></>
                          ) : (
                            <><XCircle className="w-3 h-3 text-[#fb7185]" />
                            <span className="text-[#fb7185] text-[10px]">{entry.status}</span></>
                          )}
                          {entry.duration_ms !== undefined && (
                            <span className="text-[#475569] text-[10px] ml-auto">{entry.duration_ms}ms</span>
                          )}
                        </div>
                        {/* Output */}
                        {entry.output && (
                          <pre className="pl-3 text-[#94a3b8] text-[11px] leading-relaxed whitespace-pre-wrap break-all bg-[#0f172a] rounded-lg p-2 border border-[#1e293b]">{entry.output}</pre>
                        )}
                        {/* Error */}
                        {entry.error && (
                          <pre className="pl-3 text-[#fb7185] text-[11px] leading-relaxed whitespace-pre-wrap break-all bg-[#1f0a0e] rounded-lg p-2 border border-[#fb7185]/20">{entry.error}</pre>
                        )}
                      </div>
                    ))}
                    <div ref={terminalEndRef} />
                  </>
                )}
              </div>
              {/* Input area */}
              <div className="flex items-center gap-2 px-4 py-3 border-t border-[#1e293b] bg-[#0d1525]">
                <span className="text-[#22d3ee] font-mono text-xs shrink-0">❯</span>
                <Input
                  value={execCommand}
                  onChange={(e) => setExecCommand(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !execLoading) handleExec(); }}
                  placeholder="komut girin..."
                  disabled={execLoading}
                  className="bg-transparent border-none text-[#e2e8f0] font-mono text-xs h-7 px-0 focus-visible:ring-0 placeholder:text-[#2d3f52]"
                />
                <Button size="sm" onClick={handleExec}
                  disabled={execLoading || !execCommand.trim()}
                  className="h-7 px-3 bg-[#38bdf8]/10 hover:bg-[#38bdf8]/20 text-[#38bdf8] border border-[#38bdf8]/20 rounded-lg shrink-0"
                  variant="outline">
                  {execLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                </Button>
              </div>
            </Card>
          </TabsContent>

          {/* Load Balancing Tab */}
          <TabsContent value="scale" className="space-y-4">
            <Card className="p-6 bg-white/80 dark:bg-[#0d1c24]/85 border-[#34d399]/10 dark:border-[#34d399]/8 rounded-xl">
              <div className="flex items-center gap-2 mb-6">
                <Layers className="w-4 h-4 text-[#34d399]" />
                <h3 className="text-sm font-semibold text-[#3b4563] dark:text-[#d0f4ff]">Load Balancing & Scale</h3>
              </div>

              {/* Instance count */}
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] text-[#7c8db5] uppercase tracking-wider block mb-2">Instance Sayısı</label>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setScaleInstances(Math.max(0, scaleInstances - 1))}
                      className="w-8 h-8 rounded-lg border border-[#34d399]/20 text-[#34d399] hover:bg-[#34d399]/10 flex items-center justify-center transition-all">
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-2xl font-bold text-[#3b4563] dark:text-[#d0f4ff] w-10 text-center">{scaleInstances}</span>
                    <button onClick={() => setScaleInstances(Math.min(32, scaleInstances + 1))}
                      className="w-8 h-8 rounded-lg border border-[#34d399]/20 text-[#34d399] hover:bg-[#34d399]/10 flex items-center justify-center transition-all">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <div className="flex gap-1 ml-2">
                      {[1, 2, 4, 8].map((n) => (
                        <button key={n} onClick={() => setScaleInstances(n)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-medium border transition-all ${
                            scaleInstances === n
                              ? 'bg-[#34d399]/15 text-[#059669] border-[#34d399]/30'
                              : 'text-[#7c8db5] border-[#e2e8f0] dark:border-[#1e3a4a] hover:border-[#34d399]/20'
                          }`}>{n}x</button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Strategy */}
                <div>
                  <label className="text-[10px] text-[#7c8db5] uppercase tracking-wider block mb-2">Load Balancing Stratejisi</label>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { value: 'round_robin', label: 'Round Robin', desc: 'Sırayla dağıt' },
                      { value: 'least_conn', label: 'Least Conn', desc: 'En az bağlantı' },
                      { value: 'ip_hash', label: 'IP Hash', desc: 'IP bazlı sticky' },
                    ] as const).map((s) => (
                      <button key={s.value} onClick={() => setScaleStrategy(s.value)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          scaleStrategy === s.value
                            ? 'border-[#34d399]/40 bg-[#34d399]/8 dark:bg-[#34d399]/6'
                            : 'border-[#e2e8f0] dark:border-[#1e3a4a] hover:border-[#34d399]/20'
                        }`}>
                        <p className={`text-xs font-semibold mb-0.5 ${
                          scaleStrategy === s.value ? 'text-[#059669]' : 'text-[#3b4563] dark:text-[#d0f4ff]'
                        }`}>{s.label}</p>
                        <p className="text-[10px] text-[#b0bdd5]">{s.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Info box */}
                <div className="p-3 rounded-xl bg-[#f0fdf4] dark:bg-[#0a1f15] border border-[#34d399]/15 text-[10px] text-[#7c8db5] dark:text-[#4a9a6a] leading-relaxed">
                  Komut agent'a iletilir. Agent'ta <code className="font-mono bg-[#34d399]/10 px-1 rounded">NANONET_SCALE_CMD</code> tanımlıysa
                  çalıştırılır; tanımlı değilse acknowledge edilir.
                  <br />Örn: <code className="font-mono bg-[#34d399]/10 px-1 rounded">docker service scale myapp=$INSTANCES</code>
                </div>

                <Button onClick={handleScale} disabled={scaleLoading}
                  className="w-full bg-[#34d399] hover:bg-[#22c55e] text-white rounded-xl h-9 text-sm font-medium">
                  {scaleLoading
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gönderiliyor...</>
                    : <><Layers className="w-4 h-4 mr-2" /> {scaleInstances} Instance'a Scale Et ({scaleStrategy})</>}
                </Button>
              </div>
            </Card>
          </TabsContent>

          {/* Command History Tab */}
          <TabsContent value="history" className="space-y-3">
            <CommandHistoryTab serviceId={serviceId!} />
          </TabsContent>

          {/* AI Tab */}
          <TabsContent value="ai" className="space-y-4">
            <Card className="p-6 bg-white/80 dark:bg-[#0d1c24]/85 border-[#c4b5fd]/10 dark:border-[#a78bfa]/8 rounded-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#c4b5fd]" />
                  <h3 className="text-sm font-semibold text-[#3b4563] dark:text-[#d0f4ff]">AI Analiz</h3>
                </div>
                <Button
                  onClick={handleAnalyze}
                  disabled={analyzeLoading}
                  className="bg-linear-to-r from-[#c4b5fd] to-[#93c5fd] text-white rounded-xl text-xs h-8"
                >
                  {analyzeLoading ? (
                    <>
                      <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Analiz Ediliyor...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3 mr-1" /> Analiz Başlat
                    </>
                  )}
                </Button>
              </div>

              {analysisResult ? (
                <div className="space-y-4">
                  <div className="p-4 bg-[#f5f8ff] dark:bg-[#0f1e28] rounded-xl border border-[#c4b5fd]/10 dark:border-[#a78bfa]/10">
                    <h4 className="text-xs text-[#7c8db5] uppercase tracking-wider mb-2">Özet</h4>
                    <p className="text-sm text-[#3b4563] dark:text-[#d0f4ff]">{analysisResult.summary}</p>
                  </div>
                  {analysisResult.root_cause && (
                    <div className="p-4 bg-[#fda4af]/5 rounded-xl border border-[#fda4af]/10">
                      <h4 className="text-xs text-[#7c8db5] uppercase tracking-wider mb-2">Kök Neden</h4>
                      <p className="text-sm text-[#3b4563] dark:text-[#d0f4ff]">{analysisResult.root_cause}</p>
                    </div>
                  )}
                  {analysisResult.recommendations && analysisResult.recommendations.length > 0 && (
                    <div className="p-4 bg-[#39c5bb]/5 rounded-xl border border-[#39c5bb]/10">
                      <h4 className="text-xs text-[#7c8db5] uppercase tracking-wider mb-2">Öneriler</h4>
                      <ul className="space-y-2">
                        {analysisResult.recommendations.map((rec, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <Badge className={`text-[9px] px-1.5 py-0 rounded-full shrink-0 mt-0.5 ${
                              rec.priority === "high" ? "bg-[#fda4af]/15 text-[#e11d48]" :
                              rec.priority === "medium" ? "bg-[#fbbf24]/15 text-[#d97706]" :
                              "bg-[#39c5bb]/15 text-[#2da89e]"
                            }`}>
                              {rec.priority}
                            </Badge>
                            <span className="text-xs text-[#3b4563] dark:text-[#d0f4ff]">{rec.action}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {analysisResult.confidence !== undefined && (
                    <div className="flex items-center gap-2 text-[10px] text-[#b0bdd5]">
                      <Eye className="w-3 h-3" /> Güven: {(analysisResult.confidence * 100).toFixed(0)}%
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Sparkles className="w-8 h-8 text-[#c4b5fd]/30 mx-auto mb-3" />
                  <p className="text-xs text-[#7c8db5]">
                    AI-powered analiz için "Analiz Başlat" butonuna tıklayın
                  </p>
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}

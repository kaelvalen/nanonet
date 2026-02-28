import React, { useState, useEffect, useRef } from "react";
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
    if (status === 'success') return <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "var(--status-up)" }} />;
    if (status === 'failed' || status === 'timeout') return <XCircle className="w-3.5 h-3.5" style={{ color: "var(--status-down)" }} />;
    return <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: "var(--status-warn)" }} />;
  };

  const actionColorStyle: Record<string, React.CSSProperties> = {
    restart: { color: 'var(--color-teal)', background: 'var(--color-teal-subtle)' },
    stop:    { color: 'var(--status-warn-text)', background: 'var(--status-warn-subtle)' },
    start:   { color: 'var(--status-up-text)', background: 'var(--status-up-subtle)' },
    exec:    { color: 'var(--color-blue)', background: 'var(--color-blue-subtle)' },
    scale:   { color: 'var(--color-lavender)', background: 'var(--color-lavender-subtle)' },
    ping:    { color: 'var(--text-muted)', background: 'var(--surface-sunken)' },
  };

  if (isLoading) return (
    <Card className="p-6 rounded-xl animate-pulse" style={{ background: "var(--surface-card)", border: "1px solid var(--color-blue-border)" }}>
      <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-10 rounded-lg" style={{ background: "var(--color-blue-subtle)" }} />)}</div>
    </Card>
  );

  if (logs.length === 0) return (
    <Card className="p-12 rounded-xl text-center" style={{ background: "var(--surface-card)", border: "1px solid var(--color-blue-border)" }}>
      <History className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--text-faint)" }} />
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>Henüz komut geçmişi yok</p>
    </Card>
  );

  return (
    <div className="space-y-2">
      {logs.map((log) => (
        <Card key={log.id} className="p-3 rounded-xl" style={{ background: "var(--surface-card)", border: "1px solid var(--color-blue-border)" }}>
          <div className="flex items-center gap-3">
            {statusIcon(log.status)}
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full font-mono"
              style={actionColorStyle[log.action] ?? { color: 'var(--text-muted)', background: 'var(--surface-sunken)' }}>{log.action}</span>
            <span className="text-xs font-mono flex-1 truncate" style={{ color: "var(--text-secondary)" }}>
              {log.command_id.slice(0, 12)}...
            </span>
            {log.duration_ms != null && (
              <span className="text-[10px]" style={{ color: "var(--text-faint)" }}>{log.duration_ms}ms</span>
            )}
            <span className="text-[10px]" style={{ color: "var(--text-faint)" }}>
              {new Date(log.queued_at).toLocaleString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
          {log.output && (
            <pre className="mt-2 ml-6 text-[10px] font-mono rounded-lg p-2 whitespace-pre-wrap break-all line-clamp-3" style={{ color: "var(--text-muted)", background: "var(--surface-sunken)", border: "1px solid var(--border-subtle)" }}>{log.output}</pre>
          )}
        </Card>
      ))}
      <p className="text-[10px] px-1 text-right" style={{ color: "var(--text-faint)" }}>Son {logs.length} komut · 15s yenileme</p>
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
  const [deepAnalysis, setDeepAnalysis] = useState(false);
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
      const result = await metricsApi.analyze(serviceId, 30, deepAnalysis);
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
        <div className="h-8 w-48 rounded animate-pulse" style={{ background: "var(--color-teal-subtle)" }} />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="p-4 rounded-xl animate-pulse" style={{ background: "var(--surface-card)", border: "1px solid var(--color-teal-border)" }}>
              <div className="h-4 w-20 rounded mb-2" style={{ background: "var(--color-teal-subtle)" }} />
              <div className="h-6 w-16 rounded" style={{ background: "var(--color-teal-subtle)" }} />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="text-center py-20">
        <Server className="w-16 h-16 mx-auto mb-4" style={{ color: "var(--text-faint)" }} />
        <h2 className="text-lg font-semibold" style={{ color: "var(--text-secondary)" }}>Servis bulunamadı</h2>
        <Link to="/services" className="text-sm hover:underline mt-2 inline-block" style={{ color: "var(--color-teal)" }}>
          ← Servislere dön
        </Link>
      </div>
    );
  }

  const statusBadgeStyle: React.CSSProperties =
    service.status === "up"
      ? { background: "var(--status-up-subtle)", color: "var(--status-up-text)", borderColor: "var(--status-up-border)" }
      : service.status === "degraded"
      ? { background: "var(--status-warn-subtle)", color: "var(--status-warn-text)", borderColor: "var(--status-warn-border)" }
      : { background: "var(--status-down-subtle)", color: "var(--status-down-text)", borderColor: "var(--status-down-border)" };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate("/services")} className="p-2 rounded-lg transition-all" style={{ color: "var(--text-muted)" }}>
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold truncate" style={{ color: "var(--text-secondary)" }}>{service?.name ?? ''}</h1>
              <Badge className="text-[10px] font-([--font-mono]) px-2 py-0.5 rounded-full border" style={statusBadgeStyle}>
                {service?.status?.toUpperCase() ?? 'UNKNOWN'}
              </Badge>
            </div>
            <p className="text-xs font-([--font-mono]) mt-0.5" style={{ color: "var(--text-faint)" }}>
              {service?.host}:{service?.port} · {service?.health_endpoint} · {service?.poll_interval_sec}s poll
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleStart} disabled={startLoading} className="rounded-lg text-xs h-8" style={{ borderColor: "var(--status-up-border)", color: "var(--status-up-text)" }}>
              {startLoading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Play className="w-3 h-3 mr-1" />} Start
            </Button>
            <Button variant="outline" size="sm" onClick={handleRestart} className="rounded-lg text-xs h-8" style={{ borderColor: "var(--color-teal-border)", color: "var(--color-teal)" }}>
              <RefreshCw className="w-3 h-3 mr-1" /> Restart
            </Button>
            <Button variant="outline" size="sm" onClick={handleStop} className="rounded-lg text-xs h-8" style={{ borderColor: "var(--status-warn-border)", color: "var(--status-warn-text)" }}>
              <Power className="w-3 h-3 mr-1" /> Stop
            </Button>
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="rounded-lg text-xs h-8" style={{ borderColor: "var(--status-down-border)", color: "var(--status-down-text)" }}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-2xl" style={{ background: "var(--surface-card)", border: "1px solid var(--status-down-border)" }}>
                <DialogHeader>
                  <DialogTitle style={{ color: "var(--status-down-text)" }}>Servisi Sil</DialogTitle>
                  <DialogDescription style={{ color: "var(--text-muted)" }}>
                    <strong>{service?.name}</strong> servisini silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} className="rounded-xl">İptal</Button>
                  <Button onClick={handleDelete} className="text-white rounded-xl" style={{ background: "var(--status-down-text)" }}>Sil</Button>
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
          <Card className="p-4 rounded-xl overflow-hidden" style={{ background: "var(--surface-card)", border: "1px solid var(--color-teal-border)" }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5" style={{ color: "var(--color-teal)" }} />
                <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>CPU</span>
              </div>
              {latestMetric && (
                <span className="text-[10px] font-medium" style={{ color: (latestMetric.cpu_percent ?? 0) > 80 ? "var(--status-down-text)" : (latestMetric.cpu_percent ?? 0) > 60 ? "var(--status-warn-text)" : "var(--status-up-text)" }}>
                  {(latestMetric.cpu_percent ?? 0) > 80 ? "High" : (latestMetric.cpu_percent ?? 0) > 60 ? "Mod" : "OK"}
                </span>
              )}
            </div>
            <p className="text-xl font-bold mb-2" style={{ color: "var(--text-secondary)" }}>
              {latestMetric ? `${latestMetric.cpu_percent?.toFixed(1)}%` : "—"}
            </p>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--border-track)" }}>
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: !latestMetric ? undefined : (latestMetric.cpu_percent ?? 0) > 80 ? "var(--status-down)" : (latestMetric.cpu_percent ?? 0) > 60 ? "var(--status-warn)" : "var(--color-teal)" }}
                initial={{ width: 0 }}
                animate={{ width: latestMetric ? `${Math.min(latestMetric.cpu_percent ?? 0, 100)}%` : "0%" }}
                transition={{ duration: 0.7, delay: 0.2 }}
              />
            </div>
          </Card>
          {/* Memory */}
          <Card className="p-4 rounded-xl overflow-hidden" style={{ background: "var(--surface-card)", border: "1px solid var(--color-blue-border)" }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5" style={{ color: "var(--color-blue)" }} />
                <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Memory</span>
              </div>
            </div>
            <p className="text-xl font-bold mb-2" style={{ color: "var(--text-secondary)" }}>
              {latestMetric ? `${latestMetric.memory_used_mb?.toFixed(0)} MB` : "—"}
            </p>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--border-track)" }}>
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: "var(--color-blue)" }}
                initial={{ width: 0 }}
                animate={{ width: latestMetric ? `${Math.min(((latestMetric.memory_used_mb ?? 0) / 4096) * 100, 100)}%` : "0%" }}
                transition={{ duration: 0.7, delay: 0.25 }}
              />
            </div>
          </Card>
          {/* Latency */}
          <Card className="p-4 rounded-xl overflow-hidden" style={{ background: "var(--surface-card)", border: "1px solid var(--color-lavender-border)" }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" style={{ color: "var(--color-lavender)" }} />
                <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Latency</span>
              </div>
              {latestMetric && (
                <span className="text-[10px] font-medium" style={{ color: (latestMetric.latency_ms ?? 0) > 500 ? "var(--status-down-text)" : (latestMetric.latency_ms ?? 0) > 200 ? "var(--status-warn-text)" : "var(--status-up-text)" }}>
                  {(latestMetric.latency_ms ?? 0) > 500 ? "Slow" : (latestMetric.latency_ms ?? 0) > 200 ? "Mod" : "Fast"}
                </span>
              )}
            </div>
            <p className="text-xl font-bold mb-2" style={{ color: "var(--text-secondary)" }}>
              {latestMetric ? `${latestMetric.latency_ms?.toFixed(0)} ms` : "—"}
            </p>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--border-track)" }}>
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: !latestMetric ? undefined : (latestMetric.latency_ms ?? 0) > 500 ? "var(--status-down)" : (latestMetric.latency_ms ?? 0) > 200 ? "var(--status-warn)" : "var(--color-lavender)" }}
                initial={{ width: 0 }}
                animate={{ width: latestMetric ? `${Math.min(((latestMetric.latency_ms ?? 0) / 1000) * 100, 100)}%` : "0%" }}
                transition={{ duration: 0.7, delay: 0.3 }}
              />
            </div>
          </Card>
          {/* Uptime */}
          <Card className="p-4 rounded-xl overflow-hidden" style={{ background: "var(--surface-card)", border: "1px solid var(--status-up-border)" }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" style={{ color: "var(--status-up)" }} />
                <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Uptime</span>
              </div>
            </div>
            <p className="text-xl font-bold mb-2" style={{ color: "var(--text-secondary)" }}>
              {uptime ? `${uptime.uptime_percent.toFixed(1)}%` : "—"}
            </p>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--border-track)" }}>
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: !uptime ? undefined : uptime.uptime_percent >= 99 ? "var(--status-up)" : uptime.uptime_percent >= 95 ? "var(--status-warn)" : "var(--status-down)" }}
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
            <TabsList className="rounded-xl p-1" style={{ background: "var(--surface-card)", border: "1px solid var(--color-teal-border)" }}>
              <TabsTrigger value="metrics" className="rounded-lg text-xs">
                <TrendingUp className="w-3 h-3 mr-1" /> Metrics
              </TabsTrigger>
              <TabsTrigger value="alerts" className="rounded-lg text-xs">
                <AlertCircle className="w-3 h-3 mr-1" /> Alerts ({alerts.length})
              </TabsTrigger>
              <TabsTrigger value="ai" className="rounded-lg text-xs">
                <Sparkles className="w-3 h-3 mr-1" /> AI Analysis
              </TabsTrigger>
              <TabsTrigger value="terminal" className="rounded-lg text-xs">
                <Terminal className="w-3 h-3 mr-1" /> Terminal
              </TabsTrigger>
              <TabsTrigger value="scale" className="rounded-lg text-xs">
                <Layers className="w-3 h-3 mr-1" /> Load Balancing
              </TabsTrigger>
              <TabsTrigger value="history" className="rounded-lg text-xs">
                <History className="w-3 h-3 mr-1" /> History
              </TabsTrigger>
            </TabsList>

            {/* Duration picker for metrics */}
            <div className="flex items-center gap-1">
              {["15m", "1h", "6h", "24h"].map((d) => (
                <button
                  key={d}
                  onClick={() => setMetricsDuration(d)}
                  className="px-2 py-1 rounded-lg text-[10px] font-medium transition-all border"
                  style={metricsDuration === d
                    ? { background: "var(--color-teal-subtle)", color: "var(--color-teal)", borderColor: "var(--color-teal-border)" }
                    : { color: "var(--text-muted)", borderColor: "transparent" }}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Metrics Tab */}
          <TabsContent value="metrics" className="space-y-4">
            {metricsLoading ? (
              <Card className="p-8 rounded-xl animate-pulse" style={{ background: "var(--surface-card)", border: "1px solid var(--color-teal-border)" }}>
                <div className="h-64 rounded-lg" style={{ background: "var(--color-teal-subtle)" }} />
              </Card>
            ) : chartData.length === 0 ? (
              <Card className="p-12 rounded-xl text-center" style={{ background: "var(--surface-card)", border: "1px solid var(--color-teal-border)" }}>
                <Activity className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--text-faint)" }} />
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>Bu zaman aralığında metrik verisi yok</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* CPU Chart */}
                <Card className="p-4 rounded-xl" style={{ background: "var(--surface-card)", border: "1px solid var(--color-teal-border)" }}>
                  <h3 className="text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
                    <Cpu className="w-3 h-3" style={{ color: "var(--color-teal)" }} /> CPU Usage (%)
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
                <Card className="p-4 rounded-xl" style={{ background: "var(--surface-card)", border: "1px solid var(--color-blue-border)" }}>
                  <h3 className="text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
                    <HardDrive className="w-3 h-3" style={{ color: "var(--color-blue)" }} /> Memory (MB)
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
                <Card className="p-4 rounded-xl" style={{ background: "var(--surface-card)", border: "1px solid var(--color-lavender-border)" }}>
                  <h3 className="text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
                    <Clock className="w-3 h-3" style={{ color: "var(--color-lavender)" }} /> Latency (ms)
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
                <Card className="p-4 rounded-xl" style={{ background: "var(--surface-card)", border: "1px solid var(--status-down-border)" }}>
                  <h3 className="text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
                    <Zap className="w-3 h-3" style={{ color: "var(--status-down)" }} /> Error Rate (%)
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
              <Card className="p-12 rounded-xl text-center" style={{ background: "var(--surface-card)", border: "1px solid var(--color-teal-border)" }}>
                <Shield className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--status-up)" }} />
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>Aktif alert yok — tüm sistemler çalışıyor</p>
              </Card>
            ) : (
              alerts.map((alert, index) => (
                <motion.div key={alert.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.05 }}>
                  <Card className="p-4 rounded-xl border" style={{ background: "var(--surface-card)", borderColor: alert.severity === "crit" ? "var(--status-down-border)" : alert.severity === "warn" ? "var(--status-warn-border)" : "var(--color-blue-border)" }}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: alert.severity === "crit" ? "var(--status-down)" : alert.severity === "warn" ? "var(--status-warn)" : "var(--color-blue)" }} />
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className="text-[9px] px-1.5 py-0 rounded-full border uppercase font-([--font-mono])" style={{ background: alert.severity === "crit" ? "var(--status-down-subtle)" : alert.severity === "warn" ? "var(--status-warn-subtle)" : "var(--color-blue-subtle)", color: alert.severity === "crit" ? "var(--status-down-text)" : alert.severity === "warn" ? "var(--status-warn-text)" : "var(--color-blue)", borderColor: alert.severity === "crit" ? "var(--status-down-border)" : alert.severity === "warn" ? "var(--status-warn-border)" : "var(--color-blue-border)" }}>
                              {alert.severity}
                            </Badge>
                            <span className="text-[10px]" style={{ color: "var(--text-faint)" }}>{alert.type}</span>
                          </div>
                          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{alert.message}</p>
                          <p className="text-[10px] mt-1" style={{ color: "var(--text-faint)" }}>
                            {new Date(alert.triggered_at).toLocaleString("tr-TR")}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleResolveAlert(alert.id)}
                        className="text-[10px] rounded-lg h-7"
                        style={{ borderColor: "var(--status-up-border)", color: "var(--status-up-text)" }}
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
            <Card className="rounded-xl overflow-hidden shadow-xl" style={{ background: "var(--terminal-bg, #0a0f1a)", border: "1px solid var(--terminal-border, #1e293b)" }}>
              {/* Title bar */}
              <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: "1px solid var(--terminal-border, #1e293b)", background: "var(--terminal-header, #0d1525)" }}>
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#ff5f57" }} />
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#febc2e" }} />
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#28c840" }} />
                </div>
                <span className="text-[10px] font-mono ml-2" style={{ color: "#475569" }}>{service?.name ?? 'terminal'} — exec</span>
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
                    <Terminal className="w-10 h-10" style={{ color: "#1e3a4a" }} />
                    <p className="text-[11px]" style={{ color: "#334155" }}>Komut girin ve Enter'a basın</p>
                    <div className="flex flex-wrap gap-2 mt-1 justify-center">
                      {['uptime', 'ps aux', 'df -h', 'free -m'].map((s) => (
                        <button key={s} onClick={() => setExecCommand(s)}
                          className="px-2 py-1 rounded text-[10px] transition-colors" style={{ background: "#1e293b", color: "#38bdf8" }}>
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
                          <span className="shrink-0" style={{ color: "#22d3ee" }}>$</span>
                          <span style={{ color: "#e2e8f0" }}>{entry.command}</span>
                          <span className="ml-auto text-[10px]" style={{ color: "#334155" }}>
                            {new Date(entry.queued_at).toLocaleTimeString('tr-TR')}
                          </span>
                        </div>
                        {/* Status indicator */}
                        <div className="flex items-center gap-1.5 pl-3">
                          {entry.status === 'queued' || entry.status === 'received' ? (
                            <><Loader2 className="w-3 h-3 animate-spin" style={{ color: "#fbbf24" }} />
                            <span className="text-[10px]" style={{ color: "#fbbf24" }}>{entry.status}...</span></>
                          ) : entry.status === 'success' ? (
                            <><CheckCircle2 className="w-3 h-3" style={{ color: "#34d399" }} />
                            <span className="text-[10px]" style={{ color: "#34d399" }}>success</span></>
                          ) : (
                            <><XCircle className="w-3 h-3" style={{ color: "#fb7185" }} />
                            <span className="text-[10px]" style={{ color: "#fb7185" }}>{entry.status}</span></>
                          )}
                          {entry.duration_ms !== undefined && (
                            <span className="text-[10px] ml-auto" style={{ color: "#475569" }}>{entry.duration_ms}ms</span>
                          )}
                        </div>
                        {/* Output */}
                        {entry.output && (
                          <pre className="pl-3 text-[11px] leading-relaxed whitespace-pre-wrap break-all rounded-lg p-2" style={{ color: "#94a3b8", background: "#0f172a", border: "1px solid #1e293b" }}>{entry.output}</pre>
                        )}
                        {/* Error */}
                        {entry.error && (
                          <pre className="pl-3 text-[11px] leading-relaxed whitespace-pre-wrap break-all rounded-lg p-2" style={{ color: "#fb7185", background: "#1f0a0e", border: "1px solid rgba(251,113,133,0.2)" }}>{entry.error}</pre>
                        )}
                      </div>
                    ))}
                    <div ref={terminalEndRef} />
                  </>
                )}
              </div>
              {/* Input area */}
              <div className="flex items-center gap-2 px-4 py-3" style={{ borderTop: "1px solid #1e293b", background: "#0d1525" }}>
                <span className="font-mono text-xs shrink-0" style={{ color: "#22d3ee" }}>❯</span>
                <Input
                  value={execCommand}
                  onChange={(e) => setExecCommand(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !execLoading) handleExec(); }}
                  placeholder="komut girin..."
                  disabled={execLoading}
                  className="bg-transparent border-none font-mono text-xs h-7 px-0 focus-visible:ring-0"
                  style={{ color: "#e2e8f0" }}
                />
                <Button size="sm" onClick={handleExec}
                  disabled={execLoading || !execCommand.trim()}
                  className="h-7 px-3 rounded-lg shrink-0"
                  style={{ background: "rgba(56,189,248,0.1)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.2)" }}
                  variant="outline">
                  {execLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                </Button>
              </div>
            </Card>
          </TabsContent>

          {/* Load Balancing Tab */}
          <TabsContent value="scale" className="space-y-4">
            <Card className="p-6 rounded-xl" style={{ background: "var(--surface-card)", border: "1px solid var(--status-up-border)" }}>
              <div className="flex items-center gap-2 mb-6">
                <Layers className="w-4 h-4" style={{ color: "var(--status-up)" }} />
                <h3 className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>Load Balancing &amp; Scale</h3>
              </div>

              {/* Instance count */}
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] uppercase tracking-wider block mb-2" style={{ color: "var(--text-muted)" }}>Instance Sayısı</label>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setScaleInstances(Math.max(0, scaleInstances - 1))}
                      className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                      style={{ border: "1px solid var(--status-up-border)", color: "var(--status-up)" }}>
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-2xl font-bold w-10 text-center" style={{ color: "var(--text-secondary)" }}>{scaleInstances}</span>
                    <button onClick={() => setScaleInstances(Math.min(32, scaleInstances + 1))}
                      className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
                      style={{ border: "1px solid var(--status-up-border)", color: "var(--status-up)" }}>
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <div className="flex gap-1 ml-2">
                      {[1, 2, 4, 8].map((n) => (
                        <button key={n} onClick={() => setScaleInstances(n)}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-medium border transition-all"
                          style={scaleInstances === n
                            ? { background: "var(--status-up-subtle)", color: "var(--status-up-text)", borderColor: "var(--status-up-border)" }
                            : { color: "var(--text-muted)", borderColor: "var(--border-default)" }}>{n}x</button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Strategy */}
                <div>
                  <label className="text-[10px] uppercase tracking-wider block mb-2" style={{ color: "var(--text-muted)" }}>Load Balancing Stratejisi</label>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { value: 'round_robin', label: 'Round Robin', desc: 'Sırayla dağıt' },
                      { value: 'least_conn', label: 'Least Conn', desc: 'En az bağlantı' },
                      { value: 'ip_hash', label: 'IP Hash', desc: 'IP bazlı sticky' },
                    ] as const).map((s) => (
                      <button key={s.value} onClick={() => setScaleStrategy(s.value)}
                        className="p-3 rounded-xl border text-left transition-all"
                        style={scaleStrategy === s.value
                          ? { borderColor: "var(--status-up-border)", background: "var(--status-up-subtle)" }
                          : { borderColor: "var(--border-default)" }}>
                        <p className="text-xs font-semibold mb-0.5" style={{ color: scaleStrategy === s.value ? "var(--status-up-text)" : "var(--text-secondary)" }}>{s.label}</p>
                        <p className="text-[10px]" style={{ color: "var(--text-faint)" }}>{s.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Info box */}
                <div className="p-3 rounded-xl text-[10px] leading-relaxed" style={{ background: "var(--status-up-subtle)", border: "1px solid var(--status-up-border)", color: "var(--text-muted)" }}>
                  Komut agent'a iletilir. Agent'ta <code className="font-mono px-1 rounded" style={{ background: "var(--status-up-subtle)" }}>NANONET_SCALE_CMD</code> tanımlıysa
                  çalıştırılır; tanımlı değilse acknowledge edilir.
                  <br />Örn: <code className="font-mono px-1 rounded" style={{ background: "var(--status-up-subtle)" }}>docker service scale myapp=$INSTANCES</code>
                </div>

                <Button onClick={handleScale} disabled={scaleLoading}
                  className="w-full text-white rounded-xl h-9 text-sm font-medium" style={{ background: "var(--status-up)" }}>
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
            <Card className="p-6 rounded-xl" style={{ background: "var(--surface-card)", border: "1px solid var(--color-lavender-border)" }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" style={{ color: "var(--color-lavender)" }} />
                  <h3 className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>AI Analiz</h3>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: "var(--color-lavender-border)" }}>
                    <button
                      onClick={() => setDeepAnalysis(false)}
                      className="px-3 py-1.5 text-[10px] font-medium transition-all"
                      style={!deepAnalysis
                        ? { background: "var(--color-lavender-subtle)", color: "var(--color-lavender)" }
                        : { color: "var(--text-muted)" }}
                    >
                      Hızlı
                    </button>
                    <button
                      onClick={() => setDeepAnalysis(true)}
                      className="px-3 py-1.5 text-[10px] font-medium transition-all"
                      style={deepAnalysis
                        ? { background: "var(--color-lavender-subtle)", color: "var(--color-lavender)" }
                        : { color: "var(--text-muted)" }}
                    >
                      Derin
                    </button>
                  </div>
                  <Button
                    onClick={handleAnalyze}
                    disabled={analyzeLoading}
                    className="text-white rounded-xl text-xs h-8" style={{ background: "var(--gradient-btn-primary)" }}
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
              </div>

              {analysisResult ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl" style={{ background: "var(--surface-sunken)", border: "1px solid var(--color-lavender-border)" }}>
                    <h4 className="text-xs uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Özet</h4>
                    <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{analysisResult.summary}</p>
                  </div>
                  {analysisResult.root_cause && (
                    <div className="p-4 rounded-xl" style={{ background: "var(--status-down-subtle)", border: "1px solid var(--status-down-border)" }}>
                      <h4 className="text-xs uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Kök Neden</h4>
                      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{analysisResult.root_cause}</p>
                    </div>
                  )}
                  {analysisResult.recommendations && analysisResult.recommendations.length > 0 && (
                    <div className="p-4 rounded-xl" style={{ background: "var(--color-teal-subtle)", border: "1px solid var(--color-teal-border)" }}>
                      <h4 className="text-xs uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>Öneriler</h4>
                      <ul className="space-y-2">
                        {analysisResult.recommendations.map((rec, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <Badge className="text-[9px] px-1.5 py-0 rounded-full shrink-0 mt-0.5" style={{ background: rec.priority === "high" ? "var(--status-down-subtle)" : rec.priority === "medium" ? "var(--status-warn-subtle)" : "var(--color-teal-subtle)", color: rec.priority === "high" ? "var(--status-down-text)" : rec.priority === "medium" ? "var(--status-warn-text)" : "var(--color-teal)" }}>
                              {rec.priority}
                            </Badge>
                            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{rec.action}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {analysisResult.confidence !== undefined && (
                    <div className="flex items-center gap-2 text-[10px]" style={{ color: "var(--text-faint)" }}>
                      <Eye className="w-3 h-3" /> Güven: {(analysisResult.confidence * 100).toFixed(0)}%
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Sparkles className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--color-lavender-subtle)" }} />
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
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

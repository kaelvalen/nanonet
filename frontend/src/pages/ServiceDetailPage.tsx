import { useState } from "react";
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
  status: string;
  queued_at: string;
};

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

  const handleRestart = () => {
    if (serviceId) restartService(serviceId);
  };

  const handleStop = () => {
    if (serviceId) stopService(serviceId);
  };

  const handleExec = async () => {
    if (!serviceId || !execCommand.trim()) return;
    const cmd = execCommand.trim();
    setExecLoading(true);
    setExecCommand("");
    try {
      const result = await servicesApi.exec(serviceId, cmd);
      setExecHistory((prev) => [
        { command: cmd, ...result },
        ...prev,
      ]);
      toast.success("Komut gönderildi");
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
            <Card key={i} className="p-4 bg-white/80 border-[#39c5bb]/10 rounded-xl animate-pulse">
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
        <h2 className="text-lg font-semibold text-[#3b4563]">Servis bulunamadı</h2>
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
              <h1 className="text-xl font-bold text-[#3b4563] truncate">{service.name}</h1>
              <Badge className={`text-[10px] font-[var(--font-mono)] px-2 py-0.5 rounded-full border ${statusBg}`}>
                {service.status?.toUpperCase() ?? 'UNKNOWN'}
              </Badge>
            </div>
            <p className="text-xs text-[#b0bdd5] font-[var(--font-mono)] mt-0.5">
              {service.host}:{service.port} · {service.health_endpoint} · {service.poll_interval_sec}s poll
            </p>
          </div>
          <div className="flex items-center gap-2">
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
              <DialogContent className="bg-white border-[#fda4af]/20 rounded-2xl">
                <DialogHeader>
                  <DialogTitle className="text-[#e11d48]">Servisi Sil</DialogTitle>
                  <DialogDescription className="text-[#7c8db5]">
                    <strong>{service.name}</strong> servisini silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
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
          <Card className="p-3 bg-white/80 border-[#39c5bb]/10 rounded-xl">
            <div className="flex items-center gap-2 mb-1">
              <Cpu className="w-3.5 h-3.5 text-[#39c5bb]" />
              <span className="text-[10px] text-[#7c8db5] uppercase tracking-wider">CPU</span>
            </div>
            <p className="text-lg font-bold text-[#3b4563]">
              {latestMetric ? `${latestMetric.cpu_percent?.toFixed(1)}%` : "—"}
            </p>
          </Card>
          <Card className="p-3 bg-white/80 border-[#93c5fd]/10 rounded-xl">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-3.5 h-3.5 text-[#93c5fd]" />
              <span className="text-[10px] text-[#7c8db5] uppercase tracking-wider">Memory</span>
            </div>
            <p className="text-lg font-bold text-[#3b4563]">
              {latestMetric ? `${latestMetric.memory_used_mb?.toFixed(0)} MB` : "—"}
            </p>
          </Card>
          <Card className="p-3 bg-white/80 border-[#c4b5fd]/10 rounded-xl">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-3.5 h-3.5 text-[#c4b5fd]" />
              <span className="text-[10px] text-[#7c8db5] uppercase tracking-wider">Latency</span>
            </div>
            <p className="text-lg font-bold text-[#3b4563]">
              {latestMetric ? `${latestMetric.latency_ms?.toFixed(0)} ms` : "—"}
            </p>
          </Card>
          <Card className="p-3 bg-white/80 border-[#fda4af]/10 rounded-xl">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-3.5 h-3.5 text-[#34d399]" />
              <span className="text-[10px] text-[#7c8db5] uppercase tracking-wider">Uptime</span>
            </div>
            <p className="text-lg font-bold text-[#3b4563]">
              {uptime ? `${uptime.uptime_percent.toFixed(1)}%` : "—"}
            </p>
          </Card>
        </div>
      </motion.div>

      {/* Tabs: Charts, Alerts, AI */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
        <Tabs defaultValue="metrics" className="space-y-4">
          <div className="flex items-center justify-between">
            <TabsList className="bg-white/80 border border-[#39c5bb]/10 rounded-xl p-1">
              <TabsTrigger value="metrics" className="rounded-lg text-xs data-[state=active]:bg-[#39c5bb]/10 data-[state=active]:text-[#2da89e]">
                <TrendingUp className="w-3 h-3 mr-1" /> Metrics
              </TabsTrigger>
              <TabsTrigger value="alerts" className="rounded-lg text-xs data-[state=active]:bg-[#fda4af]/10 data-[state=active]:text-[#e11d48]">
                <AlertCircle className="w-3 h-3 mr-1" /> Alerts ({alerts.length})
              </TabsTrigger>
              <TabsTrigger value="ai" className="rounded-lg text-xs data-[state=active]:bg-[#c4b5fd]/10 data-[state=active]:text-[#7c3aed]">
                <Sparkles className="w-3 h-3 mr-1" /> AI Analysis
              </TabsTrigger>
              <TabsTrigger value="terminal" className="rounded-lg text-xs data-[state=active]:bg-[#1e293b]/10 data-[state=active]:text-[#334155]">
                <Terminal className="w-3 h-3 mr-1" /> Terminal
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
                      : "text-[#7c8db5] hover:bg-[#f5f8ff] border border-transparent"
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
              <Card className="p-8 bg-white/80 border-[#39c5bb]/10 rounded-xl animate-pulse">
                <div className="h-64 bg-[#39c5bb]/5 rounded-lg" />
              </Card>
            ) : chartData.length === 0 ? (
              <Card className="p-12 bg-white/80 border-[#39c5bb]/10 rounded-xl text-center">
                <Activity className="w-10 h-10 text-[#b0bdd5] mx-auto mb-3" />
                <p className="text-sm text-[#7c8db5]">Bu zaman aralığında metrik verisi yok</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* CPU Chart */}
                <Card className="p-4 bg-white/80 border-[#39c5bb]/10 rounded-xl">
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
                <Card className="p-4 bg-white/80 border-[#93c5fd]/10 rounded-xl">
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
                <Card className="p-4 bg-white/80 border-[#c4b5fd]/10 rounded-xl">
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
                <Card className="p-4 bg-white/80 border-[#fda4af]/10 rounded-xl">
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
              <Card className="p-12 bg-white/80 border-[#39c5bb]/10 rounded-xl text-center">
                <Shield className="w-10 h-10 text-[#34d399] mx-auto mb-3" />
                <p className="text-sm text-[#7c8db5]">Aktif alert yok — tüm sistemler çalışıyor</p>
              </Card>
            ) : (
              alerts.map((alert, index) => (
                <motion.div key={alert.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.05 }}>
                  <Card className={`p-4 bg-white/80 border rounded-xl ${
                    alert.severity === "crit" ? "border-[#fda4af]/30" :
                    alert.severity === "warn" ? "border-[#fbbf24]/25" :
                    "border-[#93c5fd]/20"
                  }`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                          alert.severity === "crit" ? "bg-[#fb7185]" :
                          alert.severity === "warn" ? "bg-[#fbbf24]" :
                          "bg-[#93c5fd]"
                        }`} />
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className={`text-[9px] px-1.5 py-0 rounded-full border uppercase font-[var(--font-mono)] ${
                              alert.severity === "crit" ? "bg-[#fda4af]/15 text-[#e11d48] border-[#fda4af]/30" :
                              alert.severity === "warn" ? "bg-[#fef3c7]/30 text-[#d97706] border-[#fbbf24]/20" :
                              "bg-[#93c5fd]/15 text-[#3b82f6] border-[#93c5fd]/20"
                            }`}>
                              {alert.severity}
                            </Badge>
                            <span className="text-[10px] text-[#b0bdd5]">{alert.type}</span>
                          </div>
                          <p className="text-xs text-[#3b4563]">{alert.message}</p>
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
            <Card className="bg-[#0f172a] border-[#1e293b] rounded-xl overflow-hidden">
              {/* Output area */}
              <div className="p-4 min-h-[280px] max-h-[400px] overflow-y-auto space-y-2 font-mono text-xs">
                {execHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[240px] gap-2">
                    <Terminal className="w-8 h-8 text-[#334155]" />
                    <p className="text-[#475569] text-[11px]">Çalıştırmak istediğiniz komutu girin</p>
                  </div>
                ) : (
                  execHistory.map((entry, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center gap-1.5 text-[#38bdf8]">
                        <ChevronRight className="w-3 h-3 flex-shrink-0" />
                        <span>{entry.command}</span>
                      </div>
                      <div className="pl-4 text-[#64748b] space-y-0.5">
                        <p>
                          <span className="text-[#22d3ee]">status:</span>{" "}
                          <span className={entry.status === "queued" ? "text-[#a3e635]" : "text-[#fbbf24]"}>
                            {entry.status}
                          </span>
                        </p>
                        <p>
                          <span className="text-[#22d3ee]">id:</span>{" "}
                          <span className="text-[#94a3b8]">{entry.command_id}</span>
                        </p>
                        <p>
                          <span className="text-[#22d3ee]">queued_at:</span>{" "}
                          <span className="text-[#94a3b8]">
                            {new Date(entry.queued_at).toLocaleTimeString("tr-TR")}
                          </span>
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {/* Input area */}
              <div className="flex items-center gap-2 px-4 py-3 border-t border-[#1e293b] bg-[#0f172a]">
                <span className="text-[#38bdf8] font-mono text-xs flex-shrink-0">$</span>
                <Input
                  value={execCommand}
                  onChange={(e) => setExecCommand(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !execLoading) handleExec(); }}
                  placeholder="komut girin..."
                  disabled={execLoading}
                  className="bg-transparent border-none text-[#e2e8f0] font-mono text-xs h-7 px-0 focus-visible:ring-0 placeholder:text-[#334155]"
                />
                <Button
                  size="sm"
                  onClick={handleExec}
                  disabled={execLoading || !execCommand.trim()}
                  className="h-7 px-3 bg-[#38bdf8]/10 hover:bg-[#38bdf8]/20 text-[#38bdf8] border border-[#38bdf8]/20 rounded-lg flex-shrink-0"
                  variant="outline"
                >
                  {execLoading ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <Send className="w-3 h-3" />
                  )}
                </Button>
              </div>
            </Card>
            <p className="text-[10px] text-[#b0bdd5] px-1">
              Komutlar agent üzerinden asenkron olarak çalıştırılır. Sonuçlar agent loglarında görünür.
            </p>
          </TabsContent>

          {/* AI Tab */}
          <TabsContent value="ai" className="space-y-4">
            <Card className="p-6 bg-white/80 border-[#c4b5fd]/10 rounded-xl">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#c4b5fd]" />
                  <h3 className="text-sm font-semibold text-[#3b4563]">AI Analiz</h3>
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
                  <div className="p-4 bg-[#f5f8ff] rounded-xl border border-[#c4b5fd]/10">
                    <h4 className="text-xs text-[#7c8db5] uppercase tracking-wider mb-2">Özet</h4>
                    <p className="text-sm text-[#3b4563]">{analysisResult.summary}</p>
                  </div>
                  {analysisResult.root_cause && (
                    <div className="p-4 bg-[#fda4af]/5 rounded-xl border border-[#fda4af]/10">
                      <h4 className="text-xs text-[#7c8db5] uppercase tracking-wider mb-2">Kök Neden</h4>
                      <p className="text-sm text-[#3b4563]">{analysisResult.root_cause}</p>
                    </div>
                  )}
                  {analysisResult.recommendations && analysisResult.recommendations.length > 0 && (
                    <div className="p-4 bg-[#39c5bb]/5 rounded-xl border border-[#39c5bb]/10">
                      <h4 className="text-xs text-[#7c8db5] uppercase tracking-wider mb-2">Öneriler</h4>
                      <ul className="space-y-2">
                        {analysisResult.recommendations.map((rec, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <Badge className={`text-[9px] px-1.5 py-0 rounded-full flex-shrink-0 mt-0.5 ${
                              rec.priority === "high" ? "bg-[#fda4af]/15 text-[#e11d48]" :
                              rec.priority === "medium" ? "bg-[#fbbf24]/15 text-[#d97706]" :
                              "bg-[#39c5bb]/15 text-[#2da89e]"
                            }`}>
                              {rec.priority}
                            </Badge>
                            <span className="text-xs text-[#3b4563]">{rec.action}</span>
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

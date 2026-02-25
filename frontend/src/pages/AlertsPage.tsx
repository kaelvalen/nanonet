import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "motion/react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Shield,
  Clock,
  CheckCircle2,
  Filter,
  Bell,
  BellOff,
  AlertTriangle,
  XOctagon,
  Info,
  ArrowRight,
} from "lucide-react";
import { metricsApi, type Alert } from "@/api/metrics";
import { toast } from "sonner";

export function AlertsPage() {
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [showResolved, setShowResolved] = useState(false);

  const { data: alerts = [], isLoading, refetch } = useQuery({
    queryKey: ["activeAlerts"],
    queryFn: () => metricsApi.getActiveAlerts(),
    refetchInterval: 15000,
  });

  const filtered = useMemo(() => {
    return alerts.filter((a) => {
      if (severityFilter !== "all" && a.severity !== severityFilter) return false;
      if (!showResolved && a.resolved_at) return false;
      return true;
    });
  }, [alerts, severityFilter, showResolved]);

  const severityCounts = useMemo(() => {
    const counts = { all: alerts.length, crit: 0, warn: 0, info: 0 };
    alerts.forEach((a) => {
      if (a.severity in counts) counts[a.severity as keyof typeof counts]++;
    });
    return counts;
  }, [alerts]);

  const handleResolve = async (alertId: string) => {
    try {
      await metricsApi.resolveAlert(alertId);
      toast.success("Alert çözüldü");
      refetch();
    } catch {
      toast.error("Alert çözülemedi");
    }
  };

  const severityConfig = (severity: string) => {
    switch (severity) {
      case "crit":
        return {
          dot: "bg-[#fb7185]",
          badge: "bg-[#fda4af]/15 text-[#e11d48] border-[#fda4af]/30",
          border: "border-[#fda4af]/25",
          glow: "from-[#fda4af] to-[#ffd1dc]",
          label: "Critical",
          color: "text-[#e11d48]",
        };
      case "warn":
        return {
          dot: "bg-[#fbbf24]",
          badge: "bg-[#fef3c7]/30 text-[#d97706] border-[#fbbf24]/20",
          border: "border-[#fbbf24]/20",
          glow: "from-[#fbbf24] to-[#fef3c7]",
          label: "Warning",
          color: "text-[#d97706]",
        };
      default:
        return {
          dot: "bg-[#93c5fd]",
          badge: "bg-[#93c5fd]/15 text-[#3b82f6] border-[#93c5fd]/20",
          border: "border-[#93c5fd]/15",
          glow: "from-[#93c5fd] to-[#b8dafb]",
          label: "Info",
          color: "text-[#3b82f6]",
        };
    }
  };

  const activeCount = alerts.filter((a) => !a.resolved_at).length;

  const SeverityIcon = ({ severity, className }: { severity: string; className?: string }) => {
    if (severity === "crit") return <XOctagon className={className} />;
    if (severity === "warn") return <AlertTriangle className={className} />;
    return <Info className={className} />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold bg-linear-to-r from-[#fda4af] via-[#c4b5fd] to-[#93c5fd] bg-clip-text text-transparent">
              Alerts
            </h1>
            <p className="text-xs text-[#7c8db5] mt-1">Real-time incident notifications and alerts</p>
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs border transition-all ${
            activeCount > 0
              ? "bg-[#fda4af]/10 border-[#fda4af]/20 text-[#e11d48]"
              : "bg-[#34d399]/10 border-[#34d399]/20 text-[#059669]"
          }`}>
            {activeCount > 0 ? (
              <><Bell className="w-3 h-3 animate-pulse" />{activeCount} Active</>
            ) : (
              <><BellOff className="w-3 h-3" />All Clear</>
            )}
          </div>
        </div>
      </motion.div>

      {/* Severity Summary Cards */}
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="grid grid-cols-3 gap-3"
      >
        {([
          { key: "crit", label: "Critical", icon: XOctagon, color: "text-[#e11d48]", bg: "bg-[#fda4af]/10", border: "border-[#fda4af]/20", bar: "bg-[#fb7185]" },
          { key: "warn", label: "Warning", icon: AlertTriangle, color: "text-[#d97706]", bg: "bg-[#fbbf24]/10", border: "border-[#fbbf24]/20", bar: "bg-[#fbbf24]" },
          { key: "info", label: "Info", icon: Info, color: "text-[#3b82f6]", bg: "bg-[#93c5fd]/10", border: "border-[#93c5fd]/20", bar: "bg-[#93c5fd]" },
        ] as const).map((s, i) => (
          <motion.div
            key={s.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 + i * 0.06 }}
          >
            <button
              onClick={() => setSeverityFilter(severityFilter === s.key ? "all" : s.key)}
              className={`w-full text-left p-3 rounded-xl border transition-all duration-200 ${s.bg} ${s.border} ${severityFilter === s.key ? "ring-2 ring-offset-1 ring-current/20 shadow-sm" : "hover:shadow-sm"}`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <s.icon className={`w-4 h-4 ${s.color}`} />
                <span className={`text-xl font-bold ${s.color}`}>{severityCounts[s.key]}</span>
              </div>
              <p className={`text-[10px] font-medium ${s.color}`}>{s.label}</p>
              <div className="mt-2 h-1 rounded-full bg-white/60 overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${s.bar}`}
                  initial={{ width: 0 }}
                  animate={{ width: severityCounts.all > 0 ? `${(severityCounts[s.key] / severityCounts.all) * 100}%` : "0%" }}
                  transition={{ duration: 0.6, delay: 0.2 + i * 0.06 }}
                />
              </div>
            </button>
          </motion.div>
        ))}
      </motion.div>

      {/* Filters */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }}>
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="w-3 h-3 text-[#b0bdd5]" />
          {(["all", "crit", "warn", "info"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSeverityFilter(s)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all border ${
                severityFilter === s
                  ? s === "all" ? "bg-[#39c5bb]/15 text-[#2da89e] border-[#39c5bb]/25"
                    : s === "crit" ? "bg-[#fda4af]/15 text-[#e11d48] border-[#fda4af]/25"
                    : s === "warn" ? "bg-[#fbbf24]/15 text-[#d97706] border-[#fbbf24]/25"
                    : "bg-[#93c5fd]/15 text-[#3b82f6] border-[#93c5fd]/25"
                  : "text-[#7c8db5] dark:text-[#527a8a] hover:bg-[#f5f8ff] dark:hover:bg-[#0f1e28] border-transparent"
              }`}
            >
              {s === "all" ? `All (${severityCounts.all})` :
               s === "crit" ? `Critical (${severityCounts.crit})` :
               s === "warn" ? `Warning (${severityCounts.warn})` :
               `Info (${severityCounts.info})`}
            </button>
          ))}
          <button
            onClick={() => setShowResolved(!showResolved)}
            className={`ml-auto px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all border ${
              showResolved
                ? "bg-[#34d399]/10 text-[#059669] border-[#34d399]/20"
                : "text-[#7c8db5] dark:text-[#527a8a] hover:bg-[#f5f8ff] dark:hover:bg-[#0f1e28] border-transparent"
            }`}
          >
            {showResolved ? "✓ Showing Resolved" : "Show Resolved"}
          </button>
        </div>
      </motion.div>

      {/* Timeline / Alerts List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-4 bg-white/80 dark:bg-[#0d1c24]/85 border-[#39c5bb]/10 dark:border-[#00e6ff]/8 rounded-xl animate-pulse">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#39c5bb]/10 shrink-0" />
                <div className="flex-1">
                  <div className="h-3.5 w-48 bg-[#39c5bb]/10 rounded mb-2" />
                  <div className="h-2.5 w-32 bg-[#39c5bb]/8 rounded" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}>
          <Card className="p-14 bg-white/80 dark:bg-[#0d1c24]/85 border-[#34d399]/15 dark:border-[#34d399]/10 rounded-xl text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#34d399]/10 flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-[#34d399]/50" />
            </div>
            <h3 className="text-sm font-semibold text-[#3b4563] dark:text-[#d0f4ff] mb-1">All Systems Operational</h3>
            <p className="text-xs text-[#7c8db5] dark:text-[#527a8a]">
              {severityFilter !== "all" ? "No alerts match this filter" : "No active alerts at this time"}
            </p>
          </Card>
        </motion.div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4.75 top-4 bottom-4 w-px bg-linear-to-b from-[#39c5bb]/20 via-[#c4b5fd]/20 to-transparent" />
          <div className="space-y-3 pl-1">
            <AnimatePresence mode="popLayout">
              {filtered.map((alert, index) => {
                const config = severityConfig(alert.severity);
                return (
                  <motion.div
                    key={alert.id}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 16, height: 0 }}
                    transition={{ duration: 0.25, delay: index * 0.04 }}
                    layout
                  >
                    <div className="flex items-start gap-3">
                      {/* Timeline icon */}
                      <div className={`relative z-10 w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 mt-0.5 ${
                        alert.severity === "crit" ? "bg-[#fda4af]/15 border-[#fda4af]/30"
                        : alert.severity === "warn" ? "bg-[#fef3c7]/40 border-[#fbbf24]/25"
                        : "bg-[#93c5fd]/10 border-[#93c5fd]/20"
                      }`}>
                        <SeverityIcon severity={alert.severity} className={`w-4 h-4 ${config.color ?? "text-[#b0bdd5]"} ${alert.severity === "crit" && !alert.resolved_at ? "animate-pulse" : ""}`} />
                      </div>

                      {/* Card */}
                      <Card className={`flex-1 bg-white/80 dark:bg-[#0d1c24]/85 backdrop-blur-sm border ${config.border} rounded-xl p-4 transition-all duration-200 hover:shadow-sm ${alert.resolved_at ? "opacity-60" : ""}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                              <Badge className={`text-[9px] px-1.5 py-0 rounded-full border uppercase font-(--font-mono) ${config.badge}`}>
                                {config.label}
                              </Badge>
                              <span className="text-[10px] text-[#b0bdd5] dark:text-[#3a6070] font-(--font-mono) bg-[#f5f8ff] dark:bg-[#0f1e28] px-1.5 py-0.5 rounded">
                                {alert.type}
                              </span>
                              {alert.resolved_at && (
                                <Badge className="text-[9px] px-1.5 py-0 rounded-full bg-[#34d399]/10 text-[#059669] border border-[#34d399]/20">
                                  <CheckCircle2 className="w-2.5 h-2.5 mr-0.5 inline" /> Resolved
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-[#3b4563] dark:text-[#d0f4ff] leading-relaxed">{alert.message}</p>
                            <div className="flex items-center gap-3 mt-2 text-[10px] text-[#b0bdd5]">
                              <span className="flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" />
                                {new Date(alert.triggered_at).toLocaleString("tr-TR")}
                              </span>
                              {alert.resolved_at && (
                                <span className="flex items-center gap-1 text-[#059669]">
                                  <ArrowRight className="w-2.5 h-2.5" />
                                  {new Date(alert.resolved_at).toLocaleTimeString("tr-TR")}
                                </span>
                              )}
                            </div>
                          </div>
                          {!alert.resolved_at && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleResolve(alert.id)}
                              className="text-[10px] border-[#34d399]/25 text-[#059669] rounded-lg h-7 px-2.5 hover:bg-[#34d399]/10 shrink-0"
                            >
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Resolve
                            </Button>
                          )}
                        </div>
                      </Card>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}

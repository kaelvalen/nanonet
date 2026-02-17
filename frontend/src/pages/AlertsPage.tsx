import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "motion/react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  Shield,
  Clock,
  CheckCircle2,
  Filter,
  Bell,
  BellOff,
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
        };
      case "warn":
        return {
          dot: "bg-[#fbbf24]",
          badge: "bg-[#fef3c7]/30 text-[#d97706] border-[#fbbf24]/20",
          border: "border-[#fbbf24]/20",
          glow: "from-[#fbbf24] to-[#fef3c7]",
          label: "Warning",
        };
      default:
        return {
          dot: "bg-[#93c5fd]",
          badge: "bg-[#93c5fd]/15 text-[#3b82f6] border-[#93c5fd]/20",
          border: "border-[#93c5fd]/15",
          glow: "from-[#93c5fd] to-[#b8dafb]",
          label: "Info",
        };
    }
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
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs border transition-all ${
              alerts.filter((a) => !a.resolved_at).length > 0
                ? "bg-[#fda4af]/10 border-[#fda4af]/20 text-[#e11d48]"
                : "bg-[#34d399]/10 border-[#34d399]/20 text-[#059669]"
            }`}>
              {alerts.filter((a) => !a.resolved_at).length > 0 ? (
                <>
                  <Bell className="w-3 h-3 animate-wiggle" />
                  {alerts.filter((a) => !a.resolved_at).length} Active
                </>
              ) : (
                <>
                  <BellOff className="w-3 h-3" />
                  All Clear
                </>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
        <Card className="bg-white/80 backdrop-blur-sm border-[#39c5bb]/10 rounded-xl p-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Filter className="w-3 h-3 text-[#b0bdd5]" />
              {(["all", "crit", "warn", "info"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSeverityFilter(s)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all ${
                    severityFilter === s
                      ? s === "all" ? "bg-[#39c5bb]/15 text-[#2da89e] border border-[#39c5bb]/20" :
                        s === "crit" ? "bg-[#fda4af]/15 text-[#e11d48] border border-[#fda4af]/20" :
                        s === "warn" ? "bg-[#fbbf24]/15 text-[#d97706] border border-[#fbbf24]/20" :
                        "bg-[#93c5fd]/15 text-[#3b82f6] border border-[#93c5fd]/20"
                      : "text-[#7c8db5] hover:bg-[#f5f8ff] border border-transparent"
                  }`}
                >
                  {s === "all" ? `All (${severityCounts.all})` :
                   s === "crit" ? `Critical (${severityCounts.crit})` :
                   s === "warn" ? `Warning (${severityCounts.warn})` :
                   `Info (${severityCounts.info})`}
                </button>
              ))}
            </div>
            <div className="sm:ml-auto">
              <button
                onClick={() => setShowResolved(!showResolved)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all border ${
                  showResolved
                    ? "bg-[#34d399]/10 text-[#059669] border-[#34d399]/20"
                    : "text-[#7c8db5] hover:bg-[#f5f8ff] border-transparent"
                }`}
              >
                {showResolved ? "Showing Resolved" : "Show Resolved"}
              </button>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Alerts List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-4 bg-white/80 border-[#39c5bb]/10 rounded-xl animate-pulse">
              <div className="h-4 w-48 bg-[#39c5bb]/10 rounded mb-2" />
              <div className="h-3 w-32 bg-[#39c5bb]/10 rounded" />
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-16 bg-white/80 border-[#39c5bb]/10 rounded-xl text-center">
          <Shield className="w-14 h-14 text-[#34d399]/30 mx-auto mb-4" />
          <h3 className="text-sm font-semibold text-[#3b4563] mb-1">Tüm Sistemler Operasyonel</h3>
          <p className="text-xs text-[#7c8db5]">Aktif alert bulunmuyor</p>
        </Card>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((alert, index) => {
              const config = severityConfig(alert.severity);
              return (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.3, delay: index * 0.04 }}
                  layout
                >
                  <div className="relative group">
                    <div className={`absolute -inset-0.5 bg-linear-to-r ${config.glow} rounded-xl blur opacity-5 group-hover:opacity-10 transition duration-300`} />
                    <Card className={`relative bg-white/80 backdrop-blur-sm border ${config.border} rounded-xl p-4 transition-all duration-200`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="relative flex-shrink-0 mt-0.5">
                            <div className={`w-2.5 h-2.5 rounded-full ${config.dot}`} />
                            {alert.severity === "crit" && !alert.resolved_at && (
                              <div className={`absolute inset-0 w-2.5 h-2.5 rounded-full ${config.dot} animate-pulse-ring`} />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <Badge className={`text-[9px] px-1.5 py-0 rounded-full border uppercase font-[var(--font-mono)] ${config.badge}`}>
                                {config.label}
                              </Badge>
                              <span className="text-[10px] text-[#b0bdd5] font-[var(--font-mono)]">{alert.type}</span>
                              {alert.resolved_at && (
                                <Badge className="text-[9px] px-1.5 py-0 rounded-full bg-[#34d399]/10 text-[#059669] border border-[#34d399]/20">
                                  <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" /> Resolved
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-[#3b4563] leading-relaxed">{alert.message}</p>
                            <div className="flex items-center gap-3 mt-2 text-[10px] text-[#b0bdd5]">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(alert.triggered_at).toLocaleString("tr-TR")}
                              </span>
                              <span className="font-[var(--font-mono)]">SVC: {alert.service_id.slice(0, 8)}...</span>
                            </div>
                          </div>
                        </div>
                        {!alert.resolved_at && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleResolve(alert.id)}
                            className="text-[10px] border-[#34d399]/20 text-[#059669] rounded-lg h-7 hover:bg-[#34d399]/10 flex-shrink-0"
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Çöz
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
      )}
    </div>
  );
}

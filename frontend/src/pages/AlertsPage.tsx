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
      case "crit": return {
        dotVar: "var(--status-down)", badgeBg: "var(--status-down-subtle)", badgeText: "var(--status-down-text)",
        badgeBorder: "var(--status-down-border)", borderVar: "var(--status-down-border)",
        colorVar: "var(--status-down-text)", label: "Critical",
      };
      case "warn": return {
        dotVar: "var(--status-warn)", badgeBg: "var(--status-warn-subtle)", badgeText: "var(--status-warn-text)",
        badgeBorder: "var(--status-warn-border)", borderVar: "var(--status-warn-border)",
        colorVar: "var(--status-warn-text)", label: "Warning",
      };
      default: return {
        dotVar: "var(--color-blue)", badgeBg: "var(--color-blue-subtle)", badgeText: "var(--color-blue-text)",
        badgeBorder: "var(--color-blue-border)", borderVar: "var(--color-blue-border)",
        colorVar: "var(--color-blue-text)", label: "Info",
      };
    }
  };

  const activeCount = alerts.filter((a) => !a.resolved_at).length;

  const SeverityIcon = ({ severity, className, style }: { severity: string; className?: string; style?: React.CSSProperties }) => {
    if (severity === "crit") return <XOctagon className={className} style={style} />;
    if (severity === "warn") return <AlertTriangle className={className} style={style} />;
    return <Info className={className} style={style} />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-heading)" }}>
              Alerts
            </h1>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Real-time incident notifications and alerts</p>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs border transition-all"
            style={activeCount > 0
              ? { background: "var(--status-down-subtle)", borderColor: "var(--status-down-border)", color: "var(--status-down-text)" }
              : { background: "var(--status-up-subtle)", borderColor: "var(--status-up-border)", color: "var(--status-up-text)" }}>
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
          { key: "crit" as const, label: "Critical", icon: XOctagon, colorVar: "var(--status-down-text)", bgVar: "var(--status-down-subtle)", borderVar: "var(--status-down-border)", barVar: "var(--status-down)" },
          { key: "warn" as const, label: "Warning", icon: AlertTriangle, colorVar: "var(--status-warn-text)", bgVar: "var(--status-warn-subtle)", borderVar: "var(--status-warn-border)", barVar: "var(--status-warn)" },
          { key: "info" as const, label: "Info", icon: Info, colorVar: "var(--color-blue-text)", bgVar: "var(--color-blue-subtle)", borderVar: "var(--color-blue-border)", barVar: "var(--color-blue)" },
        ]).map((s, i) => (
          <motion.div
            key={s.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 + i * 0.06 }}
          >
            <button
              onClick={() => setSeverityFilter(severityFilter === s.key ? "all" : s.key)}
              className={`w-full text-left p-3 rounded-xl border transition-all duration-200 ${severityFilter === s.key ? "shadow-sm" : "hover:shadow-sm"}`}
              style={{ background: s.bgVar, borderColor: s.borderVar }}
            >
              <div className="flex items-center justify-between mb-1.5">
                <s.icon className="w-4 h-4" style={{ color: s.colorVar }} />
                <span className="text-xl font-bold" style={{ color: s.colorVar }}>{severityCounts[s.key]}</span>
              </div>
              <p className="text-[10px] font-medium" style={{ color: s.colorVar }}>{s.label}</p>
              <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ backgroundColor: "var(--border-track)" }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: s.barVar }}
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
          <Filter className="w-3 h-3" style={{ color: "var(--text-faint)" }} />
          {(["all", "crit", "warn", "info"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSeverityFilter(s)}
              className="px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all border"
              style={severityFilter === s ? {
                background: s === "all" ? "var(--color-teal-subtle)" : s === "crit" ? "var(--status-down-subtle)" : s === "warn" ? "var(--status-warn-subtle)" : "var(--color-blue-subtle)",
                color: s === "all" ? "var(--color-teal)" : s === "crit" ? "var(--status-down-text)" : s === "warn" ? "var(--status-warn-text)" : "var(--color-blue-text)",
                borderColor: s === "all" ? "var(--color-teal-border)" : s === "crit" ? "var(--status-down-border)" : s === "warn" ? "var(--status-warn-border)" : "var(--color-blue-border)",
              } : { color: "var(--text-muted)", borderColor: "transparent" }}
            >
              {s === "all" ? `All (${severityCounts.all})` :
               s === "crit" ? `Critical (${severityCounts.crit})` :
               s === "warn" ? `Warning (${severityCounts.warn})` :
               `Info (${severityCounts.info})`}
            </button>
          ))}
          <button
            onClick={() => setShowResolved(!showResolved)}
            className="ml-auto px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all border"
            style={showResolved
              ? { background: "var(--status-up-subtle)", color: "var(--status-up-text)", borderColor: "var(--status-up-border)" }
              : { color: "var(--text-muted)", borderColor: "transparent" }}
          >
            {showResolved ? "✓ Showing Resolved" : "Show Resolved"}
          </button>
        </div>
      </motion.div>

      {/* Timeline / Alerts List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-4 rounded-xl animate-pulse" style={{ background: "var(--surface-glass)", border: "1px solid var(--color-teal-border)" }}>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg shrink-0" style={{ backgroundColor: "var(--color-teal-subtle)" }} />
                <div className="flex-1">
                  <div className="h-3.5 w-48 rounded mb-2" style={{ backgroundColor: "var(--color-teal-subtle)" }} />
                  <div className="h-2.5 w-32 rounded" style={{ backgroundColor: "var(--color-teal-subtle)" }} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }}>
          <Card className="p-14 rounded-xl text-center" style={{ background: "var(--surface-glass)", border: "1px solid var(--status-up-border)" }}>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: "var(--status-up-subtle)" }}>
              <Shield className="w-8 h-8 opacity-50" style={{ color: "var(--status-up)" }} />
            </div>
            <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>All Systems Operational</h3>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {severityFilter !== "all" ? "No alerts match this filter" : "No active alerts at this time"}
            </p>
          </Card>
        </motion.div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-4.75 top-4 bottom-4 w-px" style={{ background: "linear-gradient(to bottom, var(--color-teal-border), var(--color-lavender-border), transparent)" }} />
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
                      <div className="relative z-10 w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 mt-0.5"
                        style={{ background: config.badgeBg, borderColor: config.badgeBorder }}>
                        <SeverityIcon severity={alert.severity} className={`w-4 h-4 ${alert.severity === "crit" && !alert.resolved_at ? "animate-pulse" : ""}`} style={{ color: config.colorVar }} />
                      </div>

                      {/* Card */}
                      <Card className={`flex-1 backdrop-blur-sm rounded-xl p-4 transition-all duration-200 hover:shadow-sm ${alert.resolved_at ? "opacity-60" : ""}`}
                        style={{ background: "var(--surface-glass)", border: `1px solid ${config.borderVar}` }}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                              <Badge className="text-[9px] px-1.5 py-0 rounded-full border uppercase font-(--font-mono)"
                                style={{ background: config.badgeBg, color: config.badgeText, borderColor: config.badgeBorder }}>
                                {config.label}
                              </Badge>
                              <span className="text-[10px] font-(--font-mono) px-1.5 py-0.5 rounded"
                                style={{ color: "var(--text-faint)", background: "var(--surface-sunken)" }}>
                                {alert.type}
                              </span>
                              {alert.resolved_at && (
                                <Badge className="text-[9px] px-1.5 py-0 rounded-full border"
                                  style={{ background: "var(--status-up-subtle)", color: "var(--status-up-text)", borderColor: "var(--status-up-border)" }}>
                                  <CheckCircle2 className="w-2.5 h-2.5 mr-0.5 inline" /> Resolved
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{alert.message}</p>
                            <div className="flex items-center gap-3 mt-2 text-[10px]" style={{ color: "var(--text-faint)" }}>
                              <span className="flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" />
                                {new Date(alert.triggered_at).toLocaleString("tr-TR")}
                              </span>
                              {alert.resolved_at && (
                                <span className="flex items-center gap-1" style={{ color: "var(--status-up-text)" }}>
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
                              className="text-[10px] rounded-lg h-7 px-2.5 shrink-0"
                              style={{ borderColor: "var(--status-up-border)", color: "var(--status-up-text)" }}
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

import { useState, useMemo } from "react";
import { Link } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Server,
  Search,
  Clock,
  ArrowUpRight,
  Filter,
  LayoutGrid,
  List,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Globe,
  Shield,
  TrendingUp,
  BarChart3,
} from "lucide-react";
import { useServices } from "@/hooks/useServices";
import { AddServiceDialog } from "@/components/AddServiceDialog";
import { useQueries } from "@tanstack/react-query";
import { metricsApi } from "@/api/metrics";

function StatusIcon({ status }: { status: string }) {
  if (status === "up") return <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "var(--status-up)" }} />;
  if (status === "degraded") return <AlertTriangle className="w-3.5 h-3.5" style={{ color: "var(--status-warn)" }} />;
  if (status === "down") return <XCircle className="w-3.5 h-3.5" style={{ color: "var(--status-down)" }} />;
  return <HelpCircle className="w-3.5 h-3.5" style={{ color: "var(--text-faint)" }} />;
}

export function ServicesPage() {
  const { services, isLoading } = useServices();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [slaRange, setSlaRange] = useState<"24h" | "7d" | "30d">("24h");

  const uptimeQueries = useQueries({
    queries: services.map((s) => ({
      queryKey: ["serviceUptime", s.id, slaRange],
      queryFn: () => metricsApi.getUptime(s.id, slaRange),
      staleTime: 60_000,
      enabled: services.length > 0,
    })),
  });

  const uptimeMap = useMemo(() => {
    const map: Record<string, number> = {};
    uptimeQueries.forEach((q, i) => {
      if (q.data && services[i]) {
        map[services[i].id] = q.data.uptime_percent;
      }
    });
    return map;
  }, [uptimeQueries, services]);

  const avgUptime = useMemo(() => {
    const vals = Object.values(uptimeMap);
    if (vals.length === 0) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }, [uptimeMap]);

  const slaOk = useMemo(() => Object.values(uptimeMap).filter((v) => v >= 99.9).length, [uptimeMap]);
  const slaWarn = useMemo(() => Object.values(uptimeMap).filter((v) => v >= 95 && v < 99.9).length, [uptimeMap]);
  const slaCrit = useMemo(() => Object.values(uptimeMap).filter((v) => v < 95).length, [uptimeMap]);

  const filtered = useMemo(() => {
    return services.filter((s) => {
      const matchesSearch =
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.host.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || s.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [services, search, statusFilter]);

  const statusCounts = useMemo(() => {
    const counts = { all: services.length, up: 0, degraded: 0, down: 0, unknown: 0 };
    services.forEach((s) => {
      if (s.status in counts) counts[s.status as keyof typeof counts]++;
    });
    return counts;
  }, [services]);

  const statusVars = (status: string) => {
    switch (status) {
      case "up": return { dot: "var(--status-up)", badgeBg: "var(--status-up-subtle)", badgeText: "var(--status-up-text)", badgeBorder: "var(--status-up-border)", border: "var(--color-teal-border)" };
      case "degraded": return { dot: "var(--status-warn)", badgeBg: "var(--status-warn-subtle)", badgeText: "var(--status-warn-text)", badgeBorder: "var(--status-warn-border)", border: "var(--status-warn-border)" };
      case "down": return { dot: "var(--status-down)", badgeBg: "var(--status-down-subtle)", badgeText: "var(--status-down-text)", badgeBorder: "var(--status-down-border)", border: "var(--status-down-border)" };
      default: return { dot: "var(--text-faint)", badgeBg: "var(--surface-sunken)", badgeText: "var(--text-muted)", badgeBorder: "var(--border-subtle)", border: "var(--border-subtle)" };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-heading)" }}>
              Servisler
            </h1>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Tüm mikroservisleri izle ve yönet</p>
          </div>
          <AddServiceDialog />
        </div>
      </motion.div>

      {/* Search & Filter Bar */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
        <Card className="rounded p-3" style={{ background: "var(--surface-card)", border: "2px solid var(--border-default)", boxShadow: "var(--card-shadow)" }}>
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "var(--text-faint)" }} />
              <Input
                placeholder="Servis ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 rounded-lg text-xs h-9"
                style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-secondary)" }}
                aria-label="Servis ara"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5">
              <Filter className="w-3 h-3" style={{ color: "var(--text-faint)" }} />
              {(["all", "up", "degraded", "down"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className="px-2.5 py-1 rounded text-[10px] font-medium transition-all border-2"
                  style={statusFilter === s ? {
                    background: s === "up" ? "var(--status-up-subtle)" : s === "degraded" ? "var(--status-warn-subtle)" : s === "down" ? "var(--status-down-subtle)" : "var(--color-teal-subtle)",
                    color: s === "up" ? "var(--status-up-text)" : s === "degraded" ? "var(--status-warn-text)" : s === "down" ? "var(--status-down-text)" : "var(--color-teal)",
                    borderColor: s === "up" ? "var(--status-up-border)" : s === "degraded" ? "var(--status-warn-border)" : s === "down" ? "var(--status-down-border)" : "var(--color-teal-border)",
                  } : { color: "var(--text-muted)", borderColor: "transparent" }}
                  aria-label={`Filtre: ${s === "all" ? "Tümü" : s === "up" ? "Aktif" : s === "degraded" ? "Bozuk" : "Çevrimdışı"}`}
                >
                  {s === "all" ? `Tümü (${statusCounts.all})` :
                    s === "up" ? `Aktif (${statusCounts.up})` :
                      s === "degraded" ? `Bozuk (${statusCounts.degraded})` :
                        `Çevrimdışı (${statusCounts.down})`}
                </button>
              ))}
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 rounded p-0.5" style={{ border: "2px solid var(--border-default)" }}>
              <button
                onClick={() => setViewMode("grid")}
                className="p-1.5 rounded-md transition-all"
                style={viewMode === "grid" ? { background: "var(--color-teal-subtle)", color: "var(--color-teal)" } : { color: "var(--text-faint)" }}
                aria-label="Grid görünümü"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className="p-1.5 rounded-md transition-all"
                style={viewMode === "list" ? { background: "var(--color-teal-subtle)", color: "var(--color-teal)" } : { color: "var(--text-faint)" }}
                aria-label="Liste görünümü"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* SLA Summary Panel */}
      {!isLoading && services.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }}>
          <Card className="rounded p-4" style={{ background: "var(--surface-card)", border: "2px solid var(--border-default)", boxShadow: "var(--card-shadow)" }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-3.5 h-3.5" style={{ color: "var(--color-teal)" }} />
                <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>SLA / Uptime Özeti</h3>
              </div>
              <div className="flex items-center gap-1">
                {(["24h", "7d", "30d"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setSlaRange(r)}
                    className="px-2 py-0.5 rounded text-[10px] font-medium border-2 transition-all"
                    style={slaRange === r
                      ? { background: "var(--color-teal-subtle)", color: "var(--color-teal)", borderColor: "var(--color-teal-border)" }
                      : { color: "var(--text-faint)", borderColor: "transparent" }}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Avg Uptime */}
              <div className="p-3 rounded text-center" style={{ background: "var(--surface-sunken)", border: "2px solid var(--border-default)" }}>
                <TrendingUp className="w-4 h-4 mx-auto mb-1" style={{ color: avgUptime != null && avgUptime >= 99 ? "var(--status-up)" : avgUptime != null && avgUptime >= 95 ? "var(--status-warn)" : "var(--status-down)" }} />
                <p className="text-lg font-bold tabular-nums" style={{ color: avgUptime != null && avgUptime >= 99 ? "var(--status-up-text)" : avgUptime != null && avgUptime >= 95 ? "var(--status-warn-text)" : avgUptime != null ? "var(--status-down-text)" : "var(--text-faint)" }}>
                  {avgUptime != null ? `${avgUptime.toFixed(2)}%` : "—"}
                </p>
                <p className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: "var(--text-muted)" }}>Ort. Uptime</p>
              </div>
              {/* SLA ≥99.9% */}
              <div className="p-3 rounded text-center" style={{ background: "var(--status-up-subtle)", border: "2px solid var(--status-up-border)" }}>
                <Shield className="w-4 h-4 mx-auto mb-1" style={{ color: "var(--status-up)" }} />
                <p className="text-lg font-bold tabular-nums" style={{ color: "var(--status-up-text)" }}>{slaOk}</p>
                <p className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: "var(--text-muted)" }}>≥99.9% SLA</p>
              </div>
              {/* 95-99.9% */}
              <div className="p-3 rounded text-center" style={{ background: "var(--status-warn-subtle)", border: "2px solid var(--status-warn-border)" }}>
                <AlertTriangle className="w-4 h-4 mx-auto mb-1" style={{ color: "var(--status-warn)" }} />
                <p className="text-lg font-bold tabular-nums" style={{ color: "var(--status-warn-text)" }}>{slaWarn}</p>
                <p className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: "var(--text-muted)" }}>95–99.9%</p>
              </div>
              {/* <95% */}
              <div className="p-3 rounded text-center" style={{ background: "var(--status-down-subtle)", border: "2px solid var(--status-down-border)" }}>
                <XCircle className="w-4 h-4 mx-auto mb-1" style={{ color: "var(--status-down)" }} />
                <p className="text-lg font-bold tabular-nums" style={{ color: "var(--status-down-text)" }}>{slaCrit}</p>
                <p className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: "var(--text-muted)" }}>&lt;95%</p>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Services Grid/List */}
      {isLoading ? (
        <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" : "space-y-3"}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="p-4 rounded animate-pulse" style={{ background: "var(--surface-card)", border: "2px solid var(--border-default)" }}>
              <div className="h-5 w-40 rounded mb-3" style={{ backgroundColor: "var(--color-teal-subtle)" }} />
              <div className="h-3 w-28 rounded" style={{ backgroundColor: "var(--color-teal-subtle)" }} />
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 rounded text-center" style={{ background: "var(--surface-card)", border: "2px solid var(--border-default)", boxShadow: "var(--card-shadow)" }}>
          <div className="w-16 h-16 rounded flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: "var(--color-teal-subtle)", border: "2px solid var(--color-teal-border)" }}>
            <Server className="w-8 h-8 opacity-40" style={{ color: "var(--color-teal)" }} />
          </div>
          <p className="text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
            {services.length === 0 ? "Henüz servis eklenmedi" : "Filtreye uygun servis bulunamadı"}
          </p>
          <p className="text-xs" style={{ color: "var(--text-faint)" }}>
            {services.length === 0 ? 'Başlamak için "Servis Ekle" butonuna tıklayın' : "Arama veya filtre kriterlerini değiştirmeyi deneyin"}
          </p>
        </Card>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {filtered.map((service, index) => {
              const sv = statusVars(service.status);
              const iconColorVar = service.status === "up" ? "var(--color-teal)" : service.status === "degraded" ? "var(--status-warn)" : "var(--status-down)";
              const iconBgVar = service.status === "up" ? "var(--color-teal-subtle)" : service.status === "degraded" ? "var(--status-warn-subtle)" : "var(--status-down-subtle)";
              return (
                <motion.div
                  key={service.id}
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.25, delay: index * 0.04 }}
                  whileHover={{ y: -2 }}
                  layout
                >
                  <Link to={`/services/${service.id}`} className="block group">
                    <Card className="relative rounded p-5 transition-all duration-200 overflow-hidden"
                      style={{ background: "var(--surface-card)", border: `2px solid ${sv.border}`, boxShadow: "var(--card-shadow)" }}>
                      {service.status === "up" && (
                        <div className="absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(to right, transparent, var(--color-teal-border), transparent)" }} />
                      )}

                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative shrink-0">
                            <div className="w-10 h-10 rounded flex items-center justify-center" style={{ backgroundColor: iconBgVar, border: `1.5px solid ${sv.border}` }}>
                              <Server className="w-4.5 h-4.5" style={{ color: iconColorVar }} />
                            </div>
                            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border border-white flex items-center justify-center" style={{ backgroundColor: sv.dot }}>
                              {service.status === "up" && <div className="absolute inset-0 rounded-full animate-pulse-ring" style={{ backgroundColor: "var(--status-up)" }} />}
                            </div>
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-sm font-semibold truncate transition-colors" style={{ color: "var(--text-secondary)" }}>
                              {service.name}
                            </h3>
                            <p className="text-[10px] font-(--font-mono) truncate" style={{ color: "var(--text-faint)" }}>
                              {service.host}:{service.port}
                            </p>
                          </div>
                        </div>
                        <Badge className="text-[9px] font-(--font-mono) px-2 py-0.5 rounded border-2 shrink-0"
                          style={{ background: sv.badgeBg, color: sv.badgeText, borderColor: sv.badgeBorder }}>
                          {service.status?.toUpperCase() ?? "UNKNOWN"}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between pt-3" style={{ borderTop: "2px solid var(--border-default)" }}>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] flex items-center gap-1" style={{ color: "var(--text-faint)" }}>
                            <Clock className="w-3 h-3" /> {service.poll_interval_sec}s
                          </span>
                          <span className="text-[10px] flex items-center gap-1" style={{ color: "var(--text-faint)" }}>
                            <Globe className="w-3 h-3" /> {service.health_endpoint}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {uptimeMap[service.id] != null && (
                            <span className="text-[10px] font-semibold tabular-nums"
                              style={{ color: uptimeMap[service.id] >= 99 ? "var(--status-up-text)" : uptimeMap[service.id] >= 95 ? "var(--status-warn-text)" : "var(--status-down-text)" }}>
                              {uptimeMap[service.id].toFixed(1)}%
                            </span>
                          )}
                          <ArrowUpRight className="w-3.5 h-3.5 transition-colors" style={{ color: "var(--text-faint)" }} />
                        </div>
                      </div>
                    </Card>
                  </Link>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {filtered.map((service, index) => {
              const sv2 = statusVars(service.status);
              return (
                <motion.div
                  key={service.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2, delay: index * 0.03 }}
                  layout
                >
                  <Link to={`/services/${service.id}`} className="block group">
                    <Card className="rounded px-4 py-3 transition-all duration-200"
                      style={{ background: "var(--surface-card)", border: `2px solid ${sv2.border}`, boxShadow: "var(--card-shadow)" }}>
                      <div className="flex items-center gap-4">
                        <div className="relative shrink-0">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: sv2.dot }} />
                          {service.status === "up" && <div className="absolute inset-0 w-2 h-2 rounded-full animate-pulse-ring" style={{ backgroundColor: "var(--status-up)" }} />}
                        </div>
                        <span className="text-sm font-semibold w-40 truncate transition-colors" style={{ color: "var(--text-secondary)" }}>{service.name}</span>
                        <span className="text-xs font-(--font-mono) flex-1 truncate" style={{ color: "var(--text-faint)" }}>{service.host}:{service.port}</span>
                        <span className="text-[10px] hidden sm:flex items-center gap-1" style={{ color: "var(--text-faint)" }}>
                          <Clock className="w-3 h-3" />{service.poll_interval_sec}s
                        </span>
                        <Badge className="text-[9px] font-(--font-mono) px-1.5 py-0.5 rounded border-2 shrink-0"
                          style={{ background: sv2.badgeBg, color: sv2.badgeText, borderColor: sv2.badgeBorder }}>
                          {service.status?.toUpperCase() ?? "UNKNOWN"}
                        </Badge>
                        <StatusIcon status={service.status} />
                      </div>
                    </Card>
                  </Link>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

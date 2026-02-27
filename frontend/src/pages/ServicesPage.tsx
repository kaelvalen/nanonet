import { useState, useMemo } from "react";
import { Link } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Server,
  Search,
  Plus,
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
  Zap,
} from "lucide-react";
import { useServices } from "@/hooks/useServices";
import type { CreateServiceRequest } from "@/types/service";

function StatusIcon({ status }: { status: string }) {
  if (status === "up") return <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "var(--status-up)" }} />;
  if (status === "degraded") return <AlertTriangle className="w-3.5 h-3.5" style={{ color: "var(--status-warn)" }} />;
  if (status === "down") return <XCircle className="w-3.5 h-3.5" style={{ color: "var(--status-down)" }} />;
  return <HelpCircle className="w-3.5 h-3.5" style={{ color: "var(--text-faint)" }} />;
}

export function ServicesPage() {
  const { services, isLoading, createService, restartService, stopService } = useServices();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newService, setNewService] = useState<CreateServiceRequest>({
    name: "",
    host: "",
    port: 8080,
    health_endpoint: "/health",
    poll_interval_sec: 10,
  });

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

  const handleCreate = () => {
    createService(newService);
    setIsAddOpen(false);
    setNewService({ name: "", host: "", port: 8080, health_endpoint: "/health", poll_interval_sec: 10 });
  };

  const statusVars = (status: string) => {
    switch (status) {
      case "up":       return { dot: "var(--status-up)",   badgeBg: "var(--status-up-subtle)",   badgeText: "var(--status-up-text)",   badgeBorder: "var(--status-up-border)",   border: "var(--color-teal-border)" };
      case "degraded": return { dot: "var(--status-warn)", badgeBg: "var(--status-warn-subtle)", badgeText: "var(--status-warn-text)", badgeBorder: "var(--status-warn-border)", border: "var(--status-warn-border)" };
      case "down":     return { dot: "var(--status-down)", badgeBg: "var(--status-down-subtle)", badgeText: "var(--status-down-text)", badgeBorder: "var(--status-down-border)", border: "var(--status-down-border)" };
      default:         return { dot: "var(--text-faint)",  badgeBg: "var(--surface-sunken)",    badgeText: "var(--text-muted)",       badgeBorder: "var(--border-subtle)",      border: "var(--border-subtle)" };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-heading)" }}>
              Services
            </h1>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Manage and monitor all microservices</p>
          </div>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="text-white rounded-xl shadow-sm hover:shadow-md transition-all text-xs px-4 py-2" style={{ background: "var(--gradient-btn-primary)" }}>
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Service
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-125 rounded-2xl" style={{ background: "var(--surface-overlay)", border: "1px solid var(--color-teal-border)" }}>
              <DialogHeader>
                <DialogTitle style={{ color: "var(--text-link)" }}>New Service</DialogTitle>
                <DialogDescription style={{ color: "var(--text-muted)" }}>Add a new microservice to monitor</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label className="text-xs" style={{ color: "var(--text-secondary)" }}>Service Name *</Label>
                  <Input placeholder="payment-service" value={newService.name} onChange={(e) => setNewService({ ...newService, name: e.target.value })} className="rounded-xl" style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-secondary)" }} />
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs" style={{ color: "var(--text-secondary)" }}>Host / IP *</Label>
                  <Input placeholder="192.168.1.42" value={newService.host} onChange={(e) => setNewService({ ...newService, host: e.target.value })} className="rounded-xl" style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-secondary)" }} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label className="text-xs" style={{ color: "var(--text-secondary)" }}>Port *</Label>
                    <Input type="number" placeholder="8080" value={newService.port} onChange={(e) => setNewService({ ...newService, port: parseInt(e.target.value) || 0 })} className="rounded-xl" style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-secondary)" }} />
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-xs" style={{ color: "var(--text-secondary)" }}>Health Endpoint *</Label>
                    <Input placeholder="/health" value={newService.health_endpoint} onChange={(e) => setNewService({ ...newService, health_endpoint: e.target.value })} className="rounded-xl" style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-secondary)" }} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs" style={{ color: "var(--text-secondary)" }}>Poll Interval (seconds)</Label>
                  <Input type="number" placeholder="10" value={newService.poll_interval_sec} onChange={(e) => setNewService({ ...newService, poll_interval_sec: parseInt(e.target.value) || 10 })} className="rounded-xl" style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-secondary)" }} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddOpen(false)} className="rounded-xl" style={{ borderColor: "var(--color-teal-border)", color: "var(--text-secondary)" }}>Cancel</Button>
                <Button onClick={handleCreate} disabled={!newService.name || !newService.host} className="text-white rounded-xl" style={{ background: "var(--gradient-btn-primary)" }}>Deploy</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </motion.div>

      {/* Search & Filter Bar */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
        <Card className="backdrop-blur-sm rounded-xl p-3" style={{ background: "var(--surface-glass)", border: "1px solid var(--color-teal-border)" }}>
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "var(--text-faint)" }} />
              <Input
                placeholder="Search services..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 rounded-lg text-xs h-9"
                style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-secondary)" }}
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5">
              <Filter className="w-3 h-3" style={{ color: "var(--text-faint)" }} />
              {(["all", "up", "degraded", "down"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all border"
                  style={statusFilter === s ? {
                    background: s === "up" ? "var(--status-up-subtle)" : s === "degraded" ? "var(--status-warn-subtle)" : s === "down" ? "var(--status-down-subtle)" : "var(--color-teal-subtle)",
                    color: s === "up" ? "var(--status-up-text)" : s === "degraded" ? "var(--status-warn-text)" : s === "down" ? "var(--status-down-text)" : "var(--color-teal)",
                    borderColor: s === "up" ? "var(--status-up-border)" : s === "degraded" ? "var(--status-warn-border)" : s === "down" ? "var(--status-down-border)" : "var(--color-teal-border)",
                  } : { color: "var(--text-muted)", borderColor: "transparent" }}
                >
                  {s === "all" ? `All (${statusCounts.all})` :
                   s === "up" ? `Up (${statusCounts.up})` :
                   s === "degraded" ? `Deg (${statusCounts.degraded})` :
                   `Down (${statusCounts.down})`}
                </button>
              ))}
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 rounded-lg p-0.5" style={{ border: "1px solid var(--color-teal-border)" }}>
              <button
                onClick={() => setViewMode("grid")}
                className="p-1.5 rounded-md transition-all"
                style={viewMode === "grid" ? { background: "var(--color-teal-subtle)", color: "var(--color-teal)" } : { color: "var(--text-faint)" }}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className="p-1.5 rounded-md transition-all"
                style={viewMode === "list" ? { background: "var(--color-teal-subtle)", color: "var(--color-teal)" } : { color: "var(--text-faint)" }}
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Services Grid/List */}
      {isLoading ? (
        <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" : "space-y-3"}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="p-4 rounded-xl animate-pulse" style={{ background: "var(--surface-glass)", border: "1px solid var(--color-teal-border)" }}>
              <div className="h-5 w-40 rounded mb-3" style={{ backgroundColor: "var(--color-teal-subtle)" }} />
              <div className="h-3 w-28 rounded" style={{ backgroundColor: "var(--color-teal-subtle)" }} />
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 rounded-xl text-center" style={{ background: "var(--surface-glass)", border: "1px solid var(--color-teal-border)" }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: "var(--color-teal-subtle)" }}>
            <Server className="w-8 h-8 opacity-40" style={{ color: "var(--color-teal)" }} />
          </div>
          <p className="text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
            {services.length === 0 ? "No services added yet" : "No services match your filter"}
          </p>
          <p className="text-xs" style={{ color: "var(--text-faint)" }}>
            {services.length === 0 ? 'Click "Add Service" to get started' : "Try adjusting your search or filter criteria"}
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
                    <Card className="relative backdrop-blur-sm rounded-xl p-5 transition-all duration-200 shadow-sm group-hover:shadow-md overflow-hidden"
                      style={{ background: "var(--surface-glass)", border: `1px solid ${sv.border}` }}>
                      {service.status === "up" && (
                        <div className="absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(to right, transparent, var(--color-teal-border), transparent)" }} />
                      )}

                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative shrink-0">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: iconBgVar }}>
                              <Server className="w-4.5 h-4.5" style={{ color: iconColorVar }} />
                            </div>
                            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white flex items-center justify-center" style={{ backgroundColor: sv.dot }}>
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
                        <Badge className="text-[9px] font-(--font-mono) px-2 py-0.5 rounded-full border shrink-0"
                          style={{ background: sv.badgeBg, color: sv.badgeText, borderColor: sv.badgeBorder }}>
                          {service.status?.toUpperCase() ?? "UNKNOWN"}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid var(--border-divider)" }}>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] flex items-center gap-1" style={{ color: "var(--text-faint)" }}>
                            <Clock className="w-3 h-3" /> {service.poll_interval_sec}s
                          </span>
                          <span className="text-[10px] flex items-center gap-1" style={{ color: "var(--text-faint)" }}>
                            <Globe className="w-3 h-3" /> {service.health_endpoint}
                          </span>
                        </div>
                        <ArrowUpRight className="w-3.5 h-3.5 transition-colors" style={{ color: "var(--text-faint)" }} />
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
                    <Card className="rounded-xl px-4 py-3 transition-all duration-200 group-hover:shadow-sm"
                      style={{ background: "var(--surface-glass)", border: `1px solid ${sv2.border}` }}>
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
                        <Badge className="text-[9px] font-(--font-mono) px-1.5 py-0.5 rounded-full border shrink-0"
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

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
  Activity,
  Clock,
  ArrowUpRight,
  Filter,
  LayoutGrid,
  List,
  RefreshCw,
} from "lucide-react";
import { useServices } from "@/hooks/useServices";
import type { CreateServiceRequest } from "@/types/service";

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

  const statusColor = (status: string) => {
    switch (status) {
      case "up": return { dot: "bg-[#34d399]", badge: "bg-[#a7f3d0]/30 text-[#059669] border-[#a7f3d0]/50", border: "border-[#39c5bb]/15 hover:border-[#39c5bb]/30" };
      case "degraded": return { dot: "bg-[#fbbf24]", badge: "bg-[#fef3c7]/50 text-[#d97706] border-[#fbbf24]/30", border: "border-[#fbbf24]/20 hover:border-[#fbbf24]/40" };
      case "down": return { dot: "bg-[#fb7185]", badge: "bg-[#fda4af]/20 text-[#e11d48] border-[#fda4af]/30", border: "border-[#fda4af]/20 hover:border-[#fda4af]/40" };
      default: return { dot: "bg-[#b0bdd5]", badge: "bg-[#e2e8f0]/30 text-[#7c8db5] border-[#e2e8f0]/50", border: "border-[#b0bdd5]/15 hover:border-[#b0bdd5]/30" };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold bg-linear-to-r from-[#39c5bb] via-[#93c5fd] to-[#c4b5fd] bg-clip-text text-transparent">
              Services
            </h1>
            <p className="text-xs text-[#7c8db5] mt-1">Manage and monitor all microservices</p>
          </div>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="bg-linear-to-r from-[#39c5bb] to-[#93c5fd] text-white rounded-xl shadow-sm hover:shadow-md transition-all text-xs px-4 py-2">
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Service
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] bg-white border-[#39c5bb]/15 rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-[#39c5bb]">New Service</DialogTitle>
                <DialogDescription className="text-[#7c8db5]">Add a new microservice to monitor</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label className="text-[#3b4563] text-xs">Service Name *</Label>
                  <Input placeholder="payment-service" value={newService.name} onChange={(e) => setNewService({ ...newService, name: e.target.value })} className="bg-[#f5f8ff] border-[#39c5bb]/15 text-[#3b4563] rounded-xl" />
                </div>
                <div className="grid gap-2">
                  <Label className="text-[#3b4563] text-xs">Host / IP *</Label>
                  <Input placeholder="192.168.1.42" value={newService.host} onChange={(e) => setNewService({ ...newService, host: e.target.value })} className="bg-[#f5f8ff] border-[#39c5bb]/15 text-[#3b4563] rounded-xl" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label className="text-[#3b4563] text-xs">Port *</Label>
                    <Input type="number" placeholder="8080" value={newService.port} onChange={(e) => setNewService({ ...newService, port: parseInt(e.target.value) || 0 })} className="bg-[#f5f8ff] border-[#39c5bb]/15 text-[#3b4563] rounded-xl" />
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-[#3b4563] text-xs">Health Endpoint *</Label>
                    <Input placeholder="/health" value={newService.health_endpoint} onChange={(e) => setNewService({ ...newService, health_endpoint: e.target.value })} className="bg-[#f5f8ff] border-[#39c5bb]/15 text-[#3b4563] rounded-xl" />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label className="text-[#3b4563] text-xs">Poll Interval (seconds)</Label>
                  <Input type="number" placeholder="10" value={newService.poll_interval_sec} onChange={(e) => setNewService({ ...newService, poll_interval_sec: parseInt(e.target.value) || 10 })} className="bg-[#f5f8ff] border-[#39c5bb]/15 text-[#3b4563] rounded-xl" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddOpen(false)} className="border-[#39c5bb]/20 text-[#3b4563] rounded-xl">Cancel</Button>
                <Button onClick={handleCreate} disabled={!newService.name || !newService.host} className="bg-linear-to-r from-[#39c5bb] to-[#93c5fd] text-white rounded-xl">Deploy</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </motion.div>

      {/* Search & Filter Bar */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
        <Card className="bg-white/80 backdrop-blur-sm border-[#39c5bb]/10 rounded-xl p-3">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#b0bdd5]" />
              <Input
                placeholder="Search services..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-[#f5f8ff] border-[#39c5bb]/10 text-[#3b4563] rounded-lg text-xs h-9"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5">
              <Filter className="w-3 h-3 text-[#b0bdd5]" />
              {(["all", "up", "degraded", "down"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all ${
                    statusFilter === s
                      ? s === "all" ? "bg-[#39c5bb]/15 text-[#2da89e] border border-[#39c5bb]/20" :
                        s === "up" ? "bg-[#34d399]/15 text-[#059669] border border-[#34d399]/20" :
                        s === "degraded" ? "bg-[#fbbf24]/15 text-[#d97706] border border-[#fbbf24]/20" :
                        "bg-[#fda4af]/15 text-[#e11d48] border border-[#fda4af]/20"
                      : "text-[#7c8db5] hover:bg-[#f5f8ff] border border-transparent"
                  }`}
                >
                  {s === "all" ? `All (${statusCounts.all})` :
                   s === "up" ? `Up (${statusCounts.up})` :
                   s === "degraded" ? `Deg (${statusCounts.degraded})` :
                   `Down (${statusCounts.down})`}
                </button>
              ))}
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 border border-[#39c5bb]/10 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-md transition-all ${viewMode === "grid" ? "bg-[#39c5bb]/10 text-[#2da89e]" : "text-[#b0bdd5] hover:text-[#7c8db5]"}`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded-md transition-all ${viewMode === "list" ? "bg-[#39c5bb]/10 text-[#2da89e]" : "text-[#b0bdd5] hover:text-[#7c8db5]"}`}
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
            <Card key={i} className="p-4 bg-white/80 border-[#39c5bb]/10 rounded-xl animate-pulse">
              <div className="h-5 w-40 bg-[#39c5bb]/10 rounded mb-3" />
              <div className="h-3 w-28 bg-[#39c5bb]/10 rounded" />
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 bg-white/80 border-[#39c5bb]/10 rounded-xl text-center">
          <Server className="w-12 h-12 text-[#b0bdd5] mx-auto mb-3" />
          <p className="text-sm text-[#7c8db5]">
            {services.length === 0 ? "Henüz servis eklenmemiş" : "Filtreye uygun servis bulunamadı"}
          </p>
        </Card>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {filtered.map((service, index) => {
              const colors = statusColor(service.status);
              return (
                <motion.div
                  key={service.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3, delay: index * 0.04 }}
                  layout
                >
                  <Link to={`/services/${service.id}`} className="block group">
                    <Card className={`relative bg-white/80 backdrop-blur-sm border ${colors.border} rounded-xl p-5 transition-all duration-300 group-hover:translate-y-[-2px] shadow-sm group-hover:shadow-md overflow-hidden`}>
                      {service.status === "up" && (
                        <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-[#39c5bb]/30 to-transparent" />
                      )}

                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="relative flex-shrink-0">
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center bg-gradient-to-br ${
                              service.status === "up" ? "from-[#39c5bb]/10 to-[#a8ede8]/10" :
                              service.status === "degraded" ? "from-[#fbbf24]/10 to-[#fef3c7]/10" :
                              "from-[#fda4af]/10 to-[#ffd1dc]/10"
                            }`}>
                              <Server className={`w-4 h-4 ${
                                service.status === "up" ? "text-[#39c5bb]" :
                                service.status === "degraded" ? "text-[#fbbf24]" :
                                "text-[#fb7185]"
                              }`} />
                            </div>
                            <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${colors.dot}`} />
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-[#3b4563] truncate group-hover:text-[#2a3350] transition-colors">
                              {service.name}
                            </h3>
                            <p className="text-[10px] text-[#b0bdd5] font-[var(--font-mono)]">
                              {service.host}:{service.port}
                            </p>
                          </div>
                        </div>
                        <Badge className={`text-[9px] font-[var(--font-mono)] px-1.5 py-0.5 rounded-full border ${colors.badge}`}>
                          {service.status.toUpperCase()}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#e2e8f0]/50">
                        <span className="text-[10px] text-[#b0bdd5] flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {service.poll_interval_sec}s interval
                        </span>
                        <ArrowUpRight className="w-3.5 h-3.5 text-[#b0bdd5] group-hover:text-[#39c5bb] transition-colors" />
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
              const colors = statusColor(service.status);
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
                    <Card className={`bg-white/80 border ${colors.border} rounded-xl p-3 transition-all duration-200 group-hover:bg-white/95 shadow-sm`}>
                      <div className="flex items-center gap-4">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${colors.dot}`} />
                        <span className="text-sm font-semibold text-[#3b4563] w-40 truncate">{service.name}</span>
                        <span className="text-xs text-[#b0bdd5] font-[var(--font-mono)] flex-1">{service.host}:{service.port}</span>
                        <span className="text-[10px] text-[#b0bdd5]">{service.poll_interval_sec}s</span>
                        <Badge className={`text-[9px] font-[var(--font-mono)] px-1.5 py-0.5 rounded-full border ${colors.badge}`}>
                          {service.status.toUpperCase()}
                        </Badge>
                        <ArrowUpRight className="w-3.5 h-3.5 text-[#b0bdd5] group-hover:text-[#39c5bb] transition-colors" />
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

import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "motion/react";
import {
  Server,
  AlertCircle,
  Sparkles,
  Settings,
  Plus,
  Activity,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowRight,
  Shield,
  Eye,
  Heart,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useServices } from "@/hooks/useServices";
import type { CreateServiceRequest } from "@/types/service";

const navCards = [
  {
    to: "/services",
    label: "Services",
    description: "Monitor and manage all microservices",
    icon: Server,
    color: "#39c5bb",
    bgGradient: "from-[#39c5bb]/8 to-[#a8ede8]/5",
    borderColor: "border-[#39c5bb]/15 hover:border-[#39c5bb]/35",
    glowColor: "from-[#39c5bb] to-[#7eddd3]",
    statColor: "text-[#2da89e]",
  },
  {
    to: "/alerts",
    label: "Alerts",
    description: "Real-time incident alerts and notifications",
    icon: AlertCircle,
    color: "#fda4af",
    bgGradient: "from-[#fda4af]/8 to-[#ffd1dc]/5",
    borderColor: "border-[#fda4af]/15 hover:border-[#fda4af]/35",
    glowColor: "from-[#fda4af] to-[#ffd1dc]",
    statColor: "text-[#e11d48]",
    pulse: true,
  },
  {
    to: "/ai-insights",
    label: "AI Insights",
    description: "AI-powered anomaly detection and recommendations",
    icon: Sparkles,
    color: "#c4b5fd",
    bgGradient: "from-[#c4b5fd]/8 to-[#e0d6ff]/5",
    borderColor: "border-[#c4b5fd]/15 hover:border-[#c4b5fd]/35",
    glowColor: "from-[#c4b5fd] to-[#e0d6ff]",
    statColor: "text-[#7c3aed]",
  },
  {
    to: "/settings",
    label: "Settings",
    description: "Platform configuration and preferences",
    icon: Settings,
    color: "#93c5fd",
    bgGradient: "from-[#93c5fd]/8 to-[#b8dafb]/5",
    borderColor: "border-[#93c5fd]/15 hover:border-[#93c5fd]/35",
    glowColor: "from-[#93c5fd] to-[#b8dafb]",
    statColor: "text-[#3b82f6]",
  },
];

export function DashboardPage() {
  const [isAddServiceOpen, setIsAddServiceOpen] = useState(false);
  const [newService, setNewService] = useState<CreateServiceRequest>({
    name: "",
    host: "",
    port: 8080,
    health_endpoint: "/health",
    poll_interval_sec: 10,
  });
  const { services, isLoading, createService } = useServices();
  const navigate = useNavigate();

  const totalServices = services.length;
  const activeServices = services.filter((s) => s.status === "up").length;
  const degradedServices = services.filter((s) => s.status === "degraded").length;
  const offlineServices = services.filter((s) => s.status === "down" || s.status === "unknown").length;

  const stats = [
    { label: "Total Services", value: totalServices, color: "teal" },
    { label: "Active", value: activeServices, color: "mint" },
    { label: "Degraded", value: degradedServices, color: "pink" },
    { label: "Offline", value: offlineServices, color: "lavender" },
  ];

  const [animatedStats, setAnimatedStats] = useState(stats.map((s) => ({ ...s, displayValue: 0 })));

  useEffect(() => {
    const duration = 800;
    const steps = 20;
    const interval = duration / steps;
    const timers: ReturnType<typeof setInterval>[] = [];

    stats.forEach((stat, index) => {
      let current = 0;
      const increment = stat.value / steps;

      const timer = setInterval(() => {
        current += increment;
        if (current >= stat.value) {
          current = stat.value;
          clearInterval(timer);
        }
        setAnimatedStats((prev) => {
          const newStats = [...prev];
          newStats[index] = { ...stat, displayValue: Math.floor(current) };
          return newStats;
        });
      }, interval);
      timers.push(timer);
    });

    return () => timers.forEach(clearInterval);
  }, [services]);

  const handleCreateService = () => {
    createService(newService);
    setIsAddServiceOpen(false);
    setNewService({ name: "", host: "", port: 8080, health_endpoint: "/health", poll_interval_sec: 10 });
  };

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center py-4"
      >
        <div className="relative inline-block">
          <h1 className="text-4xl sm:text-5xl font-bold bg-linear-to-r from-[#39c5bb] via-[#93c5fd] to-[#c4b5fd] bg-clip-text text-transparent mb-2 font-[var(--font-quicksand)]">
            Command Center
          </h1>
          <div className="absolute -left-6 top-1/2 -translate-y-1/2 text-[#39c5bb] opacity-40 animate-twinkle">✦</div>
          <div className="absolute -right-6 top-1/2 -translate-y-1/2 text-[#fda4af] opacity-40 animate-twinkle" style={{ animationDelay: "1s" }}>✦</div>
        </div>
        <div className="flex items-center justify-center gap-3 mt-2">
          <div className="w-2 h-2 bg-[#34d399] rounded-full animate-pulse" />
          <p className="text-xs text-[#7c8db5] tracking-wider">
            Real-time Monitoring · {activeServices === totalServices && totalServices > 0 ? "All Systems Operational" : `${activeServices}/${totalServices} Online`}
          </p>
        </div>

        <div className="flex items-center justify-center gap-4 mt-3">
          <span className="text-[10px] text-[#b0bdd5] flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-white border border-[#39c5bb]/15 rounded text-[#7c8db5] font-[var(--font-mono)]">⌘K</kbd>
            Command Palette
          </span>
          <span className="text-[#c4b5fd]">·</span>
          <span className="text-[10px] text-[#b0bdd5] flex items-center gap-1">
            <span className="text-[#39c5bb]">✦</span>
            Radial Menu (bottom-left)
          </span>
        </div>
      </motion.div>

      {/* Stats Row */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-3"
      >
        {animatedStats.map((stat) => (
          <div key={stat.label} className="relative group">
            <div
              className={`absolute -inset-0.5 bg-linear-to-r ${
                stat.color === "teal" ? "from-[#39c5bb] to-[#7eddd3]" :
                stat.color === "mint" ? "from-[#34d399] to-[#a7f3d0]" :
                stat.color === "pink" ? "from-[#fda4af] to-[#ffd1dc]" :
                "from-[#c4b5fd] to-[#e0d6ff]"
              } rounded-xl blur opacity-10 group-hover:opacity-20 transition duration-300`}
            />
            <Card
              className={`relative p-3 bg-white/80 backdrop-blur-sm border ${
                stat.color === "teal" ? "border-[#39c5bb]/15" :
                stat.color === "mint" ? "border-[#34d399]/15" :
                stat.color === "pink" ? "border-[#fda4af]/15" :
                "border-[#c4b5fd]/15"
              } transition-all duration-300 rounded-xl shadow-sm`}
            >
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] text-[#7c8db5] uppercase tracking-wider">{stat.label}</p>
              </div>
              <p
                className={`text-2xl font-bold bg-gradient-to-br ${
                  stat.color === "teal" ? "from-[#39c5bb] to-[#2da89e]" :
                  stat.color === "mint" ? "from-[#34d399] to-[#059669]" :
                  stat.color === "pink" ? "from-[#fb7185] to-[#e11d48]" :
                  "from-[#a78bfa] to-[#7c3aed]"
                } bg-clip-text text-transparent`}
              >
                {stat.displayValue}
              </p>
            </Card>
          </div>
        ))}
      </motion.div>

      {/* Navigation Cards Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="h-px flex-1 bg-linear-to-r from-transparent via-[#39c5bb]/20 to-transparent" />
          <h2 className="text-xs text-[#7c8db5] uppercase tracking-widest flex items-center gap-2">
            <Eye className="w-3 h-3" /> Navigate
          </h2>
          <div className="h-px flex-1 bg-linear-to-r from-transparent via-[#39c5bb]/20 to-transparent" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {navCards.map((card, index) => (
            <motion.div
              key={card.to}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 + index * 0.08 }}
            >
              <Link to={card.to} className="block group">
                <div className="relative">
                  <div className={`absolute -inset-0.5 bg-linear-to-r ${card.glowColor} rounded-2xl blur opacity-8 group-hover:opacity-20 transition duration-500`} />

                  <Card className={`relative bg-white/80 backdrop-blur-sm border ${card.borderColor} rounded-2xl p-6 transition-all duration-500 overflow-hidden group-hover:translate-y-[-2px] shadow-sm group-hover:shadow-md`}>
                    <div className={`absolute inset-0 bg-gradient-to-br ${card.bgGradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

                    <div className="relative z-10">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-12 h-12 rounded-xl flex items-center justify-center border transition-all duration-300 group-hover:scale-110"
                            style={{ backgroundColor: `${card.color}12`, borderColor: `${card.color}25` }}
                          >
                            <card.icon className="w-6 h-6" style={{ color: card.color }} />
                          </div>
                          <div>
                            <h3 className="text-[#3b4563] tracking-wide group-hover:text-[#2a3350] transition-colors font-semibold">
                              {card.label}
                            </h3>
                            <p className="text-xs text-[#7c8db5] mt-0.5">{card.description}</p>
                          </div>
                        </div>
                        <ArrowRight className="w-5 h-5 text-[#b0bdd5] group-hover:text-[#3b4563] group-hover:translate-x-1 transition-all" />
                      </div>

                      {card.pulse && (
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 bg-[#fda4af] rounded-full animate-pulse" />
                          <span className="text-[10px] text-[#e11d48]">Needs attention</span>
                        </div>
                      )}
                    </div>
                  </Card>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Quick Services Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.5 }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="h-px w-8 bg-linear-to-r from-transparent to-[#39c5bb]/20" />
            <h2 className="text-xs text-[#7c8db5] uppercase tracking-widest flex items-center gap-2">
              <Activity className="w-3 h-3" /> Service Overview
            </h2>
            <div className="h-px w-8 bg-gradient-to-l from-transparent to-[#39c5bb]/20" />
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={isAddServiceOpen} onOpenChange={setIsAddServiceOpen}>
              <DialogTrigger asChild>
                <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#39c5bb]/8 border border-[#39c5bb]/20 text-[#2da89e] hover:bg-[#39c5bb]/15 hover:border-[#39c5bb]/35 transition-all text-xs">
                  <Plus className="w-3 h-3" />
                  Add
                </button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px] bg-white border-[#39c5bb]/15 rounded-2xl">
                <DialogHeader>
                  <DialogTitle className="text-[#39c5bb]">New Service</DialogTitle>
                  <DialogDescription className="text-[#7c8db5]">Add a new microservice to monitor</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name" className="text-[#3b4563] text-xs">Service Name *</Label>
                    <Input
                      id="name"
                      placeholder="payment-service"
                      value={newService.name}
                      onChange={(e) => setNewService({ ...newService, name: e.target.value })}
                      className="bg-[#f5f8ff] border-[#39c5bb]/15 text-[#3b4563] rounded-xl"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="host" className="text-[#3b4563] text-xs">Host / IP *</Label>
                    <Input
                      id="host"
                      placeholder="192.168.1.42"
                      value={newService.host}
                      onChange={(e) => setNewService({ ...newService, host: e.target.value })}
                      className="bg-[#f5f8ff] border-[#39c5bb]/15 text-[#3b4563] rounded-xl"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="port" className="text-[#3b4563] text-xs">Port *</Label>
                      <Input
                        id="port"
                        placeholder="8080"
                        type="number"
                        value={newService.port}
                        onChange={(e) => setNewService({ ...newService, port: parseInt(e.target.value) || 0 })}
                        className="bg-[#f5f8ff] border-[#39c5bb]/15 text-[#3b4563] rounded-xl"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="endpoint" className="text-[#3b4563] text-xs">Health Endpoint *</Label>
                      <Input
                        id="endpoint"
                        placeholder="/health"
                        value={newService.health_endpoint}
                        onChange={(e) => setNewService({ ...newService, health_endpoint: e.target.value })}
                        className="bg-[#f5f8ff] border-[#39c5bb]/15 text-[#3b4563] rounded-xl"
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddServiceOpen(false)} className="border-[#39c5bb]/20 text-[#3b4563] rounded-xl">
                    Cancel
                  </Button>
                  <Button onClick={handleCreateService} className="bg-linear-to-r from-[#39c5bb] to-[#93c5fd] text-white rounded-xl">
                    Deploy
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Link to="/services" className="text-xs text-[#7c8db5] hover:text-[#39c5bb] transition-colors flex items-center gap-1">
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-4 bg-white/80 border-[#39c5bb]/15 rounded-xl animate-pulse">
                <div className="h-4 w-32 bg-[#39c5bb]/10 rounded mb-3" />
                <div className="h-3 w-20 bg-[#39c5bb]/10 rounded" />
              </Card>
            ))}
          </div>
        ) : services.length === 0 ? (
          <Card className="p-8 bg-white/80 border-[#39c5bb]/15 rounded-xl text-center">
            <Server className="w-12 h-12 text-[#b0bdd5] mx-auto mb-3" />
            <p className="text-sm text-[#7c8db5]">Henüz servis eklenmemiş</p>
            <p className="text-xs text-[#b0bdd5] mt-1">Yukarıdaki "Add" butonunu kullanarak bir servis ekleyin</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {services.slice(0, 6).map((service, index) => (
              <motion.div
                key={service.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: 0.6 + index * 0.05 }}
              >
                <Link to={`/services/${service.id}`} className="block group">
                  <Card
                    className={`relative bg-white/80 backdrop-blur-sm border transition-all duration-300 overflow-hidden p-4 group-hover:translate-y-[-1px] rounded-xl shadow-sm group-hover:shadow-md ${
                      service.status === "up"
                        ? "border-[#39c5bb]/15 hover:border-[#39c5bb]/30"
                        : service.status === "degraded"
                        ? "border-[#fbbf24]/20 hover:border-[#fbbf24]/40"
                        : "border-[#fda4af]/20 hover:border-[#fda4af]/40"
                    }`}
                  >
                    {service.status === "up" && (
                      <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-[#39c5bb]/20 to-transparent" />
                    )}

                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="relative flex-shrink-0">
                          <div
                            className={`w-2 h-2 rounded-full ${
                              service.status === "up" ? "bg-[#34d399]" :
                              service.status === "degraded" ? "bg-[#fbbf24]" :
                              "bg-[#fb7185]"
                            }`}
                          />
                          {service.status === "up" && (
                            <div className="absolute inset-0 w-2 h-2 bg-[#34d399] rounded-full animate-pulse-ring" />
                          )}
                        </div>
                        <h3 className="text-xs font-[var(--font-mono)] text-[#3b4563] truncate group-hover:text-[#2a3350] transition-colors">
                          {service.name}
                        </h3>
                      </div>
                      <Badge
                        variant={service.status === "up" ? "default" : service.status === "degraded" ? "secondary" : "destructive"}
                        className={`text-[9px] font-[var(--font-mono)] px-1.5 py-0 rounded-full ${
                          service.status === "up" ? "bg-[#a7f3d0]/30 text-[#059669] border-[#a7f3d0]/50" : ""
                        }`}
                      >
                        {service.status === "up" ? "ON" : service.status === "degraded" ? "DEG" : "OFF"}
                      </Badge>
                    </div>

                    <div className="text-[10px] text-[#7c8db5] font-[var(--font-mono)]">
                      {service.host}:{service.port}
                    </div>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* System Telemetry Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.8 }}
        className="flex items-center justify-center gap-6 py-4 text-[10px] text-[#b0bdd5]"
      >
        <span className="flex items-center gap-1.5">
          <Shield className="w-3 h-3 text-[#34d399]" />
          System Health: {totalServices > 0 ? `${Math.round((activeServices / totalServices) * 100)}%` : "N/A"}
        </span>
        <span className="text-[#c4b5fd]">·</span>
        <span>{totalServices} Services Registered</span>
        <span className="text-[#c4b5fd] hidden sm:inline">·</span>
        <span className="hidden sm:inline flex items-center gap-1">
          <Heart className="w-3 h-3 text-[#fda4af]" />
          NanoNet v2.0
        </span>
      </motion.div>
    </div>
  );
}

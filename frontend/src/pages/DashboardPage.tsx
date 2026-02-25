import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion, useInView } from "motion/react";
import {
  Server,
  AlertCircle,
  Sparkles,
  Settings,
  Plus,
  Activity,
  ArrowRight,
  Shield,
  Eye,
  Heart,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  Zap,
  Clock,
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

function AnimatedCounter({ value, duration = 800 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const steps = 20;
    const inc = value / steps;
    const timer = setInterval(() => {
      start += inc;
      if (start >= value) { setDisplay(value); clearInterval(timer); }
      else setDisplay(Math.floor(start));
    }, duration / steps);
    return () => clearInterval(timer);
  }, [value, duration, inView]);

  return <span ref={ref}>{display}</span>;
}

function UptimeRing({ percent, size = 56 }: { percent: number; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  const color = percent >= 95 ? "#34d399" : percent >= 80 ? "#fbbf24" : "#fb7185";
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={4} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={4}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 1s ease" }}
      />
    </svg>
  );
}

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
  const healthPercent = totalServices > 0 ? Math.round((activeServices / totalServices) * 100) : 0;

  const stats = [
    {
      label: "Total",
      value: totalServices,
      icon: Server,
      color: "teal",
      gradient: "from-[#39c5bb] to-[#2da89e]",
      bg: "bg-[#39c5bb]/8",
      border: "border-[#39c5bb]/15",
      iconColor: "text-[#39c5bb]",
      bar: totalServices > 0 ? 100 : 0,
      barColor: "bg-[#39c5bb]",
    },
    {
      label: "Online",
      value: activeServices,
      icon: CheckCircle2,
      color: "mint",
      gradient: "from-[#34d399] to-[#059669]",
      bg: "bg-[#34d399]/8",
      border: "border-[#34d399]/15",
      iconColor: "text-[#34d399]",
      bar: totalServices > 0 ? (activeServices / totalServices) * 100 : 0,
      barColor: "bg-[#34d399]",
    },
    {
      label: "Degraded",
      value: degradedServices,
      icon: AlertTriangle,
      color: "yellow",
      gradient: "from-[#fbbf24] to-[#d97706]",
      bg: "bg-[#fbbf24]/8",
      border: "border-[#fbbf24]/15",
      iconColor: "text-[#fbbf24]",
      bar: totalServices > 0 ? (degradedServices / totalServices) * 100 : 0,
      barColor: "bg-[#fbbf24]",
    },
    {
      label: "Offline",
      value: offlineServices,
      icon: XCircle,
      color: "pink",
      gradient: "from-[#fb7185] to-[#e11d48]",
      bg: "bg-[#fda4af]/8",
      border: "border-[#fda4af]/15",
      iconColor: "text-[#fb7185]",
      bar: totalServices > 0 ? (offlineServices / totalServices) * 100 : 0,
      barColor: "bg-[#fb7185]",
    },
  ];

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
        className="flex flex-col sm:flex-row items-center justify-between gap-6 py-2"
      >
        <div>
          <div className="relative inline-block">
            <h1 className="text-4xl sm:text-5xl font-bold bg-linear-to-r from-[#39c5bb] via-[#93c5fd] to-[#c4b5fd] bg-clip-text text-transparent mb-1">
              Command Center
            </h1>
            <div className="absolute -left-6 top-1/2 -translate-y-1/2 text-[#39c5bb] opacity-40 animate-twinkle">✦</div>
          </div>
          <p className="text-xs text-[#7c8db5] tracking-wider flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-[#34d399] rounded-full animate-pulse inline-block" />
            {activeServices === totalServices && totalServices > 0
              ? "All Systems Operational"
              : `${activeServices}/${totalServices} Services Online`}
          </p>
        </div>

        {/* System Health Ring */}
        {totalServices > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex items-center gap-4 bg-white/60 dark:bg-[#0d1c24]/80 backdrop-blur-sm border border-[#39c5bb]/15 dark:border-[#00e6ff]/12 rounded-2xl px-5 py-3"
          >
            <div className="relative flex items-center justify-center">
              <UptimeRing percent={healthPercent} size={64} />
              <span className={`absolute text-xs font-bold ${healthPercent >= 95 ? "text-[#059669]" : healthPercent >= 80 ? "text-[#d97706]" : "text-[#e11d48]"}`}>
                {healthPercent}%
              </span>
            </div>
            <div>
              <p className="text-xs font-semibold text-[#3b4563] dark:text-[#d0f4ff]">System Health</p>
              <p className="text-[10px] text-[#7c8db5] dark:text-[#527a8a] mt-0.5">{activeServices} of {totalServices} operational</p>
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* Stats Row */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-3"
      >
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 + i * 0.07 }}
            className="group relative"
          >
            <Card className={`p-4 bg-white/80 dark:bg-[#0d1c24]/85 backdrop-blur-sm border ${stat.border} rounded-xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden`}>
              <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-current to-transparent opacity-20" style={{ color: stat.iconColor.replace("text-", "") }} />
              <div className="flex items-start justify-between mb-3">
                <div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center`}>
                  <stat.icon className={`w-4 h-4 ${stat.iconColor}`} />
                </div>
                <span className={`text-2xl font-bold bg-linear-to-br ${stat.gradient} bg-clip-text text-transparent tabular-nums`}>
                  <AnimatedCounter value={stat.value} />
                </span>
              </div>
              <p className="text-[10px] text-[#7c8db5] dark:text-[#527a8a] uppercase tracking-wider mb-2">{stat.label}</p>
              <div className="h-1 rounded-full bg-[#e2e8f0] dark:bg-[#162534] overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${stat.barColor}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${stat.bar}%` }}
                  transition={{ duration: 0.8, delay: 0.3 + i * 0.07 }}
                />
              </div>
            </Card>
          </motion.div>
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
              whileHover={{ y: -2 }}
            >
              <Link to={card.to} className="block group">
                <Card className={`relative bg-white/80 dark:bg-[#0d1c24]/85 backdrop-blur-sm border ${card.borderColor} rounded-2xl p-5 transition-all duration-300 overflow-hidden shadow-sm group-hover:shadow-lg`}>
                  <div className={`absolute inset-0 bg-linear-to-br ${card.bgGradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                  <div className={`absolute inset-x-0 top-0 h-0.5 bg-linear-to-r ${card.glowColor} opacity-0 group-hover:opacity-60 transition-opacity duration-300`} />

                  <div className="relative z-10 flex items-center gap-4">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center border transition-all duration-300 group-hover:scale-110 shrink-0"
                      style={{ backgroundColor: `${card.color}15`, borderColor: `${card.color}30` }}
                    >
                      <card.icon className="w-5 h-5" style={{ color: card.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-[#3b4563] dark:text-[#d0f4ff] group-hover:text-[#2a3350] dark:group-hover:text-white transition-colors">
                          {card.label}
                        </h3>
                        <ArrowRight className="w-4 h-4 text-[#b0bdd5] dark:text-[#3a6070] group-hover:text-[#3b4563] dark:group-hover:text-[#d0f4ff] group-hover:translate-x-1 transition-all shrink-0" />
                      </div>
                      <p className="text-xs text-[#7c8db5] dark:text-[#527a8a] mt-0.5 truncate">{card.description}</p>
                      {card.pulse && (
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <div className="w-1.5 h-1.5 bg-[#fda4af] rounded-full animate-pulse" />
                          <span className="text-[10px] text-[#e11d48]">Needs attention</span>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
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
          <h2 className="text-xs text-[#7c8db5] uppercase tracking-widest flex items-center gap-2">
            <Activity className="w-3 h-3" /> Recent Services
          </h2>
          <div className="flex items-center gap-2">
            <Dialog open={isAddServiceOpen} onOpenChange={setIsAddServiceOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="h-7 px-3 text-xs bg-linear-to-r from-[#39c5bb] to-[#93c5fd] text-white rounded-lg shadow-sm hover:shadow-md transition-all">
                  <Plus className="w-3 h-3 mr-1" /> Add Service
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-125 bg-white dark:bg-[#0a161e] border-[#39c5bb]/15 dark:border-[#00e6ff]/12 rounded-2xl">
                <DialogHeader>
                  <DialogTitle className="text-[#00b4d8] dark:text-[#00e6ff]">New Service</DialogTitle>
                  <DialogDescription className="text-[#7c8db5] dark:text-[#527a8a]">Add a new microservice to monitor</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name" className="text-[#3b4563] dark:text-[#d0f4ff] text-xs">Service Name *</Label>
                    <Input id="name" placeholder="payment-service" value={newService.name}
                      onChange={(e) => setNewService({ ...newService, name: e.target.value })}
                      className="bg-[#f5f8ff] dark:bg-[#0f1e28] border-[#39c5bb]/15 dark:border-[#00e6ff]/12 text-[#3b4563] dark:text-[#d0f4ff] rounded-xl" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="host" className="text-[#3b4563] dark:text-[#d0f4ff] text-xs">Host / IP *</Label>
                    <Input id="host" placeholder="192.168.1.42" value={newService.host}
                      onChange={(e) => setNewService({ ...newService, host: e.target.value })}
                      className="bg-[#f5f8ff] dark:bg-[#0f1e28] border-[#39c5bb]/15 dark:border-[#00e6ff]/12 text-[#3b4563] dark:text-[#d0f4ff] rounded-xl" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="port" className="text-[#3b4563] dark:text-[#d0f4ff] text-xs">Port *</Label>
                      <Input id="port" placeholder="8080" type="number" value={newService.port}
                        onChange={(e) => setNewService({ ...newService, port: parseInt(e.target.value) || 0 })}
                        className="bg-[#f5f8ff] dark:bg-[#0f1e28] border-[#39c5bb]/15 dark:border-[#00e6ff]/12 text-[#3b4563] dark:text-[#d0f4ff] rounded-xl" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="endpoint" className="text-[#3b4563] dark:text-[#d0f4ff] text-xs">Health Endpoint *</Label>
                      <Input id="endpoint" placeholder="/health" value={newService.health_endpoint}
                        onChange={(e) => setNewService({ ...newService, health_endpoint: e.target.value })}
                        className="bg-[#f5f8ff] dark:bg-[#0f1e28] border-[#39c5bb]/15 dark:border-[#00e6ff]/12 text-[#3b4563] dark:text-[#d0f4ff] rounded-xl" />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddServiceOpen(false)} className="border-[#39c5bb]/20 dark:border-[#00e6ff]/15 text-[#3b4563] dark:text-[#d0f4ff] rounded-xl">Cancel</Button>
                  <Button onClick={handleCreateService} disabled={!newService.name || !newService.host}
                    className="bg-linear-to-r from-[#39c5bb] to-[#93c5fd] text-white rounded-xl">Deploy</Button>
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
              <Card key={i} className="p-4 bg-white/80 dark:bg-[#0d1c24]/85 border-[#39c5bb]/10 dark:border-[#00e6ff]/8 rounded-xl animate-pulse">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-[#39c5bb]/10" />
                  <div className="flex-1">
                    <div className="h-3.5 w-28 bg-[#39c5bb]/10 rounded mb-1.5" />
                    <div className="h-2.5 w-20 bg-[#39c5bb]/8 rounded" />
                  </div>
                </div>
                <div className="h-1.5 w-full bg-[#39c5bb]/8 rounded-full" />
              </Card>
            ))}
          </div>
        ) : services.length === 0 ? (
          <Card className="p-10 bg-white/80 dark:bg-[#0d1c24]/85 border-[#39c5bb]/15 dark:border-[#00e6ff]/12 rounded-xl text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#39c5bb]/8 flex items-center justify-center mx-auto mb-3">
              <Server className="w-7 h-7 text-[#39c5bb]/40" />
            </div>
            <p className="text-sm font-medium text-[#3b4563] dark:text-[#d0f4ff] mb-1">No services yet</p>
            <p className="text-xs text-[#b0bdd5] dark:text-[#3a6070]">Click "Add Service" above to get started</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {services.slice(0, 6).map((service, index) => {
              const statusDot = service.status === "up" ? "bg-[#34d399]" : service.status === "degraded" ? "bg-[#fbbf24]" : "bg-[#fb7185]";
              const statusIcon = service.status === "up" ? CheckCircle2 : service.status === "degraded" ? AlertTriangle : XCircle;
              const StatusIcon = statusIcon;
              const cardBorder = service.status === "up" ? "border-[#39c5bb]/15 hover:border-[#39c5bb]/30" : service.status === "degraded" ? "border-[#fbbf24]/20 hover:border-[#fbbf24]/35" : "border-[#fda4af]/20 hover:border-[#fda4af]/35";
              const iconBg = service.status === "up" ? "bg-[#39c5bb]/10" : service.status === "degraded" ? "bg-[#fbbf24]/10" : "bg-[#fda4af]/10";
              const iconColor = service.status === "up" ? "text-[#39c5bb]" : service.status === "degraded" ? "text-[#fbbf24]" : "text-[#fb7185]";
              return (
                <motion.div
                  key={service.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.55 + index * 0.06 }}
                  whileHover={{ y: -2 }}
                >
                  <Link to={`/services/${service.id}`} className="block group">
                    <Card className={`relative bg-white/80 dark:bg-[#0d1c24]/85 backdrop-blur-sm border ${cardBorder} rounded-xl p-4 transition-all duration-200 shadow-sm group-hover:shadow-md overflow-hidden`}>
                      {service.status === "up" && (
                        <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-[#39c5bb]/30 to-transparent" />
                      )}
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
                          <Server className={`w-4 h-4 ${iconColor}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="relative shrink-0">
                              <div className={`w-2 h-2 rounded-full ${statusDot}`} />
                              {service.status === "up" && <div className="absolute inset-0 w-2 h-2 bg-[#34d399] rounded-full animate-pulse-ring" />}
                            </div>
                            <h3 className="text-xs font-(--font-mono) text-[#3b4563] dark:text-[#d0f4ff] truncate group-hover:text-[#2a3350] dark:group-hover:text-white transition-colors">
                              {service.name}
                            </h3>
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <p className="text-[10px] text-[#b0bdd5] dark:text-[#3a6070] font-(--font-mono)">{service.host}:{service.port}</p>
                            <div className="flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5 text-[#b0bdd5]" />
                              <span className="text-[10px] text-[#b0bdd5] dark:text-[#3a6070]">{service.poll_interval_sec}s</span>
                            </div>
                          </div>
                        </div>
                        <StatusIcon className={`w-4 h-4 shrink-0 ${iconColor} opacity-60 group-hover:opacity-100 transition-opacity`} />
                      </div>
                    </Card>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.9 }}
        className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 py-3 text-[10px] text-[#b0bdd5] dark:text-[#3a6070]"
      >
        <span className="flex items-center gap-1.5">
          <Shield className="w-3 h-3 text-[#34d399]" />
          {totalServices > 0 ? `${healthPercent}% uptime` : "No services monitored"}
        </span>
        <span className="text-[#c4b5fd]">·</span>
        <span className="flex items-center gap-1.5">
          <Zap className="w-3 h-3 text-[#93c5fd]" />
          {totalServices} registered
        </span>
        <span className="text-[#c4b5fd] hidden sm:inline">·</span>
        <span className="hidden sm:flex items-center gap-1.5">
          <Heart className="w-3 h-3 text-[#fda4af]" />
          NanoNet v2.0
        </span>
      </motion.div>
    </div>
  );
}

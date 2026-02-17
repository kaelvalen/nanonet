import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
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
} from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { MiniSparkline } from "../components/MiniSparkline";

const services = [
  {
    id: "auth-service",
    name: "auth-service",
    status: "up",
    cpu: 23,
    memory: "412MB",
    latency: 42,
    trend: "stable",
    sparklineData: [20, 22, 21, 23, 25, 24, 23, 22],
    uptime: 99.9,
  },
  {
    id: "payment-svc",
    name: "payment-service",
    status: "up",
    cpu: 67,
    memory: "890MB",
    latency: 89,
    trend: "up",
    sparklineData: [45, 50, 55, 60, 65, 67, 68, 67],
    uptime: 99.8,
  },
  {
    id: "notification",
    name: "notification-svc",
    status: "down",
    cpu: 0,
    memory: "—",
    latency: 0,
    trend: "down",
    sparklineData: [30, 28, 25, 20, 15, 10, 5, 0],
    uptime: 0,
  },
  {
    id: "user-mgmt",
    name: "user-management",
    status: "up",
    cpu: 45,
    memory: "623MB",
    latency: 56,
    trend: "stable",
    sparklineData: [42, 44, 43, 45, 46, 45, 44, 45],
    uptime: 99.7,
  },
  {
    id: "analytics",
    name: "analytics-engine",
    status: "degraded",
    cpu: 89,
    memory: "1.2GB",
    latency: 234,
    trend: "up",
    sparklineData: [60, 65, 70, 75, 80, 85, 88, 89],
    uptime: 98.2,
  },
  {
    id: "email-svc",
    name: "email-service",
    status: "up",
    cpu: 12,
    memory: "256MB",
    latency: 28,
    trend: "down",
    sparklineData: [20, 18, 16, 14, 13, 12, 12, 12],
    uptime: 99.9,
  },
];

const stats = [
  { label: "Total Services", value: 24, change: "+2", trend: "up", color: "teal" },
  { label: "Active", value: 22, change: "—", trend: "stable", color: "mint" },
  { label: "Alerts", value: 3, change: "+1", trend: "up", color: "pink" },
  { label: "Offline", value: 1, change: "-1", trend: "down", color: "lavender" },
];

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
    stat: "24 Active",
    statSub: "1 offline",
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
    stat: "3 Active",
    statSub: "6 total",
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
    stat: "3 Insights",
    statSub: "1 critical",
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
    stat: "Configured",
    statSub: "all systems",
    statColor: "text-[#3b82f6]",
  },
];

export function DashboardPage() {
  const [isAddServiceOpen, setIsAddServiceOpen] = useState(false);
  const [animatedStats, setAnimatedStats] = useState(
    stats.map((s) => ({ ...s, displayValue: 0 }))
  );
  const navigate = useNavigate();

  useEffect(() => {
    const duration = 1000;
    const steps = 30;
    const interval = duration / steps;
    const timers: NodeJS.Timeout[] = [];

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
  }, []);

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
          <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-[#39c5bb] via-[#93c5fd] to-[#c4b5fd] bg-clip-text text-transparent mb-2 font-[var(--font-quicksand)]">
            Command Center
          </h1>
          {/* Decorative sparkles */}
          <div className="absolute -left-6 top-1/2 -translate-y-1/2 text-[#39c5bb] opacity-40 animate-twinkle">✦</div>
          <div className="absolute -right-6 top-1/2 -translate-y-1/2 text-[#fda4af] opacity-40 animate-twinkle" style={{ animationDelay: "1s" }}>✦</div>
        </div>
        <div className="flex items-center justify-center gap-3 mt-2">
          <div className="w-2 h-2 bg-[#34d399] rounded-full animate-pulse" />
          <p className="text-xs text-[#7c8db5] tracking-wider">
            Real-time Monitoring · All Systems Operational
          </p>
        </div>

        {/* Quick actions hint */}
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
              className={`absolute -inset-0.5 bg-gradient-to-r ${
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
                <p className="text-[10px] text-[#7c8db5] uppercase tracking-wider">
                  {stat.label}
                </p>
                {stat.trend === "up" && <TrendingUp className="w-3 h-3 text-[#059669]" />}
                {stat.trend === "down" && <TrendingDown className="w-3 h-3 text-[#059669]" />}
                {stat.trend === "stable" && <Minus className="w-3 h-3 text-[#7c8db5]" />}
              </div>
              <div className="flex items-end justify-between">
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
                <span
                  className={`text-[10px] font-[var(--font-mono)] ${
                    stat.trend === "up" && (stat.color === "pink" || stat.color === "lavender")
                      ? "text-[#fb7185]"
                      : stat.trend === "down"
                      ? "text-[#059669]"
                      : "text-[#b0bdd5]"
                  }`}
                >
                  {stat.change}
                </span>
              </div>
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
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#39c5bb]/20 to-transparent" />
          <h2 className="text-xs text-[#7c8db5] uppercase tracking-widest flex items-center gap-2">
            <Eye className="w-3 h-3" /> Navigate
          </h2>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#39c5bb]/20 to-transparent" />
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
                  {/* Soft glow */}
                  <div
                    className={`absolute -inset-0.5 bg-gradient-to-r ${card.glowColor} rounded-2xl blur opacity-8 group-hover:opacity-20 transition duration-500`}
                  />

                  <Card
                    className={`relative bg-white/80 backdrop-blur-sm border ${card.borderColor} rounded-2xl p-6 transition-all duration-500 overflow-hidden group-hover:translate-y-[-2px] shadow-sm group-hover:shadow-md`}
                  >
                    {/* Background gradient */}
                    <div
                      className={`absolute inset-0 bg-gradient-to-br ${card.bgGradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
                    />

                    {/* Top shimmer */}
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-current to-transparent opacity-0 group-hover:opacity-20 transition-opacity" style={{ color: card.color }} />

                    <div className="relative z-10">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-12 h-12 rounded-xl flex items-center justify-center border transition-all duration-300 group-hover:scale-110"
                            style={{
                              backgroundColor: `${card.color}12`,
                              borderColor: `${card.color}25`,
                            }}
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
                        <ArrowRight
                          className="w-5 h-5 text-[#b0bdd5] group-hover:text-[#3b4563] group-hover:translate-x-1 transition-all"
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold ${card.statColor}`}>
                            {card.stat}
                          </span>
                          <span className="text-[10px] text-[#b0bdd5]">
                            {card.statSub}
                          </span>
                        </div>
                        {card.pulse && (
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 bg-[#fda4af] rounded-full animate-pulse" />
                            <span className="text-[10px] text-[#e11d48]">Needs attention</span>
                          </div>
                        )}
                      </div>
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
            <div className="h-px w-8 bg-gradient-to-r from-transparent to-[#39c5bb]/20" />
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
                  <DialogDescription className="text-[#7c8db5]">
                    Add a new microservice to monitor
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name" className="text-[#3b4563] text-xs">Service Name *</Label>
                    <Input id="name" placeholder="payment-service" className="bg-[#f5f8ff] border-[#39c5bb]/15 text-[#3b4563] rounded-xl" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="host" className="text-[#3b4563] text-xs">Host / IP *</Label>
                    <Input id="host" placeholder="192.168.1.42" className="bg-[#f5f8ff] border-[#39c5bb]/15 text-[#3b4563] rounded-xl" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="port" className="text-[#3b4563] text-xs">Port *</Label>
                      <Input id="port" placeholder="8080" type="number" className="bg-[#f5f8ff] border-[#39c5bb]/15 text-[#3b4563] rounded-xl" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="endpoint" className="text-[#3b4563] text-xs">Health Endpoint *</Label>
                      <Input id="endpoint" placeholder="/health" className="bg-[#f5f8ff] border-[#39c5bb]/15 text-[#3b4563] rounded-xl" />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddServiceOpen(false)} className="border-[#39c5bb]/20 text-[#3b4563] rounded-xl">
                    Cancel
                  </Button>
                  <Button onClick={() => setIsAddServiceOpen(false)} className="bg-gradient-to-r from-[#39c5bb] to-[#93c5fd] text-white rounded-xl">
                    Deploy
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Link
              to="/services"
              className="text-xs text-[#7c8db5] hover:text-[#39c5bb] transition-colors flex items-center gap-1"
            >
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {services.map((service, index) => (
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
                  {/* Top accent */}
                  {service.status === "up" && (
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#39c5bb]/20 to-transparent" />
                  )}

                  {/* Header */}
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
                        service.status === "up"
                          ? "bg-[#a7f3d0]/30 text-[#059669] border-[#a7f3d0]/50"
                          : ""
                      }`}
                    >
                      {service.status === "up" ? "ON" : service.status === "degraded" ? "DEG" : "OFF"}
                    </Badge>
                  </div>

                  {/* Sparkline */}
                  {service.status !== "down" && (
                    <div className="h-8 mb-2">
                      <MiniSparkline
                        data={service.sparklineData}
                        color={service.status === "up" ? "#39c5bb" : "#fbbf24"}
                        trend={service.trend as "up" | "down" | "stable"}
                      />
                    </div>
                  )}

                  {/* Metrics */}
                  {service.status !== "down" ? (
                    <div className="grid grid-cols-3 gap-1.5">
                      <div className="bg-[#39c5bb]/5 border border-[#39c5bb]/10 rounded-lg px-2 py-1">
                        <p className="text-[9px] text-[#39c5bb]/60">CPU</p>
                        <p className="text-xs font-[var(--font-mono)] text-[#2da89e]">{service.cpu}%</p>
                      </div>
                      <div className="bg-[#c4b5fd]/8 border border-[#c4b5fd]/10 rounded-lg px-2 py-1">
                        <p className="text-[9px] text-[#c4b5fd]/60">MEM</p>
                        <p className="text-xs font-[var(--font-mono)] text-[#7c3aed]">{service.memory}</p>
                      </div>
                      <div className="bg-[#93c5fd]/8 border border-[#93c5fd]/10 rounded-lg px-2 py-1">
                        <p className="text-[9px] text-[#93c5fd]/60">LAT</p>
                        <p className="text-xs font-[var(--font-mono)] text-[#3b82f6]">{service.latency}ms</p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-2">
                      <p className="text-xs text-[#fb7185]/60">Offline</p>
                    </div>
                  )}
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
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
          System Health: 98.7%
        </span>
        <span className="text-[#c4b5fd]">·</span>
        <span>Uptime: 99.97%</span>
        <span className="text-[#c4b5fd]">·</span>
        <span>Latency: 42ms avg</span>
        <span className="text-[#c4b5fd] hidden sm:inline">·</span>
        <span className="hidden sm:inline flex items-center gap-1">
          <Heart className="w-3 h-3 text-[#fda4af]" />
          NanoNet v2.0.1
        </span>
      </motion.div>
    </div>
  );
}

import { useState } from "react";
import { Link } from "react-router";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { motion } from "motion/react";
import { Search, ArrowRight, Server } from "lucide-react";
import { MiniSparkline } from "../components/MiniSparkline";

const services = [
  { id: "auth-service", name: "auth-service", status: "up", cpu: 23, memory: "412MB", latency: 42, uptime: "99.9%", instances: 3, sparklineData: [20, 22, 21, 23, 25, 24, 23, 22] },
  { id: "payment-svc", name: "payment-service", status: "up", cpu: 67, memory: "890MB", latency: 89, uptime: "99.8%", instances: 2, sparklineData: [45, 50, 55, 60, 65, 67, 68, 67] },
  { id: "notification", name: "notification-service", status: "down", cpu: 0, memory: "—", latency: 0, uptime: "0%", instances: 0, sparklineData: [30, 28, 25, 20, 15, 10, 5, 0] },
  { id: "user-mgmt", name: "user-management", status: "up", cpu: 45, memory: "623MB", latency: 56, uptime: "99.7%", instances: 4, sparklineData: [42, 44, 43, 45, 46, 45, 44, 45] },
  { id: "analytics", name: "analytics-engine", status: "degraded", cpu: 89, memory: "1.2GB", latency: 234, uptime: "98.2%", instances: 2, sparklineData: [60, 65, 70, 75, 80, 85, 88, 89] },
  { id: "email-svc", name: "email-service", status: "up", cpu: 12, memory: "256MB", latency: 28, uptime: "99.9%", instances: 2, sparklineData: [20, 18, 16, 14, 13, 12, 12, 12] },
  { id: "order-proc", name: "order-processing", status: "up", cpu: 34, memory: "512MB", latency: 67, uptime: "99.6%", instances: 3, sparklineData: [30, 32, 34, 33, 35, 34, 33, 34] },
  { id: "file-storage", name: "file-storage-api", status: "up", cpu: 56, memory: "789MB", latency: 92, uptime: "99.5%", instances: 2, sparklineData: [50, 52, 55, 54, 56, 55, 56, 56] },
];

export function ServicesPage() {
  const [search, setSearch] = useState("");
  const filtered = services.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div className="relative">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-[#39c5bb] via-[#7eddd3] to-[#93c5fd] bg-clip-text text-transparent">
            Services
          </h1>
          <div className="text-[10px] text-[#7c8db5] mt-1 flex items-center gap-2">
            <Server className="w-3 h-3 text-[#39c5bb]" />
            {services.length} microservices registered
          </div>
        </div>
      </motion.div>

      {/* Search */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7c8db5]" />
        <Input
          placeholder="Search services..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-white/80 border-[#39c5bb]/15 text-[#3b4563] placeholder:text-[#b0bdd5] rounded-xl"
        />
      </motion.div>

      {/* Services List */}
      <div className="space-y-3">
        {filtered.map((service, index) => (
          <motion.div
            key={service.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 + index * 0.05 }}
          >
            <Link to={`/services/${service.id}`} className="block group">
              <Card className={`relative bg-white/80 backdrop-blur-sm p-4 transition-all duration-300 overflow-hidden group-hover:translate-x-1 border rounded-xl shadow-sm group-hover:shadow-md ${
                service.status === "up" ? "border-[#39c5bb]/15 hover:border-[#39c5bb]/30" :
                service.status === "degraded" ? "border-[#fbbf24]/20 hover:border-[#fbbf24]/40" :
                "border-[#fda4af]/20 hover:border-[#fda4af]/40"
              }`}>
                {/* Left accent */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${
                  service.status === "up" ? "bg-[#39c5bb]" :
                  service.status === "degraded" ? "bg-[#fbbf24]" :
                  "bg-[#fb7185]"
                }`} />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    {/* Status + Name */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="relative flex-shrink-0">
                        <div className={`w-2.5 h-2.5 rounded-full ${
                          service.status === "up" ? "bg-[#34d399]" :
                          service.status === "degraded" ? "bg-[#fbbf24]" : "bg-[#fb7185]"
                        }`} />
                        {service.status === "up" && <div className="absolute inset-0 bg-[#34d399] rounded-full animate-pulse-ring" />}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-[var(--font-mono)] text-[#3b4563] truncate group-hover:text-[#2a3350] transition-colors">{service.name}</h3>
                        <div className="flex items-center gap-3 text-[10px] text-[#7c8db5] mt-0.5">
                          <span>Uptime: {service.uptime}</span>
                          <span>·</span>
                          <span>Instances: {service.instances}</span>
                        </div>
                      </div>
                    </div>

                    {/* Sparkline */}
                    {service.status !== "down" && (
                      <div className="hidden md:block w-24 h-8">
                        <MiniSparkline data={service.sparklineData} color={service.status === "up" ? "#39c5bb" : "#fbbf24"} />
                      </div>
                    )}

                    {/* Metrics */}
                    {service.status !== "down" && (
                      <div className="hidden lg:flex items-center gap-4">
                        <div className="text-center">
                          <p className="text-[9px] text-[#39c5bb]/60">CPU</p>
                          <p className="text-xs font-[var(--font-mono)] text-[#2da89e]">{service.cpu}%</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[9px] text-[#c4b5fd]/60">MEM</p>
                          <p className="text-xs font-[var(--font-mono)] text-[#7c3aed]">{service.memory}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[9px] text-[#93c5fd]/60">LAT</p>
                          <p className="text-xs font-[var(--font-mono)] text-[#3b82f6]">{service.latency}ms</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right */}
                  <div className="flex items-center gap-3 ml-4">
                    <Badge
                      variant={service.status === "up" ? "default" : service.status === "degraded" ? "secondary" : "destructive"}
                      className={`text-[10px] font-[var(--font-mono)] rounded-full ${
                        service.status === "up" ? "bg-[#a7f3d0]/30 text-[#059669] border-[#a7f3d0]/50" : ""
                      }`}
                    >
                      {service.status === "up" ? "ONLINE" : service.status === "degraded" ? "DEGRADED" : "OFFLINE"}
                    </Badge>
                    <ArrowRight className="w-4 h-4 text-[#b0bdd5] group-hover:text-[#3b4563] group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

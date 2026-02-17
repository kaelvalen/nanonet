import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { AlertCircle, CheckCircle, Clock, Filter, Bell } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { motion } from "motion/react";

const alerts = [
  { id: 1, service: "payment-service", type: "Latency", message: "Latency > 500ms", status: "active", time: "14:32", severity: "critical" },
  { id: 2, service: "analytics-engine", type: "Memory", message: "Memory usage > 90%", status: "active", time: "14:15", severity: "warning" },
  { id: 3, service: "auth-service", type: "CPU", message: "CPU > 80%", status: "resolved", time: "12:05", severity: "warning" },
  { id: 4, service: "notification-service", type: "Downtime", message: "Service is down", status: "active", time: "11:45", severity: "critical" },
  { id: 5, service: "user-management", type: "Memory", message: "Memory usage > 90%", status: "resolved", time: "10:15", severity: "warning" },
  { id: 6, service: "email-service", type: "Latency", message: "Latency > 200ms", status: "resolved", time: "09:30", severity: "info" },
];

export function AlertsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div className="relative">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-[#fda4af] via-[#fb7185] to-[#c4b5fd] bg-clip-text text-transparent">
            Alerts
          </h1>
          <div className="text-[10px] text-[#7c8db5] mt-1 flex items-center gap-2">
            <Bell className="w-3 h-3 text-[#fda4af]" />
            Real-time incident monitoring
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select defaultValue="all">
            <SelectTrigger className="w-[150px] bg-white/80 border-[#39c5bb]/15 text-[#3b4563] text-xs rounded-xl">
              <Filter className="w-3 h-3 mr-2" />
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent className="bg-white border-[#39c5bb]/15 rounded-xl">
              <SelectItem value="all" className="text-xs text-[#3b4563]">All</SelectItem>
              <SelectItem value="active" className="text-xs text-[#3b4563]">Active</SelectItem>
              <SelectItem value="resolved" className="text-xs text-[#3b4563]">Resolved</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="bg-white/80 backdrop-blur-sm border-[#39c5bb]/10 rounded-xl shadow-sm">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-[#7c8db5] uppercase">Total Alerts</p>
                <p className="text-2xl font-bold text-[#3b4563] mt-1">{alerts.length}</p>
              </div>
              <AlertCircle className="w-6 h-6 text-[#b0bdd5]" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/80 backdrop-blur-sm border-[#fda4af]/15 rounded-xl shadow-sm">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-[#7c8db5] uppercase">Active</p>
                <p className="text-2xl font-bold text-[#fb7185] mt-1">
                  {alerts.filter((a) => a.status === "active").length}
                </p>
              </div>
              <div className="w-3 h-3 bg-[#fb7185] rounded-full animate-pulse" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/80 backdrop-blur-sm border-[#a7f3d0]/20 rounded-xl shadow-sm">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-[#7c8db5] uppercase">Resolved</p>
                <p className="text-2xl font-bold text-[#059669] mt-1">
                  {alerts.filter((a) => a.status === "resolved").length}
                </p>
              </div>
              <CheckCircle className="w-6 h-6 text-[#34d399]/50" />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Alerts List */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
        <Card className="bg-white/80 backdrop-blur-sm border-[#39c5bb]/15 rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm text-[#7c8db5]">All Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alerts.map((alert, index) => (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 + index * 0.05 }}
                  className={`p-4 rounded-xl border transition-all ${
                    alert.status === "active"
                      ? alert.severity === "critical"
                        ? "bg-[#fda4af]/5 border-[#fda4af]/15"
                        : "bg-[#fef3c7]/30 border-[#fcd34d]/15"
                      : "bg-[#f5f8ff] border-[#39c5bb]/10"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      {alert.status === "active" ? (
                        alert.severity === "critical" ? (
                          <AlertCircle className="w-4 h-4 text-[#fb7185] mt-0.5 flex-shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-[#fbbf24] mt-0.5 flex-shrink-0" />
                        )
                      ) : (
                        <CheckCircle className="w-4 h-4 text-[#34d399] mt-0.5 flex-shrink-0" />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-[#3b4563] text-sm">{alert.service}</h3>
                          <Badge variant="outline" className="text-[10px] border-[#39c5bb]/15 text-[#7c8db5] rounded-full">
                            {alert.type}
                          </Badge>
                        </div>
                        <p className="text-xs text-[#7c8db5]">{alert.message}</p>
                        <div className="flex items-center gap-2 mt-2 text-[10px] text-[#b0bdd5] font-[var(--font-mono)]">
                          <Clock className="w-3 h-3" />
                          <span>{alert.time}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {alert.status === "active" ? (
                        <>
                          <Badge className={`text-[10px] rounded-full ${
                            alert.severity === "critical"
                              ? "bg-[#fda4af]/20 text-[#e11d48] border-[#fda4af]/30"
                              : "bg-[#fef3c7]/50 text-[#d97706] border-[#fcd34d]/30"
                          }`}>
                            ACTIVE
                          </Badge>
                          <Button variant="outline" size="sm" className="border-[#39c5bb]/20 text-[#3b4563] text-[10px] h-7 px-2 rounded-xl">
                            RESOLVE
                          </Button>
                        </>
                      ) : (
                        <Badge className="bg-[#a7f3d0]/30 text-[#059669] border-[#a7f3d0]/50 text-[10px] rounded-full">
                          RESOLVED
                        </Badge>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

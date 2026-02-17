import { useParams } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { RotateCw, StopCircle, AlertTriangle, CheckCircle, Clock, Activity, Terminal } from "lucide-react";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { motion } from "motion/react";

const cpuData = [
  { time: "14:20", value: 23 },
  { time: "14:25", value: 28 },
  { time: "14:30", value: 45 },
  { time: "14:35", value: 67 },
  { time: "14:40", value: 72 },
  { time: "14:45", value: 58 },
  { time: "14:50", value: 42 },
];

const memoryData = [
  { time: "14:20", value: 380 },
  { time: "14:25", value: 395 },
  { time: "14:30", value: 420 },
  { time: "14:35", value: 450 },
  { time: "14:40", value: 480 },
  { time: "14:45", value: 460 },
  { time: "14:50", value: 412 },
];

const latencyData = [
  { time: "14:20", value: 42 },
  { time: "14:25", value: 45 },
  { time: "14:30", value: 89 },
  { time: "14:35", value: 456 },
  { time: "14:40", value: 523 },
  { time: "14:45", value: 234 },
  { time: "14:50", value: 89 },
];

const alerts = [
  { time: "14:32", type: "Latency", message: "Latency > 500ms", status: "active" },
  { time: "12:05", type: "CPU", message: "CPU > 80%", status: "resolved" },
  { time: "10:15", type: "Memory", message: "Memory > 90%", status: "resolved" },
];

const customTooltipStyle = {
  backgroundColor: "rgba(255, 255, 255, 0.95)",
  border: "1px solid rgba(57, 197, 187, 0.2)",
  borderRadius: "12px",
  fontSize: "12px",
  color: "#3b4563",
  backdropFilter: "blur(8px)",
  boxShadow: "0 4px 12px rgba(57, 197, 187, 0.08)",
};

export function ServiceDetailPage() {
  const { serviceId } = useParams();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-[#39c5bb] to-[#93c5fd] bg-clip-text text-transparent">
              {serviceId}
            </h1>
            <Badge className="bg-[#a7f3d0]/30 text-[#059669] border-[#a7f3d0]/50 font-[var(--font-mono)] text-[10px] rounded-full">ONLINE</Badge>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-2 h-2 bg-[#34d399] rounded-full animate-pulse" />
            <span className="text-xs text-[#7c8db5]">Connected · Last ping 2s ago</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2 border-[#39c5bb]/20 text-[#3b4563] hover:text-[#39c5bb] hover:border-[#39c5bb]/40 text-xs rounded-xl">
            <RotateCw className="w-4 h-4" />
            Restart
          </Button>
          <Button variant="outline" className="gap-2 border-[#fda4af]/30 text-[#fb7185] hover:bg-[#fda4af]/10 text-xs rounded-xl">
            <StopCircle className="w-4 h-4" />
            Stop
          </Button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Info Sidebar */}
        <Card className="lg:col-span-1 bg-white/80 backdrop-blur-sm border-[#39c5bb]/15 rounded-xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-[#3b4563] text-sm flex items-center gap-2">
              <Terminal className="w-4 h-4 text-[#39c5bb]" />
              Service Info
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-[10px] text-[#7c8db5] uppercase">Status</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-2 h-2 bg-[#34d399] rounded-full animate-pulse" />
                <span className="text-sm font-[var(--font-mono)] text-[#059669]">UP</span>
              </div>
            </div>
            <Separator className="bg-[#39c5bb]/10" />
            <div>
              <p className="text-[10px] text-[#7c8db5] uppercase">Host</p>
              <p className="text-sm font-[var(--font-mono)] text-[#3b4563] mt-1">192.168.1.42</p>
            </div>
            <div>
              <p className="text-[10px] text-[#7c8db5] uppercase">Port</p>
              <p className="text-sm font-[var(--font-mono)] text-[#3b4563] mt-1">8080</p>
            </div>
            <div>
              <p className="text-[10px] text-[#7c8db5] uppercase">Endpoint</p>
              <p className="text-sm font-[var(--font-mono)] text-[#39c5bb] mt-1">/health</p>
            </div>
            <Separator className="bg-[#39c5bb]/10" />
            <div>
              <p className="text-[10px] text-[#7c8db5] uppercase">Uptime</p>
              <p className="text-sm font-[var(--font-mono)] text-[#059669] mt-1">99.8%</p>
            </div>
            <div>
              <p className="text-[10px] text-[#7c8db5] uppercase">Agent</p>
              <Badge className="mt-1 bg-[#a7f3d0]/30 text-[#059669] border-[#a7f3d0]/50 font-[var(--font-mono)] text-[10px] rounded-full">CONNECTED</Badge>
            </div>
            <div>
              <p className="text-[10px] text-[#7c8db5] uppercase">Last Update</p>
              <p className="text-sm font-[var(--font-mono)] text-[#3b4563] mt-1">2 seconds ago</p>
            </div>
            <Button variant="outline" className="w-full mt-4 border-[#39c5bb]/20 text-[#3b4563] hover:text-[#39c5bb] hover:border-[#39c5bb]/40 text-xs rounded-xl">
              Edit Config
            </Button>
          </CardContent>
        </Card>

        {/* Metrics */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="1h">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm text-[#7c8db5] flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#39c5bb]" />
                Live Metrics
              </h2>
              <TabsList className="bg-white/80 border border-[#39c5bb]/15 rounded-xl">
                <TabsTrigger value="1h" className="text-xs data-[state=active]:bg-[#39c5bb]/10 data-[state=active]:text-[#2da89e] rounded-lg">1h</TabsTrigger>
                <TabsTrigger value="6h" className="text-xs data-[state=active]:bg-[#39c5bb]/10 data-[state=active]:text-[#2da89e] rounded-lg">6h</TabsTrigger>
                <TabsTrigger value="24h" className="text-xs data-[state=active]:bg-[#39c5bb]/10 data-[state=active]:text-[#2da89e] rounded-lg">24h</TabsTrigger>
                <TabsTrigger value="7d" className="text-xs data-[state=active]:bg-[#39c5bb]/10 data-[state=active]:text-[#2da89e] rounded-lg">7d</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="1h" className="space-y-6 mt-0">
              {/* CPU Chart */}
              <Card className="bg-white/80 backdrop-blur-sm border-[#39c5bb]/15 rounded-xl shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-[#39c5bb]">CPU Usage</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={cpuData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(57, 197, 187, 0.08)" />
                      <XAxis dataKey="time" stroke="#b0bdd5" style={{ fontSize: "10px" }} />
                      <YAxis stroke="#b0bdd5" style={{ fontSize: "10px" }} />
                      <Tooltip contentStyle={customTooltipStyle} />
                      <Line type="monotone" dataKey="value" stroke="#39c5bb" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Memory Chart */}
              <Card className="bg-white/80 backdrop-blur-sm border-[#c4b5fd]/15 rounded-xl shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-[#8b5cf6]">Memory Usage</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={memoryData}>
                      <defs>
                        <linearGradient id="colorMemoryPastel" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#c4b5fd" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#c4b5fd" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(196, 181, 253, 0.08)" />
                      <XAxis dataKey="time" stroke="#b0bdd5" style={{ fontSize: "10px" }} />
                      <YAxis stroke="#b0bdd5" style={{ fontSize: "10px" }} />
                      <Tooltip contentStyle={customTooltipStyle} />
                      <Area type="monotone" dataKey="value" stroke="#c4b5fd" strokeWidth={2} fillOpacity={1} fill="url(#colorMemoryPastel)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Latency Chart */}
              <Card className="bg-white/80 backdrop-blur-sm border-[#fda4af]/15 rounded-xl shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-[#fb7185]">Latency</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={latencyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(253, 164, 175, 0.08)" />
                      <XAxis dataKey="time" stroke="#b0bdd5" style={{ fontSize: "10px" }} />
                      <YAxis stroke="#b0bdd5" style={{ fontSize: "10px" }} />
                      <Tooltip contentStyle={customTooltipStyle} />
                      <Line type="monotone" dataKey="value" stroke="#fda4af" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* AI Insights */}
      <Card className="bg-white/80 backdrop-blur-sm border-[#fda4af]/15 overflow-hidden rounded-xl shadow-sm">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#fda4af]/20 to-transparent" />
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <AlertTriangle className="w-4 h-4 text-[#fbbf24]" />
            <span className="text-[#d97706]">AI Insights</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-[#3b4563]">
            <span className="text-[#d97706] font-semibold">Anomaly Detected</span> — Latency increased by 340% since 14:32
          </p>
          <p className="text-xs text-[#7c8db5]">
            Possible cause: Correlation with auth-service timeouts
          </p>
          <div className="space-y-2">
            <p className="text-xs text-[#7c8db5]">Recommendations:</p>
            <ul className="text-xs text-[#3b4563] space-y-1">
              <li className="flex items-start gap-2">
                <span className="text-[#39c5bb]">✦</span>
                Inspect auth-service logs between 14:30-14:35
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#39c5bb]">✦</span>
                Consider restarting payment-service
              </li>
            </ul>
          </div>
          <div className="flex items-center gap-4 pt-2 border-t border-[#39c5bb]/10">
            <Button variant="outline" size="sm" className="border-[#39c5bb]/20 text-[#3b4563] text-xs rounded-xl">Details</Button>
            <Button variant="outline" size="sm" className="border-[#39c5bb]/20 text-[#3b4563] text-xs rounded-xl">Restart</Button>
            <span className="text-[10px] text-[#8b5cf6] ml-auto">Confidence: 82%</span>
          </div>
        </CardContent>
      </Card>

      {/* Alerts History */}
      <Card className="bg-white/80 backdrop-blur-sm border-[#39c5bb]/15 rounded-xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm text-[#7c8db5]">Alert History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {alerts.map((alert, index) => (
              <div
                key={index}
                className={`flex items-center justify-between p-3 rounded-xl border ${
                  alert.status === "active"
                    ? "bg-[#fda4af]/5 border-[#fda4af]/15"
                    : "bg-[#f5f8ff] border-[#39c5bb]/10"
                }`}
              >
                <div className="flex items-center gap-4">
                  <Clock className="w-4 h-4 text-[#7c8db5]" />
                  <div>
                    <p className="text-sm text-[#3b4563]">{alert.message}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] text-[#7c8db5] font-[var(--font-mono)]">{alert.time}</span>
                      <Badge variant="outline" className="text-[10px] border-[#39c5bb]/20 text-[#7c8db5] rounded-full">{alert.type}</Badge>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {alert.status === "active" ? (
                    <>
                      <div className="w-2 h-2 bg-[#fb7185] rounded-full animate-pulse" />
                      <span className="text-xs text-[#fb7185]">Active</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 text-[#34d399]" />
                      <span className="text-xs text-[#059669]">Resolved</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

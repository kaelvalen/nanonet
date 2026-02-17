import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";
import { TrendingUp, TrendingDown, Activity, Zap, Database, Network } from "lucide-react";

const performanceData = [
  { time: "00:00", cpu: 45, memory: 62, network: 32 },
  { time: "02:00", cpu: 42, memory: 58, network: 28 },
  { time: "04:00", cpu: 52, memory: 64, network: 35 },
  { time: "06:00", cpu: 48, memory: 60, network: 30 },
  { time: "08:00", cpu: 68, memory: 72, network: 48 },
  { time: "10:00", cpu: 72, memory: 75, network: 52 },
  { time: "12:00", cpu: 75, memory: 78, network: 55 },
  { time: "14:00", cpu: 70, memory: 74, network: 50 },
  { time: "16:00", cpu: 58, memory: 68, network: 42 },
  { time: "18:00", cpu: 55, memory: 65, network: 38 },
  { time: "20:00", cpu: 46, memory: 60, network: 32 },
  { time: "22:00", cpu: 44, memory: 58, network: 30 },
];

const responseTimeData = [
  { service: "Auth", avgTime: 42, p95: 85, p99: 120 },
  { service: "Payment", avgTime: 156, p95: 280, p99: 450 },
  { service: "User", avgTime: 89, p95: 165, p99: 240 },
  { service: "Order", avgTime: 64, p95: 125, p99: 180 },
  { service: "Notification", avgTime: 28, p95: 55, p99: 85 },
  { service: "Analytics", avgTime: 234, p95: 450, p99: 650 },
];

const throughputData = [
  { hour: "00", requests: 1200, errors: 12 },
  { hour: "02", requests: 800, errors: 8 },
  { hour: "04", requests: 600, errors: 5 },
  { hour: "06", requests: 1100, errors: 10 },
  { hour: "08", requests: 2400, errors: 18 },
  { hour: "10", requests: 2800, errors: 22 },
  { hour: "12", requests: 3200, errors: 28 },
  { hour: "14", requests: 3000, errors: 25 },
  { hour: "16", requests: 2800, errors: 20 },
  { hour: "18", requests: 2400, errors: 18 },
  { hour: "20", requests: 1600, errors: 12 },
  { hour: "22", requests: 1400, errors: 10 },
];

const serviceHealthData = [
  { metric: "Uptime", value: 98 },
  { metric: "Performance", value: 92 },
  { metric: "Security", value: 95 },
  { metric: "Reliability", value: 88 },
  { metric: "Scalability", value: 85 },
];

export function Metrics() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-600 to-pink-600 bg-clip-text text-transparent">
          Metrikler
        </h1>
        <p className="text-gray-600 mt-1">Detaylı performans analizi ve metrikler</p>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-cyan-50 to-cyan-100 border-cyan-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-cyan-700">Ortalama Yanıt</CardTitle>
            <Activity className="w-4 h-4 text-cyan-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-cyan-900">89ms</div>
            <div className="flex items-center gap-1 text-xs text-emerald-600 mt-1">
              <TrendingDown className="w-3 h-3" />
              <span>%12 daha hızlı</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-pink-50 to-pink-100 border-pink-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-pink-700">İstek Sayısı</CardTitle>
            <Zap className="w-4 h-4 text-pink-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-pink-900">2.4M</div>
            <div className="flex items-center gap-1 text-xs text-emerald-600 mt-1">
              <TrendingUp className="w-3 h-3" />
              <span>%18 artış</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-700">Hata Oranı</CardTitle>
            <Database className="w-4 h-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-900">0.68%</div>
            <div className="flex items-center gap-1 text-xs text-emerald-600 mt-1">
              <TrendingDown className="w-3 h-3" />
              <span>%5 azalma</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-700">Network I/O</CardTitle>
            <Network className="w-4 h-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-900">42GB</div>
            <div className="flex items-center gap-1 text-xs text-blue-600 mt-1">
              <TrendingUp className="w-3 h-3" />
              <span>Son 24 saat</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList className="bg-white/60 backdrop-blur-lg border border-cyan-200">
          <TabsTrigger value="performance">Performans</TabsTrigger>
          <TabsTrigger value="response">Yanıt Süresi</TabsTrigger>
          <TabsTrigger value="throughput">Throughput</TabsTrigger>
          <TabsTrigger value="health">Sağlık</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4">
          <Card className="bg-white/60 backdrop-blur-lg border-cyan-200">
            <CardHeader>
              <CardTitle className="text-cyan-900">Sistem Performansı (24 Saat)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0f2fe" />
                  <XAxis dataKey="time" stroke="#0e7490" />
                  <YAxis stroke="#0e7490" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.9)',
                      border: '1px solid #a5f3fc',
                      borderRadius: '8px'
                    }}
                  />
                  <Line type="monotone" dataKey="cpu" stroke="#06b6d4" strokeWidth={2} name="CPU %" />
                  <Line type="monotone" dataKey="memory" stroke="#ec4899" strokeWidth={2} name="Memory %" />
                  <Line type="monotone" dataKey="network" stroke="#8b5cf6" strokeWidth={2} name="Network %" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="response" className="space-y-4">
          <Card className="bg-white/60 backdrop-blur-lg border-pink-200">
            <CardHeader>
              <CardTitle className="text-pink-900">Servis Yanıt Süreleri (ms)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={responseTimeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#fce7f3" />
                  <XAxis dataKey="service" stroke="#be185d" />
                  <YAxis stroke="#be185d" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.9)',
                      border: '1px solid #fbcfe8',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="avgTime" fill="#06b6d4" radius={[4, 4, 0, 0]} name="Ortalama" />
                  <Bar dataKey="p95" fill="#ec4899" radius={[4, 4, 0, 0]} name="P95" />
                  <Bar dataKey="p99" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="P99" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="throughput" className="space-y-4">
          <Card className="bg-white/60 backdrop-blur-lg border-purple-200">
            <CardHeader>
              <CardTitle className="text-purple-900">İstek ve Hata Dağılımı</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={throughputData}>
                  <defs>
                    <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorErrors" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3e8ff" />
                  <XAxis dataKey="hour" stroke="#7c3aed" />
                  <YAxis stroke="#7c3aed" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.9)',
                      border: '1px solid #e9d5ff',
                      borderRadius: '8px'
                    }}
                  />
                  <Area type="monotone" dataKey="requests" stroke="#06b6d4" fillOpacity={1} fill="url(#colorRequests)" name="İstekler" />
                  <Area type="monotone" dataKey="errors" stroke="#ef4444" fillOpacity={1} fill="url(#colorErrors)" name="Hatalar" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="health" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-white/60 backdrop-blur-lg border-blue-200">
              <CardHeader>
                <CardTitle className="text-blue-900">Servis Sağlık Skoru</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <RadarChart data={serviceHealthData}>
                    <PolarGrid stroke="#bfdbfe" />
                    <PolarAngleAxis dataKey="metric" stroke="#1e40af" />
                    <PolarRadiusAxis stroke="#1e40af" />
                    <Radar name="Score" dataKey="value" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.6} />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="bg-white/60 backdrop-blur-lg border-cyan-200">
              <CardHeader>
                <CardTitle className="text-cyan-900">Sağlık Detayları</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {serviceHealthData.map((item, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">{item.metric}</span>
                      <Badge
                        variant={item.value >= 90 ? "default" : item.value >= 80 ? "secondary" : "destructive"}
                        className={item.value >= 90 ? "bg-emerald-500" : ""}
                      >
                        {item.value}%
                      </Badge>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          item.value >= 90
                            ? "bg-gradient-to-r from-cyan-400 to-emerald-400"
                            : item.value >= 80
                            ? "bg-gradient-to-r from-cyan-400 to-amber-400"
                            : "bg-gradient-to-r from-rose-400 to-pink-400"
                        }`}
                        style={{ width: `${item.value}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

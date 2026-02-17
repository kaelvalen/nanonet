import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Activity, Server, Zap, AlertCircle, TrendingUp, Clock } from "lucide-react";
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const cpuData = [
  { time: "00:00", value: 45 },
  { time: "04:00", value: 52 },
  { time: "08:00", value: 68 },
  { time: "12:00", value: 72 },
  { time: "16:00", value: 58 },
  { time: "20:00", value: 46 },
];

const requestData = [
  { time: "00:00", requests: 1200 },
  { time: "04:00", requests: 800 },
  { time: "08:00", requests: 2400 },
  { time: "12:00", requests: 3200 },
  { time: "16:00", requests: 2800 },
  { time: "20:00", requests: 1600 },
];

const serviceDistribution = [
  { name: "Auth API", value: 32, color: "#06b6d4" },
  { name: "Payment API", value: 24, color: "#ec4899" },
  { name: "User API", value: 18, color: "#8b5cf6" },
  { name: "Order API", value: 26, color: "#14b8a6" },
];

const services = [
  { name: "Auth Service", status: "healthy", uptime: "99.9%", requests: "12.4K", latency: "42ms" },
  { name: "Payment Gateway", status: "healthy", uptime: "99.8%", requests: "8.2K", latency: "156ms" },
  { name: "User Management", status: "warning", uptime: "98.5%", requests: "15.3K", latency: "89ms" },
  { name: "Order Processing", status: "healthy", uptime: "99.7%", requests: "10.1K", latency: "64ms" },
  { name: "Notification Service", status: "healthy", uptime: "99.9%", requests: "5.8K", latency: "28ms" },
  { name: "Analytics Engine", status: "error", uptime: "92.3%", requests: "3.2K", latency: "234ms" },
];

export function Dashboard() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-600 to-pink-600 bg-clip-text text-transparent">
            Dashboard
          </h1>
          <p className="text-gray-600 mt-1">Sistem durumu ve performans metrikleri</p>
        </div>
        <div className="flex items-center gap-2 bg-white/60 backdrop-blur-lg px-4 py-2 rounded-xl border border-cyan-200">
          <Clock className="w-4 h-4 text-cyan-600" />
          <span className="text-sm text-gray-600">Son güncelleme: 2 saniye önce</span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-cyan-50 to-cyan-100 border-cyan-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-cyan-700">Toplam Servis</CardTitle>
            <Server className="w-4 h-4 text-cyan-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-cyan-900">24</div>
            <p className="text-xs text-cyan-600 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              +2 bu hafta
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-pink-50 to-pink-100 border-pink-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-pink-700">Aktif Servis</CardTitle>
            <Activity className="w-4 h-4 text-pink-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-pink-900">22</div>
            <p className="text-xs text-pink-600 mt-1">%91.7 uptime</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-700">İstekler/sn</CardTitle>
            <Zap className="w-4 h-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-900">1.2K</div>
            <p className="text-xs text-purple-600 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              +12% son 1 saat
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-rose-50 to-rose-100 border-rose-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-rose-700">Hatalar</CardTitle>
            <AlertCircle className="w-4 h-4 text-rose-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-rose-900">3</div>
            <p className="text-xs text-rose-600 mt-1">2 kritik, 1 uyarı</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-white/60 backdrop-blur-lg border-cyan-200">
          <CardHeader>
            <CardTitle className="text-cyan-900">CPU Kullanımı</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={cpuData}>
                <defs>
                  <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                  </linearGradient>
                </defs>
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
                <Area type="monotone" dataKey="value" stroke="#06b6d4" fillOpacity={1} fill="url(#colorCpu)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-white/60 backdrop-blur-lg border-pink-200">
          <CardHeader>
            <CardTitle className="text-pink-900">İstek Dağılımı</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={requestData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#fce7f3" />
                <XAxis dataKey="time" stroke="#be185d" />
                <YAxis stroke="#be185d" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.9)', 
                    border: '1px solid #fbcfe8',
                    borderRadius: '8px'
                  }}
                />
                <Bar dataKey="requests" fill="#ec4899" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Service Status and Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-white/60 backdrop-blur-lg border-cyan-200">
          <CardHeader>
            <CardTitle className="text-cyan-900">Servis Durumu</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {services.map((service, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-cyan-50 to-blue-50 hover:from-cyan-100 hover:to-blue-100 transition-all duration-300 border border-cyan-200"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-3 h-3 rounded-full ${
                      service.status === 'healthy' ? 'bg-emerald-400 shadow-lg shadow-emerald-200' :
                      service.status === 'warning' ? 'bg-amber-400 shadow-lg shadow-amber-200' :
                      'bg-rose-400 shadow-lg shadow-rose-200'
                    }`}></div>
                    <div>
                      <p className="font-medium text-gray-900">{service.name}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-gray-600">Uptime: {service.uptime}</span>
                        <span className="text-xs text-gray-600">Latency: {service.latency}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={service.status === 'healthy' ? 'default' : service.status === 'warning' ? 'secondary' : 'destructive'}>
                      {service.status === 'healthy' ? 'Sağlıklı' : service.status === 'warning' ? 'Uyarı' : 'Hata'}
                    </Badge>
                    <p className="text-sm text-gray-600 mt-1">{service.requests} istek</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/60 backdrop-blur-lg border-pink-200">
          <CardHeader>
            <CardTitle className="text-pink-900">Trafik Dağılımı</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={serviceDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="value"
                >
                  {serviceDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2">
              {serviceDistribution.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                    <span className="text-sm text-gray-700">{item.name}</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">{item.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

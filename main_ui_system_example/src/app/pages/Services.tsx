import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Search, Server, Play, Pause, RotateCw, Trash2, Settings, Activity } from "lucide-react";

const allServices = [
  {
    id: 1,
    name: "Auth Service",
    status: "running",
    health: "healthy",
    version: "v2.4.1",
    instances: 3,
    memory: "256MB",
    cpu: "12%",
    uptime: "15d 8h",
    port: 8001,
  },
  {
    id: 2,
    name: "Payment Gateway",
    status: "running",
    health: "healthy",
    version: "v1.8.3",
    instances: 2,
    memory: "512MB",
    cpu: "34%",
    uptime: "8d 12h",
    port: 8002,
  },
  {
    id: 3,
    name: "User Management",
    status: "running",
    health: "warning",
    version: "v3.1.0",
    instances: 4,
    memory: "384MB",
    cpu: "28%",
    uptime: "22d 3h",
    port: 8003,
  },
  {
    id: 4,
    name: "Order Processing",
    status: "running",
    health: "healthy",
    version: "v2.0.5",
    instances: 3,
    memory: "448MB",
    cpu: "19%",
    uptime: "12d 15h",
    port: 8004,
  },
  {
    id: 5,
    name: "Notification Service",
    status: "running",
    health: "healthy",
    version: "v1.5.2",
    instances: 2,
    memory: "192MB",
    cpu: "8%",
    uptime: "30d 1h",
    port: 8005,
  },
  {
    id: 6,
    name: "Analytics Engine",
    status: "stopped",
    health: "error",
    version: "v4.2.0",
    instances: 0,
    memory: "0MB",
    cpu: "0%",
    uptime: "0h",
    port: 8006,
  },
  {
    id: 7,
    name: "File Storage API",
    status: "running",
    health: "healthy",
    version: "v2.1.4",
    instances: 3,
    memory: "640MB",
    cpu: "45%",
    uptime: "18d 7h",
    port: 8007,
  },
  {
    id: 8,
    name: "Email Service",
    status: "running",
    health: "healthy",
    version: "v1.9.1",
    instances: 2,
    memory: "128MB",
    cpu: "5%",
    uptime: "25d 11h",
    port: 8008,
  },
];

export function Services() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "running" | "stopped">("all");

  const filteredServices = allServices.filter((service) => {
    const matchesSearch = service.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filter === "all" || service.status === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-600 to-pink-600 bg-clip-text text-transparent">
          Mikroservisler
        </h1>
        <p className="text-gray-600 mt-1">Tüm servislerinizi yönetin ve izleyin</p>
      </div>

      {/* Filters */}
      <Card className="bg-white/60 backdrop-blur-lg border-cyan-200">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Servis ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white border-cyan-200 focus:border-cyan-400"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={filter === "all" ? "default" : "outline"}
                onClick={() => setFilter("all")}
                className={filter === "all" ? "bg-gradient-to-r from-cyan-500 to-pink-500" : ""}
              >
                Tümü
              </Button>
              <Button
                variant={filter === "running" ? "default" : "outline"}
                onClick={() => setFilter("running")}
                className={filter === "running" ? "bg-gradient-to-r from-cyan-500 to-pink-500" : ""}
              >
                Çalışıyor
              </Button>
              <Button
                variant={filter === "stopped" ? "default" : "outline"}
                onClick={() => setFilter("stopped")}
                className={filter === "stopped" ? "bg-gradient-to-r from-cyan-500 to-pink-500" : ""}
              >
                Durduruldu
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Services Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredServices.map((service) => (
          <Card
            key={service.id}
            className="bg-gradient-to-br from-white/80 to-cyan-50/80 backdrop-blur-lg border-cyan-200 hover:border-pink-300 transition-all duration-300 hover:shadow-xl"
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    service.status === 'running' 
                      ? 'bg-gradient-to-br from-cyan-400 to-blue-500' 
                      : 'bg-gradient-to-br from-gray-300 to-gray-400'
                  }`}>
                    <Server className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{service.name}</CardTitle>
                    <p className="text-sm text-gray-600">Port: {service.port}</p>
                  </div>
                </div>
                <Badge
                  variant={service.health === "healthy" ? "default" : service.health === "warning" ? "secondary" : "destructive"}
                  className={service.health === "healthy" ? "bg-emerald-500" : ""}
                >
                  {service.health === "healthy" ? "Sağlıklı" : service.health === "warning" ? "Uyarı" : "Hata"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white/50 rounded-lg p-3 border border-cyan-200">
                  <p className="text-xs text-gray-600">İnstanslar</p>
                  <p className="text-lg font-bold text-cyan-700">{service.instances}</p>
                </div>
                <div className="bg-white/50 rounded-lg p-3 border border-cyan-200">
                  <p className="text-xs text-gray-600">Memory</p>
                  <p className="text-lg font-bold text-cyan-700">{service.memory}</p>
                </div>
                <div className="bg-white/50 rounded-lg p-3 border border-cyan-200">
                  <p className="text-xs text-gray-600">CPU</p>
                  <p className="text-lg font-bold text-cyan-700">{service.cpu}</p>
                </div>
                <div className="bg-white/50 rounded-lg p-3 border border-cyan-200">
                  <p className="text-xs text-gray-600">Uptime</p>
                  <p className="text-lg font-bold text-cyan-700">{service.uptime}</p>
                </div>
              </div>

              {/* Version */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Versiyon:</span>
                <Badge variant="outline" className="border-cyan-300">
                  {service.version}
                </Badge>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                {service.status === "running" ? (
                  <Button size="sm" variant="outline" className="flex-1 border-amber-300 hover:bg-amber-50">
                    <Pause className="w-4 h-4 mr-2" />
                    Durdur
                  </Button>
                ) : (
                  <Button size="sm" className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600">
                    <Play className="w-4 h-4 mr-2" />
                    Başlat
                  </Button>
                )}
                <Button size="sm" variant="outline" className="border-cyan-300 hover:bg-cyan-50">
                  <RotateCw className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="outline" className="border-cyan-300 hover:bg-cyan-50">
                  <Settings className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="outline" className="border-rose-300 hover:bg-rose-50">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredServices.length === 0 && (
        <Card className="bg-white/60 backdrop-blur-lg border-cyan-200">
          <CardContent className="py-12 text-center">
            <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Servis bulunamadı</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

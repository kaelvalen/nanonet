import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Search, Filter, Download, AlertCircle, Info, CheckCircle, XCircle } from "lucide-react";

const logEntries = [
  {
    id: 1,
    timestamp: "2026-02-17 14:23:45",
    service: "Auth Service",
    level: "info",
    message: "User authentication successful",
    userId: "user_12345",
  },
  {
    id: 2,
    timestamp: "2026-02-17 14:23:42",
    service: "Payment Gateway",
    level: "success",
    message: "Payment processed successfully",
    amount: "$129.99",
  },
  {
    id: 3,
    timestamp: "2026-02-17 14:23:38",
    service: "User Management",
    level: "warning",
    message: "High memory usage detected",
    memory: "384MB / 512MB",
  },
  {
    id: 4,
    timestamp: "2026-02-17 14:23:35",
    service: "Order Processing",
    level: "info",
    message: "New order created",
    orderId: "ORD-98765",
  },
  {
    id: 5,
    timestamp: "2026-02-17 14:23:30",
    service: "Analytics Engine",
    level: "error",
    message: "Database connection failed",
    error: "ECONNREFUSED",
  },
  {
    id: 6,
    timestamp: "2026-02-17 14:23:28",
    service: "Notification Service",
    level: "success",
    message: "Email notification sent",
    recipient: "user@example.com",
  },
  {
    id: 7,
    timestamp: "2026-02-17 14:23:25",
    service: "Auth Service",
    level: "warning",
    message: "Multiple failed login attempts detected",
    attempts: "5",
  },
  {
    id: 8,
    timestamp: "2026-02-17 14:23:20",
    service: "File Storage API",
    level: "info",
    message: "File uploaded successfully",
    fileSize: "2.4MB",
  },
  {
    id: 9,
    timestamp: "2026-02-17 14:23:15",
    service: "Payment Gateway",
    level: "error",
    message: "Payment validation failed",
    reason: "Invalid card number",
  },
  {
    id: 10,
    timestamp: "2026-02-17 14:23:10",
    service: "Order Processing",
    level: "success",
    message: "Order shipped",
    trackingId: "TRK-45678",
  },
];

export function Logs() {
  const [searchQuery, setSearchQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [serviceFilter, setServiceFilter] = useState<string>("all");

  const filteredLogs = logEntries.filter((log) => {
    const matchesSearch =
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.service.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesLevel = levelFilter === "all" || log.level === levelFilter;
    const matchesService = serviceFilter === "all" || log.service === serviceFilter;
    return matchesSearch && matchesLevel && matchesService;
  });

  const getLevelIcon = (level: string) => {
    switch (level) {
      case "error":
        return <XCircle className="w-4 h-4" />;
      case "warning":
        return <AlertCircle className="w-4 h-4" />;
      case "success":
        return <CheckCircle className="w-4 h-4" />;
      default:
        return <Info className="w-4 h-4" />;
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case "error":
        return "from-rose-50 to-rose-100 border-rose-200 text-rose-700";
      case "warning":
        return "from-amber-50 to-amber-100 border-amber-200 text-amber-700";
      case "success":
        return "from-emerald-50 to-emerald-100 border-emerald-200 text-emerald-700";
      default:
        return "from-blue-50 to-blue-100 border-blue-200 text-blue-700";
    }
  };

  const services = Array.from(new Set(logEntries.map((log) => log.service)));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-600 to-pink-600 bg-clip-text text-transparent">
            Loglar
          </h1>
          <p className="text-gray-600 mt-1">Sistem loglarını görüntüleyin ve filtreleyin</p>
        </div>
        <Button className="bg-gradient-to-r from-cyan-500 to-pink-500 hover:from-cyan-600 hover:to-pink-600">
          <Download className="w-4 h-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Filters */}
      <Card className="bg-white/60 backdrop-blur-lg border-cyan-200">
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Log ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white border-cyan-200 focus:border-cyan-400"
              />
            </div>
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="w-full lg:w-[180px] bg-white border-cyan-200">
                <SelectValue placeholder="Seviye" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Seviyeler</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
            <Select value={serviceFilter} onValueChange={setServiceFilter}>
              <SelectTrigger className="w-full lg:w-[200px] bg-white border-cyan-200">
                <SelectValue placeholder="Servis" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tüm Servisler</SelectItem>
                {services.map((service) => (
                  <SelectItem key={service} value={service}>
                    {service}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Log Entries */}
      <Card className="bg-white/60 backdrop-blur-lg border-cyan-200">
        <CardHeader>
          <CardTitle className="text-cyan-900 flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Log Kayıtları ({filteredLogs.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {filteredLogs.map((log) => (
            <div
              key={log.id}
              className={`p-4 rounded-xl border bg-gradient-to-r transition-all duration-300 hover:shadow-md ${getLevelColor(
                log.level
              )}`}
            >
              <div className="flex items-start gap-4">
                <div className="mt-1">{getLevelIcon(log.level)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap mb-2">
                    <span className="text-xs font-mono text-gray-600">{log.timestamp}</span>
                    <Badge variant="outline" className="text-xs">
                      {log.service}
                    </Badge>
                    <Badge
                      variant={
                        log.level === "error"
                          ? "destructive"
                          : log.level === "warning"
                          ? "secondary"
                          : log.level === "success"
                          ? "default"
                          : "outline"
                      }
                      className={log.level === "success" ? "bg-emerald-500 text-white" : ""}
                    >
                      {log.level.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="font-medium text-gray-900 mb-1">{log.message}</p>
                  <div className="flex gap-4 text-xs text-gray-600">
                    {Object.entries(log)
                      .filter(
                        ([key]) =>
                          !["id", "timestamp", "service", "level", "message"].includes(key)
                      )
                      .map(([key, value]) => (
                        <span key={key}>
                          <span className="font-semibold">{key}:</span> {value}
                        </span>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {filteredLogs.length === 0 && (
            <div className="text-center py-12">
              <Info className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Log bulunamadı</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

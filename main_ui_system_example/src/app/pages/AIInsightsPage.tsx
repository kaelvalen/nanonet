import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { AlertTriangle, Info, Sparkles, TrendingUp, Brain } from "lucide-react";
import { motion } from "motion/react";

const insights = [
  {
    id: 1,
    service: "payment-service",
    severity: "warn",
    title: "Latency Anomaly",
    time: "14:32",
    description: "The latency spike in payment-service (+340ms since 14:32) correlates with increased timeout rates in auth-service.",
    recommendations: [
      "Inspect auth-service logs between 14:30-14:35",
      "Consider restarting payment-service",
    ],
    confidence: 82,
  },
  {
    id: 2,
    service: "notification-service",
    severity: "info",
    title: "Normal Activity",
    time: "12:05",
    description: "CPU usage exceeded normal levels but memory usage remains stable. This pattern indicates a typical cache refresh cycle.",
    recommendations: ["No action required."],
    confidence: 95,
  },
  {
    id: 3,
    service: "analytics-engine",
    severity: "critical",
    title: "High Memory Usage",
    time: "10:15",
    description: "Memory usage increased by 45% in the last 2 hours. High probability of memory leak.",
    recommendations: [
      "Start memory profiling",
      "Review changes since last deployment",
      "Plan emergency restart",
    ],
    confidence: 78,
  },
];

export function AIInsightsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div className="relative">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-[#c4b5fd] via-[#93c5fd] to-[#fda4af] bg-clip-text text-transparent">
            AI Insights
          </h1>
          <div className="text-[10px] text-[#7c8db5] mt-1 flex items-center gap-2">
            <Brain className="w-3 h-3 text-[#8b5cf6]" />
            AI-powered anomaly detection
          </div>
        </div>
        <Button className="gap-2 bg-gradient-to-r from-[#c4b5fd] to-[#93c5fd] hover:from-[#a78bfa] hover:to-[#60a5fa] border-0 text-white text-xs rounded-xl">
          <Sparkles className="w-4 h-4" />
          Analyze All
        </Button>
      </motion.div>

      {/* Insights List */}
      <div className="space-y-4">
        {insights.map((insight, index) => (
          <motion.div
            key={insight.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + index * 0.1 }}
          >
            <Card className={`bg-white/80 backdrop-blur-sm overflow-hidden border rounded-xl shadow-sm ${
              insight.severity === "critical" ? "border-[#fda4af]/20" :
              insight.severity === "warn" ? "border-[#fcd34d]/20" :
              "border-[#93c5fd]/15"
            }`}>
              {/* Top accent line */}
              <div className={`h-px ${
                insight.severity === "critical" ? "bg-gradient-to-r from-transparent via-[#fb7185]/30 to-transparent" :
                insight.severity === "warn" ? "bg-gradient-to-r from-transparent via-[#fbbf24]/30 to-transparent" :
                "bg-gradient-to-r from-transparent via-[#93c5fd]/30 to-transparent"
              }`} />

              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    {insight.severity === "critical" ? (
                      <AlertTriangle className="w-5 h-5 text-[#fb7185] mt-0.5" />
                    ) : insight.severity === "warn" ? (
                      <AlertTriangle className="w-5 h-5 text-[#fbbf24] mt-0.5" />
                    ) : (
                      <Info className="w-5 h-5 text-[#93c5fd] mt-0.5" />
                    )}
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <span className={
                          insight.severity === "critical" ? "text-[#e11d48]" :
                          insight.severity === "warn" ? "text-[#d97706]" :
                          "text-[#3b82f6]"
                        }>{insight.service}</span>
                        <span className="text-[#7c8db5] text-xs">— {insight.title}</span>
                      </CardTitle>
                      <p className="text-[10px] text-[#7c8db5] mt-1 font-[var(--font-mono)]">{insight.time}</p>
                    </div>
                  </div>
                  <Badge
                    variant={insight.severity === "critical" ? "destructive" : insight.severity === "warn" ? "secondary" : "outline"}
                    className={`text-[10px] rounded-full ${
                      insight.severity === "critical" ? "bg-[#fda4af]/20 text-[#e11d48] border-[#fda4af]/30" :
                      insight.severity === "warn" ? "bg-[#fef3c7]/50 text-[#d97706] border-[#fcd34d]/30" :
                      "bg-[#93c5fd]/10 text-[#3b82f6] border-[#93c5fd]/20"
                    }`}
                  >
                    {insight.severity === "critical" ? "CRITICAL" : insight.severity === "warn" ? "WARNING" : "INFO"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-[#3b4563]">{insight.description}</p>

                {insight.recommendations.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[10px] text-[#7c8db5] uppercase">Recommendations:</p>
                    <ul className="text-sm text-[#3b4563] space-y-1">
                      {insight.recommendations.map((rec, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-[#39c5bb]">✦</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex items-center justify-between pt-4 border-t border-[#39c5bb]/10">
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="border-[#39c5bb]/20 text-[#3b4563] hover:text-[#39c5bb] text-xs rounded-xl">
                      Details
                    </Button>
                    {insight.severity !== "info" && (
                      <Button variant="outline" size="sm" className="border-[#39c5bb]/20 text-[#3b4563] hover:text-[#39c5bb] text-xs rounded-xl">
                        Restart
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-[#8b5cf6]">
                    <TrendingUp className="w-3 h-3" />
                    <span>Confidence: {insight.confidence}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

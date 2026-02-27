import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sparkles,
  Brain,
  RefreshCw,
  Clock,
  Target,
  Lightbulb,
  Activity,
  ChevronDown,
  ChevronRight,
  Zap,
} from "lucide-react";
import { metricsApi, type AIInsight, type AnalysisResult } from "@/api/metrics";
import { useServices } from "@/hooks/useServices";
import { toast } from "sonner";

export function AIInsightsPage() {
  const { services } = useServices();
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null);

  const { data: insightsData, isLoading } = useQuery({
    queryKey: ["insights", selectedServiceId],
    queryFn: () => metricsApi.getInsights(selectedServiceId),
    enabled: !!selectedServiceId,
  });

  const insights = insightsData?.insights || [];

  const handleAnalyze = async () => {
    if (!selectedServiceId) {
      toast.error("Lütfen bir servis seçin");
      return;
    }
    setAnalyzeLoading(true);
    try {
      const result = await metricsApi.analyze(selectedServiceId, 30);
      setAnalysisResult(result);
      toast.success("AI analiz tamamlandı");
    } catch {
      toast.error("AI analiz başarısız oldu");
    } finally {
      setAnalyzeLoading(false);
    }
  };

  const confidence = analysisResult?.confidence ?? 0;
  const confPct = Math.round(confidence * 100);
  const r = 22;
  const circ = 2 * Math.PI * r;
  const confOffset = circ - (confPct / 100) * circ;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-heading)" }}>
              AI Insights
            </h1>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>AI-powered anomaly detection and recommendations</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
              <SelectTrigger className="w-48 rounded-xl text-xs h-9" style={{ background: "var(--surface-glass)", borderColor: "var(--color-lavender-border)", color: "var(--text-secondary)" }}>
                <SelectValue placeholder="Select service..." />
              </SelectTrigger>
              <SelectContent className="rounded-xl" style={{ background: "var(--surface-overlay)", borderColor: "var(--color-lavender-border)" }}>
                {services.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-xs" style={{ color: "var(--text-secondary)" }}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={handleAnalyze}
              disabled={analyzeLoading || !selectedServiceId}
              className="text-white rounded-xl text-xs h-9 shadow-sm hover:shadow-md transition-all"
              style={{ background: "var(--gradient-btn-primary)" }}
            >
              {analyzeLoading
                ? <><RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Analyzing...</>
                : <><Brain className="w-3 h-3 mr-1" /> Analyze</>}
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Analyzing skeleton */}
      {analyzeLoading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <Card className="rounded-xl p-5 space-y-3" style={{ background: "var(--surface-glass)", border: "1px solid var(--color-lavender-border)" }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: "var(--color-lavender-subtle)" }}>
                <Brain className="w-4.5 h-4.5 animate-pulse" style={{ color: "var(--color-lavender)" }} />
              </div>
              <div>
                <div className="h-3.5 w-36 rounded animate-pulse mb-1.5" style={{ backgroundColor: "var(--color-lavender-subtle)" }} />
                <div className="h-2.5 w-24 rounded animate-pulse" style={{ backgroundColor: "var(--color-lavender-subtle)" }} />
              </div>
            </div>
            {[80, 60, 90, 50].map((w, i) => (
              <div key={i} className="h-2.5 rounded animate-pulse" style={{ width: `${w}%`, animationDelay: `${i * 0.15}s`, backgroundColor: "var(--color-lavender-subtle)" }} />
            ))}
          </Card>
        </motion.div>
      )}

      {/* Live Analysis Result */}
      {analysisResult && !analyzeLoading && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <Card className="rounded-xl overflow-hidden shadow-sm" style={{ background: "var(--surface-glass)", border: "1px solid var(--color-lavender-border)" }}>
            <div className="h-1" style={{ background: "var(--gradient-btn-primary)" }} />
            <div className="p-5 space-y-4">
              {/* Header row */}
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--color-lavender-subtle)" }}>
                  <Brain className="w-5 h-5" style={{ color: "var(--color-lavender)" }} />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>Live Analysis Result</h3>
                  <p className="text-[10px]" style={{ color: "var(--text-faint)" }}>Last 30 minutes analyzed</p>
                </div>
                {analysisResult.confidence !== undefined && (
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="relative flex items-center justify-center">
                      <svg width="56" height="56" className="-rotate-90">
                        <circle cx="28" cy="28" r={r} fill="none" stroke="var(--border-track)" strokeWidth="4" />
                        <circle cx="28" cy="28" r={r} fill="none" stroke="var(--color-lavender)" strokeWidth="4"
                          strokeDasharray={circ} strokeDashoffset={confOffset}
                          strokeLinecap="round" style={{ transition: "stroke-dashoffset 1s ease" }} />
                      </svg>
                      <span className="absolute text-[10px] font-bold" style={{ color: "var(--color-lavender)" }}>{confPct}%</span>
                    </div>
                    <div>
                      <p className="text-[10px] font-medium" style={{ color: "var(--text-secondary)" }}>Confidence</p>
                      <p className="text-[9px]" style={{ color: "var(--text-faint)" }}>{confPct >= 80 ? "High" : confPct >= 60 ? "Medium" : "Low"}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Summary */}
              <div className="p-4 rounded-xl" style={{ background: "var(--surface-sunken)", border: "1px solid var(--color-lavender-border)" }}>
                <div className="flex items-center gap-1.5 mb-2">
                  <Activity className="w-3 h-3" style={{ color: "var(--color-lavender)" }} />
                  <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Summary</span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{analysisResult.summary}</p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                {/* Root Cause */}
                {analysisResult.root_cause && (
                  <div className="p-4 rounded-xl" style={{ background: "var(--status-down-subtle)", border: "1px solid var(--status-down-border)" }}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Target className="w-3 h-3" style={{ color: "var(--color-pink)" }} />
                      <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Root Cause</span>
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{analysisResult.root_cause}</p>
                  </div>
                )}

                {/* Recommendations */}
                {analysisResult.recommendations && analysisResult.recommendations.length > 0 && (
                  <div className="p-4 rounded-xl" style={{ background: "var(--color-teal-subtle)", border: "1px solid var(--color-teal-border)" }}>
                    <div className="flex items-center gap-1.5 mb-3">
                      <Lightbulb className="w-3 h-3" style={{ color: "var(--color-teal)" }} />
                      <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Recommendations</span>
                    </div>
                    <ul className="space-y-2">
                      {analysisResult.recommendations.map((rec, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Badge className="text-[9px] px-1.5 py-0 rounded-full shrink-0 mt-0.5 border"
                            style={{
                              background: rec.priority === "high" ? "var(--status-down-subtle)" : rec.priority === "medium" ? "var(--status-warn-subtle)" : "var(--color-teal-subtle)",
                              color: rec.priority === "high" ? "var(--status-down-text)" : rec.priority === "medium" ? "var(--status-warn-text)" : "var(--color-teal)",
                              borderColor: rec.priority === "high" ? "var(--status-down-border)" : rec.priority === "medium" ? "var(--status-warn-border)" : "var(--color-teal-border)",
                            }}>{rec.priority}</Badge>
                          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{rec.action}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Historical Insights */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="h-px flex-1" style={{ background: "linear-gradient(to right, transparent, var(--color-lavender-border), transparent)" }} />
          <h2 className="text-xs uppercase tracking-widest flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
            <Sparkles className="w-3 h-3" /> Geçmiş İç Görüler
          </h2>
          <div className="h-px flex-1" style={{ background: "linear-gradient(to right, transparent, var(--color-lavender-border), transparent)" }} />
        </div>

        {!selectedServiceId ? (
          <Card className="p-16 rounded-xl text-center" style={{ background: "var(--surface-glass)", border: "1px solid var(--color-lavender-border)" }}>
            <Sparkles className="w-14 h-14 mx-auto mb-4 opacity-20" style={{ color: "var(--color-lavender)" }} />
            <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Servis Seçin</h3>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>AI iç görülerini görüntülemek için yukarıdan bir servis seçin</p>
          </Card>
        ) : isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-4 rounded-xl animate-pulse" style={{ background: "var(--surface-glass)", border: "1px solid var(--color-lavender-border)" }}>
                <div className="h-4 w-60 rounded mb-2" style={{ backgroundColor: "var(--color-lavender-subtle)" }} />
                <div className="h-3 w-40 rounded" style={{ backgroundColor: "var(--color-lavender-subtle)" }} />
              </Card>
            ))}
          </div>
        ) : insights.length === 0 ? (
          <Card className="p-12 rounded-xl text-center" style={{ background: "var(--surface-glass)", border: "1px solid var(--color-lavender-border)" }}>
            <Brain className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: "var(--color-lavender)" }} />
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>Bu servis için henüz AI iç görüsü yok</p>
            <p className="text-xs mt-1" style={{ color: "var(--text-faint)" }}>Yukarıdaki "Analyze" butonuyla analiz başlatın</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {insights.map((insight, index) => (
              <motion.div
                key={insight.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <Card className="rounded-xl overflow-hidden transition-all duration-200" style={{ background: "var(--surface-glass)", border: "1px solid var(--color-lavender-border)" }}>
                  <button
                    className="w-full p-4 text-left"
                    onClick={() => setExpandedInsight(expandedInsight === insight.id ? null : insight.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: "var(--color-lavender-subtle)" }}>
                          <Zap className="w-4 h-4" style={{ color: "var(--color-lavender)" }} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium leading-relaxed line-clamp-2" style={{ color: "var(--text-secondary)" }}>{insight.summary}</p>
                          <div className="flex items-center gap-3 mt-1.5 text-[10px]" style={{ color: "var(--text-faint)" }}>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(insight.created_at).toLocaleString("tr-TR")}
                            </span>
                            <Badge className="text-[8px] rounded-full px-1.5 py-0 border"
                              style={{ background: "var(--color-blue-subtle)", color: "var(--color-blue-text)", borderColor: "var(--color-blue-border)" }}>
                              {insight.model}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      {expandedInsight === insight.id ? (
                        <ChevronDown className="w-4 h-4 shrink-0" style={{ color: "var(--text-faint)" }} />
                      ) : (
                        <ChevronRight className="w-4 h-4 shrink-0" style={{ color: "var(--text-faint)" }} />
                      )}
                    </div>
                  </button>

                  {expandedInsight === insight.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="px-4 pb-4" style={{ borderTop: "1px solid var(--color-lavender-border)" }}
                    >
                      <div className="pt-3 space-y-3">
                        {insight.root_cause && (
                          <div className="p-3 rounded-lg" style={{ background: "var(--status-down-subtle)", border: "1px solid var(--status-down-border)" }}>
                            <span className="text-[10px] uppercase tracking-wider flex items-center gap-1 mb-1" style={{ color: "var(--text-muted)" }}>
                              <Target className="w-3 h-3" style={{ color: "var(--color-pink)" }} /> Kök Neden
                            </span>
                            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{insight.root_cause}</p>
                          </div>
                        )}
                        {insight.recommendations && insight.recommendations.length > 0 && (
                          <div className="p-3 rounded-lg" style={{ background: "var(--color-teal-subtle)", border: "1px solid var(--color-teal-border)" }}>
                            <span className="text-[10px] uppercase tracking-wider flex items-center gap-1 mb-2" style={{ color: "var(--text-muted)" }}>
                              <Lightbulb className="w-3 h-3" style={{ color: "var(--color-teal)" }} /> Öneriler
                            </span>
                            <ul className="space-y-1.5">
                              {insight.recommendations.map((rec, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <Badge className="text-[8px] px-1 py-0 rounded-full shrink-0 mt-0.5"
                                    style={{
                                      background: rec.priority === "high" ? "var(--status-down-subtle)" : rec.priority === "medium" ? "var(--status-warn-subtle)" : "var(--color-teal-subtle)",
                                      color: rec.priority === "high" ? "var(--status-down-text)" : rec.priority === "medium" ? "var(--status-warn-text)" : "var(--color-teal)",
                                    }}>
                                    {rec.priority}
                                  </Badge>
                                  <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{rec.action}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}

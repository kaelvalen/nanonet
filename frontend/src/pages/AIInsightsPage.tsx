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
            <h1 className="text-2xl font-bold bg-linear-to-r from-[#c4b5fd] via-[#93c5fd] to-[#39c5bb] bg-clip-text text-transparent">
              AI Insights
            </h1>
            <p className="text-xs text-[#7c8db5] mt-1">AI-powered anomaly detection and recommendations</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
              <SelectTrigger className="w-48 bg-white/80 dark:bg-[#0d1c24]/85 border-[#c4b5fd]/15 dark:border-[#a78bfa]/12 text-[#3b4563] dark:text-[#d0f4ff] rounded-xl text-xs h-9">
                <SelectValue placeholder="Select service..." />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-[#0a161e] border-[#c4b5fd]/15 dark:border-[#a78bfa]/12 rounded-xl">
                {services.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-xs text-[#3b4563] dark:text-[#d0f4ff]">{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={handleAnalyze}
              disabled={analyzeLoading || !selectedServiceId}
              className="bg-linear-to-r from-[#c4b5fd] to-[#93c5fd] text-white rounded-xl text-xs h-9 shadow-sm hover:shadow-md transition-all"
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
          <Card className="bg-white/80 dark:bg-[#0d1c24]/85 border-[#c4b5fd]/15 dark:border-[#a78bfa]/12 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-[#c4b5fd]/15 flex items-center justify-center">
                <Brain className="w-4.5 h-4.5 text-[#c4b5fd] animate-pulse" />
              </div>
              <div>
                <div className="h-3.5 w-36 bg-[#c4b5fd]/15 rounded animate-pulse mb-1.5" />
                <div className="h-2.5 w-24 bg-[#c4b5fd]/8 rounded animate-pulse" />
              </div>
            </div>
            {[80, 60, 90, 50].map((w, i) => (
              <div key={i} className="h-2.5 rounded animate-pulse bg-[#c4b5fd]/10" style={{ width: `${w}%`, animationDelay: `${i * 0.15}s` }} />
            ))}
          </Card>
        </motion.div>
      )}

      {/* Live Analysis Result */}
      {analysisResult && !analyzeLoading && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <Card className="bg-white/80 dark:bg-[#0d1c24]/85 border-[#c4b5fd]/20 dark:border-[#a78bfa]/15 rounded-xl overflow-hidden shadow-sm">
            <div className="h-1 bg-linear-to-r from-[#c4b5fd] via-[#93c5fd] to-[#39c5bb]" />
            <div className="p-5 space-y-4">
              {/* Header row */}
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-linear-to-br from-[#c4b5fd]/15 to-[#93c5fd]/15 flex items-center justify-center shrink-0">
                  <Brain className="w-5 h-5 text-[#c4b5fd]" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-[#3b4563] dark:text-[#d0f4ff]">Live Analysis Result</h3>
                  <p className="text-[10px] text-[#b0bdd5] dark:text-[#3a6070]">Last 30 minutes analyzed</p>
                </div>
                {analysisResult.confidence !== undefined && (
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="relative flex items-center justify-center">
                      <svg width="56" height="56" className="-rotate-90">
                        <circle cx="28" cy="28" r={r} fill="none" stroke="#e2e8f0" strokeWidth="4" />
                        <circle cx="28" cy="28" r={r} fill="none" stroke="#c4b5fd" strokeWidth="4"
                          strokeDasharray={circ} strokeDashoffset={confOffset}
                          strokeLinecap="round" style={{ transition: "stroke-dashoffset 1s ease" }} />
                      </svg>
                      <span className="absolute text-[10px] font-bold text-[#7c3aed]">{confPct}%</span>
                    </div>
                    <div>
                      <p className="text-[10px] font-medium text-[#3b4563] dark:text-[#d0f4ff]">Confidence</p>
                      <p className="text-[9px] text-[#b0bdd5]">{confPct >= 80 ? "High" : confPct >= 60 ? "Medium" : "Low"}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Summary */}
              <div className="p-4 bg-[#f5f8ff] dark:bg-[#0f1e28] rounded-xl border border-[#c4b5fd]/10 dark:border-[#a78bfa]/10">
                <div className="flex items-center gap-1.5 mb-2">
                  <Activity className="w-3 h-3 text-[#c4b5fd]" />
                  <span className="text-[10px] text-[#7c8db5] uppercase tracking-wider">Summary</span>
                </div>
                <p className="text-xs text-[#3b4563] dark:text-[#d0f4ff] leading-relaxed">{analysisResult.summary}</p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                {/* Root Cause */}
                {analysisResult.root_cause && (
                  <div className="p-4 bg-[#fda4af]/5 rounded-xl border border-[#fda4af]/10">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Target className="w-3 h-3 text-[#fda4af]" />
                      <span className="text-[10px] text-[#7c8db5] uppercase tracking-wider">Root Cause</span>
                    </div>
                    <p className="text-xs text-[#3b4563] dark:text-[#d0f4ff] leading-relaxed">{analysisResult.root_cause}</p>
                  </div>
                )}

                {/* Recommendations */}
                {analysisResult.recommendations && analysisResult.recommendations.length > 0 && (
                  <div className="p-4 bg-[#39c5bb]/5 rounded-xl border border-[#39c5bb]/10">
                    <div className="flex items-center gap-1.5 mb-3">
                      <Lightbulb className="w-3 h-3 text-[#39c5bb]" />
                      <span className="text-[10px] text-[#7c8db5] uppercase tracking-wider">Recommendations</span>
                    </div>
                    <ul className="space-y-2">
                      {analysisResult.recommendations.map((rec, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <Badge className={`text-[9px] px-1.5 py-0 rounded-full shrink-0 mt-0.5 border ${
                            rec.priority === "high" ? "bg-[#fda4af]/15 text-[#e11d48] border-[#fda4af]/20"
                            : rec.priority === "medium" ? "bg-[#fbbf24]/15 text-[#d97706] border-[#fbbf24]/20"
                            : "bg-[#39c5bb]/15 text-[#2da89e] border-[#39c5bb]/20"
                          }`}>{rec.priority}</Badge>
                          <span className="text-xs text-[#3b4563] dark:text-[#d0f4ff]">{rec.action}</span>
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
          <div className="h-px flex-1 bg-linear-to-r from-transparent via-[#c4b5fd]/20 to-transparent" />
          <h2 className="text-xs text-[#7c8db5] uppercase tracking-widest flex items-center gap-2">
            <Sparkles className="w-3 h-3" /> Geçmiş İç Görüler
          </h2>
          <div className="h-px flex-1 bg-linear-to-r from-transparent via-[#c4b5fd]/20 to-transparent" />
        </div>

        {!selectedServiceId ? (
          <Card className="p-16 bg-white/80 dark:bg-[#0d1c24]/85 border-[#c4b5fd]/10 dark:border-[#a78bfa]/8 rounded-xl text-center">
            <Sparkles className="w-14 h-14 text-[#c4b5fd]/20 mx-auto mb-4" />
            <h3 className="text-sm font-semibold text-[#3b4563] dark:text-[#d0f4ff] mb-1">Servis Seçin</h3>
            <p className="text-xs text-[#7c8db5]">AI iç görülerini görüntülemek için yukarıdan bir servis seçin</p>
          </Card>
        ) : isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-4 bg-white/80 dark:bg-[#0d1c24]/85 border-[#c4b5fd]/10 dark:border-[#a78bfa]/8 rounded-xl animate-pulse">
                <div className="h-4 w-60 bg-[#c4b5fd]/10 rounded mb-2" />
                <div className="h-3 w-40 bg-[#c4b5fd]/10 rounded" />
              </Card>
            ))}
          </div>
        ) : insights.length === 0 ? (
          <Card className="p-12 bg-white/80 dark:bg-[#0d1c24]/85 border-[#c4b5fd]/10 dark:border-[#a78bfa]/8 rounded-xl text-center">
            <Brain className="w-10 h-10 text-[#c4b5fd]/20 mx-auto mb-3" />
            <p className="text-sm text-[#7c8db5]">Bu servis için henüz AI iç görüsü yok</p>
            <p className="text-xs text-[#b0bdd5] mt-1">Yukarıdaki "Analyze" butonuyla analiz başlatın</p>
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
                <Card className="bg-white/80 dark:bg-[#0d1c24]/85 border-[#c4b5fd]/10 dark:border-[#a78bfa]/8 rounded-xl overflow-hidden transition-all duration-200 hover:border-[#c4b5fd]/25 dark:hover:border-[#a78bfa]/20">
                  <button
                    className="w-full p-4 text-left"
                    onClick={() => setExpandedInsight(expandedInsight === insight.id ? null : insight.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-linear-to-br from-[#c4b5fd]/10 to-[#93c5fd]/10 flex items-center justify-center shrink-0 mt-0.5">
                          <Zap className="w-4 h-4 text-[#c4b5fd]" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-[#3b4563] dark:text-[#d0f4ff] font-medium leading-relaxed line-clamp-2">{insight.summary}</p>
                          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-[#b0bdd5]">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(insight.created_at).toLocaleString("tr-TR")}
                            </span>
                            <Badge className="text-[8px] bg-[#93c5fd]/10 text-[#3b82f6] border border-[#93c5fd]/15 rounded-full px-1.5 py-0">
                              {insight.model}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      {expandedInsight === insight.id ? (
                        <ChevronDown className="w-4 h-4 text-[#b0bdd5] shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-[#b0bdd5] shrink-0" />
                      )}
                    </div>
                  </button>

                  {expandedInsight === insight.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-[#c4b5fd]/10 px-4 pb-4"
                    >
                      <div className="pt-3 space-y-3">
                        {insight.root_cause && (
                          <div className="p-3 bg-[#fda4af]/5 rounded-lg border border-[#fda4af]/10">
                            <span className="text-[10px] text-[#7c8db5] uppercase tracking-wider flex items-center gap-1 mb-1">
                              <Target className="w-3 h-3 text-[#fda4af]" /> Kök Neden
                            </span>
                            <p className="text-xs text-[#3b4563] dark:text-[#d0f4ff]">{insight.root_cause}</p>
                          </div>
                        )}
                        {insight.recommendations && insight.recommendations.length > 0 && (
                          <div className="p-3 bg-[#39c5bb]/5 rounded-lg border border-[#39c5bb]/10">
                            <span className="text-[10px] text-[#7c8db5] uppercase tracking-wider flex items-center gap-1 mb-2">
                              <Lightbulb className="w-3 h-3 text-[#39c5bb]" /> Öneriler
                            </span>
                            <ul className="space-y-1.5">
                              {insight.recommendations.map((rec, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <Badge className={`text-[8px] px-1 py-0 rounded-full shrink-0 mt-0.5 ${
                                    rec.priority === "high" ? "bg-[#fda4af]/15 text-[#e11d48]" :
                                    rec.priority === "medium" ? "bg-[#fbbf24]/15 text-[#d97706]" :
                                    "bg-[#39c5bb]/15 text-[#2da89e]"
                                  }`}>
                                    {rec.priority}
                                  </Badge>
                                  <span className="text-[11px] text-[#3b4563] dark:text-[#d0f4ff]">{rec.action}</span>
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

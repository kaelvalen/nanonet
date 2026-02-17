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
              <SelectTrigger className="w-[200px] bg-white/80 border-[#c4b5fd]/15 text-[#3b4563] rounded-xl text-xs h-9">
                <SelectValue placeholder="Servis seçin..." />
              </SelectTrigger>
              <SelectContent className="bg-white border-[#c4b5fd]/15 rounded-xl">
                {services.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-xs text-[#3b4563]">
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={handleAnalyze}
              disabled={analyzeLoading || !selectedServiceId}
              className="bg-linear-to-r from-[#c4b5fd] to-[#93c5fd] text-white rounded-xl text-xs h-9"
            >
              {analyzeLoading ? (
                <>
                  <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Analyzing...
                </>
              ) : (
                <>
                  <Brain className="w-3 h-3 mr-1" /> Analyze
                </>
              )}
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Live Analysis Result */}
      {analysisResult && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <Card className="bg-white/80 border-[#c4b5fd]/15 rounded-xl overflow-hidden">
            <div className="p-1 bg-linear-to-r from-[#c4b5fd]/20 via-[#93c5fd]/20 to-[#39c5bb]/20" />
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#c4b5fd]/20 to-[#93c5fd]/20 flex items-center justify-center">
                  <Brain className="w-4 h-4 text-[#c4b5fd]" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#3b4563]">Canlı Analiz Sonucu</h3>
                  <p className="text-[10px] text-[#b0bdd5]">Son 30 dakikalık veriler analiz edildi</p>
                </div>
                {analysisResult.confidence !== undefined && (
                  <Badge className="ml-auto text-[9px] bg-[#c4b5fd]/10 text-[#7c3aed] border border-[#c4b5fd]/20 rounded-full">
                    Güven: {(analysisResult.confidence * 100).toFixed(0)}%
                  </Badge>
                )}
              </div>

              {/* Summary */}
              <div className="p-4 bg-[#f5f8ff] rounded-xl border border-[#c4b5fd]/10">
                <div className="flex items-center gap-1.5 mb-2">
                  <Activity className="w-3 h-3 text-[#c4b5fd]" />
                  <span className="text-[10px] text-[#7c8db5] uppercase tracking-wider">Özet</span>
                </div>
                <p className="text-xs text-[#3b4563] leading-relaxed">{analysisResult.summary}</p>
              </div>

              {/* Root Cause */}
              {analysisResult.root_cause && (
                <div className="p-4 bg-[#fda4af]/5 rounded-xl border border-[#fda4af]/10">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Target className="w-3 h-3 text-[#fda4af]" />
                    <span className="text-[10px] text-[#7c8db5] uppercase tracking-wider">Kök Neden</span>
                  </div>
                  <p className="text-xs text-[#3b4563] leading-relaxed">{analysisResult.root_cause}</p>
                </div>
              )}

              {/* Recommendations */}
              {analysisResult.recommendations && analysisResult.recommendations.length > 0 && (
                <div className="p-4 bg-[#39c5bb]/5 rounded-xl border border-[#39c5bb]/10">
                  <div className="flex items-center gap-1.5 mb-3">
                    <Lightbulb className="w-3 h-3 text-[#39c5bb]" />
                    <span className="text-[10px] text-[#7c8db5] uppercase tracking-wider">Öneriler</span>
                  </div>
                  <ul className="space-y-2">
                    {analysisResult.recommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Badge className={`text-[9px] px-1.5 py-0 rounded-full flex-shrink-0 mt-0.5 ${
                          rec.priority === "high" ? "bg-[#fda4af]/15 text-[#e11d48] border border-[#fda4af]/20" :
                          rec.priority === "medium" ? "bg-[#fbbf24]/15 text-[#d97706] border border-[#fbbf24]/20" :
                          "bg-[#39c5bb]/15 text-[#2da89e] border border-[#39c5bb]/20"
                        }`}>
                          {rec.priority}
                        </Badge>
                        <span className="text-xs text-[#3b4563]">{rec.action}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
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
          <Card className="p-16 bg-white/80 border-[#c4b5fd]/10 rounded-xl text-center">
            <Sparkles className="w-14 h-14 text-[#c4b5fd]/20 mx-auto mb-4" />
            <h3 className="text-sm font-semibold text-[#3b4563] mb-1">Servis Seçin</h3>
            <p className="text-xs text-[#7c8db5]">AI iç görülerini görüntülemek için yukarıdan bir servis seçin</p>
          </Card>
        ) : isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-4 bg-white/80 border-[#c4b5fd]/10 rounded-xl animate-pulse">
                <div className="h-4 w-60 bg-[#c4b5fd]/10 rounded mb-2" />
                <div className="h-3 w-40 bg-[#c4b5fd]/10 rounded" />
              </Card>
            ))}
          </div>
        ) : insights.length === 0 ? (
          <Card className="p-12 bg-white/80 border-[#c4b5fd]/10 rounded-xl text-center">
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
                <Card className="bg-white/80 border-[#c4b5fd]/10 rounded-xl overflow-hidden transition-all duration-200 hover:border-[#c4b5fd]/25">
                  <button
                    className="w-full p-4 text-left"
                    onClick={() => setExpandedInsight(expandedInsight === insight.id ? null : insight.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#c4b5fd]/10 to-[#93c5fd]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Zap className="w-4 h-4 text-[#c4b5fd]" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs text-[#3b4563] font-medium leading-relaxed line-clamp-2">{insight.summary}</p>
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
                        <ChevronDown className="w-4 h-4 text-[#b0bdd5] flex-shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-[#b0bdd5] flex-shrink-0" />
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
                            <p className="text-xs text-[#3b4563]">{insight.root_cause}</p>
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
                                  <Badge className={`text-[8px] px-1 py-0 rounded-full flex-shrink-0 mt-0.5 ${
                                    rec.priority === "high" ? "bg-[#fda4af]/15 text-[#e11d48]" :
                                    rec.priority === "medium" ? "bg-[#fbbf24]/15 text-[#d97706]" :
                                    "bg-[#39c5bb]/15 text-[#2da89e]"
                                  }`}>
                                    {rec.priority}
                                  </Badge>
                                  <span className="text-[11px] text-[#3b4563]">{rec.action}</span>
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

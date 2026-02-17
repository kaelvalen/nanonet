import { Brain, Lightbulb, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import type { AnalysisResult } from '../../api/metrics';

interface InsightCardProps {
  insight: AnalysisResult;
  isLoading?: boolean;
}

export default function InsightCard({ insight, isLoading }: InsightCardProps) {
  const [expanded, setExpanded] = useState(true);

  if (isLoading) {
    return (
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 skeleton rounded-lg" />
          <div className="h-5 skeleton rounded w-40" />
        </div>
        <div className="space-y-3">
          <div className="h-4 skeleton rounded w-full" />
          <div className="h-4 skeleton rounded w-3/4" />
          <div className="h-4 skeleton rounded w-1/2" />
        </div>
      </div>
    );
  }

  const priorityColors: Record<string, string> = {
    high: 'bg-red-500/10 text-red-400 ring-1 ring-red-500/20',
    medium: 'bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20',
    low: 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20',
  };

  return (
    <div className="card overflow-hidden">
      <div
        className="p-5 flex items-center justify-between cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-purple-500/20">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white">AI Analiz Sonucu</h3>
            {insight.confidence !== undefined && (
              <span className="text-xs text-gray-500">
                Güven: %{(insight.confidence * 100).toFixed(0)}
              </span>
            )}
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-gray-600" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-600" />
        )}
      </div>

      {expanded && (
        <div className="px-5 pb-5 space-y-4">
          <div className="p-4 bg-indigo-500/5 rounded-xl ring-1 ring-indigo-500/10">
            <p className="text-sm text-gray-300 leading-relaxed">{insight.summary}</p>
          </div>

          {insight.root_cause && (
            <div className="p-4 bg-amber-500/5 rounded-xl ring-1 ring-amber-500/10">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-medium text-amber-400">Olası Neden</span>
              </div>
              <p className="text-sm text-gray-300 leading-relaxed">{insight.root_cause}</p>
            </div>
          )}

          {insight.recommendations && insight.recommendations.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-400">Öneriler</span>
              </div>
              <div className="space-y-2">
                {insight.recommendations.map((rec, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-3 bg-white/[0.02] rounded-lg"
                  >
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold rounded tracking-wider ${
                        priorityColors[rec.priority] || priorityColors.medium
                      }`}
                    >
                      {rec.priority === 'high' ? 'YÜKSEK' : rec.priority === 'medium' ? 'ORTA' : 'DÜŞÜK'}
                    </span>
                    <p className="text-sm text-gray-300 flex-1">{rec.action}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

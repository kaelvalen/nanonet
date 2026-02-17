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
      <div className="card p-6 animate-pulse">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-purple-100 rounded-lg" />
          <div className="h-5 bg-gray-200 rounded w-40" />
        </div>
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded w-full" />
          <div className="h-4 bg-gray-200 rounded w-3/4" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
        </div>
      </div>
    );
  }

  const priorityColors: Record<string, string> = {
    high: 'bg-red-100 text-red-700 border-red-200',
    medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    low: 'bg-green-100 text-green-700 border-green-200',
  };

  return (
    <div className="card overflow-hidden">
      <div
        className="p-5 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">AI Analiz Sonucu</h3>
            {insight.confidence !== undefined && (
              <span className="text-xs text-gray-500">
                Güven: %{(insight.confidence * 100).toFixed(0)}
              </span>
            )}
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </div>

      {expanded && (
        <div className="px-5 pb-5 space-y-4">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
            <p className="text-sm text-blue-900 leading-relaxed">{insight.summary}</p>
          </div>

          {insight.root_cause && (
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-100">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-800">Olası Neden</span>
              </div>
              <p className="text-sm text-amber-900 leading-relaxed">{insight.root_cause}</p>
            </div>
          )}

          {insight.recommendations && insight.recommendations.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="w-4 h-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">Öneriler</span>
              </div>
              <div className="space-y-2">
                {insight.recommendations.map((rec, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                  >
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded border ${
                        priorityColors[rec.priority] || priorityColors.medium
                      }`}
                    >
                      {rec.priority === 'high' ? 'Yüksek' : rec.priority === 'medium' ? 'Orta' : 'Düşük'}
                    </span>
                    <p className="text-sm text-gray-700 flex-1">{rec.action}</p>
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

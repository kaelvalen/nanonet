import { AlertCircle, CheckCircle, Info, XCircle } from 'lucide-react';

interface AlertCardProps {
  id: string;
  type: string;
  severity: 'info' | 'warn' | 'crit';
  message: string;
  triggeredAt: string;
  resolvedAt?: string;
  onResolve?: (id: string) => void;
}

export default function AlertCard({
  id,
  type,
  severity,
  message,
  triggeredAt,
  resolvedAt,
  onResolve,
}: AlertCardProps) {
  const severityConfig = {
    info: {
      bg: 'bg-indigo-500/5',
      border: 'border-indigo-500/20',
      text: 'text-indigo-400',
      iconBg: 'bg-indigo-500/10',
      icon: Info,
    },
    warn: {
      bg: 'bg-amber-500/5',
      border: 'border-amber-500/20',
      text: 'text-amber-400',
      iconBg: 'bg-amber-500/10',
      icon: AlertCircle,
    },
    crit: {
      bg: 'bg-red-500/5',
      border: 'border-red-500/20',
      text: 'text-red-400',
      iconBg: 'bg-red-500/10',
      icon: XCircle,
    },
  };

  const config = severityConfig[severity];
  const Icon = config.icon;

  return (
    <div
      className={`p-4 rounded-xl border ${config.bg} ${config.border} transition-opacity ${
        resolvedAt ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-lg ${config.iconBg} flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-4 h-4 ${config.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-sm font-medium ${config.text}`}>
              {type.replace(/_/g, ' ').toUpperCase()}
            </span>
            {resolvedAt && (
              <span className="flex items-center gap-1 text-xs text-emerald-400">
                <CheckCircle className="w-3 h-3" />
                Çözümlendi
              </span>
            )}
          </div>
          <p className="text-sm text-gray-300 mb-2 leading-relaxed">{message}</p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600">
              {new Date(triggeredAt).toLocaleString('tr-TR')}
            </span>
            {!resolvedAt && onResolve && (
              <button
                onClick={() => onResolve(id)}
                className="text-xs px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-gray-300 hover:bg-white/10 transition-colors"
              >
                Çözümle
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

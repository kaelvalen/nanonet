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
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-800',
      icon: Info,
    },
    warn: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      text: 'text-yellow-800',
      icon: AlertCircle,
    },
    crit: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-800',
      icon: XCircle,
    },
  };

  const config = severityConfig[severity];
  const Icon = config.icon;

  return (
    <div
      className={`p-4 rounded-lg border ${config.bg} ${config.border} ${
        resolvedAt ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 ${config.text} flex-shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`font-medium ${config.text}`}>
              {type.replace(/_/g, ' ').toUpperCase()}
            </span>
            {resolvedAt && (
              <span className="flex items-center gap-1 text-xs text-green-600">
                <CheckCircle className="w-3 h-3" />
                Çözümlendi
              </span>
            )}
          </div>
          <p className="text-sm text-gray-700 mb-2">{message}</p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">
              {new Date(triggeredAt).toLocaleString('tr-TR')}
            </span>
            {!resolvedAt && onResolve && (
              <button
                onClick={() => onResolve(id)}
                className="text-xs px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50"
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

import { useState } from 'react';
import { RotateCcw, Square, Loader2 } from 'lucide-react';

interface CommandButtonProps {
  action: 'restart' | 'stop';
  onExecute: () => void;
  disabled?: boolean;
  isLoading?: boolean;
}

export default function CommandButton({ action, onExecute, disabled, isLoading }: CommandButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  const config = {
    restart: {
      icon: RotateCcw,
      label: 'Restart',
      confirmText: 'Bu servis yeniden başlatılacak. Devam etmek istiyor musunuz?',
      color: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20',
      confirmColor: 'bg-indigo-600 hover:bg-indigo-700',
    },
    stop: {
      icon: Square,
      label: 'Stop',
      confirmText: 'Bu servis durdurulacak. Devam etmek istiyor musunuz?',
      color: 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/20',
      confirmColor: 'bg-red-600 hover:bg-red-700',
    },
  };

  const cfg = config[action];
  const Icon = cfg.icon;

  if (showConfirm) {
    return (
      <div className="card p-4 border border-amber-500/20 bg-amber-500/5">
        <p className="text-sm text-amber-300 mb-3">{cfg.confirmText}</p>
        <div className="flex gap-2">
          <button
            onClick={() => {
              onExecute();
              setShowConfirm(false);
            }}
            disabled={isLoading}
            className={`px-4 py-1.5 text-sm text-white rounded-lg ${cfg.confirmColor} disabled:opacity-50 flex items-center gap-2 transition-colors`}
          >
            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
            Onayla
          </button>
          <button
            onClick={() => setShowConfirm(false)}
            className="btn-ghost px-4 py-1.5 text-sm"
          >
            İptal
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      disabled={disabled || isLoading}
      className={`flex items-center gap-2 px-4 py-2 text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${cfg.color}`}
    >
      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
      {cfg.label}
    </button>
  );
}

import { Clock, CheckCircle, XCircle, Loader2, RotateCcw, Square, Radio } from 'lucide-react';
import type { CommandLog } from '../../api/metrics';

interface CommandHistoryProps {
  commands: CommandLog[];
  isLoading?: boolean;
}

export default function CommandHistory({ commands, isLoading }: CommandHistoryProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card p-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 skeleton rounded-lg" />
              <div className="flex-1 space-y-2">
                <div className="h-4 skeleton rounded w-1/3" />
                <div className="h-3 skeleton rounded w-1/4" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (commands.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
          <Clock className="w-7 h-7 text-gray-700" />
        </div>
        <p className="font-medium text-gray-400">Henüz komut geçmişi yok</p>
        <p className="text-sm text-gray-600 mt-1">Servis üzerinde restart veya stop komutu çalıştırıldığında burada görünecek</p>
      </div>
    );
  }

  const actionIcons: Record<string, typeof RotateCcw> = {
    restart: RotateCcw,
    stop: Square,
    ping: Radio,
  };

  const statusConfig: Record<string, { icon: typeof CheckCircle; color: string; label: string }> = {
    queued: { icon: Loader2, color: 'text-indigo-400', label: 'Kuyrukta' },
    received: { icon: Loader2, color: 'text-amber-400', label: 'Alındı' },
    success: { icon: CheckCircle, color: 'text-emerald-400', label: 'Başarılı' },
    failed: { icon: XCircle, color: 'text-red-400', label: 'Başarısız' },
    timeout: { icon: XCircle, color: 'text-orange-400', label: 'Zaman Aşımı' },
  };

  return (
    <div className="space-y-2">
      {commands.map((cmd) => {
        const ActionIcon = actionIcons[cmd.action] || RotateCcw;
        const status = statusConfig[cmd.status] || statusConfig.queued;
        const StatusIcon = status.icon;

        return (
          <div key={cmd.id} className="card p-4 flex items-center gap-4">
            <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
              <ActionIcon className="w-4 h-4 text-gray-400" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm text-white capitalize">{cmd.action}</span>
                <span className={`flex items-center gap-1 text-xs ${status.color}`}>
                  <StatusIcon className={`w-3 h-3 ${cmd.status === 'queued' || cmd.status === 'received' ? 'animate-spin' : ''}`} />
                  {status.label}
                </span>
              </div>
              <div className="text-xs text-gray-600 mt-0.5">
                {new Date(cmd.queued_at).toLocaleString('tr-TR')}
                {cmd.duration_ms !== undefined && cmd.duration_ms !== null && (
                  <span className="ml-2 text-gray-500">({cmd.duration_ms}ms)</span>
                )}
              </div>
            </div>

            <div className="text-xs text-gray-700 font-mono hidden sm:block">
              {cmd.command_id.slice(0, 8)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

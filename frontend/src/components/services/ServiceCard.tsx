import { Activity, MoreVertical, RotateCcw, Square, Wifi, WifiOff } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import type { Service } from '../../types/service';

interface ServiceCardProps {
  service: Service & { agent_connected?: boolean };
  onRestart: (id: string) => void;
  onStop: (id: string) => void;
  onClick: (id: string) => void;
}

export default function ServiceCard({ service, onRestart, onStop, onClick }: ServiceCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const statusConfig = {
    up: { badge: 'badge-up', dot: 'bg-emerald-500', label: 'UP', glow: 'shadow-emerald-500/10' },
    down: { badge: 'badge-down', dot: 'bg-red-500', label: 'DOWN', glow: 'shadow-red-500/10' },
    degraded: { badge: 'badge-degraded', dot: 'bg-amber-500', label: 'DEGRADED', glow: 'shadow-amber-500/10' },
    unknown: { badge: 'badge-unknown', dot: 'bg-gray-500', label: 'UNKNOWN', glow: '' },
  };

  const config = statusConfig[service.status] || statusConfig.unknown;

  return (
    <div
      className={`card-hover p-5 cursor-pointer relative group animate-fade-in ${config.glow}`}
      onClick={() => onClick(service.id)}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center flex-shrink-0 ring-1 ring-indigo-500/20">
            <Activity className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-white text-[15px] truncate">{service.name}</h3>
            <p className="text-xs text-gray-500 truncate mt-0.5">
              {service.host}:{service.port}
            </p>
          </div>
        </div>
        <div className="relative" ref={menuRef}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-1.5 text-gray-600 hover:text-gray-300 hover:bg-white/5 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-8 card p-1 w-36 z-20 animate-scale-in">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRestart(service.id);
                  setShowMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-white/5 rounded-md transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restart
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStop(service.id);
                  setShowMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
              >
                <Square className="w-3.5 h-3.5" />
                Stop
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              {service.status === 'up' && (
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.dot} opacity-50`} />
              )}
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${config.dot}`} />
            </span>
            <span className={config.badge}>{config.label}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {service.agent_connected !== undefined && (
            <span className={`flex items-center gap-1 text-xs ${service.agent_connected ? 'text-emerald-500' : 'text-gray-600'}`}>
              {service.agent_connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            </span>
          )}
          <span className="text-[11px] text-gray-600 tabular-nums">
            {service.poll_interval_sec}s
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 pt-3 border-t border-white/[0.04]">
        <div className="flex items-center justify-between">
          <code className="text-[11px] text-gray-600 font-mono">
            {service.health_endpoint}
          </code>
          <span className="text-[11px] text-gray-600">
            {new Date(service.updated_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    </div>
  );
}

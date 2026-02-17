import { Activity, MoreVertical, Play, Square } from 'lucide-react';
import { useState } from 'react';
import type { Service } from '../../types/service';

interface ServiceCardProps {
  service: Service;
  onRestart: (id: string) => void;
  onStop: (id: string) => void;
  onClick: (id: string) => void;
}

export default function ServiceCard({ service, onRestart, onStop, onClick }: ServiceCardProps) {
  const [showMenu, setShowMenu] = useState(false);

  const statusConfig = {
    up: { bg: 'bg-green-100', text: 'text-green-800', dot: 'bg-green-500' },
    down: { bg: 'bg-red-100', text: 'text-red-800', dot: 'bg-red-500' },
    degraded: { bg: 'bg-yellow-100', text: 'text-yellow-800', dot: 'bg-yellow-500' },
    unknown: { bg: 'bg-gray-100', text: 'text-gray-800', dot: 'bg-gray-500' },
  };

  const config = statusConfig[service.status];

  return (
    <div
      className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer relative"
      onClick={() => onClick(service.id)}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Activity className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">{service.name}</h3>
            <p className="text-sm text-gray-500">
              {service.host}:{service.port}
            </p>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          className="p-1 hover:bg-gray-100 rounded"
        >
          <MoreVertical className="w-5 h-5 text-gray-400" />
        </button>
        {showMenu && (
          <div className="absolute right-6 top-16 bg-white border rounded-lg shadow-lg py-1 z-10">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRestart(service.id);
                setShowMenu(false);
              }}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              Restart
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStop(service.id);
                setShowMenu(false);
              }}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-red-600"
            >
              <Square className="w-4 h-4" />
              Stop
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${config.dot} animate-pulse`} />
          <span className={`text-sm font-medium px-2 py-1 rounded ${config.bg} ${config.text}`}>
            {service.status.toUpperCase()}
          </span>
        </div>
        <span className="text-xs text-gray-500">
          Poll: {service.poll_interval_sec}s
        </span>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="text-xs text-gray-500">
          Health: {service.health_endpoint}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef, useCallback } from 'react';
import { useWSStore } from '../store/wsStore';
import { useServiceStore } from '../store/serviceStore';
import toast from 'react-hot-toast';

export function useWebSocket() {
  const { setConnected, setWS } = useWSStore();
  const { updateServiceStatus } = useServiceStore();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const reconnectDelayRef = useRef(1000);

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message = JSON.parse(event.data);

      switch (message.type) {
        case 'metric_update':
          if (message.service_id && message.data?.status) {
            updateServiceStatus(message.service_id, message.data.status);
          }
          break;

        case 'alert':
          if (message.data) {
            const severity = message.data.severity;
            const text = message.data.message || 'Yeni alert';
            if (severity === 'crit') {
              toast.error(text, { duration: 5000 });
            } else if (severity === 'warn') {
              toast(text, { icon: '⚠️', duration: 4000 });
            } else {
              toast(text, { icon: 'ℹ️' });
            }
          }
          break;

        case 'command_status':
          if (message.status === 'success') {
            toast.success(`Komut başarılı (${message.command_id?.slice(0, 8)})`);
          } else if (message.status === 'failed') {
            toast.error(`Komut başarısız (${message.command_id?.slice(0, 8)})`);
          }
          break;
      }
    } catch (error) {
      console.error('WebSocket mesaj parse hatası:', error);
    }
  }, [updateServiceStatus]);

  useEffect(() => {
    const connect = () => {
      const wsUrl = import.meta.env.VITE_WS_URL;
      const token = localStorage.getItem('access_token');

      if (!token || !wsUrl) return;

      const ws = new WebSocket(`${wsUrl}/dashboard?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setWS(ws);
        reconnectDelayRef.current = 1000;
      };

      ws.onmessage = handleMessage;

      ws.onerror = () => {
        setConnected(false);
      };

      ws.onclose = () => {
        setConnected(false);
        setWS(null);

        const delay = reconnectDelayRef.current;
        reconnectDelayRef.current = Math.min(delay * 2, 30000);

        reconnectTimeoutRef.current = setTimeout(() => {
          if (localStorage.getItem('access_token')) {
            connect();
          }
        }, delay);
      };
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [setConnected, setWS, handleMessage]);
}

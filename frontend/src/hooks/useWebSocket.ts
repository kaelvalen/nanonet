import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useWSStore } from '../store/wsStore';
import { useServiceStore } from '../store/serviceStore';
import { useAuthStore } from '../store/authStore';
import { toast } from 'sonner';

const MAX_RECONNECT_DELAY = 30000;
const INITIAL_RECONNECT_DELAY = 1000;
const HEARTBEAT_INTERVAL = 30000;

export function useWebSocket() {
  const queryClient = useQueryClient();
  const {
    setConnected, setWS,
    incrementReconnect, resetReconnect,
    setLastMessageTime, setLastError,
  } = useWSStore();
  const { updateServiceStatus } = useServiceStore();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const heartbeatRef = useRef<ReturnType<typeof setInterval>>();
  const reconnectDelayRef = useRef(INITIAL_RECONNECT_DELAY);
  const mountedRef = useRef(true);

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      setLastMessageTime(Date.now());
      const message = JSON.parse(event.data);

      switch (message.type) {
        case 'metric_update':
          if (message.service_id && message.data?.status) {
            updateServiceStatus(message.service_id, message.data.status);
            queryClient.setQueryData(['services'], (old: unknown) => {
              if (!Array.isArray(old)) return old;
              return old.map((s: { id: string; status: string }) =>
                s.id === message.service_id
                  ? { ...s, status: message.data.status }
                  : s
              );
            });
          }
          break;

        case 'alert':
          if (message.data) {
            const severity = message.data.severity;
            const text = message.data.message || 'Yeni alert';
            if (severity === 'crit') {
              toast.error(text, { duration: 5000 });
            } else if (severity === 'warn') {
              toast.warning(text, { duration: 4000 });
            } else {
              toast.info(text);
            }
          }
          break;

        case 'command_status': {
          const commandEvent = new CustomEvent('nanonet:command_result', {
            detail: {
              command_id: message.command_id,
              status: message.status,
              output: message.output,
              error: message.error,
              service_id: message.service_id,
            },
          });
          window.dispatchEvent(commandEvent);
          if (message.status === 'success') {
            toast.success(`Komut tamamlandı`, { duration: 2500 });
          } else if (message.status === 'failed' || message.status === 'timeout') {
            toast.error(`Komut başarısız: ${message.error ?? 'bilinmeyen hata'}`, { duration: 4000 });
          }
          break;
        }

        case 'pong':
          // Heartbeat response, connection healthy
          break;
      }
    } catch (error) {
      console.error('WebSocket mesaj parse hatası:', error);
    }
  }, [updateServiceStatus, setLastMessageTime, queryClient]);

  const startHeartbeat = useCallback((ws: WebSocket) => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    heartbeatRef.current = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: 'ping' }));
        } catch {
          // Connection might be closing
        }
      }
    }, HEARTBEAT_INTERVAL);
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = undefined;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    const connect = () => {
      if (!mountedRef.current) return;

      const wsUrl = import.meta.env.VITE_WS_URL;
      const token = useAuthStore.getState().accessToken;

      if (!token || !wsUrl) return;

      // Clean up existing connection
      if (wsRef.current) {
        const prev = wsRef.current;
        wsRef.current = null;
        if (prev.readyState !== WebSocket.CLOSED) {
          prev.onclose = null; // önceki onclose'u kapat, yeniden bağlanma tetiklenmesin
          prev.close(1000, 'reconnect');
        }
      }

      try {
        const ws = new WebSocket(`${wsUrl}/dashboard?token=${encodeURIComponent(token)}`);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!mountedRef.current) return;
          setConnected(true);
          setWS(ws);
          setLastError(null);
          resetReconnect();
          reconnectDelayRef.current = INITIAL_RECONNECT_DELAY;
          startHeartbeat(ws);
        };

        ws.onmessage = handleMessage;

        ws.onerror = (e) => {
          if (!mountedRef.current) return;
          setConnected(false);
          setLastError('WebSocket bağlantı hatası');
          console.error('WebSocket error:', e);
        };

        ws.onclose = (e) => {
          if (!mountedRef.current) return;
          setConnected(false);
          setWS(null);
          stopHeartbeat();

          // Don't reconnect if closed intentionally or auth failed
          if (e.code === 1000 || e.code === 4401) {
            if (e.code === 4401) {
              setLastError('Oturum süresi doldu');
              localStorage.removeItem('access_token');
              window.location.href = '/login';
            }
            return;
          }

          const delay = reconnectDelayRef.current;
          reconnectDelayRef.current = Math.min(delay * 2, MAX_RECONNECT_DELAY);
          incrementReconnect();

          reconnectTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current && useAuthStore.getState().accessToken) {
              connect();
            }
          }, delay);
        };
      } catch (err) {
        console.error('WebSocket oluşturma hatası:', err);
        setLastError('WebSocket oluşturulamadı');
      }
    };

    connect();

    return () => {
      mountedRef.current = false;
      stopHeartbeat();
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmount');
      }
    };
  }, [setConnected, setWS, handleMessage, startHeartbeat, stopHeartbeat, resetReconnect, incrementReconnect, setLastError]);
}

import { useEffect, useRef } from 'react';
import { useWSStore } from '../store/wsStore';
import { useServiceStore } from '../store/serviceStore';

export function useWebSocket() {
  const { setConnected, setWS } = useWSStore();
  const { updateServiceStatus } = useServiceStore();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const connect = () => {
      const wsUrl = import.meta.env.VITE_WS_URL;
      const token = localStorage.getItem('access_token');
      
      if (!token) return;

      const ws = new WebSocket(`${wsUrl}/dashboard`);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        setWS(ws);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'metrics' && message.service_id) {
            updateServiceStatus(message.service_id, message.data.status);
          }
        } catch (error) {
          console.error('WebSocket mesaj parse hatası:', error);
        }
      };

      ws.onerror = () => {
        setConnected(false);
      };

      ws.onclose = () => {
        setConnected(false);
        setWS(null);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 5000);
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
  }, [setConnected, setWS, updateServiceStatus]);
}

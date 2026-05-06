import { AppState, type AppStateStatus } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import { getAccessToken } from "../api/client";
import { useAuthStore } from "../store/authStore";
import type { ServiceMetrics } from "@nanonet/shared-types";

const WS_URL = process.env.EXPO_PUBLIC_WS_URL ?? "";
const MAX_RECONNECT_DELAY = 30000;
const INITIAL_RECONNECT_DELAY = 1000;
const HEARTBEAT_INTERVAL = 30000;
const MAX_CACHED_POINTS = 500;

export function useWebSocket() {
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuthStore();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectDelayRef = useRef(INITIAL_RECONNECT_DELAY);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const heartbeatRef = useRef<ReturnType<typeof setInterval>>();
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!mountedRef.current || !isAuthenticated) return;
    const token = getAccessToken();
    if (!token) return;

    const ws = new WebSocket(`${WS_URL}?token=${token}`);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectDelayRef.current = INITIAL_RECONNECT_DELAY;
      heartbeatRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }));
        }
      }, HEARTBEAT_INTERVAL);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data as string);
        if (message.type === "metric_update") {
          const metric = message.payload as ServiceMetrics;
          queryClient.setQueryData<ServiceMetrics[]>(
            ["serviceMetrics", metric.service_id],
            (prev = []) => {
              const updated = [...prev, metric];
              return updated.length > MAX_CACHED_POINTS
                ? updated.slice(updated.length - MAX_CACHED_POINTS)
                : updated;
            }
          );
        } else if (message.type === "service_status") {
          queryClient.invalidateQueries({ queryKey: ["services"] });
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (!mountedRef.current) return;
      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectDelayRef.current = Math.min(
          reconnectDelayRef.current * 2,
          MAX_RECONNECT_DELAY
        );
        connect();
      }, reconnectDelayRef.current);
    };
  }, [isAuthenticated, queryClient]);

  const disconnect = useCallback(() => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, [connect, disconnect]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") connect();
      else disconnect();
    });
    return () => sub.remove();
  }, [connect, disconnect]);
}

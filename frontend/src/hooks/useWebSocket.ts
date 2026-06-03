import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { authApi } from "../api/auth";
import { runtimeMessageToLog } from "../lib/serviceLogEntries";
import { useAuthStore } from "../store/authStore";
import { useServiceLogStore } from "../store/serviceLogStore";
import { useServiceStore } from "../store/serviceStore";
import { useWSStore } from "../store/wsStore";
import type { ServiceMetrics } from "../types/metrics";

const MAX_RECONNECT_DELAY = 30000;
const INITIAL_RECONNECT_DELAY = 1000;
const HEARTBEAT_INTERVAL = 30000;
const MAX_CACHED_POINTS = 500;
const METRICS_TTL_MS = 24 * 60 * 60 * 1000; // 24 saat
const AUTH_ACK_TIMEOUT_MS = 10000; // backend'den auth_ok bekleme süresi

export function useWebSocket() {
	const queryClient = useQueryClient();
	const {
		setConnected,
		incrementReconnect,
		resetReconnect,
		setLastMessageTime,
		setLastError,
	} = useWSStore();
	const { updateServiceStatus } = useServiceStore();
	const appendLog = useServiceLogStore((state) => state.appendLog);
	const wsRef = useRef<WebSocket | null>(null);
	const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
	const heartbeatRef = useRef<ReturnType<typeof setInterval>>();
	const authAckTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
	const reconnectDelayRef = useRef(INITIAL_RECONNECT_DELAY);
	const mountedRef = useRef(true);

	const startHeartbeat = useCallback((ws: WebSocket) => {
		if (heartbeatRef.current) clearInterval(heartbeatRef.current);
		heartbeatRef.current = setInterval(() => {
			if (ws.readyState === WebSocket.OPEN) {
				try {
					ws.send(JSON.stringify({ type: "ping" }));
				} catch {
					// Connection might be closing
				}
			}
		}, HEARTBEAT_INTERVAL);
	}, []);

	const handleMessage = useCallback(
		(event: MessageEvent) => {
			try {
				setLastMessageTime(Date.now());
				const message = JSON.parse(event.data);
				const log = runtimeMessageToLog(message);
				if (log) {
					appendLog(log.serviceId, log.entry);
				}

				switch (message.type) {
					case "auth_ok": {
						const activeWS = wsRef.current;
						if (!activeWS) break;
						// ACK zamanında geldi — timeout'u iptal et
						if (authAckTimeoutRef.current) {
							clearTimeout(authAckTimeoutRef.current);
							authAckTimeoutRef.current = undefined;
						}
						setConnected(true);
						setLastError(null);
						resetReconnect();
						reconnectDelayRef.current = INITIAL_RECONNECT_DELAY;
						startHeartbeat(activeWS);
						break;
					}

					case "metric_update":
						if (message.service_id && message.data?.status) {
							updateServiceStatus(message.service_id, message.data.status);
							queryClient.setQueryData(["services"], (old: unknown) => {
								if (!Array.isArray(old)) return old;
								return old.map((s: { id: string }) =>
									s.id === message.service_id
										? {
											...s,
											status:                   message.data.status,
											agent_connected:          true,
											agent_status:             message.data.agent_status ?? "healthy",
											agent_last_heartbeat_at:  new Date().toISOString(), // WS receipt time, not metric time
											agent_version:            message.data.agent_version ?? (s as Record<string, unknown>).agent_version,
										  }
										: s,
								);
							});

							// Push the new data point into all cached serviceMetrics queries for
							// this service so charts update in real-time without waiting for a poll.
							const newPoint: ServiceMetrics = {
								time: message.data.time ?? new Date().toISOString(),
								service_id: message.service_id,
								status: message.data.status,
								cpu_percent: message.data.cpu_percent,
								memory_used_mb: message.data.memory_used_mb,
								latency_ms: message.data.latency_ms,
								error_rate: message.data.error_rate,
								disk_used_gb: message.data.disk_used_gb,
							};

							const appendMetricPoint = (old: ServiceMetrics[] | undefined) => {
								const now = Date.now();
								const arr = [...(old ?? []), newPoint].filter(
									(p) => now - new Date(p.time).getTime() < METRICS_TTL_MS,
								);
								return arr.slice(-MAX_CACHED_POINTS);
							};

							queryClient.setQueriesData(
								{
									predicate: (query) => {
										const key = query.queryKey;
										return (
											Array.isArray(key) &&
											key[0] === "serviceMetrics" &&
											key[1] === message.service_id
										);
									},
								},
								(old: ServiceMetrics[] | undefined) => {
									if (!Array.isArray(old)) return old;
									return appendMetricPoint(old);
								},
							);

							// Warm the default detail-page duration even before the page is opened.
							queryClient.setQueryData(
								["serviceMetrics", message.service_id, "1h"],
								(old: ServiceMetrics[] | undefined) => {
									const now = Date.now();
									const arr = [...(old ?? []), newPoint].filter(
										(p) => now - new Date(p.time).getTime() < METRICS_TTL_MS,
									);
									return arr.slice(-MAX_CACHED_POINTS);
								},
							);
						}
						break;

					case "alert":
						if (message.data) {
							const severity = message.data.severity;
							const text = message.data.message || "Yeni alert";
							if (severity === "crit") {
								toast.error(text, { duration: 5000 });
							} else if (severity === "warn") {
								toast.warning(text, { duration: 4000 });
							} else {
								toast.info(text);
							}
						}
						break;

					case "command_status": {
						const commandEvent = new CustomEvent("nanonet:command_result", {
							detail: {
								command_id: message.command_id,
								status: message.status,
								output: message.output,
								error: message.error,
								service_id: message.service_id,
							},
						});
						window.dispatchEvent(commandEvent);
						if (message.status === "success") {
							toast.success(`Komut tamamlandı`, { duration: 2500 });
						} else if (
							message.status === "failed" ||
							message.status === "timeout"
						) {
							toast.error(
								`Komut başarısız: ${message.error ?? "bilinmeyen hata"}`,
								{ duration: 4000 },
							);
						}
						break;
					}

					case "pong":
						// Heartbeat response, connection healthy
						break;
				}
			} catch (error) {
				console.error("WebSocket mesaj parse hatası:", error);
			}
		},
		[
			updateServiceStatus,
			appendLog,
			setLastMessageTime,
			queryClient,
			startHeartbeat,
			setLastError,
			setConnected,
			resetReconnect,
		],
	);

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

			const wsUrl = import.meta.env.VITE_WS_URL ??
				`${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws`;
			const token = useAuthStore.getState().accessToken;

			if (!token) return;

			// Clean up existing connection
			if (wsRef.current) {
				const prev = wsRef.current;
				wsRef.current = null;
				if (prev.readyState !== WebSocket.CLOSED) {
					prev.onclose = null; // önceki onclose'u kapat, yeniden bağlanma tetiklenmesin
					prev.close(1000, "reconnect");
				}
			}

			try {
				const ws = new WebSocket(`${wsUrl}/dashboard`);
				wsRef.current = ws;

				ws.onopen = () => {
					if (!mountedRef.current) return;
					// Token'ı URL yerine ilk mesaj olarak gönder (server log / browser history'de görünmez)
					// setConnected backend'den auth_ok mesajı geldikten sonra çağrılır.
					try {
						ws.send(JSON.stringify({ type: "auth", token }));
					} catch {
						ws.close(1000, "auth send failed");
						return;
					}
					// auth_ok gelmezse bağlantıyı kapat → onclose → normal reconnect akışı
					authAckTimeoutRef.current = setTimeout(() => {
						if (!mountedRef.current) return;
						if (wsRef.current === ws && ws.readyState === WebSocket.OPEN) {
							setLastError("Sunucu kimlik doğrulama yanıtı vermedi");
							ws.close(4408, "auth ack timeout");
						}
					}, AUTH_ACK_TIMEOUT_MS);
				};

				ws.onmessage = handleMessage;

				ws.onerror = () => {
					if (!mountedRef.current) return;
					setConnected(false);
					setLastError("WebSocket bağlantı hatası");
					// Don't log: connection failures during startup/reconnect are expected
					// and handled visually via the connection state in the UI.
				};

				ws.onclose = (e) => {
					if (!mountedRef.current) return;
					setConnected(false);
					stopHeartbeat();

					// Don't reconnect if closed intentionally or auth failed
					if (e.code === 1000 || e.code === 4401) {
						if (e.code === 4401) {
							setLastError("Oturum süresi doldu");
							useAuthStore.getState().clearAuth();
							window.location.href = "/login";
						}
						return;
					}

					const delay = reconnectDelayRef.current;
					reconnectDelayRef.current = Math.min(delay * 2, MAX_RECONNECT_DELAY);
					incrementReconnect();

					reconnectTimeoutRef.current = setTimeout(async () => {
						if (!mountedRef.current) return;

						const authState = useAuthStore.getState();
						if (!authState.accessToken) return;

						// Refresh artık cookie üzerinden taşınıyor (HttpOnly); store'da
						// token yok. authApi.refresh() çağrısı backend'in cookie'yi
						// okumasına dayanır — başarılıysa yeni access token gelir.
						try {
							const tokens = await authApi.refresh();
							if (authState.user) {
								authState.setAuth(authState.user, tokens.access_token);
							}
						} catch {
							// Refresh başarısız — oturumu temizle ve login'e yönlendir
							authState.clearAuth();
							window.location.href = "/login";
							return;
						}

						connect();
					}, delay);
				};
			} catch (err) {
				console.error("WebSocket oluşturma hatası:", err);
				setLastError("WebSocket oluşturulamadı");
			}
		};

		connect();

		return () => {
			mountedRef.current = false;
			stopHeartbeat();
			if (authAckTimeoutRef.current) {
				clearTimeout(authAckTimeoutRef.current);
			}
			if (reconnectTimeoutRef.current) {
				clearTimeout(reconnectTimeoutRef.current);
			}
			if (wsRef.current) {
				wsRef.current.close(1000, "Component unmount");
			}
		};
	}, [
		setConnected,
		handleMessage,
		stopHeartbeat,
		incrementReconnect,
		setLastError,
	]);
}

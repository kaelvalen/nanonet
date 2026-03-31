import {
	AlertCircle,
	CheckCircle2,
	ChevronDown,
	Circle,
	Download,
	Loader2,
	Search,
	Terminal,
	Trash2,
	WifiOff,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { metricsApi } from "@/api/metrics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/components/ui/utils";
import { useAuthStore } from "@/store/authStore";

export interface LogEntry {
	id: string;
	timestamp: string;
	level: "info" | "warn" | "error" | "debug";
	source: string;
	message: string;
	raw?: string;
}

interface LogViewerProps {
	serviceId: string;
	serviceName?: string;
	maxLines?: number;
}

const LEVEL_COLORS: Record<string, string> = {
	info: "var(--color-blue)",
	warn: "var(--status-warn)",
	error: "var(--status-down)",
	debug: "var(--text-faint)",
};

const LEVEL_BG: Record<string, string> = {
	info: "rgba(59,130,246,0.08)",
	warn: "rgba(245,158,11,0.08)",
	error: "rgba(239,68,68,0.08)",
	debug: "transparent",
};

function parseAgentMessage(raw: string, serviceId: string): LogEntry | null {
	try {
		const msg = JSON.parse(raw);

		if (msg.type === "metrics" && msg.service_id === serviceId) {
			const sys = msg.system ?? {};
			const svc = msg.service ?? {};
			return {
				id: `${Date.now()}-${Math.random()}`,
				timestamp: msg.timestamp ?? new Date().toISOString(),
				level:
					svc.status === "down"
						? "error"
						: svc.status === "degraded"
							? "warn"
							: "info",
				source: "agent",
				message: `cpu=${sys.cpu_percent?.toFixed(1) ?? "?"}% mem=${sys.memory_used_mb?.toFixed(0) ?? "?"}MB latency=${svc.latency_ms?.toFixed(0) ?? "?"}ms status=${svc.status ?? "?"}`,
				raw,
			};
		}

		if (msg.type === "alert" && msg.data?.service_id === serviceId) {
			const sev = msg.data.severity ?? "info";
			return {
				id: `${Date.now()}-${Math.random()}`,
				timestamp: new Date().toISOString(),
				level: sev === "crit" ? "error" : sev === "warn" ? "warn" : "info",
				source: "alert",
				message: `[ALERT] ${msg.data.message ?? ""}`,
				raw,
			};
		}

		if (msg.type === "command_status" && msg.service_id === serviceId) {
			const isErr = msg.status === "failed" || msg.status === "timeout";
			return {
				id: `${Date.now()}-${Math.random()}`,
				timestamp: new Date().toISOString(),
				level: isErr ? "error" : "info",
				source: "command",
				message: `[CMD] ${msg.action ?? "command"} → ${msg.status}${msg.output ? ` — ${msg.output}` : ""}`,
				raw,
			};
		}

		if (msg.type === "metric_update" && msg.service_id === serviceId) {
			const d = msg.data ?? {};
			return {
				id: `${Date.now()}-${Math.random()}`,
				timestamp: d.time ?? new Date().toISOString(),
				level:
					d.status === "down"
						? "error"
						: d.status === "degraded"
							? "warn"
							: "info",
				source: "metric",
				message: `cpu=${d.cpu_percent?.toFixed(1) ?? "?"}% mem=${d.memory_used_mb?.toFixed(0) ?? "?"}MB latency=${d.latency_ms?.toFixed(0) ?? "?"}ms status=${d.status ?? "?"}`,
				raw,
			};
		}
	} catch {}
	return null;
}

function formatTimestamp(ts: string): string {
	try {
		const d = new Date(ts);
		return d.toLocaleTimeString("tr-TR", {
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		});
	} catch {
		return ts;
	}
}

function LevelBadge({ level }: { level: string }) {
	const color = LEVEL_COLORS[level] ?? LEVEL_COLORS.debug;
	return (
		<span
			className="text-xs font-mono font-bold w-11 text-center inline-block shrink-0"
			style={{ color }}
		>
			{level.toUpperCase()}
		</span>
	);
}

const HTTP_POLL_INTERVAL_MS = 10_000;

export function LogViewer({
	serviceId,
	serviceName,
	maxLines = 500,
}: LogViewerProps) {
	const [logs, setLogs] = useState<LogEntry[]>([]);
	const [connected, setConnected] = useState(false);
	const [pollingFallback, setPollingFallback] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [search, setSearch] = useState("");
	const [levelFilter, setLevelFilter] = useState<string>("all");
	const [autoScroll, setAutoScroll] = useState(true);
	const [paused, setPaused] = useState(false);
	const [unreadCount, setUnreadCount] = useState(0);

	const wsRef = useRef<WebSocket | null>(null);
	const pollTimerRef = useRef<ReturnType<typeof setInterval>>();
	const seenTimestamps = useRef<Set<string>>(new Set());
	const bottomRef = useRef<HTMLDivElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const pausedRef = useRef(paused);
	pausedRef.current = paused;

	const addLog = useCallback(
		(entry: LogEntry) => {
			if (pausedRef.current) return;
			setUnreadCount((n) => (autoScrollRef.current ? 0 : n + 1));
			setLogs((prev) => {
				const next = [...prev, entry];
				return next.length > maxLines ? next.slice(-maxLines) : next;
			});
		},
		[maxLines],
	);

	useEffect(() => {
		const wsUrl = import.meta.env.VITE_WS_URL as string;
		const token = useAuthStore.getState().accessToken;
		if (!wsUrl || !token) return;

		setError(null);

		const ws = new WebSocket(`${wsUrl}/services/${serviceId}`);
		wsRef.current = ws;

		ws.onopen = () => {
			// setConnected backend'den auth_ok mesajı geldikten sonra çağrılır.
			ws.send(JSON.stringify({ type: "auth", token }));
		};

		ws.onmessage = (e) => {
			try {
				const msg = JSON.parse(e.data);
				if (msg.type === "auth_ok") {
					setConnected(true);
					addLog({
						id: "sys-connect",
						timestamp: new Date().toISOString(),
						level: "info",
						source: "system",
						message: `Log akışı başlatıldı — ${serviceName ?? serviceId}`,
					});
					return;
				}
			} catch {
				// not JSON or not auth_ok — fall through to parseAgentMessage
			}
			const entry = parseAgentMessage(e.data, serviceId);
			if (entry) addLog(entry);
		};

		ws.onerror = () => {
			setConnected(false);
			setError("WebSocket bağlantı hatası");
		};

		ws.onclose = (ev) => {
			setConnected(false);
			if (ev.code !== 1000) {
				setError(`Bağlantı kapandı (${ev.code}) — HTTP polling aktif`);
				// Start HTTP polling fallback
				setPollingFallback(true);
				const poll = async () => {
					if (pausedRef.current) return;
					try {
						const metrics = await metricsApi.getHistory(serviceId, "15m", 20);
						for (const m of metrics) {
							if (seenTimestamps.current.has(m.time)) continue;
							seenTimestamps.current.add(m.time);
							addLog({
								id: `poll-${m.time}`,
								timestamp: m.time,
								level:
									m.status === "down"
										? "error"
										: m.status === "degraded"
											? "warn"
											: "info",
								source: "poll",
								message: `cpu=${m.cpu_percent?.toFixed(1) ?? "?"}% mem=${m.memory_used_mb?.toFixed(0) ?? "?"}MB latency=${m.latency_ms?.toFixed(0) ?? "?"}ms status=${m.status ?? "?"}`,
							});
						}
					} catch {
						// silently ignore polling errors
					}
				};
				poll();
				pollTimerRef.current = setInterval(poll, HTTP_POLL_INTERVAL_MS);
			}
		};

		return () => {
			ws.onclose = null;
			ws.close(1000, "unmount");
			if (pollTimerRef.current) {
				clearInterval(pollTimerRef.current);
				pollTimerRef.current = undefined;
				setPollingFallback(false);
			}
		};
	}, [serviceId, serviceName, addLog]);

	const autoScrollRef = useRef(autoScroll);
	autoScrollRef.current = autoScroll;

	useEffect(() => {
		if (autoScroll && !paused) {
			bottomRef.current?.scrollIntoView({ behavior: "smooth" });
			setUnreadCount(0);
		}
	}, [autoScroll, paused]);

	const handleScroll = () => {
		const el = containerRef.current;
		if (!el) return;
		const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
		setAutoScroll(atBottom);
		if (atBottom) setUnreadCount(0);
	};

	const scrollToBottom = () => {
		setAutoScroll(true);
		setUnreadCount(0);
		bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	};

	const filtered = useMemo(() => {
		return logs.filter((l) => {
			const matchLevel = levelFilter === "all" || l.level === levelFilter;
			const matchSearch =
				!search ||
				l.message.toLowerCase().includes(search.toLowerCase()) ||
				l.source.toLowerCase().includes(search.toLowerCase());
			return matchLevel && matchSearch;
		});
	}, [logs, search, levelFilter]);

	const downloadLogs = () => {
		const text = filtered
			.map(
				(l) =>
					`[${l.timestamp}] [${l.level.toUpperCase()}] [${l.source}] ${l.message}`,
			)
			.join("\n");
		const blob = new Blob([text], { type: "text/plain" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `${serviceName ?? serviceId}-logs.txt`;
		a.click();
		URL.revokeObjectURL(url);
	};

	const counts = useMemo(
		() => ({
			error: logs.filter((l) => l.level === "error").length,
			warn: logs.filter((l) => l.level === "warn").length,
			info: logs.filter((l) => l.level === "info").length,
		}),
		[logs],
	);

	return (
		<div
			className="flex flex-col h-full rounded overflow-hidden"
			style={{
				background: "var(--surface-card)",
				border: "2px solid var(--border-default)",
				boxShadow: "var(--card-shadow)",
				fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
			}}
		>
			{/* Header */}
			<div
				className="flex items-center gap-3 px-4 py-2.5 border-b"
				style={{ borderColor: "var(--border-subtle)" }}
			>
				<div className="flex items-center gap-2">
					<Terminal
						className="w-4 h-4"
						style={{ color: "var(--color-blue)" }}
					/>
					<span
						className="text-sm font-semibold"
						style={{ color: "var(--text-primary)" }}
					>
						Log Akışı
					</span>
					{serviceName && (
						<span className="text-xs" style={{ color: "var(--text-faint)" }}>
							— {serviceName}
						</span>
					)}
				</div>

				<div className="flex items-center gap-1.5">
					{connected ? (
						<>
							<Circle
								className="w-2 h-2 fill-current animate-pulse"
								style={{ color: "var(--status-up)" }}
							/>
							<span className="text-xs" style={{ color: "var(--status-up)" }}>
								Canlı
							</span>
						</>
					) : pollingFallback ? (
						<>
							<Loader2
								className="w-3 h-3 animate-spin"
								style={{ color: "var(--status-warn)" }}
							/>
							<span className="text-xs" style={{ color: "var(--status-warn)" }}>
								HTTP Polling
							</span>
						</>
					) : (
						<>
							<WifiOff
								className="w-3 h-3"
								style={{ color: "var(--text-faint)" }}
							/>
							<span className="text-xs" style={{ color: "var(--text-faint)" }}>
								{error ?? "Bağlantı kesik"}
							</span>
						</>
					)}
				</div>

				<div className="flex items-center gap-2 text-xs">
					{counts.error > 0 && (
						<span style={{ color: LEVEL_COLORS.error }}>
							{counts.error} hata
						</span>
					)}
					{counts.warn > 0 && (
						<span style={{ color: LEVEL_COLORS.warn }}>
							{counts.warn} uyarı
						</span>
					)}
				</div>

				<div className="flex-1" />

				<div className="flex items-center gap-2">
					<div className="relative">
						<Search
							className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3"
							style={{ color: "var(--text-faint)" }}
						/>
						<Input
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							placeholder="Filtrele..."
							className="h-7 pl-7 text-xs w-36"
							style={{ background: "var(--bg-surface)" }}
						/>
					</div>

					<div className="flex items-center gap-1">
						{(["all", "error", "warn", "info", "debug"] as const).map((lvl) => (
							<button
								type="button"
								key={lvl}
								onClick={() => setLevelFilter(lvl)}
								className={cn(
									"text-xs px-1.5 py-0.5 rounded transition-all",
									levelFilter === lvl
										? "font-bold"
										: "opacity-50 hover:opacity-80",
								)}
								style={{
									color:
										lvl === "all" ? "var(--text-secondary)" : LEVEL_COLORS[lvl],
									background:
										levelFilter === lvl
											? (LEVEL_BG[lvl] ?? "var(--bg-elevated)")
											: "transparent",
								}}
							>
								{lvl === "all" ? "Tümü" : lvl.toUpperCase()}
							</button>
						))}
					</div>

					<Button
						size="icon"
						variant="ghost"
						className="h-7 w-7"
						onClick={() => setPaused((v) => !v)}
						title={paused ? "Devam et" : "Duraklat"}
					>
						{paused ? (
							<CheckCircle2
								className="w-3.5 h-3.5"
								style={{ color: "var(--status-up)" }}
							/>
						) : (
							<AlertCircle
								className="w-3.5 h-3.5"
								style={{ color: "var(--text-faint)" }}
							/>
						)}
					</Button>

					<Button
						size="icon"
						variant="ghost"
						className="h-7 w-7"
						onClick={downloadLogs}
						title="İndir"
					>
						<Download
							className="w-3.5 h-3.5"
							style={{ color: "var(--text-faint)" }}
						/>
					</Button>

					<Button
						size="icon"
						variant="ghost"
						className="h-7 w-7"
						onClick={() => setLogs([])}
						title="Temizle"
					>
						<Trash2
							className="w-3.5 h-3.5"
							style={{ color: "var(--text-faint)" }}
						/>
					</Button>
				</div>
			</div>

			{/* Log lines */}
			<div className="relative flex-1 min-h-0">
				<div
					ref={containerRef}
					onScroll={handleScroll}
					className="h-full overflow-y-auto text-xs leading-relaxed"
					style={{
						background: "var(--bg-primary)",
					}}
				>
					{filtered.length === 0 && (
						<div className="flex flex-col items-center justify-center h-32 gap-2">
							{connected ? (
								<>
									<Loader2
										className="w-4 h-4 animate-spin"
										style={{ color: "var(--text-faint)" }}
									/>
									<p className="text-xs" style={{ color: "var(--text-faint)" }}>
										Log bekleniyor...
									</p>
								</>
							) : (
								<p className="text-xs" style={{ color: "var(--text-faint)" }}>
									{error ?? "Bağlantı kurulmadı"}
								</p>
							)}
						</div>
					)}

					{filtered.map((log) => (
						<div
							key={log.id}
							className="flex items-start gap-2 px-4 py-0.5 hover:opacity-90 transition-colors"
							style={{ background: LEVEL_BG[log.level] ?? "transparent" }}
						>
							<span
								className="shrink-0 text-xs tabular-nums pt-px"
								style={{ color: "var(--text-faint)", minWidth: "60px" }}
							>
								{formatTimestamp(log.timestamp)}
							</span>
							<LevelBadge level={log.level} />
							<span
								className="shrink-0 text-xs"
								style={{ color: "var(--text-faint)", minWidth: "52px" }}
							>
								[{log.source}]
							</span>
							<span
								style={{ color: "var(--text-primary)", wordBreak: "break-all" }}
							>
								{log.message}
							</span>
						</div>
					))}

					<div ref={bottomRef} />
				</div>
				{!autoScroll && (
					<button
						type="button"
						onClick={scrollToBottom}
						className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium shadow-lg transition-all hover:opacity-90"
						style={{
							background: "var(--color-blue)",
							color: "white",
							zIndex: 10,
						}}
					>
						<ChevronDown className="w-3 h-3" />
						{unreadCount > 0 ? `${unreadCount} yeni log` : "En alta in"}
					</button>
				)}
			</div>

			{/* Footer */}
			<div
				className="flex items-center justify-between px-4 py-1.5 border-t text-xs"
				style={{
					borderColor: "var(--border-subtle)",
					color: "var(--text-faint)",
				}}
			>
				<span>
					{filtered.length} / {logs.length} satır
				</span>
				{!autoScroll && (
					<button
						type="button"
						className="flex items-center gap-1 hover:opacity-80"
						onClick={() => {
							setAutoScroll(true);
							bottomRef.current?.scrollIntoView({ behavior: "smooth" });
						}}
					>
						<ChevronDown className="w-3 h-3" />
						En alta in
					</button>
				)}
				{paused && (
					<span style={{ color: LEVEL_COLORS.warn }}>⏸ Duraklatıldı</span>
				)}
			</div>
		</div>
	);
}

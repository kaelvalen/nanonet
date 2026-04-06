import { useQuery } from "@tanstack/react-query";
import {
	Activity,
	AlertCircle,
	AlertTriangle,
	Bug,
	ChevronDown,
	ChevronUp,
	Clock,
	Cloud,
	Download,
	Info,
	Loader2,
	RefreshCw,
	Search,
	Server,
	Shield,
	Terminal,
	X,
	Zap,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { type LogQueryParams, logsApi, type ServiceLog } from "@/api/metrics";
import { servicesApi } from "@/api/services";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/store/authStore";

// ── Tipler ──────────────────────────────────────────────────────
type TabKey = "service" | "audit" | "k8s";

interface AuditLog {
	ID: string;
	UserID: string | null;
	Action: string;
	ResourceType: string;
	ResourceID: string | null;
	IPAddress: string | null;
	Status: "success" | "failure" | "blocked";
	Details: Record<string, unknown> | null;
	CreatedAt: string;
	// lowercase aliases (fallback)
	id?: string;
	action?: string;
	resource_type?: string;
	ip_address?: string | null;
	status?: "success" | "failure" | "blocked";
	created_at?: string;
}

// ── Sabitler ────────────────────────────────────────────────────
const LEVEL_CONFIG: Record<
	string,
	{
		label: string;
		icon: React.ElementType;
		textColor: string;
		bgColor: string;
		dotColor: string;
	}
> = {
	debug: {
		label: "Debug",
		icon: Bug,
		textColor: "var(--text-faint)",
		bgColor: "transparent",
		dotColor: "var(--text-faint)",
	},
	info: {
		label: "Info",
		icon: Info,
		textColor: "var(--color-blue-text)",
		bgColor: "var(--color-blue-subtle)",
		dotColor: "var(--color-blue)",
	},
	warn: {
		label: "Warn",
		icon: AlertTriangle,
		textColor: "var(--status-warn-text)",
		bgColor: "var(--status-warn-subtle)",
		dotColor: "var(--status-warn)",
	},
	error: {
		label: "Error",
		icon: AlertCircle,
		textColor: "var(--status-down-text)",
		bgColor: "var(--status-down-subtle)",
		dotColor: "var(--status-down)",
	},
};

const SOURCE_CONFIG: Record<
	string,
	{ label: string; icon: React.ElementType; color: string }
> = {
	agent: { label: "Agent", icon: Terminal, color: "var(--color-lavender)" },
	system: { label: "Sistem", icon: Activity, color: "var(--color-blue)" },
	k8s: { label: "Kubernetes", icon: Cloud, color: "var(--color-teal)" },
	health_check: { label: "Health Check", icon: Zap, color: "var(--status-up)" },
	command: { label: "Komut", icon: Terminal, color: "var(--status-warn)" },
};

const AUDIT_STATUS_CONFIG: Record<
	string,
	{ label: string; textColor: string; bgColor: string; borderColor: string }
> = {
	success: {
		label: "Başarılı",
		textColor: "var(--status-up-text)",
		bgColor: "var(--status-up-subtle)",
		borderColor: "var(--status-up-border)",
	},
	failure: {
		label: "Başarısız",
		textColor: "var(--status-down-text)",
		bgColor: "var(--status-down-subtle)",
		borderColor: "var(--status-down-border)",
	},
	blocked: {
		label: "Engellendi",
		textColor: "var(--status-warn-text)",
		bgColor: "var(--status-warn-subtle)",
		borderColor: "var(--status-warn-border)",
	},
};

// ── Yardımcılar ─────────────────────────────────────────────────
function formatTime(iso: string): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return "—";
	return d.toLocaleString("tr-TR", {
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});
}

function auditTime(log: AuditLog): string {
	return formatTime(log.CreatedAt ?? log.created_at ?? "");
}
function auditAction(log: AuditLog): string {
	return log.Action ?? log.action ?? "";
}
function auditResource(log: AuditLog): string {
	return log.ResourceType ?? log.resource_type ?? "";
}
function auditIP(log: AuditLog): string {
	return log.IPAddress ?? log.ip_address ?? "—";
}
function auditStatus(log: AuditLog): "success" | "failure" | "blocked" {
	return log.Status ?? log.status ?? "success";
}
function auditID(log: AuditLog, idx: number): string {
	return log.ID ?? log.id ?? `audit-${idx}`;
}

function downloadLogs(logs: ServiceLog[]) {
	const lines = logs
		.map(
			(l) => `${l.time}\t${l.level.toUpperCase()}\t${l.source}\t${l.message}`,
		)
		.join("\n");
	const blob = new Blob([lines], { type: "text/plain" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = `nanonet-logs-${Date.now()}.txt`;
	a.click();
	URL.revokeObjectURL(url);
}

// ── Bileşenler ───────────────────────────────────────────────────
function StatCard({
	label,
	value,
	cfg,
}: {
	label: string;
	value: number;
	cfg: {
		textColor: string;
		bgColor: string;
		dotColor: string;
		icon: React.ElementType;
	};
}) {
	const Icon = cfg.icon;
	return (
		<div
			className="rounded-xl p-4 flex items-center gap-3 relative overflow-hidden"
			style={{
				background: "var(--surface-card)",
				border: "1px solid var(--border-default)",
			}}
		>
			<div
				className="absolute left-0 top-3 bottom-3 w-0.5 rounded-r-full"
				style={{ background: cfg.dotColor }}
			/>
			<div
				className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
				style={{
					background: cfg.bgColor,
					border: `1px solid ${cfg.dotColor}30`,
				}}
			>
				<Icon className="w-4 h-4" style={{ color: cfg.textColor }} />
			</div>
			<div>
				<p
					className="text-2xl font-bold tabular-nums leading-none"
					style={{ color: cfg.textColor }}
				>
					{value.toLocaleString()}
				</p>
				<p
					className="text-[11px] font-medium mt-0.5"
					style={{ color: "var(--text-faint)" }}
				>
					{label}
				</p>
			</div>
		</div>
	);
}

function LogRow({ log }: { log: ServiceLog }) {
	const [expanded, setExpanded] = useState(false);
	const lvl = LEVEL_CONFIG[log.level] ?? LEVEL_CONFIG.info;
	const src = SOURCE_CONFIG[log.source] ?? SOURCE_CONFIG.system;
	const LevelIcon = lvl.icon;
	const SrcIcon = src.icon;
	const hasFields = log.fields && Object.keys(log.fields).length > 0;

	return (
		<div
			style={{
				borderBottom: "1px solid var(--border-subtle)",
				background: lvl.bgColor,
			}}
		>
			<button
				type="button"
				className="w-full text-left px-4 py-2 flex items-start gap-3 transition-colors"
				style={{ background: "transparent" }}
				onClick={() => hasFields && setExpanded((v) => !v)}
			>
				<LevelIcon
					className="w-3.5 h-3.5 mt-0.5 shrink-0"
					style={{ color: lvl.textColor }}
				/>
				<span
					className="font-mono text-[10px] shrink-0 w-36"
					style={{ color: "var(--text-faint)" }}
				>
					{formatTime(log.time)}
				</span>
				<span
					className="flex items-center gap-1 text-[10px] shrink-0 w-28 font-medium"
					style={{ color: src.color }}
				>
					<SrcIcon className="w-3 h-3" />
					{src.label}
				</span>
				<span
					className="text-xs flex-1 font-mono leading-relaxed"
					style={{ color: "var(--text-secondary)" }}
				>
					{log.message}
				</span>
				{hasFields && (
					<span className="shrink-0" style={{ color: "var(--text-faint)" }}>
						{expanded ? (
							<ChevronUp className="w-3.5 h-3.5" />
						) : (
							<ChevronDown className="w-3.5 h-3.5" />
						)}
					</span>
				)}
			</button>
			{expanded && log.fields && (
				<div className="px-14 pb-3">
					<pre
						className="text-xs font-mono rounded-lg p-3 overflow-x-auto"
						style={{
							background: "var(--surface-sunken)",
							color: "var(--text-muted)",
						}}
					>
						{JSON.stringify(log.fields, null, 2)}
					</pre>
				</div>
			)}
		</div>
	);
}

function AuditRow({ log }: { log: AuditLog }) {
	const statusKey = auditStatus(log);
	const st = AUDIT_STATUS_CONFIG[statusKey] ?? AUDIT_STATUS_CONFIG.success;
	return (
		<div
			className="px-4 py-2.5 flex items-center gap-3 transition-colors"
			style={{ borderBottom: "1px solid var(--border-subtle)" }}
		>
			<span
				className="font-mono text-[10px] shrink-0 w-36"
				style={{ color: "var(--text-faint)" }}
			>
				{auditTime(log)}
			</span>
			<span
				className="text-[10px] px-2 py-0.5 rounded font-semibold uppercase shrink-0 border"
				style={{
					color: st.textColor,
					background: st.bgColor,
					borderColor: st.borderColor,
				}}
			>
				{st.label}
			</span>
			<span
				className="text-xs font-mono shrink-0 w-44 truncate"
				style={{ color: "var(--text-secondary)" }}
			>
				{auditAction(log)}
			</span>
			<span
				className="text-xs shrink-0 w-28 truncate"
				style={{ color: "var(--text-muted)" }}
			>
				{auditResource(log)}
			</span>
			<span
				className="text-xs flex-1 truncate font-mono"
				style={{ color: "var(--text-faint)" }}
			>
				{auditIP(log)}
			</span>
		</div>
	);
}

// ── Service Logs Tab ─────────────────────────────────────────────
function ServiceLogsTab() {
	const { data: services } = useQuery({
		queryKey: ["services"],
		queryFn: () => servicesApi.list(),
	});

	const [selectedServiceId, setSelectedServiceId] = useState<string>("");
	const [params, setParams] = useState<LogQueryParams>({
		limit: 100,
		offset: 0,
	});
	const [search, setSearch] = useState("");
	const searchTimer = useRef<ReturnType<typeof setTimeout>>();

	const { data, isLoading, refetch, isFetching } = useQuery({
		queryKey: ["service-logs", selectedServiceId, params],
		queryFn: () => logsApi.getServiceLogs(selectedServiceId, params),
		enabled: !!selectedServiceId,
		refetchInterval: selectedServiceId ? 15_000 : false,
	});

	const { data: stats } = useQuery({
		queryKey: ["log-stats", selectedServiceId],
		queryFn: () => logsApi.getStats(selectedServiceId || undefined),
		refetchInterval: 30_000,
	});

	useEffect(() => {
		clearTimeout(searchTimer.current);
		searchTimer.current = setTimeout(() => {
			setParams((p) => ({ ...p, search: search || undefined, offset: 0 }));
		}, 400);
		return () => clearTimeout(searchTimer.current);
	}, [search]);

	return (
		<div className="space-y-4">
			{/* Filters */}
			<div className="flex flex-wrap gap-2">
				<select
					className="px-3 py-2 text-sm rounded-lg appearance-none"
					style={{
						background: "var(--surface-card)",
						border: "1px solid var(--border-default)",
						color: "var(--text-primary)",
					}}
					value={selectedServiceId}
					onChange={(e) => {
						setSelectedServiceId(e.target.value);
						setParams((p) => ({ ...p, offset: 0 }));
					}}
				>
					<option value="">Servis seçin...</option>
					{services?.map((s: { id: string; name: string }) => (
						<option key={s.id} value={s.id}>
							{s.name}
						</option>
					))}
				</select>

				<select
					className="px-3 py-2 text-sm rounded-lg appearance-none"
					style={{
						background: "var(--surface-card)",
						border: "1px solid var(--border-default)",
						color: "var(--text-primary)",
					}}
					value={params.level ?? ""}
					onChange={(e) =>
						setParams((p) => ({
							...p,
							level: e.target.value || undefined,
							offset: 0,
						}))
					}
				>
					<option value="">Tüm seviyeler</option>
					{Object.entries(LEVEL_CONFIG).map(([k, v]) => (
						<option key={k} value={k}>
							{v.label}
						</option>
					))}
				</select>

				<select
					className="px-3 py-2 text-sm rounded-lg appearance-none"
					style={{
						background: "var(--surface-card)",
						border: "1px solid var(--border-default)",
						color: "var(--text-primary)",
					}}
					value={params.source ?? ""}
					onChange={(e) =>
						setParams((p) => ({
							...p,
							source: e.target.value || undefined,
							offset: 0,
						}))
					}
				>
					<option value="">Tüm kaynaklar</option>
					{Object.entries(SOURCE_CONFIG).map(([k, v]) => (
						<option key={k} value={k}>
							{v.label}
						</option>
					))}
				</select>

				<div className="relative flex-1" style={{ minWidth: "180px" }}>
					<Search
						className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
						style={{ color: "var(--text-faint)" }}
					/>
					<Input
						className="pl-9"
						placeholder="Mesaj ara..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
					/>
					{search && (
						<button
							type="button"
							onClick={() => setSearch("")}
							className="absolute right-3 top-1/2 -translate-y-1/2"
							style={{ color: "var(--text-faint)" }}
						>
							<X className="w-3.5 h-3.5" />
						</button>
					)}
				</div>

				<Button
					variant="outline"
					size="sm"
					onClick={() => refetch()}
					disabled={isFetching}
				>
					<RefreshCw className="w-3.5 h-3.5 mr-1.5" />
					Yenile
				</Button>
				{data?.logs && data.logs.length > 0 && (
					<Button
						variant="outline"
						size="sm"
						onClick={() => downloadLogs(data.logs)}
					>
						<Download className="w-3.5 h-3.5 mr-1.5" />
						İndir
					</Button>
				)}
			</div>

			{/* Stats */}
			{stats && (
				<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
					<StatCard
						label="Debug"
						value={stats.debug ?? 0}
						cfg={LEVEL_CONFIG.debug}
					/>
					<StatCard
						label="Info"
						value={stats.info ?? 0}
						cfg={LEVEL_CONFIG.info}
					/>
					<StatCard
						label="Warn"
						value={stats.warn ?? 0}
						cfg={LEVEL_CONFIG.warn}
					/>
					<StatCard
						label="Error"
						value={stats.error ?? 0}
						cfg={LEVEL_CONFIG.error}
					/>
				</div>
			)}

			{/* Log list */}
			<Card
				style={{
					background: "var(--surface-card)",
					border: "1px solid var(--border-default)",
				}}
				className="overflow-hidden"
			>
				<div
					className="px-4 py-3 flex items-center justify-between"
					style={{ borderBottom: "1px solid var(--border-default)" }}
				>
					<span
						className="text-sm font-semibold"
						style={{ color: "var(--text-primary)" }}
					>
						{data ? `${data.total.toLocaleString()} kayıt` : "Servis Logları"}
					</span>
					{isFetching && (
						<Loader2
							className="w-3.5 h-3.5 animate-spin"
							style={{ color: "var(--text-faint)" }}
						/>
					)}
				</div>

				{!selectedServiceId ? (
					<EmptyState
						icon={Server}
						text="Logları görüntülemek için servis seçin"
					/>
				) : isLoading ? (
					<LoadingState />
				) : !data?.logs.length ? (
					<EmptyState icon={Terminal} text="Bu servis için log bulunamadı" />
				) : (
					<div>
						{data.logs.map((log) => (
							<LogRow key={`${log.time}-${log.id}`} log={log} />
						))}
					</div>
				)}

				{data && data.total > data.limit && (
					<div
						className="px-4 py-3 flex items-center justify-between"
						style={{ borderTop: "1px solid var(--border-default)" }}
					>
						<span className="text-xs" style={{ color: "var(--text-faint)" }}>
							{(params.offset ?? 0) + 1}–
							{Math.min((params.offset ?? 0) + data.limit, data.total)} /{" "}
							{data.total}
						</span>
						<div className="flex gap-2">
							<Button
								variant="outline"
								size="sm"
								disabled={(params.offset ?? 0) === 0}
								onClick={() =>
									setParams((p) => ({
										...p,
										offset: Math.max(0, (p.offset ?? 0) - (p.limit ?? 100)),
									}))
								}
							>
								Önceki
							</Button>
							<Button
								variant="outline"
								size="sm"
								disabled={(params.offset ?? 0) + data.limit >= data.total}
								onClick={() =>
									setParams((p) => ({
										...p,
										offset: (p.offset ?? 0) + (p.limit ?? 100),
									}))
								}
							>
								Sonraki
							</Button>
						</div>
					</div>
				)}
			</Card>
		</div>
	);
}

// ── Audit Logs Tab ───────────────────────────────────────────────
function AuditLogsTab() {
	const [offset, setOffset] = useState(0);
	const limit = 50;

	const { data, isLoading, isFetching, refetch } = useQuery({
		queryKey: ["audit-logs", offset],
		queryFn: () => logsApi.getAuditLogs({ limit, offset }),
	});

	const logs = (data?.logs ?? []) as AuditLog[];

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<p className="text-sm" style={{ color: "var(--text-muted)" }}>
					Kullanıcı işlemleri, giriş/çıkış ve kaynak değişikliklerini gösterir.
				</p>
				<Button
					variant="outline"
					size="sm"
					onClick={() => refetch()}
					disabled={isFetching}
				>
					<RefreshCw
						className="w-3.5 h-3.5 mr-1.5"
						style={{
							animation: isFetching ? "spin 1s linear infinite" : undefined,
						}}
					/>
					Yenile
				</Button>
			</div>

			<Card
				style={{
					background: "var(--surface-card)",
					border: "1px solid var(--border-default)",
				}}
				className="overflow-hidden"
			>
				<div
					className="px-4 py-3 flex items-center gap-3"
					style={{ borderBottom: "1px solid var(--border-default)" }}
				>
					<span
						className="font-mono text-[10px] w-36"
						style={{ color: "var(--text-faint)" }}
					>
						Zaman
					</span>
					<span
						className="text-[10px] w-20"
						style={{ color: "var(--text-faint)" }}
					>
						Durum
					</span>
					<span
						className="text-[10px] w-44"
						style={{ color: "var(--text-faint)" }}
					>
						İşlem
					</span>
					<span
						className="text-[10px] w-28"
						style={{ color: "var(--text-faint)" }}
					>
						Kaynak
					</span>
					<span className="text-[10px]" style={{ color: "var(--text-faint)" }}>
						IP
					</span>
				</div>

				{isLoading ? (
					<LoadingState />
				) : !logs.length ? (
					<EmptyState icon={Shield} text="Audit log bulunamadı" />
				) : (
					logs.map((log, i) => <AuditRow key={auditID(log, i)} log={log} />)
				)}

				{data && data.total > limit && (
					<div
						className="px-4 py-3 flex items-center justify-between"
						style={{ borderTop: "1px solid var(--border-default)" }}
					>
						<span className="text-xs" style={{ color: "var(--text-faint)" }}>
							{offset + 1}–{Math.min(offset + limit, data.total)} / {data.total}
						</span>
						<div className="flex gap-2">
							<Button
								variant="outline"
								size="sm"
								disabled={offset === 0}
								onClick={() => setOffset((o) => Math.max(0, o - limit))}
							>
								Önceki
							</Button>
							<Button
								variant="outline"
								size="sm"
								disabled={offset + limit >= data.total}
								onClick={() => setOffset((o) => o + limit)}
							>
								Sonraki
							</Button>
						</div>
					</div>
				)}
			</Card>
		</div>
	);
}

// ── K8s Events Tab ───────────────────────────────────────────────
function K8sLogsTab() {
	const token = useAuthStore((s) => s.accessToken);
	const [podName, setPodName] = useState("");
	const [podInput, setPodInput] = useState("");
	const [lines, setLines] = useState(200);

	const { data, isLoading, isFetching } = useQuery({
		queryKey: ["k8s-pod-logs", podName, lines],
		queryFn: async () => {
			const res = await fetch(
				`/api/v1/k8s/pods/${encodeURIComponent(podName)}/logs?tail=${lines}`,
				{ headers: { Authorization: `Bearer ${token}` } },
			);
			const json = await res.json();
			return (json.data?.logs ?? json.data ?? "") as string;
		},
		enabled: !!podName,
	});

	const logLines =
		typeof data === "string" ? data.split("\n").filter(Boolean) : [];

	const getLineLevel = (line: string) => {
		const lower = line.toLowerCase();
		if (
			lower.includes("error") ||
			lower.includes("fatal") ||
			lower.includes("panic")
		)
			return "error";
		if (lower.includes("warn")) return "warn";
		if (lower.includes("debug")) return "debug";
		return "info";
	};

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap gap-3">
				<div className="relative flex-1" style={{ minWidth: "250px" }}>
					<Cloud
						className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
						style={{ color: "var(--text-faint)" }}
					/>
					<Input
						className="pl-9"
						placeholder="Pod adı (örn: nanonet-backend-xxxx)"
						value={podInput}
						onChange={(e) => setPodInput(e.target.value)}
						onKeyDown={(e) => e.key === "Enter" && setPodName(podInput.trim())}
					/>
				</div>
				<select
					className="px-3 py-2 text-sm rounded-lg"
					style={{
						background: "var(--surface-card)",
						border: "1px solid var(--border-default)",
						color: "var(--text-primary)",
					}}
					value={lines}
					onChange={(e) => setLines(Number(e.target.value))}
				>
					<option value={50}>Son 50</option>
					<option value={200}>Son 200</option>
					<option value={500}>Son 500</option>
					<option value={1000}>Son 1000</option>
				</select>
				<Button
					onClick={() => {
						const p = podInput.trim();
						if (p) setPodName(p);
					}}
					disabled={!podInput.trim() || isFetching}
				>
					{isFetching ? (
						<Loader2 className="w-4 h-4 animate-spin mr-1.5" />
					) : (
						<Cloud className="w-4 h-4 mr-1.5" />
					)}
					Getir
				</Button>
			</div>

			<Card
				style={{
					background: "var(--surface-card)",
					border: "1px solid var(--border-default)",
				}}
				className="overflow-hidden"
			>
				<div
					className="px-4 py-3 flex items-center justify-between"
					style={{ borderBottom: "1px solid var(--border-default)" }}
				>
					<span
						className="text-sm font-semibold"
						style={{ color: "var(--text-primary)" }}
					>
						{podName ? `Pod: ${podName}` : "Kubernetes Pod Logları"}
					</span>
					{logLines.length > 0 && (
						<span className="text-xs" style={{ color: "var(--text-faint)" }}>
							{logLines.length} satır
						</span>
					)}
				</div>

				{!podName ? (
					<EmptyState icon={Cloud} text="Pod adını girin ve logları getirin" />
				) : isLoading ? (
					<LoadingState />
				) : !logLines.length ? (
					<EmptyState icon={Terminal} text="Log bulunamadı" />
				) : (
					<div
						className="overflow-y-auto font-mono text-xs"
						style={{ maxHeight: "600px" }}
					>
						{[...logLines.entries()].map(([lineNum, line]) => {
							const lvlKey = getLineLevel(line);
							const cfg = LEVEL_CONFIG[lvlKey];
							return (
								<div
									key={line}
									className="px-4 py-1"
									style={{
										borderBottom: "1px solid var(--border-subtle)",
										background: cfg.bgColor,
									}}
								>
									<span
										className="mr-3 select-none"
										style={{ color: cfg.textColor, opacity: 0.5 }}
									>
										{lineNum + 1}
									</span>
									<span style={{ color: "var(--text-secondary)" }}>{line}</span>
								</div>
							);
						})}
					</div>
				)}
			</Card>
		</div>
	);
}

// ── Ortak yardımcı bileşenler ────────────────────────────────────
function EmptyState({
	icon: Icon,
	text,
}: {
	icon: React.ElementType;
	text: string;
}) {
	return (
		<div className="py-14 flex flex-col items-center gap-3">
			<div
				className="w-12 h-12 rounded-2xl flex items-center justify-center"
				style={{
					background: "var(--surface-sunken)",
					border: "1px solid var(--border-default)",
				}}
			>
				<Icon className="w-5 h-5" style={{ color: "var(--text-faint)" }} />
			</div>
			<p className="text-sm" style={{ color: "var(--text-faint)" }}>
				{text}
			</p>
		</div>
	);
}

function LoadingState() {
	return (
		<div className="py-14 flex justify-center">
			<Loader2
				className="w-5 h-5 animate-spin"
				style={{ color: "var(--text-faint)" }}
			/>
		</div>
	);
}

// ── Ana Sayfa ─────────────────────────────────────────────────────
export function LogsPage() {
	const [activeTab, setActiveTab] = useState<TabKey>("service");

	const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
		{ key: "service", label: "Servis Logları", icon: Server },
		{ key: "audit", label: "Denetim Logları", icon: Shield },
		{ key: "k8s", label: "Kubernetes", icon: Cloud },
	];

	return (
		<motion.div
			className="space-y-6"
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.3 }}
		>
			{/* Header */}
			<div>
				<h1
					className="text-2xl font-bold flex items-center gap-2.5"
					style={{ color: "var(--text-primary)" }}
				>
					<Terminal
						className="w-6 h-6"
						style={{ color: "var(--color-lavender)" }}
					/>
					Log Merkezi
				</h1>
				<p className="text-sm mt-1" style={{ color: "var(--text-faint)" }}>
					Servis logları, denetim kayıtları ve Kubernetes pod loglarını tek
					ekranda görüntüleyin.
				</p>
			</div>

			{/* Tabs */}
			<div
				className="flex gap-1 p-1 rounded-xl"
				style={{
					background: "var(--surface-sunken)",
					border: "1px solid var(--border-default)",
				}}
			>
				{tabs.map((tab) => {
					const Icon = tab.icon;
					const active = activeTab === tab.key;
					return (
						<button
							key={tab.key}
							type="button"
							onClick={() => setActiveTab(tab.key)}
							className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
							style={
								active
									? {
											background: "var(--surface-card)",
											color: "var(--text-primary)",
											boxShadow: "var(--panel-shadow)",
										}
									: { background: "transparent", color: "var(--text-faint)" }
							}
						>
							<Icon className="w-4 h-4" />
							<span className="hidden sm:inline">{tab.label}</span>
						</button>
					);
				})}
			</div>

			{/* Retention bilgisi */}
			<div
				className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs"
				style={{
					background: "var(--surface-card)",
					border: "1px solid var(--border-default)",
					color: "var(--text-faint)",
				}}
			>
				<Clock
					className="w-3.5 h-3.5 shrink-0"
					style={{ color: "var(--color-blue)" }}
				/>
				<span>
					Loglar otomatik olarak{" "}
					<strong style={{ color: "var(--text-secondary)" }}>30 gün</strong>{" "}
					süreyle saklanır. Servis logları TimescaleDB hypertable ile yönetilir.
				</span>
			</div>

			{/* Tab içeriği */}
			{activeTab === "service" && <ServiceLogsTab />}
			{activeTab === "audit" && <AuditLogsTab />}
			{activeTab === "k8s" && <K8sLogsTab />}
		</motion.div>
	);
}

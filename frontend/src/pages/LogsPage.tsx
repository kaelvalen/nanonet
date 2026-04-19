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
import { useEffect, useRef, useState } from "react";
import { type LogQueryParams, logsApi, type ServiceLog } from "@/api/metrics";
import { servicesApi } from "@/api/services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import {
	Panel,
	EmptyState as SharedEmptyState,
} from "@/components/ui/primitives";
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
function LogStatCard({
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
			className="relative rounded-[6px] p-4 flex items-center gap-3"
			style={{
				background: "var(--surface-base)",
				border: "1px solid var(--border-subtle)",
			}}
		>
			<span
				aria-hidden
				className="absolute left-0 top-3 bottom-3 w-[2px] rounded-r-full"
				style={{ background: cfg.dotColor }}
			/>
			<div
				className="ml-1 w-9 h-9 rounded-[6px] flex items-center justify-center shrink-0"
				style={{
					background: "var(--surface-sunken)",
					border: "1px solid var(--border-subtle)",
				}}
			>
				<Icon className="w-4 h-4" style={{ color: cfg.textColor }} />
			</div>
			<div>
				<p
					className="text-[22px] font-semibold leading-none tnum"
					style={{ color: cfg.textColor }}
				>
					{value.toLocaleString()}
				</p>
				<p
					className="text-[11px] font-medium uppercase tracking-wider mt-1.5"
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
						className="text-[12px] font-mono rounded-[6px] p-3 overflow-x-auto"
						style={{
							background: "var(--surface-sunken)",
							border: "1px solid var(--border-subtle)",
							color: "var(--text-secondary)",
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
			className="px-4 py-2 flex items-center gap-3"
			style={{ borderBottom: "1px solid var(--border-subtle)" }}
		>
			<span
				className="font-mono text-[11px] tnum shrink-0 w-36"
				style={{ color: "var(--text-faint)" }}
			>
				{auditTime(log)}
			</span>
			<span
				className="text-[10px] px-1.5 py-0.5 rounded-[4px] font-medium uppercase tracking-wider shrink-0"
				style={{
					color: st.textColor,
					background: st.bgColor,
				}}
			>
				{st.label}
			</span>
			<span
				className="text-[12px] font-mono shrink-0 w-44 truncate"
				style={{ color: "var(--text-secondary)" }}
			>
				{auditAction(log)}
			</span>
			<span
				className="text-[12px] shrink-0 w-28 truncate"
				style={{ color: "var(--text-tertiary)" }}
			>
				{auditResource(log)}
			</span>
			<span
				className="text-[12px] flex-1 truncate font-mono tnum"
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
					className="px-3 h-9 text-[13px] rounded-[6px] appearance-none cursor-pointer"
					style={{
						background: "var(--surface-base)",
						border: "1px solid var(--border-subtle)",
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
					className="px-3 h-9 text-[13px] rounded-[6px] appearance-none cursor-pointer"
					style={{
						background: "var(--surface-base)",
						border: "1px solid var(--border-subtle)",
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
					className="px-3 h-9 text-[13px] rounded-[6px] appearance-none cursor-pointer"
					style={{
						background: "var(--surface-base)",
						border: "1px solid var(--border-subtle)",
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
						className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
						style={{ color: "var(--text-faint)" }}
					/>
					<Input
						className="pl-8 h-9 text-[13px]"
						placeholder="Mesaj ara..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
					/>
					{search && (
						<button
							type="button"
							onClick={() => setSearch("")}
							className="absolute right-2.5 top-1/2 -translate-y-1/2"
							style={{ color: "var(--text-faint)" }}
							aria-label="Aramayı temizle"
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
					<LogStatCard
						label="Debug"
						value={stats.debug ?? 0}
						cfg={LEVEL_CONFIG.debug}
					/>
					<LogStatCard
						label="Info"
						value={stats.info ?? 0}
						cfg={LEVEL_CONFIG.info}
					/>
					<LogStatCard
						label="Warn"
						value={stats.warn ?? 0}
						cfg={LEVEL_CONFIG.warn}
					/>
					<LogStatCard
						label="Error"
						value={stats.error ?? 0}
						cfg={LEVEL_CONFIG.error}
					/>
				</div>
			)}

			{/* Log list */}
			<Panel padding="none" className="overflow-hidden">
				<div
					className="px-4 py-2.5 flex items-center justify-between"
					style={{ borderBottom: "1px solid var(--border-subtle)" }}
				>
					<span
						className="text-[13px] font-semibold tnum"
						style={{ color: "var(--text-primary)" }}
					>
						{data ? `${data.total.toLocaleString()} kayıt` : "Servis logları"}
					</span>
					{isFetching && (
						<Loader2
							className="w-3.5 h-3.5 animate-spin"
							style={{ color: "var(--text-faint)" }}
						/>
					)}
				</div>

				{!selectedServiceId ? (
					<SharedEmptyState
						icon={Server}
						title="Servis seçin"
						description="Logları görüntülemek için yukarıdan bir servis seçin."
						tone="muted"
					/>
				) : isLoading ? (
					<LoadingState />
				) : !data?.logs.length ? (
					<SharedEmptyState
						icon={Terminal}
						title="Log yok"
						description="Bu servis için log bulunamadı."
						tone="muted"
					/>
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
			</Panel>
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
				<p
					className="text-[13px] leading-relaxed"
					style={{ color: "var(--text-tertiary)" }}
				>
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

			<Panel padding="none" className="overflow-hidden">
				<div
					className="px-4 py-2.5 flex items-center gap-3"
					style={{ borderBottom: "1px solid var(--border-subtle)" }}
				>
					{["Zaman", "Durum", "İşlem", "Kaynak", "IP"].map((label, i) => (
						<span
							key={label}
							className="text-[10px] uppercase tracking-wider font-medium"
							style={{
								color: "var(--text-faint)",
								width:
									i === 0
										? "144px"
										: i === 1
											? "80px"
											: i === 2
												? "176px"
												: i === 3
													? "112px"
													: undefined,
							}}
						>
							{label}
						</span>
					))}
				</div>

				{isLoading ? (
					<LoadingState />
				) : !logs.length ? (
					<SharedEmptyState
						icon={Shield}
						title="Kayıt yok"
						description="Audit log bulunamadı."
						tone="muted"
					/>
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
			</Panel>
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
					className="px-3 h-9 text-[13px] rounded-[6px]"
					style={{
						background: "var(--surface-base)",
						border: "1px solid var(--border-subtle)",
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

			<Panel padding="none" className="overflow-hidden">
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
					<SharedEmptyState
						icon={Cloud}
						title="Pod adını girin"
						description="Yukarıdan pod adını girip 'Getir' butonuna tıklayın."
						tone="accent"
					/>
				) : isLoading ? (
					<LoadingState />
				) : !logLines.length ? (
					<SharedEmptyState
						icon={Terminal}
						title="Log yok"
						description="Bu pod için log bulunamadı."
						tone="muted"
					/>
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
			</Panel>
		</div>
	);
}

// ── Ortak yardımcı bileşenler ────────────────────────────────────
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
		<PageShell width="wide" fill>
			<PageHeader
				eyebrow="Observability"
				title="Log merkezi"
				description="Servis logları, denetim kayıtları ve Kubernetes pod logları"
			/>

			{/* Tabs */}
			<div
				role="tablist"
				aria-label="Log tipi"
				className="inline-flex self-start gap-0.5 p-0.5 rounded-[6px] mb-4 shrink-0"
				style={{
					background: "var(--surface-sunken)",
					border: "1px solid var(--border-subtle)",
				}}
			>
				{tabs.map((tab) => {
					const Icon = tab.icon;
					const active = activeTab === tab.key;
					return (
						<button
							key={tab.key}
							type="button"
							role="tab"
							aria-selected={active}
							onClick={() => setActiveTab(tab.key)}
							className="flex items-center justify-center gap-2 px-3 h-7 rounded-[4px] text-[12px] font-medium transition-colors"
							style={{
								background: active ? "var(--surface-base)" : "transparent",
								color: active ? "var(--text-primary)" : "var(--text-tertiary)",
								boxShadow: active ? "0 0 0 1px var(--border-subtle)" : "none",
							}}
						>
							<Icon className="w-3.5 h-3.5" />
							<span className="hidden sm:inline">{tab.label}</span>
						</button>
					);
				})}
			</div>

			{/* Retention bilgisi */}
			<div
				className="relative flex items-center gap-2.5 rounded-[6px] px-4 py-2.5 text-[12px] mb-4 shrink-0"
				style={{
					background: "var(--surface-base)",
					border: "1px solid var(--border-subtle)",
					color: "var(--text-secondary)",
				}}
			>
				<span
					aria-hidden
					className="absolute left-0 top-2 bottom-2 w-[2px] rounded-r-full"
					style={{ background: "var(--brand-primary)" }}
				/>
				<Clock
					className="w-3.5 h-3.5 shrink-0 ml-1"
					style={{ color: "var(--brand-primary)" }}
				/>
				<span className="leading-relaxed">
					Loglar{" "}
					<strong className="tnum" style={{ color: "var(--text-primary)" }}>
						30 gün
					</strong>{" "}
					süreyle saklanır — servis logları TimescaleDB hypertable ile
					yönetilir.
				</span>
			</div>

			{/* Tab içeriği — scrollable */}
			<div className="flex-1 min-h-0 overflow-y-auto -mx-2 px-2 pb-4">
				{activeTab === "service" && <ServiceLogsTab />}
				{activeTab === "audit" && <AuditLogsTab />}
				{activeTab === "k8s" && <K8sLogsTab />}
			</div>
		</PageShell>
	);
}

import { useQuery } from "@tanstack/react-query";
import {
	Activity,
	ArrowRight,
	Bell,
	BrainCircuit,
	CheckCircle2,
	ChevronRight,
	Cpu,
	Gauge,
	GitFork,
	MemoryStick,
	Plus,
	Server,
	ShieldCheck,
	Sparkles,
	TrendingUp,
	XCircle,
	Zap,
} from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { metricsApi } from "@/api/metrics";
import { AddServiceDialog } from "@/components/AddServiceDialog";
import { DashboardCustomize } from "@/components/DashboardCustomize";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import {
	SeverityBadge,
	StatusBadge,
	StatusDot,
} from "@/components/ui/status-atoms";
import { useDashboardLayout } from "@/hooks/useDashboardLayout";
import { useServices } from "@/hooks/useServices";
import type { Alert } from "@/types/alerts";
import type { Service } from "@/types/service";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers

function fmt(v: number | null | undefined, unit = "", decimals?: number) {
	if (v == null) return "—";
	if (v <= 0 && v !== 0) return "—";
	const d = decimals ?? (v < 10 ? 1 : 0);
	return `${v.toFixed(d)}${unit}`;
}

function fmtMemory(mb: number | null | undefined) {
	if (mb == null) return "—";
	if (mb > 1024) return `${(mb / 1024).toFixed(1)}GB`;
	return `${mb.toFixed(0)}MB`;
}

function fmtTime(iso: string | null | undefined) {
	if (!iso) return "—";
	try {
		const d = new Date(iso);
		const diff = (Date.now() - d.getTime()) / 1000;
		if (diff < 60) return "şimdi";
		if (diff < 3600) return `${Math.floor(diff / 60)}dk`;
		if (diff < 86400) return `${Math.floor(diff / 3600)}sa`;
		return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });
	} catch {
		return "—";
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// Health ring (SVG circular progress)

function HealthRing({
	percent,
	size = 72,
	strokeWidth = 6,
}: {
	percent: number;
	size?: number;
	strokeWidth?: number;
}) {
	const radius = (size - strokeWidth) / 2;
	const circumference = 2 * Math.PI * radius;
	const offset = circumference - (percent / 100) * circumference;
	const color =
		percent >= 95
			? "var(--status-up)"
			: percent >= 80
				? "var(--status-warn)"
				: "var(--status-down)";

	return (
		<div className="relative shrink-0" style={{ width: size, height: size }}>
			<svg
				width={size}
				height={size}
				className="-rotate-90"
				viewBox={`0 0 ${size} ${size}`}
			>
				<title>Sistem sağlığı: %{percent}</title>
				<circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					fill="none"
					stroke="var(--border-subtle)"
					strokeWidth={strokeWidth}
				/>
				<circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					fill="none"
					stroke={color}
					strokeWidth={strokeWidth}
					strokeLinecap="round"
					strokeDasharray={circumference}
					strokeDashoffset={offset}
					style={{ transition: "stroke-dashoffset 600ms ease" }}
				/>
			</svg>
			<div className="absolute inset-0 flex flex-col items-center justify-center">
				<span
					className="text-lg font-bold tabular-nums leading-none"
					style={{ color: "var(--text-primary)" }}
				>
					{percent}
				</span>
				<span
					className="text-[9px] font-semibold mt-0.5"
					style={{ color: "var(--text-faint)" }}
				>
					%
				</span>
			</div>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Onboarding

function Onboarding() {
	return (
		<div className="flex items-center justify-center h-full">
			<motion.div
				initial={{ opacity: 0, scale: 0.98 }}
				animate={{ opacity: 1, scale: 1 }}
				transition={{ duration: 0.3 }}
				className="w-full max-w-md text-center"
			>
				<div
					className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-6"
					style={{
						background: "var(--surface-sunken)",
						border: "1px solid var(--border-default)",
					}}
				>
					<Server className="w-6 h-6" style={{ color: "var(--color-teal)" }} />
				</div>
				<h1
					className="text-2xl font-bold tracking-tight mb-2"
					style={{ color: "var(--text-primary)" }}
				>
					NanoNet'e hoş geldiniz
				</h1>
				<p
					className="text-sm leading-relaxed mb-8"
					style={{ color: "var(--text-muted)" }}
				>
					İzlemek istediğiniz ilk servisi ekleyerek başlayın.
				</p>
				<AddServiceDialog
					trigger={
						<Button
							className="h-10 px-6 text-sm font-semibold"
							style={{
								background: "var(--gradient-btn-primary)",
								color: "#fff",
							}}
						>
							<Plus className="w-4 h-4 mr-1.5" />
							İlk servisi ekle
						</Button>
					}
				/>
			</motion.div>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero card — one of three cards in the top row

function HeroCard({
	children,
	accent,
	className,
}: {
	children: React.ReactNode;
	accent?: string;
	className?: string;
}) {
	return (
		<div
			className={`relative overflow-hidden rounded-lg p-4 flex gap-4 ${className ?? ""}`}
			style={{
				background: "var(--surface-card)",
				border: "1px solid var(--border-default)",
			}}
		>
			{accent && (
				<span
					className="absolute left-0 top-0 bottom-0 w-0.5"
					style={{ background: accent }}
				/>
			)}
			{children}
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Metric chip — compact stat display

function MetricChip({
	label,
	value,
	sub,
	icon: Icon,
	tone = "default",
	to,
}: {
	label: string;
	value: React.ReactNode;
	sub?: string;
	icon: React.ElementType;
	tone?: "default" | "accent" | "success" | "warn" | "danger";
	to?: string;
}) {
	const color =
		tone === "accent"
			? "var(--color-teal)"
			: tone === "success"
				? "var(--status-up)"
				: tone === "warn"
					? "var(--status-warn)"
					: tone === "danger"
						? "var(--status-down)"
						: "var(--text-muted)";

	const body = (
		<div
			className="group flex items-center gap-3 px-3.5 py-2.5 rounded-lg transition-colors hover:bg-[var(--surface-sunken)]"
			style={{
				background: "var(--surface-card)",
				border: "1px solid var(--border-default)",
			}}
		>
			<div
				className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
				style={{
					background: "var(--surface-sunken)",
					border: `1px solid ${color}30`,
				}}
			>
				<Icon className="w-3.5 h-3.5" style={{ color }} />
			</div>
			<div className="min-w-0 flex-1">
				<p
					className="text-[10px] font-semibold uppercase tracking-wider leading-none"
					style={{ color: "var(--text-faint)" }}
				>
					{label}
				</p>
				<div className="flex items-baseline gap-1.5 mt-1">
					<p
						className="text-base font-bold tabular-nums font-mono leading-none"
						style={{ color: "var(--text-primary)" }}
					>
						{value}
					</p>
					{sub && (
						<p
							className="text-[10px] leading-none"
							style={{ color: "var(--text-faint)" }}
						>
							{sub}
						</p>
					)}
				</div>
			</div>
		</div>
	);

	return to ? <Link to={to}>{body}</Link> : body;
}

// ─────────────────────────────────────────────────────────────────────────────
// Service row with uptime bar

function ServiceRow({
	service,
	uptime,
}: {
	service: Service;
	uptime?: number;
}) {
	const uptimeColor =
		uptime != null
			? uptime >= 99.5
				? "var(--status-up)"
				: uptime >= 95
					? "var(--status-warn)"
					: "var(--status-down)"
			: "var(--text-faint)";

	return (
		<Link
			to={`/app/services/${service.id}`}
			className="group flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors hover:bg-[var(--surface-sunken)]"
		>
			<StatusDot status={service.status} />

			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-2 mb-1">
					<span
						className="text-sm font-semibold truncate"
						style={{ color: "var(--text-primary)" }}
					>
						{service.name}
					</span>
					<span
						className="text-[10px] font-mono truncate hidden md:inline"
						style={{ color: "var(--text-faint)" }}
					>
						{service.host}:{service.port}
					</span>
				</div>
				{/* Uptime bar */}
				<div
					className="relative h-1 rounded-full overflow-hidden"
					style={{ background: "var(--surface-sunken)" }}
				>
					<div
						className="absolute inset-y-0 left-0 rounded-full transition-all"
						style={{
							width: `${uptime ?? 0}%`,
							background: uptimeColor,
						}}
					/>
				</div>
			</div>

			<div className="flex items-center gap-2 shrink-0">
				{uptime != null && (
					<span
						className="text-[11px] font-mono font-bold tabular-nums w-12 text-right"
						style={{ color: uptimeColor }}
					>
						{uptime.toFixed(1)}%
					</span>
				)}
				<StatusBadge status={service.status} />
				<ChevronRight
					className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity"
					style={{ color: "var(--text-faint)" }}
				/>
			</div>
		</Link>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Alert row

function AlertRow({
	alert,
	serviceName,
}: {
	alert: Alert;
	serviceName: string;
}) {
	return (
		<Link
			to="/app/alerts"
			className="flex items-start gap-2.5 px-3 py-2.5 rounded-md transition-colors hover:bg-[var(--surface-sunken)]"
		>
			<SeverityBadge severity={alert.severity} />
			<div className="flex-1 min-w-0">
				<div className="flex items-center justify-between gap-2">
					<span
						className="text-xs font-semibold truncate"
						style={{ color: "var(--text-primary)" }}
					>
						{serviceName}
					</span>
					<span
						className="text-[10px] font-mono shrink-0"
						style={{ color: "var(--text-faint)" }}
					>
						{fmtTime(alert.triggered_at)}
					</span>
				</div>
				<p
					className="text-[11px] mt-0.5 truncate"
					style={{ color: "var(--text-muted)" }}
				>
					{alert.message ?? alert.type}
				</p>
			</div>
		</Link>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Activity right column — tabbed: alerts | insights

type ActivityTab = "alerts" | "insights";

function ActivityPanel({
	alerts,
	services,
}: {
	alerts: Alert[];
	services: Service[];
}) {
	const [tab, setTab] = useState<ActivityTab>("alerts");
	const { data: insights } = useQuery({
		queryKey: ["dashLatestInsights"],
		queryFn: () => metricsApi.getAllInsights(5),
		refetchInterval: 60_000,
		staleTime: 45_000,
	});

	const critCount = alerts.filter((a) => a.severity === "crit").length;
	const warnCount = alerts.filter((a) => a.severity === "warn").length;
	const insightCount = insights?.insights.length ?? 0;

	return (
		<div
			className="flex flex-col min-h-0 overflow-hidden"
			style={{
				background: "var(--surface-card)",
				border: "1px solid var(--border-default)",
				borderRadius: "var(--radius)",
			}}
		>
			{/* Tabs header */}
			<div
				className="flex items-center justify-between gap-2 px-3 py-2 shrink-0"
				style={{ borderBottom: "1px solid var(--border-subtle)" }}
			>
				<div className="flex items-center gap-1">
					<button
						type="button"
						onClick={() => setTab("alerts")}
						className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all"
						style={{
							background:
								tab === "alerts" ? "var(--surface-sunken)" : "transparent",
							color:
								tab === "alerts" ? "var(--text-primary)" : "var(--text-muted)",
						}}
					>
						<Bell className="w-3 h-3" />
						Uyarılar
						{alerts.length > 0 && (
							<span
								className="min-w-4 h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center"
								style={{
									background:
										critCount > 0
											? "var(--status-down-subtle)"
											: "var(--surface-sunken)",
									color:
										critCount > 0
											? "var(--status-down-text)"
											: "var(--text-muted)",
								}}
							>
								{alerts.length}
							</span>
						)}
					</button>
					<button
						type="button"
						onClick={() => setTab("insights")}
						className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all"
						style={{
							background:
								tab === "insights" ? "var(--surface-sunken)" : "transparent",
							color:
								tab === "insights"
									? "var(--text-primary)"
									: "var(--text-muted)",
						}}
					>
						<BrainCircuit className="w-3 h-3" />
						AI İçgörü
						{insightCount > 0 && (
							<span
								className="min-w-4 h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center"
								style={{
									background: "var(--color-lavender-subtle)",
									color: "var(--color-lavender)",
								}}
							>
								{insightCount}
							</span>
						)}
					</button>
				</div>

				<Link
					to={tab === "alerts" ? "/app/alerts" : "/app/ai-insights"}
					className="flex items-center gap-1 text-[11px] font-medium transition-colors hover:text-[var(--text-primary)] shrink-0"
					style={{ color: "var(--text-muted)" }}
				>
					Tümü <ArrowRight className="w-3 h-3" />
				</Link>
			</div>

			{/* Sub-summary line */}
			<div
				className="px-3 py-1.5 text-[10px] shrink-0 flex items-center gap-3"
				style={{
					background: "var(--surface-sunken)",
					color: "var(--text-faint)",
					borderBottom: "1px solid var(--border-subtle)",
				}}
			>
				{tab === "alerts" ? (
					<>
						{critCount > 0 && (
							<span className="flex items-center gap-1 font-semibold">
								<span
									className="w-1.5 h-1.5 rounded-full"
									style={{ background: "var(--status-down)" }}
								/>
								{critCount} kritik
							</span>
						)}
						{warnCount > 0 && (
							<span className="flex items-center gap-1 font-semibold">
								<span
									className="w-1.5 h-1.5 rounded-full"
									style={{ background: "var(--status-warn)" }}
								/>
								{warnCount} uyarı
							</span>
						)}
						{alerts.length === 0 && (
							<span className="flex items-center gap-1 font-semibold">
								<CheckCircle2
									className="w-3 h-3"
									style={{ color: "var(--status-up)" }}
								/>
								Tümü sakin
							</span>
						)}
					</>
				) : (
					<span>Son Claude analiz çıktıları</span>
				)}
			</div>

			{/* Scrollable content */}
			<div className="flex-1 min-h-0 overflow-y-auto">
				{tab === "alerts" ? (
					alerts.length === 0 ? (
						<EmptyState
							icon={CheckCircle2}
							title="Aktif uyarı yok"
							subtitle="Tüm sistemler normal"
							tone="success"
						/>
					) : (
						<ul className="flex flex-col p-1.5 gap-px">
							{alerts.slice(0, 30).map((alert) => (
								<li key={alert.id}>
									<AlertRow
										alert={alert}
										serviceName={
											services.find((s) => s.id === alert.service_id)?.name ??
											"Bilinmeyen"
										}
									/>
								</li>
							))}
						</ul>
					)
				) : insightCount === 0 ? (
					<EmptyState
						icon={BrainCircuit}
						title="Henüz içgörü yok"
						subtitle="Servis analizi için AI İçgörüler sayfasına git"
						tone="accent"
					/>
				) : (
					<ul className="flex flex-col p-2 gap-2">
						{insights?.insights.map((insight) => (
							<li key={insight.id}>
								<Link
									to="/app/ai-insights"
									className="block p-2.5 rounded-md transition-colors hover:bg-[var(--surface-sunken)]"
									style={{ border: "1px solid var(--border-subtle)" }}
								>
									<div className="flex items-center justify-between gap-2 mb-1.5">
										<span
											className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider"
											style={{ color: "var(--color-lavender)" }}
										>
											<Sparkles className="w-2.5 h-2.5" />
											{insight.model}
										</span>
										<span
											className="text-[10px] font-mono"
											style={{ color: "var(--text-faint)" }}
										>
											{fmtTime(insight.created_at)}
										</span>
									</div>
									<p
										className="text-xs line-clamp-2 leading-relaxed"
										style={{ color: "var(--text-primary)" }}
									>
										{insight.summary}
									</p>
								</Link>
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	);
}

function EmptyState({
	icon: Icon,
	title,
	subtitle,
	tone,
}: {
	icon: React.ElementType;
	title: string;
	subtitle: string;
	tone: "success" | "accent";
}) {
	const bg =
		tone === "success"
			? "var(--status-up-subtle)"
			: "var(--color-lavender-subtle)";
	const color =
		tone === "success" ? "var(--status-up)" : "var(--color-lavender)";
	return (
		<div className="flex flex-col items-center gap-2 h-full justify-center py-12 px-6 text-center">
			<div
				className="w-10 h-10 rounded-xl flex items-center justify-center"
				style={{ background: bg }}
			>
				<Icon className="w-5 h-5" style={{ color }} />
			</div>
			<p
				className="text-sm font-semibold"
				style={{ color: "var(--text-primary)" }}
			>
				{title}
			</p>
			<p
				className="text-xs max-w-[200px]"
				style={{ color: "var(--text-faint)" }}
			>
				{subtitle}
			</p>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page

export function DashboardPage() {
	const { services, isLoading } = useServices();
	const navigate = useNavigate();
	const { isVisible, config } = useDashboardLayout();
	const dense = config.density === "compact";

	const { data: activeAlerts } = useQuery({
		queryKey: ["activeAlerts"],
		queryFn: () => metricsApi.getActiveAlerts(),
		refetchInterval: 15_000,
		staleTime: 10_000,
	});

	const hasServices = services.length > 0;

	const { data: globalSummary } = useQuery({
		queryKey: ["dashGlobalSummary"],
		queryFn: () => metricsApi.getGlobalSummary(),
		enabled: hasServices,
		refetchInterval: 30_000,
		staleTime: 20_000,
	});

	const { data: bulkUptime } = useQuery({
		queryKey: ["dashBulkUptime"],
		queryFn: () => metricsApi.getBulkUptime("24h"),
		enabled: hasServices,
		refetchInterval: 120_000,
		staleTime: 60_000,
	});

	// ── Derived ────────────────────────────────────────────────────────────
	const counts = useMemo(() => {
		const c = { up: 0, degraded: 0, down: 0, unknown: 0 };
		for (const s of services) {
			if (s.status === "up") c.up++;
			else if (s.status === "degraded") c.degraded++;
			else if (s.status === "down") c.down++;
			else c.unknown++;
		}
		return c;
	}, [services]);

	const total = services.length;
	const onlineCount = counts.up;
	const unhealthyCount = counts.down + counts.degraded + counts.unknown;
	const healthPercent = total > 0 ? Math.round((onlineCount / total) * 100) : 0;

	const alerts = activeAlerts ?? [];
	const critCount = alerts.filter((a) => a.severity === "crit").length;
	const warnCount = alerts.filter((a) => a.severity === "warn").length;

	// Average uptime across all services
	const avgUptime = useMemo(() => {
		if (!bulkUptime) return null;
		const vals = Object.values(bulkUptime);
		if (vals.length === 0) return null;
		return vals.reduce((a, b) => a + b, 0) / vals.length;
	}, [bulkUptime]);

	// Sort: critical first, then degraded, then up
	const sortedServices = useMemo(() => {
		const priority = { down: 0, unknown: 1, degraded: 2, up: 3 } as const;
		return [...services].sort((a, b) => {
			const pa = priority[a.status as keyof typeof priority] ?? 4;
			const pb = priority[b.status as keyof typeof priority] ?? 4;
			return pa - pb;
		});
	}, [services]);

	if (!isLoading && !hasServices) {
		return (
			<PageShell width="wide" fill>
				<Onboarding />
			</PageShell>
		);
	}

	const heroVisible = isVisible("health") || isVisible("alerts") || isVisible("performance");
	const chipsVisible =
		isVisible("cpu") || isVisible("memory") || isVisible("errors") || isVisible("status");
	const showServices = isVisible("services");
	const showActivity = isVisible("activity");

	return (
		<PageShell width="wide" fill>
			<PageHeader
				eyebrow="Panel"
				title="Genel Bakış"
				actions={
					<>
						<DashboardCustomize />
						<Button
							variant="ghost"
							size="sm"
							className="h-7 text-xs"
							onClick={() => navigate("/app/service-map")}
						>
							<GitFork className="w-3.5 h-3.5 mr-1.5" />
							Harita
						</Button>
						<Button
							variant="ghost"
							size="sm"
							className="h-7 text-xs"
							onClick={() => navigate("/app/ai-insights")}
						>
							<Sparkles className="w-3.5 h-3.5 mr-1.5" />
							AI
						</Button>
						<AddServiceDialog />
					</>
				}
			/>

			{/* ── HERO ROW ─────────────────────────────────────────────────── */}
			{heroVisible && (
			<motion.div
				className={`grid grid-cols-1 md:grid-cols-3 ${dense ? "gap-2 mb-2" : "gap-3 mb-3"} shrink-0`}
				initial={{ opacity: 0, y: 6 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.3 }}
			>
				{/* Health ring card */}
				{isVisible("health") && (
				<HeroCard
					accent={
						healthPercent >= 95
							? "var(--status-up)"
							: healthPercent >= 80
								? "var(--status-warn)"
								: "var(--status-down)"
					}
				>
					<HealthRing percent={healthPercent} />
					<div className="min-w-0 flex-1 flex flex-col justify-center">
						<p
							className="text-[10px] font-bold uppercase tracking-[0.18em]"
							style={{ color: "var(--text-faint)" }}
						>
							Sistem Sağlığı
						</p>
						<p
							className="text-sm font-semibold mt-1"
							style={{ color: "var(--text-primary)" }}
						>
							{onlineCount} / {total} çevrimiçi
						</p>
						{/* Segmented breakdown */}
						<div className="flex gap-0.5 mt-2.5">
							{counts.up > 0 && (
								<div
									className="h-1 rounded-full"
									style={{
										flex: counts.up,
										background: "var(--status-up)",
									}}
								/>
							)}
							{counts.degraded > 0 && (
								<div
									className="h-1 rounded-full"
									style={{
										flex: counts.degraded,
										background: "var(--status-warn)",
									}}
								/>
							)}
							{counts.down > 0 && (
								<div
									className="h-1 rounded-full"
									style={{
										flex: counts.down,
										background: "var(--status-down)",
									}}
								/>
							)}
							{counts.unknown > 0 && (
								<div
									className="h-1 rounded-full"
									style={{
										flex: counts.unknown,
										background: "var(--border-subtle)",
									}}
								/>
							)}
						</div>
					</div>
				</HeroCard>
				)}

				{/* Alerts pulse card */}
				{isVisible("alerts") && (
				<HeroCard
					accent={
						critCount > 0
							? "var(--status-down)"
							: warnCount > 0
								? "var(--status-warn)"
								: "var(--status-up)"
					}
				>
					<div
						className="relative w-[72px] h-[72px] rounded-xl flex items-center justify-center shrink-0"
						style={{
							background:
								critCount > 0
									? "var(--status-down-subtle)"
									: warnCount > 0
										? "var(--status-warn-subtle)"
										: "var(--status-up-subtle)",
							border: `1px solid ${
								critCount > 0
									? "var(--status-down-border)"
									: warnCount > 0
										? "var(--status-warn-border)"
										: "var(--status-up-border)"
							}`,
						}}
					>
						{critCount > 0 && (
							<span
								className="absolute inset-0 rounded-xl animate-pulse"
								style={{ background: "var(--status-down)", opacity: 0.15 }}
							/>
						)}
						<Bell
							className="w-6 h-6 relative z-10"
							style={{
								color:
									critCount > 0
										? "var(--status-down)"
										: warnCount > 0
											? "var(--status-warn)"
											: "var(--status-up)",
							}}
						/>
					</div>
					<div className="min-w-0 flex-1 flex flex-col justify-center">
						<p
							className="text-[10px] font-bold uppercase tracking-[0.18em]"
							style={{ color: "var(--text-faint)" }}
						>
							Aktif Uyarı
						</p>
						<p
							className="text-2xl font-bold tabular-nums leading-none mt-1.5"
							style={{
								color:
									alerts.length > 0
										? "var(--text-primary)"
										: "var(--text-muted)",
							}}
						>
							{alerts.length}
						</p>
						<div className="flex items-center gap-2 mt-1.5 text-[11px]">
							{critCount > 0 && (
								<span
									className="font-semibold"
									style={{ color: "var(--status-down-text)" }}
								>
									{critCount} kritik
								</span>
							)}
							{warnCount > 0 && (
								<span
									className="font-semibold"
									style={{ color: "var(--status-warn-text)" }}
								>
									{warnCount} uyarı
								</span>
							)}
							{alerts.length === 0 && (
								<span style={{ color: "var(--text-faint)" }}>
									son 24 saatte temiz
								</span>
							)}
						</div>
					</div>
				</HeroCard>
				)}

				{/* Performance card */}
				{isVisible("performance") && (
				<HeroCard accent="var(--color-teal)">
					<div
						className="w-[72px] h-[72px] rounded-xl flex items-center justify-center shrink-0"
						style={{
							background: "var(--color-teal-subtle)",
							border: "1px solid var(--color-teal-border)",
						}}
					>
						<Activity
							className="w-6 h-6"
							style={{ color: "var(--color-teal)" }}
						/>
					</div>
					<div className="min-w-0 flex-1 flex flex-col justify-center">
						<p
							className="text-[10px] font-bold uppercase tracking-[0.18em]"
							style={{ color: "var(--text-faint)" }}
						>
							Performans
						</p>
						<p
							className="text-2xl font-bold tabular-nums leading-none mt-1.5 font-mono"
							style={{ color: "var(--text-primary)" }}
						>
							{fmt(globalSummary?.avg_latency_ms, "ms")}
						</p>
						<div className="flex items-center gap-2 mt-1.5 text-[11px]">
							<span style={{ color: "var(--text-faint)" }}>
								P95 {fmt(globalSummary?.p95_latency_ms, "ms")}
							</span>
							{avgUptime != null && (
								<>
									<span style={{ color: "var(--border-default)" }}>·</span>
									<span
										className="font-semibold"
										style={{
											color:
												avgUptime >= 99
													? "var(--status-up-text)"
													: "var(--status-warn-text)",
										}}
									>
										{avgUptime.toFixed(2)}% uptime
									</span>
								</>
							)}
						</div>
					</div>
				</HeroCard>
				)}
			</motion.div>
			)}

			{/* ── METRIC CHIPS ─────────────────────────────────────────────── */}
			{chipsVisible && (
			<motion.div
				className={`grid grid-cols-2 md:grid-cols-4 ${dense ? "gap-1.5 mb-2" : "gap-2 mb-4"} shrink-0`}
				initial={{ opacity: 0, y: 6 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.3, delay: 0.05 }}
			>
				{isVisible("cpu") && (
				<MetricChip
					label="CPU"
					value={fmt(globalSummary?.avg_cpu_percent, "%")}
					icon={Cpu}
					tone={(globalSummary?.avg_cpu_percent ?? 0) > 75 ? "warn" : "accent"}
				/>
				)}
				{isVisible("memory") && (
				<MetricChip
					label="Bellek"
					value={fmtMemory(globalSummary?.avg_memory_used_mb)}
					icon={MemoryStick}
					tone="default"
				/>
				)}
				{isVisible("errors") && (
				<MetricChip
					label="Hata Oranı"
					value={
						globalSummary?.avg_error_rate
							? `${Math.min(globalSummary.avg_error_rate, 100).toFixed(1)}%`
							: "0%"
					}
					icon={ShieldCheck}
					tone={(globalSummary?.avg_error_rate ?? 0) > 1 ? "danger" : "success"}
				/>
				)}
				{isVisible("status") && (
				<MetricChip
					label="Durum"
					value={
						unhealthyCount === 0
							? "Sağlıklı"
							: unhealthyCount === 1
								? "1 sorun"
								: `${unhealthyCount} sorun`
					}
					icon={unhealthyCount === 0 ? CheckCircle2 : XCircle}
					tone={unhealthyCount === 0 ? "success" : "danger"}
				/>
				)}
			</motion.div>
			)}

			{/* ── MAIN GRID ────────────────────────────────────────────────── */}
			{(showServices || showActivity) && (
			<div
				className={`flex-1 min-h-0 grid grid-cols-1 ${
					showServices && showActivity ? "lg:grid-cols-12" : "lg:grid-cols-1"
				} gap-3`}
			>
				{/* Services list */}
				{showServices && (
				<motion.div
					className={`${
						showActivity ? "lg:col-span-7" : "lg:col-span-1"
					} flex flex-col min-h-0 overflow-hidden`}
					style={{
						background: "var(--surface-card)",
						border: "1px solid var(--border-default)",
						borderRadius: "var(--radius)",
					}}
					initial={{ opacity: 0, y: 6 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.3, delay: 0.1 }}
				>
					{/* Header */}
					<div
						className="flex items-center justify-between gap-2 px-3 py-2 shrink-0"
						style={{ borderBottom: "1px solid var(--border-subtle)" }}
					>
						<div className="flex items-center gap-2 min-w-0">
							<div
								className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
								style={{
									background: "var(--color-teal-subtle)",
									border: "1px solid var(--color-teal-border)",
								}}
							>
								<Server
									className="w-3.5 h-3.5"
									style={{ color: "var(--color-teal)" }}
								/>
							</div>
							<div className="min-w-0">
								<h3
									className="text-sm font-semibold leading-none"
									style={{ color: "var(--text-primary)" }}
								>
									Servisler
								</h3>
								<p
									className="text-[10px] mt-1"
									style={{ color: "var(--text-faint)" }}
								>
									Kritik önce — {total} servis
								</p>
							</div>
						</div>
						<div className="flex items-center gap-2 shrink-0">
							<div className="hidden md:flex items-center gap-1.5 text-[10px] font-mono">
								{counts.up > 0 && (
									<span
										className="flex items-center gap-1"
										style={{ color: "var(--status-up-text)" }}
									>
										<span
											className="w-1.5 h-1.5 rounded-full"
											style={{ background: "var(--status-up)" }}
										/>
										{counts.up}
									</span>
								)}
								{counts.degraded > 0 && (
									<span
										className="flex items-center gap-1"
										style={{ color: "var(--status-warn-text)" }}
									>
										<span
											className="w-1.5 h-1.5 rounded-full"
											style={{ background: "var(--status-warn)" }}
										/>
										{counts.degraded}
									</span>
								)}
								{counts.down > 0 && (
									<span
										className="flex items-center gap-1"
										style={{ color: "var(--status-down-text)" }}
									>
										<span
											className="w-1.5 h-1.5 rounded-full"
											style={{ background: "var(--status-down)" }}
										/>
										{counts.down}
									</span>
								)}
							</div>
							<Link
								to="/app/services"
								className="flex items-center gap-1 text-[11px] font-medium transition-colors hover:text-[var(--text-primary)]"
								style={{ color: "var(--text-muted)" }}
							>
								Tümü <ArrowRight className="w-3 h-3" />
							</Link>
						</div>
					</div>

					{/* List */}
					<div className="flex-1 min-h-0 overflow-y-auto">
						{isLoading ? (
							<div className="flex flex-col p-1.5 gap-px">
								{[1, 2, 3, 4, 5].map((i) => (
									<div
										key={i}
										className="px-3 py-2.5 rounded-md animate-pulse flex items-center gap-3"
									>
										<div
											className="w-2 h-2 rounded-full shrink-0"
											style={{ background: "var(--border-subtle)" }}
										/>
										<div className="flex-1 space-y-1.5">
											<div
												className="h-3 w-1/3 rounded"
												style={{ background: "var(--border-subtle)" }}
											/>
											<div
												className="h-1 rounded-full"
												style={{ background: "var(--border-subtle)" }}
											/>
										</div>
										<div
											className="h-4 w-12 rounded"
											style={{ background: "var(--border-subtle)" }}
										/>
									</div>
								))}
							</div>
						) : sortedServices.length === 0 ? (
							<EmptyState
								icon={Server}
								title="Henüz servis yok"
								subtitle="İlk servisinizi ekleyin"
								tone="accent"
							/>
						) : (
							<ul className="flex flex-col p-1.5 gap-px">
								{sortedServices.map((service) => (
									<li key={service.id}>
										<ServiceRow
											service={service}
											uptime={bulkUptime?.[service.id]}
										/>
									</li>
								))}
							</ul>
						)}
					</div>
				</motion.div>
				)}

				{/* Activity panel */}
				{showActivity && (
				<motion.div
					className={`${
						showServices ? "lg:col-span-5" : "lg:col-span-1"
					} flex flex-col min-h-0`}
					initial={{ opacity: 0, y: 6 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.3, delay: 0.15 }}
				>
					<ActivityPanel alerts={alerts} services={services} />
				</motion.div>
				)}
			</div>
			)}
		</PageShell>
	);
}

// Keep these imports referenced — they are used in icon slots above.
void Gauge;
void TrendingUp;
void Zap;

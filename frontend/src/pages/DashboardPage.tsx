import { useQuery } from "@tanstack/react-query";
import {
	Activity,
	ArrowRight,
	Bell,
	BrainCircuit,
	CheckCircle2,
	Cpu,
	GitFork,
	MemoryStick,
	Plus,
	Server,
	ShieldCheck,
	Sparkles,
	XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { metricsApi } from "@/api/metrics";
import { AddServiceDialog } from "@/components/AddServiceDialog";
import { DashboardCustomize } from "@/components/DashboardCustomize";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { type Status, StatusDot } from "@/components/ui/status-atoms";
import { useDashboardLayout } from "@/hooks/useDashboardLayout";
import { useServices } from "@/hooks/useServices";
import type { Alert } from "@/types/alerts";
import type { Service } from "@/types/service";

/* DashboardPage — overview surface.

   Three layers, top to bottom:
   1. Hero strip — three KPI panels (Health · Alerts · Performance). Each uses
      a thin left accent bar to signal severity, no blob/glow accents.
   2. Metric chips — four compact tiles (CPU · Memory · Errors · Status).
   3. Main grid — left: prioritized services list (down/degraded first);
      right: activity panel with two underline tabs (Alerts · AI Insights).

   Widget visibility & density still flow through useDashboardLayout so the
   existing DashboardCustomize popover keeps working untouched. */

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
// Health ring — same gauge as Service Detail, smaller

function HealthRing({
	percent,
	size = 72,
	strokeWidth = 4,
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
				? "var(--status-degraded)"
				: "var(--status-down)";

	return (
		<div
			role="img"
			aria-label={`Sistem sağlığı yüzde ${percent}`}
			className="relative shrink-0"
			style={{ width: size, height: size }}
		>
			<svg
				width={size}
				height={size}
				className="-rotate-90"
				viewBox={`0 0 ${size} ${size}`}
				aria-hidden="true"
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
					style={{
						transition: "stroke-dashoffset 700ms cubic-bezier(0.2, 0, 0, 1)",
					}}
				/>
			</svg>
			<div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
				<span
					className="text-[20px] font-semibold tnum leading-none"
					style={{ color: "var(--text-primary)" }}
				>
					{percent}
				</span>
				<span
					className="text-[9px] uppercase tracking-wider font-semibold mt-1"
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
			<div className="w-full max-w-md text-center">
				<div
					className="w-12 h-12 rounded-[6px] flex items-center justify-center mx-auto mb-6"
					style={{
						background: "var(--surface-sunken)",
						border: "1px solid var(--border-subtle)",
					}}
				>
					<Server
						className="w-5 h-5"
						style={{ color: "var(--brand-primary)" }}
					/>
				</div>
				<h1
					className="text-[22px] font-semibold tracking-tight mb-2"
					style={{ color: "var(--text-primary)" }}
				>
					NanoNet'e hoş geldiniz
				</h1>
				<p
					className="text-[13px] leading-relaxed mb-7"
					style={{ color: "var(--text-tertiary)" }}
				>
					İzlemek istediğiniz ilk servisi ekleyerek başlayın.
				</p>
				<AddServiceDialog
					trigger={
						<Button size="default">
							<Plus className="w-4 h-4 mr-1.5" />
							İlk servisi ekle
						</Button>
					}
				/>
			</div>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero panel — left accent bar, no blobs

function HeroPanel({
	accent,
	children,
	className,
}: {
	accent?: string;
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<div
			className={`relative overflow-hidden rounded-[6px] p-4 flex gap-4 ${className ?? ""}`}
			style={{
				background: "var(--surface-base)",
				border: "1px solid var(--border-subtle)",
			}}
		>
			{accent && (
				<span
					aria-hidden
					className="absolute left-0 top-3 bottom-3 w-[2px] rounded-r-full"
					style={{ background: accent }}
				/>
			)}
			<div className="relative flex gap-4 w-full pl-2">{children}</div>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Metric chip — compact KPI

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
	const accent =
		tone === "accent"
			? "var(--brand-primary)"
			: tone === "success"
				? "var(--status-up)"
				: tone === "warn"
					? "var(--status-degraded)"
					: tone === "danger"
						? "var(--status-down)"
						: "var(--text-tertiary)";

	const body = (
		<div
			className="group flex items-center gap-3 px-3.5 py-3 rounded-[6px] transition-colors"
			style={{
				background: "var(--surface-base)",
				border: "1px solid var(--border-subtle)",
			}}
		>
			<div
				className="w-9 h-9 rounded-[6px] flex items-center justify-center shrink-0"
				style={{
					background: "var(--surface-sunken)",
					border: "1px solid var(--border-subtle)",
				}}
			>
				<Icon className="w-4 h-4" style={{ color: accent }} />
			</div>
			<div className="min-w-0 flex-1">
				<p
					className="text-[10px] uppercase tracking-wider font-semibold leading-none"
					style={{ color: "var(--text-faint)" }}
				>
					{label}
				</p>
				<div className="flex items-baseline gap-1.5 mt-2">
					<p
						className="text-[18px] font-semibold tnum leading-none"
						style={{ color: "var(--text-primary)" }}
					>
						{value}
					</p>
					{sub && (
						<p
							className="text-[11px] leading-none font-medium tnum"
							style={{ color: accent }}
						>
							{sub}
						</p>
					)}
				</div>
			</div>
		</div>
	);

	return to ? (
		<Link
			to={to}
			className="block outline-none rounded-[6px] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
		>
			{body}
		</Link>
	) : (
		body
	);
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
				? "var(--status-up-text)"
				: uptime >= 95
					? "var(--status-degraded-text)"
					: "var(--status-down-text)"
			: "var(--text-faint)";
	const barColor =
		uptime != null
			? uptime >= 99.5
				? "var(--status-up)"
				: uptime >= 95
					? "var(--status-degraded)"
					: "var(--status-down)"
			: "var(--border-subtle)";

	return (
		<Link
			to={`/app/services/${service.id}`}
			className="group flex items-center gap-3 px-3 py-2.5 rounded-[4px] transition-colors hover:bg-[var(--surface-sunken)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
		>
			<StatusDot
				status={service.status as Status}
				pulse={service.status === "up"}
			/>
			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-2 mb-1.5">
					<span
						className="text-[13px] font-medium truncate"
						style={{ color: "var(--text-primary)" }}
					>
						{service.name}
					</span>
					<span
						className="text-[11px] font-mono truncate hidden md:inline"
						style={{ color: "var(--text-faint)" }}
					>
						{service.host}:{service.port}
					</span>
				</div>
				<div
					className="relative h-[3px] rounded-full overflow-hidden"
					style={{ background: "var(--surface-sunken)" }}
				>
					<div
						className="absolute inset-y-0 left-0 rounded-full"
						style={{
							width: `${uptime ?? 0}%`,
							background: barColor,
							transition: "width 600ms cubic-bezier(0.2, 0, 0, 1)",
						}}
					/>
				</div>
			</div>
			<div className="flex items-center gap-3 shrink-0">
				{uptime != null ? (
					<span
						className="text-[12px] font-medium tnum w-14 text-right"
						style={{ color: uptimeColor }}
					>
						{uptime.toFixed(1)}%
					</span>
				) : (
					<span
						className="text-[12px] tnum w-14 text-right"
						style={{ color: "var(--text-faint)" }}
					>
						—
					</span>
				)}
				<ArrowRight
					className="w-3.5 h-3.5 opacity-0 group-hover:opacity-60 transition-opacity"
					style={{ color: "var(--text-tertiary)" }}
				/>
			</div>
		</Link>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Activity panel — Alerts | AI Insights tabs

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

	const tabs: {
		id: ActivityTab;
		label: string;
		icon: React.ElementType;
		count: number;
	}[] = [
		{ id: "alerts", label: "Uyarılar", icon: Bell, count: alerts.length },
		{
			id: "insights",
			label: "AI içgörü",
			icon: BrainCircuit,
			count: insightCount,
		},
	];

	return (
		<div
			className="flex flex-col min-h-0 overflow-hidden rounded-[6px]"
			style={{
				background: "var(--surface-base)",
				border: "1px solid var(--border-subtle)",
			}}
		>
			<header
				className="flex items-center justify-between gap-2 px-3 shrink-0"
				style={{ borderBottom: "1px solid var(--border-subtle)" }}
			>
				<div
					role="tablist"
					aria-label="Aktivite"
					className="flex items-center gap-1"
				>
					{tabs.map((t) => {
						const isActive = tab === t.id;
						const Icon = t.icon;
						return (
							<button
								key={t.id}
								type="button"
								role="tab"
								aria-selected={isActive}
								onClick={() => setTab(t.id)}
								className="relative flex items-center gap-1.5 px-2.5 h-10 text-[12px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] rounded-[4px]"
								style={{
									color: isActive
										? "var(--text-primary)"
										: "var(--text-tertiary)",
								}}
							>
								<Icon
									className="w-3.5 h-3.5"
									style={{
										color: isActive ? "var(--brand-primary)" : "currentColor",
									}}
								/>
								{t.label}
								{t.count > 0 && (
									<span
										className="ml-0.5 min-w-[18px] h-[18px] px-1 rounded-[4px] text-[10px] font-semibold flex items-center justify-center tnum"
										style={{
											background:
												t.id === "alerts" && critCount > 0
													? "var(--status-down-subtle)"
													: "var(--surface-sunken)",
											color:
												t.id === "alerts" && critCount > 0
													? "var(--status-down-text)"
													: "var(--text-tertiary)",
										}}
									>
										{t.count}
									</span>
								)}
								{isActive && (
									<span
										aria-hidden
										className="absolute left-2 right-2 -bottom-px h-[2px] rounded-t-full"
										style={{ background: "var(--brand-primary)" }}
									/>
								)}
							</button>
						);
					})}
				</div>
				<Link
					to={tab === "alerts" ? "/app/alerts" : "/app/ai-insights"}
					className="inline-flex items-center gap-1 text-[11px] font-medium transition-colors hover:text-[var(--text-primary)] shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] rounded"
					style={{ color: "var(--text-tertiary)" }}
				>
					Tümü <ArrowRight className="w-3 h-3" />
				</Link>
			</header>

			{/* Sub-summary */}
			<div
				className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-semibold shrink-0 flex items-center gap-3"
				style={{
					background: "var(--surface-canvas)",
					color: "var(--text-faint)",
					borderBottom: "1px solid var(--border-subtle)",
				}}
			>
				{tab === "alerts" ? (
					<>
						{critCount > 0 && (
							<span
								className="inline-flex items-center gap-1"
								style={{ color: "var(--status-down-text)" }}
							>
								<span
									className="w-1.5 h-1.5 rounded-full"
									style={{ background: "var(--status-down)" }}
								/>
								{critCount} kritik
							</span>
						)}
						{warnCount > 0 && (
							<span
								className="inline-flex items-center gap-1"
								style={{ color: "var(--status-degraded-text)" }}
							>
								<span
									className="w-1.5 h-1.5 rounded-full"
									style={{ background: "var(--status-degraded)" }}
								/>
								{warnCount} uyarı
							</span>
						)}
						{alerts.length === 0 && (
							<span
								className="inline-flex items-center gap-1"
								style={{ color: "var(--status-up-text)" }}
							>
								<CheckCircle2 className="w-3 h-3" />
								Tümü sakin
							</span>
						)}
					</>
				) : (
					<span>Son AI analiz çıktıları</span>
				)}
			</div>

			<div className="flex-1 min-h-0 overflow-y-auto">
				{tab === "alerts" ? (
					alerts.length === 0 ? (
						<EmptyState
							icon={CheckCircle2}
							title="Aktif uyarı yok"
							subtitle="Tüm sistemler normal."
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
						subtitle="AI İçgörüler sayfasından bir analiz başlatın."
						tone="accent"
					/>
				) : (
					<ul className="flex flex-col p-2 gap-2">
						{insights?.insights.map((insight) => (
							<li key={insight.id}>
								<Link
									to="/app/ai-insights"
									className="block p-3 rounded-[4px] transition-colors hover:bg-[var(--surface-sunken)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
									style={{ border: "1px solid var(--border-subtle)" }}
								>
									<div className="flex items-center justify-between gap-2 mb-2">
										<span
											className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded-[4px]"
											style={{
												color: "var(--brand-primary)",
												background: "var(--brand-primary-subtle)",
											}}
										>
											<Sparkles className="w-3 h-3" />
											{insight.model}
										</span>
										<span
											className="text-[11px] tnum"
											style={{ color: "var(--text-faint)" }}
										>
											{fmtTime(insight.created_at)}
										</span>
									</div>
									<p
										className="text-[13px] line-clamp-2 leading-relaxed"
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

function AlertRow({
	alert,
	serviceName,
}: {
	alert: Alert;
	serviceName: string;
}) {
	const tone =
		alert.severity === "crit"
			? {
					text: "var(--status-down-text)",
					accent: "var(--status-down)",
				}
			: alert.severity === "warn"
				? {
						text: "var(--status-degraded-text)",
						accent: "var(--status-degraded)",
					}
				: {
						text: "var(--brand-primary)",
						accent: "var(--brand-primary)",
					};
	return (
		<Link
			to="/app/alerts"
			className="flex items-start gap-2.5 px-3 py-2.5 rounded-[4px] transition-colors hover:bg-[var(--surface-sunken)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
		>
			<span
				aria-hidden
				className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
				style={{ background: tone.accent }}
			/>
			<div className="flex-1 min-w-0">
				<div className="flex items-center justify-between gap-2">
					<span
						className="text-[13px] font-medium truncate"
						style={{ color: "var(--text-primary)" }}
					>
						{serviceName}
					</span>
					<span
						className="text-[11px] tnum shrink-0"
						style={{ color: "var(--text-faint)" }}
					>
						{fmtTime(alert.triggered_at)}
					</span>
				</div>
				<p className="text-[12px] mt-1 truncate" style={{ color: tone.text }}>
					{alert.message ?? alert.type}
				</p>
			</div>
		</Link>
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
	const color =
		tone === "success" ? "var(--status-up)" : "var(--brand-primary)";
	return (
		<div className="flex flex-col items-center gap-2 h-full justify-center py-12 px-6 text-center">
			<div
				className="w-10 h-10 rounded-[6px] flex items-center justify-center"
				style={{
					background: "var(--surface-sunken)",
					border: "1px solid var(--border-subtle)",
				}}
			>
				<Icon className="w-4 h-4" style={{ color }} />
			</div>
			<p
				className="text-[14px] font-semibold mt-1"
				style={{ color: "var(--text-primary)" }}
			>
				{title}
			</p>
			<p
				className="text-[12px] max-w-[220px] leading-relaxed"
				style={{ color: "var(--text-tertiary)" }}
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

	const avgUptime = useMemo(() => {
		if (!bulkUptime) return null;
		const vals = Object.values(bulkUptime);
		if (vals.length === 0) return null;
		return vals.reduce((a, b) => a + b, 0) / vals.length;
	}, [bulkUptime]);

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

	const heroVisible =
		isVisible("health") || isVisible("alerts") || isVisible("performance");
	const chipsVisible =
		isVisible("cpu") ||
		isVisible("memory") ||
		isVisible("errors") ||
		isVisible("status");
	const showServices = isVisible("services");
	const showActivity = isVisible("activity");

	const heroAccent = (severity: "ok" | "warn" | "crit") =>
		severity === "ok"
			? "var(--status-up)"
			: severity === "warn"
				? "var(--status-degraded)"
				: "var(--status-down)";

	const healthSeverity =
		healthPercent >= 95 ? "ok" : healthPercent >= 80 ? "warn" : "crit";
	const alertSeverity = critCount > 0 ? "crit" : warnCount > 0 ? "warn" : "ok";

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
							onClick={() => navigate("/app/service-map")}
						>
							<GitFork className="w-3.5 h-3.5 mr-1.5" />
							Harita
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => navigate("/app/ai-insights")}
						>
							<Sparkles className="w-3.5 h-3.5 mr-1.5" />
							AI
						</Button>
						<AddServiceDialog />
					</>
				}
			/>

			{/* ── HERO STRIP ─────────────────────────────────────────────── */}
			{heroVisible && (
				<div
					className={`grid grid-cols-1 md:grid-cols-3 ${dense ? "gap-2 mb-2" : "gap-3 mb-3"} shrink-0`}
				>
					{isVisible("health") && (
						<HeroPanel accent={heroAccent(healthSeverity)}>
							<HealthRing percent={healthPercent} />
							<div className="min-w-0 flex-1 flex flex-col justify-center">
								<p
									className="text-[10px] uppercase tracking-wider font-semibold leading-none"
									style={{ color: "var(--text-faint)" }}
								>
									Sistem sağlığı
								</p>
								<p
									className="text-[15px] font-semibold mt-2"
									style={{ color: "var(--text-primary)" }}
								>
									<span className="tnum">{onlineCount}</span>
									<span style={{ color: "var(--text-faint)" }}> / </span>
									<span className="tnum">{total}</span>
									<span
										className="ml-1.5 text-[12px] font-normal"
										style={{ color: "var(--text-tertiary)" }}
									>
										çevrimiçi
									</span>
								</p>
								<div
									className="flex gap-px mt-3 h-1 rounded-full overflow-hidden"
									style={{ background: "var(--surface-sunken)" }}
								>
									{counts.up > 0 && (
										<div
											style={{
												flex: counts.up,
												background: "var(--status-up)",
											}}
										/>
									)}
									{counts.degraded > 0 && (
										<div
											style={{
												flex: counts.degraded,
												background: "var(--status-degraded)",
											}}
										/>
									)}
									{counts.down > 0 && (
										<div
											style={{
												flex: counts.down,
												background: "var(--status-down)",
											}}
										/>
									)}
									{counts.unknown > 0 && (
										<div
											style={{
												flex: counts.unknown,
												background: "var(--text-faint)",
											}}
										/>
									)}
								</div>
							</div>
						</HeroPanel>
					)}

					{isVisible("alerts") && (
						<HeroPanel accent={heroAccent(alertSeverity)}>
							<div
								className="w-[60px] h-[60px] rounded-[6px] flex items-center justify-center shrink-0"
								style={{
									background: "var(--surface-sunken)",
									border: "1px solid var(--border-subtle)",
								}}
							>
								<Bell
									className="w-5 h-5"
									style={{ color: heroAccent(alertSeverity) }}
								/>
							</div>
							<div className="min-w-0 flex-1 flex flex-col justify-center">
								<p
									className="text-[10px] uppercase tracking-wider font-semibold leading-none"
									style={{ color: "var(--text-faint)" }}
								>
									Aktif uyarı
								</p>
								<p
									className="text-[28px] font-semibold tnum leading-none mt-2"
									style={{
										color:
											alerts.length > 0
												? "var(--text-primary)"
												: "var(--text-tertiary)",
									}}
								>
									{alerts.length}
								</p>
								<div className="flex items-center gap-2 mt-2 text-[12px]">
									{critCount > 0 && (
										<span
											className="font-medium tnum"
											style={{ color: "var(--status-down-text)" }}
										>
											{critCount} kritik
										</span>
									)}
									{warnCount > 0 && (
										<span
											className="font-medium tnum"
											style={{ color: "var(--status-degraded-text)" }}
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
						</HeroPanel>
					)}

					{isVisible("performance") && (
						<HeroPanel accent="var(--brand-primary)">
							<div
								className="w-[60px] h-[60px] rounded-[6px] flex items-center justify-center shrink-0"
								style={{
									background: "var(--surface-sunken)",
									border: "1px solid var(--border-subtle)",
								}}
							>
								<Activity
									className="w-5 h-5"
									style={{ color: "var(--brand-primary)" }}
								/>
							</div>
							<div className="min-w-0 flex-1 flex flex-col justify-center">
								<p
									className="text-[10px] uppercase tracking-wider font-semibold leading-none"
									style={{ color: "var(--text-faint)" }}
								>
									Performans
								</p>
								<p
									className="text-[28px] font-semibold tnum leading-none mt-2"
									style={{ color: "var(--text-primary)" }}
								>
									{fmt(globalSummary?.avg_latency_ms, "ms")}
								</p>
								<div className="flex items-center gap-2 mt-2 text-[12px]">
									<span className="tnum" style={{ color: "var(--text-faint)" }}>
										P95 {fmt(globalSummary?.p95_latency_ms, "ms")}
									</span>
									{avgUptime != null && (
										<>
											<span style={{ color: "var(--border-subtle)" }}>·</span>
											<span
												className="font-medium tnum"
												style={{
													color:
														avgUptime >= 99
															? "var(--status-up-text)"
															: "var(--status-degraded-text)",
												}}
											>
												{avgUptime.toFixed(2)}% uptime
											</span>
										</>
									)}
								</div>
							</div>
						</HeroPanel>
					)}
				</div>
			)}

			{/* ── METRIC CHIPS ─────────────────────────────────────────────── */}
			{chipsVisible && (
				<div
					className={`grid grid-cols-2 md:grid-cols-4 ${dense ? "gap-1.5 mb-2" : "gap-2 mb-4"} shrink-0`}
				>
					{isVisible("cpu") && (
						<MetricChip
							label="CPU"
							value={fmt(globalSummary?.avg_cpu_percent, "%")}
							icon={Cpu}
							tone={
								(globalSummary?.avg_cpu_percent ?? 0) > 75 ? "warn" : "accent"
							}
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
							tone={
								(globalSummary?.avg_error_rate ?? 0) > 1 ? "danger" : "success"
							}
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
				</div>
			)}

			{/* ── MAIN GRID ────────────────────────────────────────────────── */}
			{(showServices || showActivity) && (
				<div
					className={`flex-1 min-h-0 grid grid-cols-1 ${
						showServices && showActivity ? "lg:grid-cols-12" : "lg:grid-cols-1"
					} gap-3`}
				>
					{showServices && (
						<section
							className={`${
								showActivity ? "lg:col-span-7" : "lg:col-span-1"
							} flex flex-col min-h-0 overflow-hidden rounded-[6px]`}
							style={{
								background: "var(--surface-base)",
								border: "1px solid var(--border-subtle)",
							}}
							aria-label="Servis listesi"
						>
							<header
								className="flex items-center justify-between gap-2 px-4 py-3 shrink-0"
								style={{ borderBottom: "1px solid var(--border-subtle)" }}
							>
								<div className="flex items-center gap-2 min-w-0">
									<h3
										className="text-[13px] font-semibold"
										style={{ color: "var(--text-primary)" }}
									>
										Servisler
									</h3>
									<span
										className="text-[11px]"
										style={{ color: "var(--text-tertiary)" }}
									>
										· kritik önce · {total} servis
									</span>
								</div>
								<div className="flex items-center gap-3 shrink-0">
									<div className="hidden md:flex items-center gap-2 text-[11px] font-mono tnum">
										{counts.up > 0 && (
											<span
												className="inline-flex items-center gap-1"
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
												className="inline-flex items-center gap-1"
												style={{ color: "var(--status-degraded-text)" }}
											>
												<span
													className="w-1.5 h-1.5 rounded-full"
													style={{ background: "var(--status-degraded)" }}
												/>
												{counts.degraded}
											</span>
										)}
										{counts.down > 0 && (
											<span
												className="inline-flex items-center gap-1"
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
										className="inline-flex items-center gap-1 text-[11px] font-medium transition-colors hover:text-[var(--text-primary)] outline-none rounded focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
										style={{ color: "var(--text-tertiary)" }}
									>
										Tümü <ArrowRight className="w-3 h-3" />
									</Link>
								</div>
							</header>

							<div className="flex-1 min-h-0 overflow-y-auto">
								{isLoading ? (
									<div className="flex flex-col p-1.5 gap-px">
										{[1, 2, 3, 4, 5].map((i) => (
											<div
												key={i}
												className="px-3 py-2.5 rounded-[4px] animate-pulse flex items-center gap-3"
											>
												<div
													className="w-2 h-2 rounded-full shrink-0"
													style={{ background: "var(--surface-sunken)" }}
												/>
												<div className="flex-1 space-y-1.5">
													<div
														className="h-3 w-1/3 rounded"
														style={{ background: "var(--surface-sunken)" }}
													/>
													<div
														className="h-1 rounded-full"
														style={{ background: "var(--surface-sunken)" }}
													/>
												</div>
												<div
													className="h-3 w-12 rounded"
													style={{ background: "var(--surface-sunken)" }}
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
						</section>
					)}

					{showActivity && (
						<div
							className={`${
								showServices ? "lg:col-span-5" : "lg:col-span-1"
							} flex flex-col min-h-0`}
						>
							<ActivityPanel alerts={alerts} services={services} />
						</div>
					)}
				</div>
			)}
		</PageShell>
	);
}

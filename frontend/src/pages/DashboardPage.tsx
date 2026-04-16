import { useQuery } from "@tanstack/react-query";
import {
	ArrowRight,
	Bell,
	CheckCircle2,
	Clock,
	Cpu,
	Gauge,
	GitFork,
	MemoryStick,
	Plus,
	Server,
	ShieldCheck,
	Sparkles,
	XCircle,
	Zap,
} from "lucide-react";
import { motion } from "motion/react";
import { Link, useNavigate } from "react-router";
import { metricsApi } from "@/api/metrics";
import { AddServiceDialog } from "@/components/AddServiceDialog";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import {
	SeverityBadge,
	StatusBadge,
	StatusDot,
} from "@/components/ui/status-atoms";
import { useServices } from "@/hooks/useServices";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers

function fmt(v: number | null | undefined, unit = "") {
	if (v == null || v <= 0) return "—";
	return `${v.toFixed(v < 10 ? 1 : 0)}${unit}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Compact stat cell (used inline in the stat strip)

function StatCell({
	label,
	value,
	icon: Icon,
	tone = "default",
	to,
	sub,
}: {
	label: string;
	value: React.ReactNode;
	icon: React.ElementType;
	tone?: "default" | "accent" | "success" | "warn" | "danger";
	to?: string;
	sub?: string;
}) {
	const accentColor =
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
			className="relative h-full px-3 py-2.5 overflow-hidden transition-colors hover:bg-[var(--surface-sunken)]"
			style={{
				background: "var(--surface-card)",
				border: "1px solid var(--border-default)",
				borderRadius: "var(--radius)",
			}}
		>
			{tone !== "default" && (
				<span
					className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r-full"
					style={{ background: accentColor }}
				/>
			)}
			<div className="flex items-center justify-between gap-2">
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-1.5 mb-1">
						<Icon className="w-3 h-3" style={{ color: accentColor }} />
						<span
							className="text-[10px] font-medium truncate"
							style={{ color: "var(--text-faint)" }}
						>
							{label}
						</span>
					</div>
					<p
						className="text-lg font-semibold tabular-nums font-mono leading-none"
						style={{ color: "var(--text-primary)" }}
					>
						{value}
					</p>
					{sub && (
						<p
							className="text-[10px] mt-1 truncate"
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
// Onboarding (no services yet)

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
// Page

export function DashboardPage() {
	const { services, isLoading } = useServices();
	const navigate = useNavigate();

	const { data: activeAlerts } = useQuery({
		queryKey: ["activeAlerts"],
		queryFn: () => metricsApi.getActiveAlerts(),
		refetchInterval: 15_000,
		staleTime: 10_000,
	});

	const { data: globalSummary } = useQuery({
		queryKey: ["dashGlobalSummary"],
		queryFn: () => metricsApi.getGlobalSummary(),
		enabled: services.length > 0,
		refetchInterval: 30_000,
		staleTime: 20_000,
	});

	const { data: bulkUptime } = useQuery({
		queryKey: ["dashBulkUptime"],
		queryFn: () => metricsApi.getBulkUptime("24h"),
		enabled: services.length > 0,
		refetchInterval: 120_000,
		staleTime: 60_000,
	});

	// ── Derived ────────────────────────────────────────────────────────────
	const totalServices = services.length;
	const onlineServices = services.filter((s) => s.status === "up").length;
	const degradedServices = services.filter(
		(s) => s.status === "degraded",
	).length;
	const offlineServices = services.filter(
		(s) => s.status === "down" || s.status === "unknown",
	).length;

	const criticalServices = services.filter(
		(s) => s.status === "down" || s.status === "degraded",
	);
	const displayServices =
		criticalServices.length > 0 ? criticalServices : services;

	const recentAlerts = (activeAlerts ?? []).slice(0, 20);
	const critAlerts = recentAlerts.filter((a) => a.severity === "crit").length;
	const warnAlerts = recentAlerts.filter((a) => a.severity === "warn").length;

	const healthPercent =
		totalServices > 0 ? Math.round((onlineServices / totalServices) * 100) : 0;
	const healthColor =
		healthPercent === 100
			? "var(--status-up)"
			: healthPercent >= 70
				? "var(--status-warn)"
				: "var(--status-down)";

	if (!isLoading && services.length === 0) {
		return (
			<PageShell fill>
				<Onboarding />
			</PageShell>
		);
	}

	const memoryValue =
		globalSummary?.avg_memory_used_mb && globalSummary.avg_memory_used_mb > 1024
			? `${(globalSummary.avg_memory_used_mb / 1024).toFixed(1)} GB`
			: fmt(globalSummary?.avg_memory_used_mb, " MB");

	return (
		<PageShell fill>
			<PageHeader
				compact
				eyebrow="Panel"
				title="Genel Bakış"
				description={`${totalServices} servis · %${healthPercent} sağlıklı`}
				meta={
					totalServices > 0 ? (
						<div
							className="flex items-center gap-2 max-w-md"
							style={{ color: "var(--text-muted)" }}
						>
							<div
								className="flex-1 h-1 rounded-full overflow-hidden"
								style={{ background: "var(--surface-sunken)" }}
							>
								<div className="h-full flex" style={{ width: "100%" }}>
									{onlineServices > 0 && (
										<div
											style={{
												width: `${(onlineServices / totalServices) * 100}%`,
												background: "var(--status-up)",
											}}
										/>
									)}
									{degradedServices > 0 && (
										<div
											style={{
												width: `${(degradedServices / totalServices) * 100}%`,
												background: "var(--status-warn)",
											}}
										/>
									)}
									{offlineServices > 0 && (
										<div
											style={{
												width: `${(offlineServices / totalServices) * 100}%`,
												background: "var(--status-down)",
											}}
										/>
									)}
								</div>
							</div>
							<span
								className="text-[11px] font-mono font-semibold tabular-nums"
								style={{ color: healthColor }}
							>
								{healthPercent}%
							</span>
						</div>
					) : null
				}
				actions={
					<>
						<Button
							variant="ghost"
							size="sm"
							className="h-8 text-xs"
							onClick={() => navigate("/app/service-map")}
						>
							<GitFork className="w-3.5 h-3.5 mr-1.5" />
							Harita
						</Button>
						<Button
							variant="ghost"
							size="sm"
							className="h-8 text-xs"
							onClick={() => navigate("/app/ai-insights")}
						>
							<Sparkles className="w-3.5 h-3.5 mr-1.5" />
							AI
						</Button>
						<AddServiceDialog />
					</>
				}
			/>

			{/* Compact stat strip — 8 cells in one row on xl */}
			<div className="grid grid-cols-4 xl:grid-cols-8 gap-2 mb-4 shrink-0">
				<StatCell
					label="Toplam"
					value={totalServices}
					icon={Server}
					tone="accent"
					to="/app/services"
				/>
				<StatCell
					label="Çevrimiçi"
					value={onlineServices}
					icon={CheckCircle2}
					tone="success"
					to="/app/services"
				/>
				<StatCell
					label="Bozuk"
					value={degradedServices}
					icon={Zap}
					tone="warn"
					to="/app/services"
				/>
				<StatCell
					label="Offline"
					value={offlineServices}
					icon={XCircle}
					tone="danger"
					to="/app/services"
				/>
				<StatCell
					label="Latency"
					value={fmt(globalSummary?.avg_latency_ms, "ms")}
					icon={Gauge}
					tone="warn"
					sub={
						globalSummary?.p95_latency_ms
							? `P95 ${fmt(globalSummary.p95_latency_ms, "ms")}`
							: undefined
					}
				/>
				<StatCell
					label="CPU"
					value={fmt(globalSummary?.avg_cpu_percent, "%")}
					icon={Cpu}
					tone="accent"
				/>
				<StatCell label="Bellek" value={memoryValue} icon={MemoryStick} />
				<StatCell
					label="Hata"
					value={
						globalSummary?.avg_error_rate && globalSummary.avg_error_rate > 0
							? `${Math.min(globalSummary.avg_error_rate, 100).toFixed(1)}%`
							: "0%"
					}
					icon={ShieldCheck}
					tone={critAlerts > 0 ? "danger" : "success"}
				/>
			</div>

			{/* Main content — services + alerts, fills remaining viewport */}
			<div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4">
				<ServicesPanel
					services={displayServices}
					uptimeMap={bulkUptime ?? {}}
					totalCount={services.length}
					criticalOnly={criticalServices.length > 0}
					className="lg:col-span-7"
				/>
				<AlertsPanel
					alerts={recentAlerts}
					services={services}
					critCount={critAlerts}
					warnCount={warnAlerts}
					className="lg:col-span-5"
				/>
			</div>
		</PageShell>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Services panel

function ServicesPanel({
	services,
	uptimeMap,
	totalCount,
	criticalOnly,
	className,
}: {
	services: Array<{
		id: string;
		name: string;
		host: string;
		port: number;
		status: "up" | "down" | "degraded" | "unknown";
	}>;
	uptimeMap: Record<string, number>;
	totalCount: number;
	criticalOnly: boolean;
	className?: string;
}) {
	return (
		<div
			className={`flex flex-col min-h-0 overflow-hidden ${className ?? ""}`}
			style={{
				background: "var(--surface-card)",
				border: "1px solid var(--border-default)",
				borderRadius: "var(--radius)",
			}}
		>
			{/* Header */}
			<div
				className="flex items-center justify-between gap-3 px-4 py-3 shrink-0"
				style={{ borderBottom: "1px solid var(--border-subtle)" }}
			>
				<div className="flex items-center gap-2.5 min-w-0">
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
							{criticalOnly ? "Dikkat gereken servisler" : "Servisler"}
						</h3>
						<p
							className="text-[11px] mt-1 truncate"
							style={{ color: "var(--text-faint)" }}
						>
							{services.length} / {totalCount} gösteriliyor
						</p>
					</div>
				</div>
				<Link
					to="/app/services"
					className="flex items-center gap-1 text-xs font-medium transition-colors hover:text-[var(--text-primary)] shrink-0"
					style={{ color: "var(--text-muted)" }}
				>
					Tümü <ArrowRight className="w-3 h-3" />
				</Link>
			</div>

			{/* Scrollable list */}
			<div className="flex-1 min-h-0 overflow-y-auto">
				<ul className="flex flex-col p-2 gap-px">
					{services.map((service) => {
						const uptime = uptimeMap[service.id];
						const uptimeColor =
							uptime != null
								? uptime >= 99
									? "var(--status-up-text)"
									: uptime >= 95
										? "var(--status-warn-text)"
										: "var(--status-down-text)"
								: "var(--text-faint)";
						return (
							<li key={service.id}>
								<Link
									to={`/app/services/${service.id}`}
									className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors hover:bg-[var(--surface-sunken)]"
								>
									<StatusDot status={service.status} />
									<span
										className="flex-1 text-sm font-medium truncate"
										style={{ color: "var(--text-primary)" }}
									>
										{service.name}
									</span>
									<span
										className="text-[11px] font-mono hidden md:block shrink-0"
										style={{ color: "var(--text-faint)" }}
									>
										{service.host}:{service.port}
									</span>
									{uptime != null && (
										<span
											className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-mono tabular-nums shrink-0 w-14 justify-end"
											style={{ color: uptimeColor }}
										>
											{uptime.toFixed(1)}%
										</span>
									)}
									<StatusBadge status={service.status} />
								</Link>
							</li>
						);
					})}
				</ul>
			</div>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Alerts panel

function AlertsPanel({
	alerts,
	services,
	critCount,
	warnCount,
	className,
}: {
	alerts: Array<{
		id: string;
		service_id: string;
		type: string;
		severity: "crit" | "warn" | "info";
		message: string;
		triggered_at: string;
	}>;
	services: Array<{ id: string; name: string }>;
	critCount: number;
	warnCount: number;
	className?: string;
}) {
	return (
		<div
			className={`flex flex-col min-h-0 overflow-hidden ${className ?? ""}`}
			style={{
				background: "var(--surface-card)",
				border: "1px solid var(--border-default)",
				borderRadius: "var(--radius)",
			}}
		>
			{/* Header */}
			<div
				className="flex items-center justify-between gap-3 px-4 py-3 shrink-0"
				style={{ borderBottom: "1px solid var(--border-subtle)" }}
			>
				<div className="flex items-center gap-2.5 min-w-0">
					<div
						className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
						style={{
							background:
								alerts.length > 0
									? "var(--status-down-subtle)"
									: "var(--status-up-subtle)",
							border: `1px solid ${
								alerts.length > 0
									? "var(--status-down-border)"
									: "var(--status-up-border)"
							}`,
						}}
					>
						<Bell
							className="w-3.5 h-3.5"
							style={{
								color:
									alerts.length > 0 ? "var(--status-down)" : "var(--status-up)",
							}}
						/>
					</div>
					<div className="min-w-0">
						<h3
							className="text-sm font-semibold leading-none"
							style={{ color: "var(--text-primary)" }}
						>
							Aktif uyarılar
						</h3>
						<p
							className="text-[11px] mt-1 truncate"
							style={{ color: "var(--text-faint)" }}
						>
							{alerts.length === 0
								? "Tümü sakin"
								: `${critCount} kritik · ${warnCount} uyarı`}
						</p>
					</div>
				</div>
				<Link
					to="/app/alerts"
					className="flex items-center gap-1 text-xs font-medium transition-colors hover:text-[var(--text-primary)] shrink-0"
					style={{ color: "var(--text-muted)" }}
				>
					Tümü <ArrowRight className="w-3 h-3" />
				</Link>
			</div>

			{/* Scrollable feed */}
			<div className="flex-1 min-h-0 overflow-y-auto">
				{alerts.length === 0 ? (
					<div className="flex flex-col items-center gap-2 py-12 px-6 text-center">
						<div
							className="w-10 h-10 rounded-xl flex items-center justify-center"
							style={{ background: "var(--status-up-subtle)" }}
						>
							<CheckCircle2
								className="w-5 h-5"
								style={{ color: "var(--status-up)" }}
							/>
						</div>
						<p
							className="text-sm font-medium"
							style={{ color: "var(--text-primary)" }}
						>
							Aktif uyarı yok
						</p>
						<p className="text-xs" style={{ color: "var(--text-faint)" }}>
							Tüm sistemler normal
						</p>
					</div>
				) : (
					<ul className="flex flex-col p-2 gap-px">
						{alerts.map((alert) => {
							const svcName =
								services.find((s) => s.id === alert.service_id)?.name ??
								"Bilinmeyen";
							return (
								<li key={alert.id}>
									<Link
										to="/app/alerts"
										className="flex items-start gap-3 px-3 py-2.5 rounded-md transition-colors hover:bg-[var(--surface-sunken)]"
									>
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-2 mb-1">
												<SeverityBadge severity={alert.severity} />
												<span
													className="text-xs font-semibold truncate"
													style={{ color: "var(--text-primary)" }}
												>
													{svcName}
												</span>
											</div>
											<p
												className="text-[11px] truncate"
												style={{ color: "var(--text-faint)" }}
											>
												{alert.message ?? alert.type}
											</p>
										</div>
										<div
											className="flex items-center gap-1 shrink-0 text-[10px] font-mono mt-0.5"
											style={{ color: "var(--text-faint)" }}
										>
											<Clock className="w-3 h-3" />
											{alert.triggered_at
												? new Date(alert.triggered_at).toLocaleTimeString(
														"tr-TR",
														{ hour: "2-digit", minute: "2-digit" },
													)
												: "—"}
										</div>
									</Link>
								</li>
							);
						})}
					</ul>
				)}
			</div>
		</div>
	);
}

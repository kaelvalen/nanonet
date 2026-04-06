import { useQuery } from "@tanstack/react-query";
import {
	Activity,
	AlertCircle,
	AlertTriangle,
	ArrowRight,
	CheckCircle2,
	Clock,
	Cpu,
	Gauge,
	Plus,
	Server,
	TrendingUp,
	XCircle,
	Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Link } from "react-router";
import { metricsApi } from "@/api/metrics";
import { AddServiceDialog } from "@/components/AddServiceDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useServices } from "@/hooks/useServices";

function StatusDot({ status }: { status: string }) {
	const colors: Record<string, string> = {
		up: "var(--status-up)",
		degraded: "var(--status-warn)",
		down: "var(--status-down)",
	};
	return (
		<span
			className="inline-block w-2 h-2 rounded-full shrink-0"
			style={{ background: colors[status] ?? "var(--text-faint)" }}
		/>
	);
}


export function DashboardPage() {
	const { services, isLoading } = useServices();

	const { data: activeAlerts } = useQuery({
		queryKey: ["activeAlerts"],
		queryFn: () => metricsApi.getActiveAlerts(),
		refetchInterval: 30_000,
		staleTime: 15_000,
	});

	const { data: globalSummary } = useQuery({
		queryKey: ["dashGlobalSummary"],
		queryFn: () => metricsApi.getGlobalSummary(),
		enabled: services.length > 0,
		refetchInterval: 60_000,
		staleTime: 30_000,
	});

	const totalServices = services.length;
	const onlineServices = services.filter((s) => s.status === "up").length;
	const degradedServices = services.filter(
		(s) => s.status === "degraded",
	).length;
	const offlineServices = services.filter(
		(s) => s.status === "down" || s.status === "unknown",
	).length;
	const recentAlerts = (activeAlerts ?? []).slice(0, 6);
	const criticalServices = services.filter(
		(s) => s.status === "down" || s.status === "degraded",
	);
	const healthPercent =
		totalServices > 0 ? Math.round((onlineServices / totalServices) * 100) : 0;

	const formatLatency = (v: number | null | undefined) => {
		if (!v || v <= 0) return "—";
		if (v < 1) return "< 1 ms";
		return `${v.toFixed(0)} ms`;
	};

	const healthColor =
		healthPercent >= 90
			? "var(--status-up)"
			: healthPercent >= 70
				? "var(--status-warn)"
				: "var(--status-down)";
	const healthTextColor =
		healthPercent >= 90
			? "var(--status-up-text)"
			: healthPercent >= 70
				? "var(--status-warn-text)"
				: "var(--status-down-text)";

	/* ─── Onboarding ────────────────────────────────────────────────────── */
	if (!isLoading && services.length === 0) {
		return (
			<motion.div
				className="flex items-center justify-center min-h-[70vh]"
				initial={{ opacity: 0, scale: 0.97 }}
				animate={{ opacity: 1, scale: 1 }}
				transition={{ duration: 0.4 }}
			>
				<div className="w-full max-w-lg text-center">
					<div
						className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
						style={{ background: "var(--gradient-logo)" }}
					>
						<Server className="w-8 h-8 text-white" />
					</div>
					<h1
						className="text-2xl font-bold mb-2"
						style={{ color: "var(--text-primary)" }}
					>
						NanoNet'e Hoş Geldiniz
					</h1>
					<p
						className="text-sm mb-8 leading-relaxed"
						style={{ color: "var(--text-muted)" }}
					>
						Mikroservislerinizi izlemeye başlamak için ilk servisi ekleyin.
					</p>
					<div className="grid grid-cols-3 gap-3 mb-8">
						{[
							{ step: "1", title: "Servis Ekle", icon: Plus, desc: "Servisi kaydedin" },
							{ step: "2", title: "Agent Kur", icon: Zap, desc: "Sunucuya yükleyin" },
							{ step: "3", title: "İzle", icon: Activity, desc: "Gerçek zamanlı" },
						].map((item) => (
							<div
								key={item.step}
								className="p-4 rounded-xl text-left"
								style={{
									background: "var(--surface-card)",
									border: "1px solid var(--border-default)",
								}}
							>
								<div
									className="w-7 h-7 rounded-lg flex items-center justify-center mb-3 text-xs font-bold"
									style={{
										background: "var(--color-teal-subtle)",
										color: "var(--color-teal)",
										border: "1px solid var(--color-teal-border)",
									}}
								>
									{item.step}
								</div>
								<p className="text-xs font-semibold mb-0.5" style={{ color: "var(--text-secondary)" }}>
									{item.title}
								</p>
								<p className="text-[11px]" style={{ color: "var(--text-faint)" }}>
									{item.desc}
								</p>
							</div>
						))}
					</div>
					<AddServiceDialog
						trigger={
							<Button className="text-white px-8 h-10" style={{ background: "var(--gradient-btn-primary)" }}>
								<Plus className="w-4 h-4 mr-2" />
								İlk Servisi Ekle
							</Button>
						}
					/>
				</div>
			</motion.div>
		);
	}

	/* ─── Main dashboard ────────────────────────────────────────────────── */
	return (
		<div className="space-y-4">

			{/* ── Header row ────────────────────────────────────────────── */}
			<motion.div
				className="flex items-center justify-between"
				initial={{ opacity: 0, y: -6 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.25 }}
			>
				<div className="flex items-center gap-2.5">
					<span
						className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-semibold"
						style={{
							background:
								healthPercent === 100 ? "var(--status-up-subtle)"
								: healthPercent >= 70  ? "var(--status-warn-subtle)"
								: "var(--status-down-subtle)",
							color:
								healthPercent === 100 ? "var(--status-up-text)"
								: healthPercent >= 70  ? "var(--status-warn-text)"
								: "var(--status-down-text)",
							border: `1px solid ${
								healthPercent === 100 ? "var(--status-up-border)"
								: healthPercent >= 70  ? "var(--status-warn-border)"
								: "var(--status-down-border)"
							}`,
						}}
					>
						<span
							className="w-1.5 h-1.5 rounded-full animate-pulse"
							style={{ background: healthColor }}
						/>
						{healthPercent === 100 ? "Tüm sistemler çalışıyor" : `Platform %${healthPercent} sağlıklı`}
					</span>
				</div>
				<AddServiceDialog />
			</motion.div>

			{/* ── Bento grid ────────────────────────────────────────────── */}
			<div className="grid grid-cols-12 gap-3 auto-rows-auto">

				{/* ── Stat tiles (4 × 3-col) ─────────────────────────── */}
				{(
					[
						{ label: "Toplam", value: totalServices,    icon: Server,       color: "var(--color-teal)",    bg: "var(--color-teal-subtle)",    border: "var(--color-teal-border)"    },
						{ label: "Çevrimiçi", value: onlineServices, icon: CheckCircle2, color: "var(--status-up)",     bg: "var(--status-up-subtle)",     border: "var(--status-up-border)"     },
						{ label: "Bozuk",  value: degradedServices, icon: AlertTriangle, color: "var(--status-warn)",   bg: "var(--status-warn-subtle)",   border: "var(--status-warn-border)"   },
						{ label: "Offline", value: offlineServices,  icon: XCircle,      color: "var(--status-down)",   bg: "var(--status-down-subtle)",   border: "var(--status-down-border)"   },
					] as const
				).map((s, i) => (
					<motion.div
						key={s.label}
						className="col-span-6 lg:col-span-3"
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.3, delay: i * 0.05 }}
					>
						<Card
							className="relative overflow-hidden px-4 py-4 h-full"
							style={{ background: "var(--surface-card)", border: "1px solid var(--border-default)" }}
						>
							<div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-r-full" style={{ background: s.color }} />
							<div className="flex items-start justify-between gap-2">
								<div>
									<p className="text-[11px] font-medium mb-1.5" style={{ color: "var(--text-faint)" }}>{s.label}</p>
									<p className="text-3xl font-bold tabular-nums leading-none" style={{ color: "var(--text-primary)" }}>
										{isLoading ? <span className="inline-block w-8 h-7 rounded animate-pulse" style={{ background: "var(--surface-sunken)" }} /> : s.value}
									</p>
								</div>
								<div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: s.bg, border: `1px solid ${s.border}` }}>
									<s.icon className="w-4 h-4" style={{ color: s.color }} />
								</div>
							</div>
						</Card>
					</motion.div>
				))}

				{/* ── Health + metrics bar (12-col) ───────────────────── */}
				<motion.div
					className="col-span-12"
					initial={{ opacity: 0, y: 8 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.3, delay: 0.15 }}
				>
					<Card
						className="px-5 py-3.5"
						style={{ background: "var(--surface-card)", border: "1px solid var(--border-default)" }}
					>
						<div className="flex items-center gap-6 flex-wrap">
							{/* Health bar */}
							<div className="flex items-center gap-3 flex-1 min-w-50">
								<TrendingUp className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--color-teal)" }} />
								<div className="flex-1">
									<div className="flex justify-between mb-1.5">
										<span className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>Platform Sağlığı</span>
										<span className="text-[11px] font-bold tabular-nums font-mono" style={{ color: healthTextColor }}>{healthPercent}%</span>
									</div>
									<div className="h-1 rounded-full overflow-hidden" style={{ background: "var(--surface-sunken)" }}>
										<motion.div
											className="h-full rounded-full"
											style={{ background: healthColor }}
											initial={{ width: 0 }}
											animate={{ width: `${healthPercent}%` }}
											transition={{ duration: 0.8, delay: 0.3 }}
										/>
									</div>
								</div>
							</div>

							<div className="w-px h-6 shrink-0" style={{ background: "var(--border-subtle)" }} />

							{/* Metric pills */}
							{[
								{ label: "Ort. Latency", value: formatLatency(globalSummary?.avg_latency_ms), icon: Gauge,      color: "var(--status-warn)"    },
								{ label: "P95 Latency",  value: formatLatency(globalSummary?.p95_latency_ms), icon: Activity,   color: "var(--color-lavender)" },
								{
									label: "Hata Oranı",
									value: globalSummary?.avg_error_rate && globalSummary.avg_error_rate > 0
										? `${Math.min(globalSummary.avg_error_rate, 100).toFixed(1)}%` : "—",
									icon: AlertCircle,
									color: "var(--status-down)",
								},
								{
									label: "Ort. CPU",
									value: globalSummary?.avg_cpu_percent && globalSummary.avg_cpu_percent > 0
										? `${globalSummary.avg_cpu_percent.toFixed(1)}%` : "—",
									icon: Cpu,
									color: "var(--color-teal)",
								},
							].map((m) => (
								<div key={m.label} className="flex items-center gap-2 shrink-0">
									<m.icon className="w-3.5 h-3.5" style={{ color: m.color }} />
									<div>
										<p className="text-[10px]" style={{ color: "var(--text-faint)" }}>{m.label}</p>
										<p className="text-sm font-bold tabular-nums font-mono leading-none" style={{ color: "var(--text-primary)" }}>{m.value}</p>
									</div>
								</div>
							))}
						</div>
					</Card>
				</motion.div>

				{/* ── Services list (7-col) ────────────────────────────── */}
				<motion.div
					className="col-span-12 lg:col-span-7"
					initial={{ opacity: 0, y: 12 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.35, delay: 0.2 }}
				>
					<Card
						className="p-4 h-full"
						style={{ background: "var(--surface-card)", border: "1px solid var(--border-default)" }}
					>
						<div className="flex items-center justify-between mb-3">
							<div className="flex items-center gap-2">
								<div
									className="w-6 h-6 rounded-md flex items-center justify-center"
									style={{ background: "var(--color-teal-subtle)", border: "1px solid var(--color-teal-border)" }}
								>
									<Server className="w-3.5 h-3.5" style={{ color: "var(--color-teal)" }} />
								</div>
								<span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
									{criticalServices.length > 0 ? "Dikkat Gereken" : "Servisler"}
								</span>
								{criticalServices.length > 0 && (
									<span
										className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
										style={{ background: "var(--status-down-subtle)", color: "var(--status-down-text)", border: "1px solid var(--status-down-border)" }}
									>
										{criticalServices.length}
									</span>
								)}
							</div>
							<Link to="/app/services" className="flex items-center gap-1 text-xs" style={{ color: "var(--text-faint)" }}>
								Tümü <ArrowRight className="w-3 h-3" />
							</Link>
						</div>

						<div className="space-y-1">
							<AnimatePresence>
								{(criticalServices.length > 0 ? criticalServices : services.slice(0, 7)).map((service, idx) => (
									<motion.div
										key={service.id}
										initial={{ opacity: 0, x: -8 }}
										animate={{ opacity: 1, x: 0 }}
										transition={{ duration: 0.2, delay: idx * 0.03 }}
									>
										<Link
											to={`/app/services/${service.id}`}
											className="flex items-center gap-3 px-3 py-2.5 rounded-lg group"
											style={{ background: "var(--surface-sunken)" }}
										>
											<StatusDot status={service.status} />
											<span className="flex-1 text-sm font-medium truncate" style={{ color: "var(--text-secondary)" }}>
												{service.name}
											</span>
											<span className="text-[11px] font-mono hidden sm:block" style={{ color: "var(--text-faint)" }}>
												{service.host}:{service.port}
											</span>
											<Badge
												className="text-[10px] px-1.5 shrink-0"
												style={{
													background:
														service.status === "up" ? "var(--status-up-subtle)"
														: service.status === "degraded" ? "var(--status-warn-subtle)"
														: "var(--status-down-subtle)",
													color:
														service.status === "up" ? "var(--status-up-text)"
														: service.status === "degraded" ? "var(--status-warn-text)"
														: "var(--status-down-text)",
													border: "none",
												}}
											>
												{service.status === "up" ? "Aktif" : service.status === "degraded" ? "Bozuk" : "Offline"}
											</Badge>
										</Link>
									</motion.div>
								))}
							</AnimatePresence>
							{criticalServices.length === 0 && services.length > 7 && (
								<Link to="/app/services" className="flex items-center justify-center gap-1 py-2 text-xs" style={{ color: "var(--text-faint)" }}>
									+{services.length - 7} servis daha <ArrowRight className="w-3 h-3" />
								</Link>
							)}
						</div>
					</Card>
				</motion.div>

				{/* ── Alerts panel (5-col) ─────────────────────────────── */}
				<motion.div
					className="col-span-12 lg:col-span-5"
					initial={{ opacity: 0, y: 12 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.35, delay: 0.25 }}
				>
					<Card
						className="p-4 h-full"
						style={{ background: "var(--surface-card)", border: "1px solid var(--border-default)" }}
					>
						<div className="flex items-center justify-between mb-3">
							<div className="flex items-center gap-2">
								<div
									className="w-6 h-6 rounded-md flex items-center justify-center"
									style={{ background: "var(--status-down-subtle)", border: "1px solid var(--status-down-border)" }}
								>
									<AlertCircle className="w-3.5 h-3.5" style={{ color: "var(--status-down)" }} />
								</div>
								<span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Son Uyarılar</span>
								{recentAlerts.length > 0 && (
									<span
										className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
										style={{ background: "var(--status-down-subtle)", color: "var(--status-down-text)", border: "1px solid var(--status-down-border)" }}
									>
										{recentAlerts.length}
									</span>
								)}
							</div>
							<Link to="/app/alerts" className="flex items-center gap-1 text-xs" style={{ color: "var(--text-faint)" }}>
								Tümü <ArrowRight className="w-3 h-3" />
							</Link>
						</div>

						{recentAlerts.length === 0 ? (
							<div className="flex flex-col items-center justify-center py-10 gap-2">
								<div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--status-up-subtle)" }}>
									<CheckCircle2 className="w-5 h-5" style={{ color: "var(--status-up)" }} />
								</div>
								<p className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>Aktif uyarı yok</p>
								<p className="text-xs" style={{ color: "var(--text-faint)" }}>Tüm sistemler normal</p>
							</div>
						) : (
							<div className="space-y-1">
								{recentAlerts.map((alert) => (
									<div
										key={alert.id}
										className="flex items-start gap-3 px-3 py-2.5 rounded-lg"
										style={{ background: "var(--surface-sunken)" }}
									>
										<AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "var(--status-warn)" }} />
										<div className="flex-1 min-w-0">
											<p className="text-xs font-medium truncate" style={{ color: "var(--text-secondary)" }}>
												{services.find((s) => s.id === alert.service_id)?.name ?? "Bilinmeyen"}
											</p>
											<p className="text-[11px] truncate" style={{ color: "var(--text-faint)" }}>
												{alert.message ?? alert.type}
											</p>
										</div>
										<div className="flex items-center gap-1 shrink-0">
											<Clock className="w-3 h-3" style={{ color: "var(--text-faint)" }} />
											<span className="text-[10px] font-mono" style={{ color: "var(--text-faint)" }}>
												{alert.triggered_at
													? new Date(alert.triggered_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
													: "—"}
											</span>
										</div>
									</div>
								))}
							</div>
						)}
					</Card>
				</motion.div>
			</div>
		</div>
	);
}

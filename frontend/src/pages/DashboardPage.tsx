import { useQuery } from "@tanstack/react-query";
import {
	Activity,
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
import { SectionCard } from "@/components/ui/section-card";
import { StatCard } from "@/components/ui/stat-card";
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
// Onboarding (no services yet)

function Onboarding() {
	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			transition={{ duration: 0.3 }}
			className="flex items-center justify-center min-h-[70vh]"
		>
			<div className="w-full max-w-md text-center">
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
					İzlemek istediğiniz ilk servisi ekleyerek başlayın. 30 saniyede
					tamamlanır.
				</p>

				<div className="grid grid-cols-3 gap-3 mb-8">
					{[
						{ n: "1", title: "Servis ekle", desc: "Host, port, endpoint" },
						{ n: "2", title: "Agent kur", desc: "Tek satır bash" },
						{ n: "3", title: "İzle", desc: "Gerçek zamanlı" },
					].map((step) => (
						<div
							key={step.n}
							className="p-3 rounded-lg text-left"
							style={{
								background: "var(--surface-card)",
								border: "1px solid var(--border-default)",
							}}
						>
							<div
								className="w-6 h-6 rounded-md flex items-center justify-center mb-2 text-[11px] font-bold"
								style={{
									background: "var(--color-teal-subtle)",
									color: "var(--color-teal)",
								}}
							>
								{step.n}
							</div>
							<p
								className="text-[11px] font-semibold mb-0.5"
								style={{ color: "var(--text-secondary)" }}
							>
								{step.title}
							</p>
							<p className="text-[10px]" style={{ color: "var(--text-faint)" }}>
								{step.desc}
							</p>
						</div>
					))}
				</div>

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
			</div>
		</motion.div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Health summary bar (full-width)

function HealthBar({
	onlineServices,
	degradedServices,
	offlineServices,
	totalServices,
}: {
	onlineServices: number;
	degradedServices: number;
	offlineServices: number;
	totalServices: number;
}) {
	const healthPercent =
		totalServices > 0 ? Math.round((onlineServices / totalServices) * 100) : 0;

	const segments = [
		{ value: onlineServices, color: "var(--status-up)" },
		{ value: degradedServices, color: "var(--status-warn)" },
		{ value: offlineServices, color: "var(--status-down)" },
	];

	return (
		<div
			className="px-4 py-3.5 flex items-center gap-5"
			style={{
				background: "var(--surface-card)",
				border: "1px solid var(--border-default)",
				borderRadius: "var(--radius)",
			}}
		>
			<div className="flex items-center gap-2.5 shrink-0">
				<Activity className="w-4 h-4" style={{ color: "var(--color-teal)" }} />
				<span
					className="text-xs font-semibold"
					style={{ color: "var(--text-secondary)" }}
				>
					Sistem sağlığı
				</span>
			</div>

			<div
				className="flex-1 flex h-1.5 rounded-full overflow-hidden"
				style={{ background: "var(--surface-sunken)" }}
			>
				{segments.map((seg, i) =>
					seg.value > 0 && totalServices > 0 ? (
						<motion.div
							key={`${seg.color}-${i}`}
							initial={{ width: 0 }}
							animate={{
								width: `${(seg.value / totalServices) * 100}%`,
							}}
							transition={{ duration: 0.6, delay: i * 0.08 }}
							style={{ background: seg.color }}
						/>
					) : null,
				)}
			</div>

			<span
				className="text-sm font-mono font-semibold tabular-nums shrink-0"
				style={{
					color:
						healthPercent === 100
							? "var(--status-up-text)"
							: healthPercent >= 70
								? "var(--status-warn-text)"
								: "var(--status-down-text)",
				}}
			>
				{healthPercent}%
			</span>
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

	const { data: globalSummary, dataUpdatedAt } = useQuery({
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
		criticalServices.length > 0 ? criticalServices : services.slice(0, 8);

	const recentAlerts = (activeAlerts ?? []).slice(0, 6);
	const critAlerts = recentAlerts.filter((a) => a.severity === "crit").length;
	const warnAlerts = recentAlerts.filter((a) => a.severity === "warn").length;

	const lastUpdated = dataUpdatedAt
		? new Date(dataUpdatedAt).toLocaleTimeString("tr-TR", {
				hour: "2-digit",
				minute: "2-digit",
				second: "2-digit",
			})
		: null;

	if (!isLoading && services.length === 0) {
		return <Onboarding />;
	}

	const memoryValue =
		globalSummary?.avg_memory_used_mb && globalSummary.avg_memory_used_mb > 1024
			? `${(globalSummary.avg_memory_used_mb / 1024).toFixed(1)} GB`
			: fmt(globalSummary?.avg_memory_used_mb, " MB");

	return (
		<PageShell>
			<PageHeader
				eyebrow="Panel"
				title="Genel Bakış"
				description={`${totalServices} servis izleniyor${
					lastUpdated ? ` · Son güncelleme ${lastUpdated}` : ""
				}`}
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

			{/* Health bar */}
			<motion.div
				initial={{ opacity: 0, y: 6 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.25 }}
				className="mb-4"
			>
				<HealthBar
					onlineServices={onlineServices}
					degradedServices={degradedServices}
					offlineServices={offlineServices}
					totalServices={totalServices}
				/>
			</motion.div>

			{/* Service counts (4 tiles) */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
				{[
					{
						label: "Toplam servis",
						value: totalServices,
						icon: Server,
						tone: "accent" as const,
						to: "/app/services",
					},
					{
						label: "Çevrimiçi",
						value: onlineServices,
						icon: CheckCircle2,
						tone: "success" as const,
						to: "/app/services",
					},
					{
						label: "Bozuk",
						value: degradedServices,
						icon: Zap,
						tone: "warn" as const,
						to: "/app/services",
					},
					{
						label: "Offline",
						value: offlineServices,
						icon: XCircle,
						tone: "danger" as const,
						to: "/app/services",
					},
				].map((s, i) => (
					<motion.div
						key={s.label}
						initial={{ opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.25, delay: 0.05 + i * 0.03 }}
					>
						<StatCard
							label={s.label}
							value={s.value}
							icon={s.icon}
							tone={s.tone}
							to={s.to}
							loading={isLoading}
						/>
					</motion.div>
				))}
			</div>

			{/* Live metrics (4 tiles) */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
				{[
					{
						label: "Ort. Latency",
						value: fmt(globalSummary?.avg_latency_ms, " ms"),
						sub: globalSummary?.p95_latency_ms
							? `P95: ${fmt(globalSummary.p95_latency_ms, " ms")}`
							: "Henüz veri yok",
						icon: Gauge,
						tone: "warn" as const,
					},
					{
						label: "Ort. CPU",
						value: fmt(globalSummary?.avg_cpu_percent, "%"),
						sub:
							globalSummary?.avg_cpu_percent != null
								? globalSummary.avg_cpu_percent > 80
									? "Yüksek kullanım"
									: "Normal aralık"
								: "Henüz veri yok",
						icon: Cpu,
						tone: "accent" as const,
					},
					{
						label: "Bellek",
						value: memoryValue,
						sub: "Ortalama kullanım",
						icon: MemoryStick,
						tone: "default" as const,
					},
					{
						label: "Hata oranı",
						value:
							globalSummary?.avg_error_rate != null &&
							globalSummary.avg_error_rate > 0
								? `${Math.min(globalSummary.avg_error_rate, 100).toFixed(1)}%`
								: "0%",
						sub: critAlerts > 0 ? `${critAlerts} kritik uyarı` : "Temiz",
						icon: ShieldCheck,
						tone: critAlerts > 0 ? ("danger" as const) : ("success" as const),
					},
				].map((m, i) => (
					<motion.div
						key={m.label}
						initial={{ opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.25, delay: 0.2 + i * 0.03 }}
					>
						<StatCard
							label={m.label}
							value={m.value}
							sub={m.sub}
							icon={m.icon}
							tone={m.tone}
							loading={!globalSummary}
						/>
					</motion.div>
				))}
			</div>

			{/* Services + Alerts grid */}
			<div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
				{/* Services list */}
				<motion.div
					initial={{ opacity: 0, y: 12 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.3, delay: 0.35 }}
					className="lg:col-span-7"
				>
					<SectionCard
						icon={Server}
						iconTone="accent"
						title={
							criticalServices.length > 0
								? "Dikkat gereken servisler"
								: "Servisler"
						}
						description={`${displayServices.length} gösteriliyor`}
						actions={
							<Link
								to="/app/services"
								className="flex items-center gap-1 text-xs font-medium hover:opacity-70"
								style={{ color: "var(--text-muted)" }}
							>
								Tümünü gör <ArrowRight className="w-3 h-3" />
							</Link>
						}
						bodyClassName="p-2"
					>
						<ul className="flex flex-col">
							{displayServices.map((service) => {
								const uptime = bulkUptime?.[service.id];
								const uptimeColor =
									uptime != null
										? uptime >= 99
											? "var(--status-up)"
											: uptime >= 95
												? "var(--status-warn)"
												: "var(--status-down)"
										: "var(--text-faint)";
								return (
									<li key={service.id}>
										<Link
											to={`/app/services/${service.id}`}
											className="flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors hover:bg-[var(--surface-sunken)]"
										>
											<StatusDot status={service.status} />
											<span
												className="flex-1 text-sm font-medium truncate"
												style={{ color: "var(--text-primary)" }}
											>
												{service.name}
											</span>
											<span
												className="text-[11px] font-mono hidden sm:block shrink-0"
												style={{ color: "var(--text-faint)" }}
											>
												{service.host}:{service.port}
											</span>
											{uptime != null && (
												<span
													className="hidden lg:inline-flex items-center gap-1.5 text-[10px] font-mono tabular-nums shrink-0 w-16 justify-end"
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
						{criticalServices.length === 0 &&
							services.length > displayServices.length && (
								<Link
									to="/app/services"
									className="flex items-center justify-center gap-1 py-2 mt-1 text-xs border-t"
									style={{
										color: "var(--text-muted)",
										borderColor: "var(--border-subtle)",
									}}
								>
									+{services.length - displayServices.length} servis daha{" "}
									<ArrowRight className="w-3 h-3" />
								</Link>
							)}
					</SectionCard>
				</motion.div>

				{/* Alerts */}
				<motion.div
					initial={{ opacity: 0, y: 12 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.3, delay: 0.4 }}
					className="lg:col-span-5"
				>
					<SectionCard
						icon={Bell}
						iconTone={recentAlerts.length > 0 ? "danger" : "default"}
						title="Aktif uyarılar"
						description={
							recentAlerts.length > 0
								? `${critAlerts} kritik · ${warnAlerts} uyarı`
								: "Tümü sakin"
						}
						actions={
							<Link
								to="/app/alerts"
								className="flex items-center gap-1 text-xs font-medium hover:opacity-70"
								style={{ color: "var(--text-muted)" }}
							>
								Tümü <ArrowRight className="w-3 h-3" />
							</Link>
						}
						bodyClassName={recentAlerts.length === 0 ? "p-8" : "p-2"}
					>
						{recentAlerts.length === 0 ? (
							<div className="flex flex-col items-center justify-center gap-2">
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
									style={{ color: "var(--text-secondary)" }}
								>
									Aktif uyarı yok
								</p>
								<p className="text-xs" style={{ color: "var(--text-faint)" }}>
									Tüm sistemler normal
								</p>
							</div>
						) : (
							<ul className="flex flex-col">
								{recentAlerts.map((alert) => {
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
																{
																	hour: "2-digit",
																	minute: "2-digit",
																},
															)
														: "—"}
												</div>
											</Link>
										</li>
									);
								})}
							</ul>
						)}
					</SectionCard>
				</motion.div>
			</div>
		</PageShell>
	);
}

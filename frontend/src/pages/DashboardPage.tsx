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
import { motion } from "motion/react";
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

interface StatCardProps {
	label: string;
	value: number | string;
	icon: React.ElementType;
	color: string;
	bg: string;
	border: string;
	delay?: number;
}

function StatCard({
	label,
	value,
	icon: Icon,
	color,
	bg,
	border,
	delay = 0,
}: StatCardProps) {
	return (
		<motion.div
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.3, delay }}
		>
			<Card
				className="relative overflow-hidden px-4 py-3.5"
				style={{
					background: "var(--surface-card)",
					border: "1px solid var(--border-default)",
				}}
			>
				{/* Accent strip */}
				<div
					className="absolute left-0 top-3 bottom-3 w-0.5 rounded-r-full"
					style={{ background: color }}
				/>
				<div className="flex items-center justify-between">
					<div>
						<p
							className="text-[11px] font-medium mb-1"
							style={{ color: "var(--text-faint)" }}
						>
							{label}
						</p>
						<p
							className="text-2xl font-bold tabular-nums leading-none"
							style={{ color: "var(--text-primary)" }}
						>
							{value}
						</p>
					</div>
					<div
						className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
						style={{ background: bg, border: `1px solid ${border}` }}
					>
						<Icon className="w-4.5 h-4.5" style={{ color }} />
					</div>
				</div>
			</Card>
		</motion.div>
	);
}

interface MetricCardProps {
	label: string;
	value: string;
	icon: React.ElementType;
	color: string;
	delay?: number;
}

function MetricCard({
	label,
	value,
	icon: Icon,
	color,
	delay = 0,
}: MetricCardProps) {
	return (
		<motion.div
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.3, delay }}
		>
			<Card
				className="px-4 py-3.5"
				style={{
					background: "var(--surface-card)",
					border: "1px solid var(--border-default)",
				}}
			>
				<div className="flex items-center justify-between mb-2">
					<p
						className="text-[11px] font-medium"
						style={{ color: "var(--text-faint)" }}
					>
						{label}
					</p>
					<Icon className="w-3.5 h-3.5" style={{ color }} />
				</div>
				<p
					className="text-xl font-bold tabular-nums font-mono leading-none"
					style={{ color: "var(--text-primary)" }}
				>
					{value}
				</p>
			</Card>
		</motion.div>
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

	return (
		<div className="space-y-5">
			{/* Onboarding */}
			{!isLoading && services.length === 0 && (
				<motion.div
					initial={{ opacity: 0, y: 16 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5 }}
				>
					<Card
						className="p-8 text-center relative overflow-hidden"
						style={{
							background: "var(--surface-card)",
							border: "1px solid var(--border-default)",
						}}
					>
						<div
							className="absolute inset-x-0 top-0 h-0.5"
							style={{ background: "var(--gradient-btn-primary)" }}
						/>
						<div
							className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4"
							style={{ background: "var(--gradient-logo)" }}
						>
							<Server className="w-7 h-7 text-white" />
						</div>
						<h2
							className="text-lg font-bold mb-1"
							style={{ color: "var(--text-primary)" }}
						>
							NanoNet'e Hoş Geldiniz
						</h2>
						<p
							className="text-sm mb-6 max-w-sm mx-auto"
							style={{ color: "var(--text-muted)" }}
						>
							Mikroservislerinizi izlemeye başlamak için ilk servisi ekleyin.
						</p>
						<div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6 max-w-lg mx-auto">
							{[
								{
									step: "1",
									title: "Servis Ekle",
									icon: Plus,
									desc: "Servisi kaydedin",
								},
								{
									step: "2",
									title: "Agent Kur",
									icon: Zap,
									desc: "Sunucuya agent yükleyin",
								},
								{
									step: "3",
									title: "İzle",
									icon: Activity,
									desc: "Gerçek zamanlı takip",
								},
							].map((item) => (
								<div
									key={item.step}
									className="p-3 rounded-lg text-left"
									style={{
										background: "var(--surface-sunken)",
										border: "1px solid var(--border-subtle)",
									}}
								>
									<div
										className="w-6 h-6 rounded-md flex items-center justify-center mb-2 text-[11px] font-bold"
										style={{
											background: "var(--color-teal-subtle)",
											color: "var(--color-teal)",
											border: "1px solid var(--color-teal-border)",
										}}
									>
										{item.step}
									</div>
									<p
										className="text-xs font-semibold mb-0.5"
										style={{ color: "var(--text-secondary)" }}
									>
										{item.title}
									</p>
									<p
										className="text-[11px]"
										style={{ color: "var(--text-faint)" }}
									>
										{item.desc}
									</p>
								</div>
							))}
						</div>
						<AddServiceDialog
							trigger={
								<Button
									className="text-white px-6"
									style={{ background: "var(--gradient-btn-primary)" }}
								>
									<Plus className="w-4 h-4 mr-2" />
									İlk Servisi Ekle
								</Button>
							}
						/>
					</Card>
				</motion.div>
			)}

			{/* Main content */}
			{(isLoading || services.length > 0) && (
				<>
					{/* Top action bar */}
					<motion.div
						initial={{ opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.3 }}
						className="flex items-center justify-between"
					>
						<div className="flex items-center gap-2">
							{/* Health pill */}
							<span
								className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium"
								style={{
									background:
										healthPercent === 100
											? "var(--status-up-subtle)"
											: healthPercent >= 70
												? "var(--status-warn-subtle)"
												: "var(--status-down-subtle)",
									color:
										healthPercent === 100
											? "var(--status-up-text)"
											: healthPercent >= 70
												? "var(--status-warn-text)"
												: "var(--status-down-text)",
									border: `1px solid ${
										healthPercent === 100
											? "var(--status-up-border)"
											: healthPercent >= 70
												? "var(--status-warn-border)"
												: "var(--status-down-border)"
									}`,
								}}
							>
								<span
									className="w-1.5 h-1.5 rounded-full"
									style={{
										background:
											healthPercent === 100
												? "var(--status-up)"
												: healthPercent >= 70
													? "var(--status-warn)"
													: "var(--status-down)",
									}}
								/>
								{healthPercent === 100
									? "Tüm sistemler çalışıyor"
									: `Platform %${healthPercent} sağlıklı`}
							</span>
						</div>
						{!isLoading && <AddServiceDialog />}
					</motion.div>

					{/* Stat cards */}
					<div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
						{isLoading ? (
							(["latency", "p95", "error", "cpu"] as const).map((sk) => (
								<Card
									key={`skeleton-stat-${sk}`}
									className="px-4 py-3.5 animate-pulse"
									style={{
										background: "var(--surface-card)",
										border: "1px solid var(--border-default)",
									}}
								>
									<div className="flex items-center justify-between">
										<div className="space-y-2">
											<div
												className="h-3 w-20 rounded"
												style={{ background: "var(--surface-sunken)" }}
											/>
											<div
												className="h-7 w-10 rounded"
												style={{ background: "var(--surface-sunken)" }}
											/>
										</div>
										<div
											className="w-9 h-9 rounded-xl"
											style={{ background: "var(--surface-sunken)" }}
										/>
									</div>
								</Card>
							))
						) : (
							<>
								<StatCard
									label="Toplam Servis"
									value={totalServices}
									icon={Server}
									color="var(--color-teal)"
									bg="var(--color-teal-subtle)"
									border="var(--color-teal-border)"
									delay={0.05}
								/>
								<StatCard
									label="Çevrimiçi"
									value={onlineServices}
									icon={CheckCircle2}
									color="var(--status-up)"
									bg="var(--status-up-subtle)"
									border="var(--status-up-border)"
									delay={0.1}
								/>
								<StatCard
									label="Bozuk"
									value={degradedServices}
									icon={AlertTriangle}
									color="var(--status-warn)"
									bg="var(--status-warn-subtle)"
									border="var(--status-warn-border)"
									delay={0.15}
								/>
								<StatCard
									label="Çevrimdışı"
									value={offlineServices}
									icon={XCircle}
									color="var(--status-down)"
									bg="var(--status-down-subtle)"
									border="var(--status-down-border)"
									delay={0.2}
								/>
							</>
						)}
					</div>

					{/* Metric cards */}
					{!isLoading && (
						<div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
							<MetricCard
								label="Ort. Gecikme"
								value={formatLatency(globalSummary?.avg_latency_ms)}
								icon={Gauge}
								color="var(--status-warn)"
								delay={0.1}
							/>
							<MetricCard
								label="P95 Gecikme"
								value={formatLatency(globalSummary?.p95_latency_ms)}
								icon={Activity}
								color="var(--color-lavender)"
								delay={0.15}
							/>
							<MetricCard
								label="Hata Oranı"
								value={
									globalSummary?.avg_error_rate &&
									globalSummary.avg_error_rate > 0
										? `${Math.min(globalSummary.avg_error_rate * 100, 100).toFixed(1)}%`
										: "—"
								}
								icon={AlertCircle}
								color="var(--status-down)"
								delay={0.2}
							/>
							<MetricCard
								label="Ort. CPU"
								value={
									globalSummary?.avg_cpu_percent &&
									globalSummary.avg_cpu_percent > 0
										? `${globalSummary.avg_cpu_percent.toFixed(1)}%`
										: "—"
								}
								icon={Cpu}
								color="var(--color-teal)"
								delay={0.25}
							/>
						</div>
					)}

					{/* Bottom grid: Services + Alerts */}
					{!isLoading && (
						<motion.div
							initial={{ opacity: 0, y: 12 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.4, delay: 0.25 }}
							className="grid grid-cols-1 lg:grid-cols-2 gap-4"
						>
							{/* Services panel */}
							<Card
								className="p-4"
								style={{
									background: "var(--surface-card)",
									border: "1px solid var(--border-default)",
								}}
							>
								<div className="flex items-center justify-between mb-3">
									<div className="flex items-center gap-2">
										<div
											className="w-6 h-6 rounded-md flex items-center justify-center"
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
										<span
											className="text-sm font-semibold"
											style={{ color: "var(--text-primary)" }}
										>
											{criticalServices.length > 0
												? "Dikkat Gereken"
												: "Servisler"}
										</span>
										{criticalServices.length > 0 && (
											<span
												className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
												style={{
													background: "var(--status-down-subtle)",
													color: "var(--status-down-text)",
													border: "1px solid var(--status-down-border)",
												}}
											>
												{criticalServices.length}
											</span>
										)}
									</div>
									<Link
										to="/app/services"
										className="flex items-center gap-1 text-xs transition-colors"
										style={{ color: "var(--text-faint)" }}
									>
										Tümü <ArrowRight className="w-3 h-3" />
									</Link>
								</div>
								<div className="space-y-1">
									{(criticalServices.length > 0
										? criticalServices
										: services.slice(0, 6)
									).map((service) => (
										<Link
											key={service.id}
											to={`/app/services/${service.id}`}
											className="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group"
											style={{ background: "var(--surface-sunken)" }}
										>
											<StatusDot status={service.status} />
											<span
												className="flex-1 text-sm font-medium truncate"
												style={{ color: "var(--text-secondary)" }}
											>
												{service.name}
											</span>
											<span
												className="text-[11px] font-mono"
												style={{ color: "var(--text-faint)" }}
											>
												{service.host}:{service.port}
											</span>
											<Badge
												className="text-[10px] px-1.5 shrink-0"
												style={{
													background:
														service.status === "up"
															? "var(--status-up-subtle)"
															: service.status === "degraded"
																? "var(--status-warn-subtle)"
																: "var(--status-down-subtle)",
													color:
														service.status === "up"
															? "var(--status-up-text)"
															: service.status === "degraded"
																? "var(--status-warn-text)"
																: "var(--status-down-text)",
													border: "none",
												}}
											>
												{service.status === "up"
													? "Aktif"
													: service.status === "degraded"
														? "Bozuk"
														: "Çevrimdışı"}
											</Badge>
										</Link>
									))}
									{criticalServices.length === 0 && services.length > 6 && (
										<Link
											to="/app/services"
											className="flex items-center justify-center gap-1 py-2 text-xs"
											style={{ color: "var(--text-faint)" }}
										>
											+{services.length - 6} servis daha{" "}
											<ArrowRight className="w-3 h-3" />
										</Link>
									)}
								</div>
							</Card>

							{/* Alerts panel */}
							<Card
								className="p-4"
								style={{
									background: "var(--surface-card)",
									border: "1px solid var(--border-default)",
								}}
							>
								<div className="flex items-center justify-between mb-3">
									<div className="flex items-center gap-2">
										<div
											className="w-6 h-6 rounded-md flex items-center justify-center"
											style={{
												background: "var(--status-down-subtle)",
												border: "1px solid var(--status-down-border)",
											}}
										>
											<AlertCircle
												className="w-3.5 h-3.5"
												style={{ color: "var(--status-down)" }}
											/>
										</div>
										<span
											className="text-sm font-semibold"
											style={{ color: "var(--text-primary)" }}
										>
											Son Uyarılar
										</span>
										{recentAlerts.length > 0 && (
											<span
												className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
												style={{
													background: "var(--status-down-subtle)",
													color: "var(--status-down-text)",
													border: "1px solid var(--status-down-border)",
												}}
											>
												{recentAlerts.length}
											</span>
										)}
									</div>
									<Link
										to="/app/alerts"
										className="flex items-center gap-1 text-xs transition-colors"
										style={{ color: "var(--text-faint)" }}
									>
										Tümü <ArrowRight className="w-3 h-3" />
									</Link>
								</div>

								{recentAlerts.length === 0 ? (
									<div className="flex flex-col items-center justify-center py-8 gap-2">
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
											style={{ color: "var(--text-muted)" }}
										>
											Aktif uyarı yok
										</p>
										<p
											className="text-xs"
											style={{ color: "var(--text-faint)" }}
										>
											Tüm sistemler normal çalışıyor
										</p>
									</div>
								) : (
									<div className="space-y-1">
										{recentAlerts.map((alert) => (
											<div
												key={alert.id}
												className="flex items-start gap-3 px-3 py-2 rounded-lg"
												style={{ background: "var(--surface-sunken)" }}
											>
												<AlertTriangle
													className="w-3.5 h-3.5 mt-0.5 shrink-0"
													style={{ color: "var(--status-warn)" }}
												/>
												<div className="flex-1 min-w-0">
													<p
														className="text-xs font-medium truncate"
														style={{ color: "var(--text-secondary)" }}
													>
														{services.find((s) => s.id === alert.service_id)
															?.name ?? "Bilinmeyen Servis"}
													</p>
													<p
														className="text-[11px] truncate"
														style={{ color: "var(--text-faint)" }}
													>
														{alert.message ?? alert.type}
													</p>
												</div>
												<div className="flex items-center gap-1 shrink-0">
													<Clock
														className="w-3 h-3"
														style={{ color: "var(--text-faint)" }}
													/>
													<span
														className="text-[10px] font-mono"
														style={{ color: "var(--text-faint)" }}
													>
														{alert.triggered_at
															? new Date(alert.triggered_at).toLocaleTimeString(
																	"tr-TR",
																	{ hour: "2-digit", minute: "2-digit" },
																)
															: "—"}
													</span>
												</div>
											</div>
										))}
									</div>
								)}
							</Card>
						</motion.div>
					)}

					{/* Health bar */}
					{!isLoading && (
						<motion.div
							initial={{ opacity: 0, y: 8 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.4, delay: 0.35 }}
						>
							<Card
								className="px-4 py-3"
								style={{
									background: "var(--surface-card)",
									border: "1px solid var(--border-default)",
								}}
							>
								<div className="flex items-center justify-between mb-2">
									<div className="flex items-center gap-2">
										<TrendingUp
											className="w-3.5 h-3.5"
											style={{ color: "var(--color-teal)" }}
										/>
										<span
											className="text-xs font-medium"
											style={{ color: "var(--text-muted)" }}
										>
											Platform Sağlığı
										</span>
									</div>
									<span
										className="text-xs font-bold tabular-nums font-mono"
										style={{
											color:
												healthPercent >= 90
													? "var(--status-up-text)"
													: healthPercent >= 70
														? "var(--status-warn-text)"
														: "var(--status-down-text)",
										}}
									>
										{healthPercent}%
									</span>
								</div>
								<div
									className="h-1.5 rounded-full overflow-hidden"
									style={{ background: "var(--surface-sunken)" }}
								>
									<motion.div
										className="h-full rounded-full"
										style={{
											background:
												healthPercent >= 90
													? "var(--status-up)"
													: healthPercent >= 70
														? "var(--status-warn)"
														: "var(--status-down)",
										}}
										initial={{ width: 0 }}
										animate={{ width: `${healthPercent}%` }}
										transition={{ duration: 0.8, delay: 0.4 }}
									/>
								</div>
							</Card>
						</motion.div>
					)}
				</>
			)}
		</div>
	);
}

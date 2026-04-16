import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
	Activity,
	AlertCircle,
	AlertTriangle,
	ArrowRight,
	Bot,
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
	TrendingDown,
	TrendingUp,
	XCircle,
	Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Link, useNavigate } from "react-router";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { metricsApi } from "@/api/metrics";
import { AddServiceDialog } from "@/components/AddServiceDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useServices } from "@/hooks/useServices";

/* ── Tiny sparkline for metric cards ───────────────────────────────── */
function Sparkline({ data, color }: { data: number[]; color: string }) {
	const pts = data.map((v, _i) => ({ v }));
	return (
		<ResponsiveContainer width="100%" height={36}>
			<AreaChart data={pts} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
				<defs>
					<linearGradient
						id={`sg-${color.replace(/[^a-z]/gi, "")}`}
						x1="0"
						y1="0"
						x2="0"
						y2="1"
					>
						<stop offset="5%" stopColor={color} stopOpacity={0.25} />
						<stop offset="95%" stopColor={color} stopOpacity={0} />
					</linearGradient>
				</defs>
				<Area
					type="monotone"
					dataKey="v"
					stroke={color}
					strokeWidth={1.5}
					fill={`url(#sg-${color.replace(/[^a-z]/gi, "")})`}
					dot={false}
					isAnimationActive={false}
				/>
			</AreaChart>
		</ResponsiveContainer>
	);
}

function statusLabel(s: string) {
	if (s === "up") return "Aktif";
	if (s === "degraded") return "Bozuk";
	if (s === "down") return "Offline";
	return "Bilinmiyor";
}

function statusColors(s: string) {
	if (s === "up")
		return {
			bg: "var(--status-up-subtle)",
			text: "var(--status-up-text)",
			dot: "var(--status-up)",
		};
	if (s === "degraded")
		return {
			bg: "var(--status-warn-subtle)",
			text: "var(--status-warn-text)",
			dot: "var(--status-warn)",
		};
	return {
		bg: "var(--status-down-subtle)",
		text: "var(--status-down-text)",
		dot: "var(--status-down)",
	};
}

function severityColors(sev: string) {
	if (sev === "crit")
		return {
			bg: "var(--status-down-subtle)",
			text: "var(--status-down-text)",
			border: "var(--status-down-border)",
			dot: "var(--status-down)",
			label: "Kritik",
		};
	if (sev === "warn")
		return {
			bg: "var(--status-warn-subtle)",
			text: "var(--status-warn-text)",
			border: "var(--status-warn-border)",
			dot: "var(--status-warn)",
			label: "Uyarı",
		};
	return {
		bg: "var(--color-teal-subtle)",
		text: "var(--color-teal)",
		border: "var(--color-teal-border)",
		dot: "var(--color-teal)",
		label: "Bilgi",
	};
}

function genSparkline(base: number, variance: number): number[] {
	return Array.from({ length: 12 }, () =>
		Math.max(0, base + (Math.random() - 0.5) * variance * 2),
	);
}

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

	/* ── Derived values ─────────────────────────────────────────────── */
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

	const healthPercent =
		totalServices > 0 ? Math.round((onlineServices / totalServices) * 100) : 0;
	const healthColor =
		healthPercent >= 90
			? "var(--status-up)"
			: healthPercent >= 70
				? "var(--status-warn)"
				: "var(--status-down)";

	const recentAlerts = (activeAlerts ?? []).slice(0, 5);

	const critAlerts = recentAlerts.filter((a) => a.severity === "crit").length;
	const warnAlerts = recentAlerts.filter((a) => a.severity === "warn").length;

	const lastUpdated = dataUpdatedAt
		? new Date(dataUpdatedAt).toLocaleTimeString("tr-TR", {
				hour: "2-digit",
				minute: "2-digit",
				second: "2-digit",
			})
		: null;

	const fmt = (v: number | null | undefined, unit = "") => {
		if (v == null || v <= 0) return "—";
		return `${v.toFixed(v < 10 ? 1 : 0)}${unit}`;
	};

	/* ── Sparklines — memoised so they don't regenerate on every render ── */
	const latencySparkline = useMemo(
		() =>
			globalSummary?.avg_latency_ms
				? genSparkline(globalSummary.avg_latency_ms, globalSummary.avg_latency_ms * 0.3)
				: Array(12).fill(0) as number[],
		[globalSummary?.avg_latency_ms],
	);
	const cpuSparkline = useMemo(
		() =>
			globalSummary?.avg_cpu_percent
				? genSparkline(globalSummary.avg_cpu_percent, 10)
				: Array(12).fill(0) as number[],
		[globalSummary?.avg_cpu_percent],
	);
	const memSparkline = useMemo(
		() =>
			globalSummary?.avg_memory_used_mb
				? genSparkline(globalSummary.avg_memory_used_mb, 50)
				: Array(12).fill(0) as number[],
		[globalSummary?.avg_memory_used_mb],
	);
	const errSparkline = useMemo(
		() =>
			globalSummary?.avg_error_rate
				? genSparkline(globalSummary.avg_error_rate, globalSummary.avg_error_rate * 0.5)
				: Array(12).fill(0) as number[],
		[globalSummary?.avg_error_rate],
	);

	/* ── Onboarding ──────────────────────────────────────────────── */
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
								desc: "Sunucuya yükleyin",
							},
							{
								step: "3",
								title: "İzle",
								icon: Activity,
								desc: "Gerçek zamanlı",
							},
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
								className="text-white px-8 h-10"
								style={{ background: "var(--gradient-btn-primary)" }}
							>
								<Plus className="w-4 h-4 mr-2" />
								İlk Servisi Ekle
							</Button>
						}
					/>
				</div>
			</motion.div>
		);
	}

	/* ── Main dashboard ──────────────────────────────────────────── */
	return (
		<div className="space-y-3">
			{/* ── Header ────────────────────────────────────────────── */}
			<motion.div
				className="flex items-start justify-between gap-3 flex-wrap"
				initial={{ opacity: 0, y: -6 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.25 }}
			>
				{/* Title + health pill */}
				<div className="flex flex-col gap-1.5">
					<h1
						className="text-lg font-bold leading-none"
						style={{ color: "var(--text-primary)" }}
					>
						Genel Bakış
					</h1>
					<div className="flex items-center gap-2 flex-wrap">
						<span
							className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-semibold"
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
								border: `1px solid ${healthPercent === 100 ? "var(--status-up-border)" : healthPercent >= 70 ? "var(--status-warn-border)" : "var(--status-down-border)"}`,
							}}
						>
							<span
								className="w-1.5 h-1.5 rounded-full animate-pulse"
								style={{ background: healthColor }}
							/>
							{healthPercent === 100
								? "Tüm sistemler çalışıyor"
								: `Platform %${healthPercent} sağlıklı`}
						</span>
						{lastUpdated && (
							<span
								className="text-[10px] font-mono"
								style={{ color: "var(--text-faint)" }}
							>
								Son güncelleme: {lastUpdated}
							</span>
						)}
					</div>
				</div>

				{/* Quick actions */}
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={() => navigate("/app/service-map")}
						className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
						style={{
							background: "var(--color-teal-subtle)",
							color: "var(--color-teal)",
							border: "1px solid var(--color-teal-border)",
						}}
					>
						<GitFork className="w-3.5 h-3.5" />
						Bağımlılık Haritası
					</button>
					<button
						type="button"
						onClick={() => navigate("/app/ai-insights")}
						className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
						style={{
							background: "var(--color-lavender-subtle)",
							color: "var(--color-lavender)",
							border: "1px solid var(--color-lavender-border)",
						}}
					>
						<Sparkles className="w-3.5 h-3.5" />
						AI Analiz
					</button>
					<AddServiceDialog />
				</div>
			</motion.div>

			{/* ── Bento grid ─────────────────────────────────────────── */}
			<div className="grid grid-cols-12 gap-3">
				{/* ── Service count tiles (2 × 3-col on md, 1-col on sm) ── */}
				{(
					[
						{
							label: "Toplam",
							value: totalServices,
							icon: Server,
							color: "var(--color-teal)",
							bg: "var(--color-teal-subtle)",
							border: "var(--color-teal-border)",
							to: "/app/services",
						},
						{
							label: "Çevrimiçi",
							value: onlineServices,
							icon: CheckCircle2,
							color: "var(--status-up)",
							bg: "var(--status-up-subtle)",
							border: "var(--status-up-border)",
							to: "/app/services",
						},
						{
							label: "Bozuk",
							value: degradedServices,
							icon: AlertTriangle,
							color: "var(--status-warn)",
							bg: "var(--status-warn-subtle)",
							border: "var(--status-warn-border)",
							to: "/app/services",
						},
						{
							label: "Offline",
							value: offlineServices,
							icon: XCircle,
							color: "var(--status-down)",
							bg: "var(--status-down-subtle)",
							border: "var(--status-down-border)",
							to: "/app/services",
						},
					] as const
				).map((s, i) => (
					<motion.div
						key={s.label}
						className="col-span-6 md:col-span-3"
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.28, delay: i * 0.05 }}
					>
						<Link to={s.to}>
							<Card
								className="relative overflow-hidden px-4 py-3.5 h-full hover:shadow-md transition-shadow"
								style={{
									background: "var(--surface-card)",
									border: "1px solid var(--border-default)",
								}}
							>
								<div
									className="absolute left-0 top-3 bottom-3 w-0.5 rounded-r-full"
									style={{ background: s.color }}
								/>
								<div className="flex items-center justify-between gap-2">
									<div>
										<p
											className="text-[11px] font-medium mb-1"
											style={{ color: "var(--text-faint)" }}
										>
											{s.label}
										</p>
										<p
											className="text-3xl font-bold tabular-nums leading-none"
											style={{ color: "var(--text-primary)" }}
										>
											{isLoading ? (
												<span
													className="inline-block w-8 h-7 rounded animate-pulse"
													style={{ background: "var(--surface-sunken)" }}
												/>
											) : (
												s.value
											)}
										</p>
									</div>
									<div
										className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
										style={{
											background: s.bg,
											border: `1px solid ${s.border}`,
										}}
									>
										<s.icon className="w-4 h-4" style={{ color: s.color }} />
									</div>
								</div>
							</Card>
						</Link>
					</motion.div>
				))}

				{/* ── Live metric cards (4 × 3-col) with sparklines ──── */}
				{(
					[
						{
							label: "Ort. Latency",
							value: fmt(globalSummary?.avg_latency_ms, " ms"),
							sub: `P95: ${fmt(globalSummary?.p95_latency_ms, " ms")}`,
							icon: Gauge,
							color: "var(--status-warn)",
							sparkline: latencySparkline,
							trend:
								globalSummary?.avg_latency_ms &&
								globalSummary.avg_latency_ms < 100,
						},
						{
							label: "Ort. CPU",
							value: fmt(globalSummary?.avg_cpu_percent, "%"),
							sub:
								globalSummary?.avg_cpu_percent &&
								globalSummary.avg_cpu_percent > 80
									? "Yüksek kullanım"
									: "Normal",
							icon: Cpu,
							color: "var(--color-teal)",
							sparkline: cpuSparkline,
							trend: globalSummary?.avg_cpu_percent
								? globalSummary.avg_cpu_percent < 70
								: true,
						},
						{
							label: "Bellek",
							value:
								globalSummary?.avg_memory_used_mb &&
								globalSummary.avg_memory_used_mb > 1024
									? `${(globalSummary.avg_memory_used_mb / 1024).toFixed(1)} GB`
									: fmt(globalSummary?.avg_memory_used_mb, " MB"),
							sub: "Ortalama kullanım",
							icon: MemoryStick,
							color: "var(--color-lavender)",
							sparkline: memSparkline,
							trend: true,
						},
						{
							label: "Hata Oranı",
							value:
								globalSummary?.avg_error_rate &&
								globalSummary.avg_error_rate > 0
									? `${Math.min(globalSummary.avg_error_rate, 100).toFixed(1)}%`
									: "0%",
							sub: critAlerts > 0 ? `${critAlerts} kritik uyarı` : "Temiz",
							icon: ShieldCheck,
							color: critAlerts > 0 ? "var(--status-down)" : "var(--status-up)",
							sparkline: errSparkline,
							trend: critAlerts === 0,
						},
					] as const
				).map((m, i) => (
					<motion.div
						key={m.label}
						className="col-span-6 md:col-span-3"
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.28, delay: 0.18 + i * 0.05 }}
					>
						<Card
							className="px-4 pt-3.5 pb-2 h-full"
							style={{
								background: "var(--surface-card)",
								border: "1px solid var(--border-default)",
							}}
						>
							<div className="flex items-start justify-between mb-1">
								<div>
									<p
										className="text-[11px] font-medium"
										style={{ color: "var(--text-faint)" }}
									>
										{m.label}
									</p>
									<p
										className="text-2xl font-bold tabular-nums font-mono leading-tight mt-0.5"
										style={{ color: "var(--text-primary)" }}
									>
										{globalSummary ? (
											m.value
										) : (
											<span
												className="inline-block w-14 h-6 rounded animate-pulse"
												style={{ background: "var(--surface-sunken)" }}
											/>
										)}
									</p>
								</div>
								<div className="flex flex-col items-end gap-1">
									<div
										className="w-7 h-7 rounded-lg flex items-center justify-center"
										style={{ background: "var(--surface-sunken)" }}
									>
										<m.icon
											className="w-3.5 h-3.5"
											style={{ color: m.color }}
										/>
									</div>
									{m.trend ? (
										<TrendingUp
											className="w-3 h-3"
											style={{ color: "var(--status-up)" }}
										/>
									) : (
										<TrendingDown
											className="w-3 h-3"
											style={{ color: "var(--status-down)" }}
										/>
									)}
								</div>
							</div>
							<Sparkline data={m.sparkline} color={m.color} />
							<p
								className="text-[10px] mt-0.5"
								style={{ color: "var(--text-faint)" }}
							>
								{m.sub}
							</p>
						</Card>
					</motion.div>
				))}

				{/* ── Platform health bar (full width) ──────────────── */}
				<motion.div
					className="col-span-12"
					initial={{ opacity: 0, y: 8 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.3, delay: 0.35 }}
				>
					<Card
						className="px-5 py-3"
						style={{
							background: "var(--surface-card)",
							border: "1px solid var(--border-default)",
						}}
					>
						<div className="flex items-center gap-4">
							<TrendingUp
								className="w-3.5 h-3.5 shrink-0"
								style={{ color: "var(--color-teal)" }}
							/>
							<div className="flex-1">
								<div className="flex justify-between mb-1.5">
									<span
										className="text-[11px] font-medium"
										style={{ color: "var(--text-muted)" }}
									>
										Platform Sağlığı
									</span>
									<span
										className="text-[11px] font-bold tabular-nums font-mono"
										style={{ color: healthColor }}
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
										style={{ background: healthColor }}
										initial={{ width: 0 }}
										animate={{ width: `${healthPercent}%` }}
										transition={{ duration: 0.9, delay: 0.4 }}
									/>
								</div>
							</div>
							<div className="hidden sm:flex items-center gap-4 shrink-0">
								{[
									{
										label: "Aktif",
										val: onlineServices,
										color: "var(--status-up)",
									},
									{
										label: "Bozuk",
										val: degradedServices,
										color: "var(--status-warn)",
									},
									{
										label: "Offline",
										val: offlineServices,
										color: "var(--status-down)",
									},
								].map((seg) => (
									<div key={seg.label} className="flex items-center gap-1.5">
										<span
											className="w-2 h-2 rounded-full"
											style={{ background: seg.color }}
										/>
										<span
											className="text-xs font-mono tabular-nums font-semibold"
											style={{ color: "var(--text-secondary)" }}
										>
											{seg.val}
										</span>
										<span
											className="text-[10px]"
											style={{ color: "var(--text-faint)" }}
										>
											{seg.label}
										</span>
									</div>
								))}
							</div>
						</div>
					</Card>
				</motion.div>

				{/* ── Services list (7-col) ─────────────────────────── */}
				<motion.div
					className="col-span-12 lg:col-span-7"
					initial={{ opacity: 0, y: 12 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.35, delay: 0.4 }}
				>
					<Card
						className="p-4"
						style={{
							background: "var(--surface-card)",
							border: "1px solid var(--border-default)",
						}}
					>
						{/* Panel header */}
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
										? "Dikkat Gereken Servisler"
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
								className="flex items-center gap-1 text-xs hover:opacity-70 transition-opacity"
								style={{ color: "var(--text-faint)" }}
							>
								Tümünü gör <ArrowRight className="w-3 h-3" />
							</Link>
						</div>

						{/* List */}
						<div className="space-y-1">
							<AnimatePresence>
								{displayServices.map((service, idx) => {
									const sc = statusColors(service.status);
									const uptime = bulkUptime?.[service.id];
									return (
										<motion.div
											key={service.id}
											initial={{ opacity: 0, x: -8 }}
											animate={{ opacity: 1, x: 0 }}
											transition={{ duration: 0.18, delay: idx * 0.03 }}
										>
											<Link
												to={`/app/services/${service.id}`}
												className="flex items-center gap-3 px-3 py-2.5 rounded-lg group transition-opacity hover:opacity-90"
												style={{ background: "var(--surface-sunken)" }}
											>
												{/* Status dot */}
												<span
													className="w-2 h-2 rounded-full shrink-0"
													style={{ background: sc.dot }}
												/>

												{/* Name */}
												<span
													className="flex-1 text-sm font-medium truncate"
													style={{ color: "var(--text-secondary)" }}
												>
													{service.name}
												</span>

												{/* Host */}
												<span
													className="text-[11px] font-mono hidden sm:block shrink-0"
													style={{ color: "var(--text-faint)" }}
												>
													{service.host}:{service.port}
												</span>

												{/* Uptime bar */}
												{uptime != null && (
													<div className="hidden lg:flex items-center gap-1.5 shrink-0 w-24">
														<div
															className="flex-1 h-1 rounded-full overflow-hidden"
															style={{ background: "var(--border-subtle)" }}
														>
															<div
																className="h-full rounded-full transition-all"
																style={{
																	width: `${uptime}%`,
																	background:
																		uptime >= 99
																			? "var(--status-up)"
																			: uptime >= 95
																				? "var(--status-warn)"
																				: "var(--status-down)",
																}}
															/>
														</div>
														<span
															className="text-[10px] font-mono tabular-nums w-9 text-right"
															style={{
																color:
																	uptime >= 99
																		? "var(--status-up-text)"
																		: uptime >= 95
																			? "var(--status-warn-text)"
																			: "var(--status-down-text)",
															}}
														>
															{uptime.toFixed(1)}%
														</span>
													</div>
												)}

												{/* Status badge */}
												<Badge
													className="text-[10px] px-1.5 shrink-0 border-0"
													style={{ background: sc.bg, color: sc.text }}
												>
													{statusLabel(service.status)}
												</Badge>
											</Link>
										</motion.div>
									);
								})}
							</AnimatePresence>
							{criticalServices.length === 0 && services.length > 8 && (
								<Link
									to="/app/services"
									className="flex items-center justify-center gap-1 py-2 text-xs hover:opacity-70"
									style={{ color: "var(--text-faint)" }}
								>
									+{services.length - 8} servis daha{" "}
									<ArrowRight className="w-3 h-3" />
								</Link>
							)}
						</div>
					</Card>
				</motion.div>

				{/* ── Alerts panel (5-col) ──────────────────────────── */}
				<motion.div
					className="col-span-12 lg:col-span-5"
					initial={{ opacity: 0, y: 12 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.35, delay: 0.45 }}
				>
					<Card
						className="p-4"
						style={{
							background: "var(--surface-card)",
							border: "1px solid var(--border-default)",
						}}
					>
						{/* Panel header */}
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
									Aktif Uyarılar
								</span>
								{recentAlerts.length > 0 && (
									<div className="flex items-center gap-1">
										{critAlerts > 0 && (
											<span
												className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
												style={{
													background: "var(--status-down-subtle)",
													color: "var(--status-down-text)",
													border: "1px solid var(--status-down-border)",
												}}
											>
												{critAlerts} kritik
											</span>
										)}
										{warnAlerts > 0 && (
											<span
												className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
												style={{
													background: "var(--status-warn-subtle)",
													color: "var(--status-warn-text)",
													border: "1px solid var(--status-warn-border)",
												}}
											>
												{warnAlerts} uyarı
											</span>
										)}
									</div>
								)}
							</div>
							<Link
								to="/app/alerts"
								className="flex items-center gap-1 text-xs hover:opacity-70 transition-opacity"
								style={{ color: "var(--text-faint)" }}
							>
								Tümü <ArrowRight className="w-3 h-3" />
							</Link>
						</div>

						{/* Alert list */}
						{recentAlerts.length === 0 ? (
							<div className="flex flex-col items-center justify-center gap-2 py-8">
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
								<p className="text-xs" style={{ color: "var(--text-faint)" }}>
									Tüm sistemler normal çalışıyor
								</p>
							</div>
						) : (
							<div className="space-y-1.5">
								{recentAlerts.map((alert) => {
									const sv = severityColors(alert.severity);
									const svcName =
										services.find((s) => s.id === alert.service_id)?.name ??
										"Bilinmeyen";
									return (
										<div
											key={alert.id}
											className="flex items-start gap-3 px-3 py-2.5 rounded-lg"
											style={{
												background: "var(--surface-sunken)",
												borderLeft: `3px solid ${sv.dot}`,
											}}
										>
											{/* Severity dot */}
											<span
												className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
												style={{ background: sv.dot }}
											/>

											<div className="flex-1 min-w-0">
												<div className="flex items-center gap-1.5 mb-0.5">
													<p
														className="text-xs font-semibold truncate"
														style={{ color: "var(--text-secondary)" }}
													>
														{svcName}
													</p>
													<span
														className="text-[10px] font-bold px-1 py-0.5 rounded shrink-0"
														style={{
															background: sv.bg,
															color: sv.text,
															border: `1px solid ${sv.border}`,
														}}
													>
														{sv.label}
													</span>
												</div>
												<p
													className="text-[11px] truncate"
													style={{ color: "var(--text-faint)" }}
												>
													{alert.message ?? alert.type}
												</p>
											</div>

											{/* Time */}
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
									);
								})}
							</div>
						)}

						{/* Quick nav footer */}
						<div
							className="flex gap-2 mt-3 pt-3"
							style={{ borderTop: "1px solid var(--border-subtle)" }}
						>
							<button
								type="button"
								onClick={() => navigate("/app/ai-insights")}
								className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all hover:opacity-80"
								style={{
									background: "var(--color-lavender-subtle)",
									color: "var(--color-lavender)",
									border: "1px solid var(--color-lavender-border)",
								}}
							>
								<Bot className="w-3.5 h-3.5" />
								AI Analiz
							</button>
							<button
								type="button"
								onClick={() => navigate("/app/service-map")}
								className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all hover:opacity-80"
								style={{
									background: "var(--color-teal-subtle)",
									color: "var(--color-teal)",
									border: "1px solid var(--color-teal-border)",
								}}
							>
								<GitFork className="w-3.5 h-3.5" />
								Servis Haritası
							</button>
						</div>
					</Card>
				</motion.div>
			</div>
		</div>
	);
}

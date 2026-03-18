import { useQuery } from "@tanstack/react-query";
import {
	Activity,
	AlertCircle,
	AlertTriangle,
	ArrowRight,
	BellRing,
	Brain,
	CheckCircle2,
	Clock,
	Cloud,
	Eye,
	Heart,
	Lightbulb,
	Plus,
	Server,
	Settings,
	Shield,
	Sparkles,
	Target,
	XCircle,
	Zap,
} from "lucide-react";
import { motion, useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { metricsApi } from "@/api/metrics";
import { AddServiceDialog } from "@/components/AddServiceDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useServices } from "@/hooks/useServices";

const navCards = [
	{
		to: "/services",
		label: "Servisler",
		description: "Tüm mikroservisleri izle ve yönet",
		icon: Server,
		colorVar: "var(--color-teal)",
		borderVar: "var(--color-teal-border)",
		pulse: false,
	},
	{
		to: "/alerts",
		label: "Uyarılar",
		description: "Gerçek zamanlı olay bildirimleri",
		icon: AlertCircle,
		colorVar: "var(--color-pink)",
		borderVar: "var(--color-pink-border)",
		pulse: true,
	},
	{
		to: "/ai-insights",
		label: "AI Analiz",
		description: "Yapay zeka destekli anomali tespiti ve öneriler",
		icon: Sparkles,
		colorVar: "var(--color-lavender)",
		borderVar: "var(--color-lavender-border)",
		pulse: false,
	},
	{
		to: "/settings",
		label: "Ayarlar",
		description: "Platform yapılandırması ve tercihler",
		icon: Settings,
		colorVar: "var(--color-blue)",
		borderVar: "var(--color-blue-border)",
		pulse: false,
	},
	{
		to: "/kubernetes",
		label: "Kubernetes",
		description: "Cluster yönetimi, pod izleme ve auto-scaling",
		icon: Cloud,
		colorVar: "var(--status-up)",
		borderVar: "var(--status-up-border)",
		pulse: false,
	},
];

function AnimatedCounter({
	value,
	duration = 800,
}: {
	value: number;
	duration?: number;
}) {
	const [display, setDisplay] = useState(0);
	const ref = useRef<HTMLSpanElement>(null);
	const inView = useInView(ref, { once: true });

	useEffect(() => {
		if (!inView) return;
		let start = 0;
		const steps = 20;
		const inc = value / steps;
		const timer = setInterval(() => {
			start += inc;
			if (start >= value) {
				setDisplay(value);
				clearInterval(timer);
			} else setDisplay(Math.floor(start));
		}, duration / steps);
		return () => clearInterval(timer);
	}, [value, duration, inView]);

	return <span ref={ref}>{display}</span>;
}

function _UptimeRing({
	percent,
	size = 56,
}: {
	percent: number;
	size?: number;
}) {
	const r = (size - 8) / 2;
	const circ = 2 * Math.PI * r;
	const offset = circ - (percent / 100) * circ;
	const color =
		percent >= 95
			? "var(--status-up)"
			: percent >= 80
				? "var(--status-warn)"
				: "var(--status-down)";
	return (
		<svg width={size} height={size} className="-rotate-90" aria-hidden="true">
			<circle
				cx={size / 2}
				cy={size / 2}
				r={r}
				fill="none"
				stroke="var(--border-track)"
				strokeWidth={4}
			/>
			<circle
				cx={size / 2}
				cy={size / 2}
				r={r}
				fill="none"
				stroke={color}
				strokeWidth={4}
				strokeDasharray={circ}
				strokeDashoffset={offset}
				strokeLinecap="round"
				style={{ transition: "stroke-dashoffset 1s ease" }}
			/>
		</svg>
	);
}

export function DashboardPage() {
	const { services, isLoading } = useServices();
	const navigate = useNavigate();

	const { data: activeAlerts } = useQuery({
		queryKey: ["activeAlerts"],
		queryFn: () => metricsApi.getActiveAlerts(),
		refetchInterval: 30_000,
		staleTime: 15_000,
	});

	const firstServiceId = services[0]?.id ?? "";
	const { data: insightsData } = useQuery({
		queryKey: ["dashInsights", firstServiceId],
		queryFn: () => metricsApi.getInsights(firstServiceId, 1),
		enabled: !!firstServiceId,
		staleTime: 60_000,
	});

	const recentAlerts = (activeAlerts ?? []).slice(0, 5);
	const recentInsights = (insightsData?.insights ?? []).slice(0, 3);

	const totalServices = services.length;
	const activeServices = services.filter((s) => s.status === "up").length;
	const degradedServices = services.filter(
		(s) => s.status === "degraded",
	).length;
	const offlineServices = services.filter(
		(s) => s.status === "down" || s.status === "unknown",
	).length;
	const healthPercent =
		totalServices > 0 ? Math.round((activeServices / totalServices) * 100) : 0;

	const stats = [
		{
			label: "Toplam",
			value: totalServices,
			icon: Server,
			iconVar: "var(--color-teal)",
			bgVar: "var(--color-teal-subtle)",
			borderVar: "var(--color-teal-border)",
			barVar: "var(--color-teal)",
			bar: totalServices > 0 ? 100 : 0,
		},
		{
			label: "Çevrimiçi",
			value: activeServices,
			icon: CheckCircle2,
			iconVar: "var(--status-up)",
			bgVar: "var(--status-up-subtle)",
			borderVar: "var(--status-up-border)",
			barVar: "var(--status-up)",
			bar: totalServices > 0 ? (activeServices / totalServices) * 100 : 0,
		},
		{
			label: "Bozuk",
			value: degradedServices,
			icon: AlertTriangle,
			iconVar: "var(--status-warn)",
			bgVar: "var(--status-warn-subtle)",
			borderVar: "var(--status-warn-border)",
			barVar: "var(--status-warn)",
			bar: totalServices > 0 ? (degradedServices / totalServices) * 100 : 0,
		},
		{
			label: "Çevrimdışı",
			value: offlineServices,
			icon: XCircle,
			iconVar: "var(--status-down)",
			bgVar: "var(--status-down-subtle)",
			borderVar: "var(--status-down-border)",
			barVar: "var(--status-down)",
			bar: totalServices > 0 ? (offlineServices / totalServices) * 100 : 0,
		},
	];

	return (
		<div className="space-y-8">
			{/* Hero Section */}
			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.6 }}
				className="flex flex-col sm:flex-row items-center justify-between gap-6 py-2"
			>
				<div>
					<div className="relative inline-block">
						<h1
							className="text-4xl sm:text-5xl font-bold bg-clip-text text-transparent mb-1"
							style={{ backgroundImage: "var(--gradient-heading)" }}
						>
							Kontrol Merkezi
						</h1>
						<div
							className="absolute -left-6 top-1/2 -translate-y-1/2 opacity-40 animate-twinkle"
							style={{ color: "var(--color-teal)" }}
						>
							✦
						</div>
					</div>
					<p
						className="text-xs tracking-wider flex items-center gap-2"
						style={{ color: "var(--text-muted)" }}
					>
						<span
							className="w-1.5 h-1.5 rounded-full animate-pulse inline-block"
							style={{ backgroundColor: "var(--status-up)" }}
						/>
						{activeServices === totalServices && totalServices > 0
							? "Tüm Sistemler Aktif"
							: `${activeServices}/${totalServices} Servis Çevrimiçi`}
					</p>
				</div>
			</motion.div>

			{/* Onboarding — sadece hiç servis yokken göster */}
			{!isLoading && services.length === 0 && (
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.6, delay: 0.15 }}
				>
					<Card
						className="rounded p-8 text-center relative overflow-hidden"
						style={{
							background: "var(--surface-card)",
							border: "2px solid var(--border-default)",
							boxShadow: "var(--card-shadow)",
						}}
					>
						<div
							className="absolute inset-x-0 top-0 h-1"
							style={{ background: "var(--gradient-btn-primary)" }}
						/>
						<div
							className="w-16 h-16 rounded flex items-center justify-center mx-auto mb-4"
							style={{
								background: "var(--gradient-logo)",
								border: "2px solid var(--border-default)",
								boxShadow: "var(--btn-shadow)",
							}}
						>
							<span className="text-2xl text-white">✦</span>
						</div>
						<h2
							className="text-lg font-bold mb-2"
							style={{ color: "var(--text-secondary)" }}
						>
							NanoNet'e Hoş Geldiniz!
						</h2>
						<p
							className="text-sm mb-6 max-w-md mx-auto"
							style={{ color: "var(--text-muted)" }}
						>
							Mikroservislerinizi izlemeye başlamak için 3 basit adım:
						</p>

						<div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
							{[
								{
									step: "1",
									title: "Servis Ekle",
									desc: "İzlemek istediğiniz servisi kaydedin",
									icon: Plus,
									colorVar: "var(--color-teal)",
								},
								{
									step: "2",
									title: "Agent Kur",
									desc: "Hedef sunucuya NanoNet Agent'ı kurun",
									icon: Zap,
									colorVar: "var(--color-blue)",
								},
								{
									step: "3",
									title: "İzlemeye Başla",
									desc: "Gerçek zamanlı metrikleri takip edin",
									icon: Activity,
									colorVar: "var(--color-lavender)",
								},
							].map((item) => (
								<div
									key={item.step}
									className="p-4 rounded text-left relative"
									style={{
										background: "var(--surface-sunken)",
										border: "2px solid var(--border-default)",
									}}
								>
									<div
										className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
										style={{
											background: `color-mix(in srgb, ${item.colorVar} 15%, transparent)`,
											color: item.colorVar,
										}}
									>
										{item.step}
									</div>
									<item.icon
										className="w-5 h-5 mb-2"
										style={{ color: item.colorVar }}
									/>
									<h3
										className="text-xs font-semibold mb-0.5"
										style={{ color: "var(--text-secondary)" }}
									>
										{item.title}
									</h3>
									<p
										className="text-[10px]"
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
									className="text-white rounded transition-all px-6"
									style={{
										background: "var(--gradient-btn-primary)",
										boxShadow: "var(--btn-shadow)",
									}}
								>
									<Plus className="w-4 h-4 mr-2" /> İlk Servisini Ekle
								</Button>
							}
						/>
					</Card>
				</motion.div>
			)}

			{/* Stats Row */}
			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.6, delay: 0.1 }}
				className="grid grid-cols-2 lg:grid-cols-4 gap-3"
			>
				{stats.map((stat, i) => (
					<motion.div
						key={stat.label}
						initial={{ opacity: 0, y: 16 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.4, delay: 0.1 + i * 0.07 }}
						className="group relative"
					>
						<Card
							className="p-4 rounded overflow-hidden"
							style={{
								background: "var(--surface-card)",
								border: `2px solid ${stat.borderVar}`,
								boxShadow: "var(--card-shadow)",
							}}
						>
							<div
								className="absolute inset-x-0 top-0 h-px opacity-20"
								style={{
									background: `linear-gradient(to right, transparent, ${stat.iconVar}, transparent)`,
								}}
							/>
							<div className="flex items-start justify-between mb-3">
								<div
									className="w-8 h-8 rounded flex items-center justify-center"
									style={{
										backgroundColor: stat.bgVar,
										border: `1.5px solid ${stat.borderVar}`,
									}}
								>
									<stat.icon
										className="w-4 h-4"
										style={{ color: stat.iconVar }}
									/>
								</div>
								<span
									className="text-2xl font-bold tabular-nums"
									style={{ color: stat.iconVar }}
								>
									<AnimatedCounter value={stat.value} />
								</span>
							</div>
							<p
								className="text-[10px] uppercase tracking-wider mb-2"
								style={{ color: "var(--text-muted)" }}
							>
								{stat.label}
							</p>
							<div
								className="h-1 rounded-full overflow-hidden"
								style={{ backgroundColor: "var(--border-track)" }}
							>
								<motion.div
									className="h-full rounded-full"
									style={{ backgroundColor: stat.barVar }}
									initial={{ width: 0 }}
									animate={{ width: `${stat.bar}%` }}
									transition={{ duration: 0.8, delay: 0.3 + i * 0.07 }}
								/>
							</div>
						</Card>
					</motion.div>
				))}
			</motion.div>

			{/* Navigation Cards Grid */}
			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.6, delay: 0.2 }}
			>
				<div className="flex items-center gap-2 mb-4">
					<div
						className="h-px flex-1"
						style={{
							background:
								"linear-gradient(to right, transparent, var(--color-teal-border), transparent)",
						}}
					/>
					<h2
						className="text-xs uppercase tracking-widest flex items-center gap-2"
						style={{ color: "var(--text-muted)" }}
					>
						<Eye className="w-3 h-3" /> Hızlı Erişim
					</h2>
					<div
						className="h-px flex-1"
						style={{
							background:
								"linear-gradient(to right, transparent, var(--color-teal-border), transparent)",
						}}
					/>
				</div>

				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					{navCards.map((card, index) => (
						<motion.div
							key={card.to}
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.4, delay: 0.3 + index * 0.08 }}
							whileHover={{ y: -2 }}
						>
							<Link to={card.to} className="block group">
								<Card
									className="relative rounded p-5 transition-all duration-200 overflow-hidden"
									style={{
										background: "var(--surface-card)",
										border: `2px solid ${card.borderVar}`,
										boxShadow: "var(--card-shadow)",
									}}
								>
									<div
										className="absolute inset-x-0 top-0 h-0.5 opacity-0 group-hover:opacity-60 transition-opacity duration-300"
										style={{
											background: `linear-gradient(to right, transparent, ${card.colorVar}, transparent)`,
										}}
									/>

									<div className="relative z-10 flex items-center gap-4">
										<div
											className="w-11 h-11 rounded flex items-center justify-center transition-all duration-200 group-hover:scale-105 shrink-0"
											style={{
												backgroundColor: `color-mix(in srgb, ${card.colorVar} 15%, transparent)`,
												border: `2px solid ${card.colorVar}`,
											}}
										>
											<card.icon
												className="w-5 h-5"
												style={{ color: card.colorVar }}
											/>
										</div>
										<div className="flex-1 min-w-0">
											<div className="flex items-center justify-between">
												<h3
													className="text-sm font-semibold transition-colors"
													style={{ color: "var(--text-secondary)" }}
												>
													{card.label}
												</h3>
												<ArrowRight
													className="w-4 h-4 group-hover:translate-x-1 transition-all shrink-0"
													style={{ color: "var(--text-faint)" }}
												/>
											</div>
											<p
												className="text-xs mt-0.5 truncate"
												style={{ color: "var(--text-muted)" }}
											>
												{card.description}
											</p>
											{card.pulse && (
												<div className="flex items-center gap-1.5 mt-1.5">
													<div
														className="w-1.5 h-1.5 rounded-full animate-pulse"
														style={{ backgroundColor: "var(--color-pink)" }}
													/>
													<span
														className="text-[10px]"
														style={{ color: "var(--status-down-text)" }}
													>
														Dikkat gerekli
													</span>
												</div>
											)}
										</div>
									</div>
								</Card>
							</Link>
						</motion.div>
					))}
				</div>
			</motion.div>

			{/* Quick Services Overview */}
			{services.length > 0 && (
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.6, delay: 0.5 }}
				>
					<div className="flex items-center justify-between mb-4">
						<h2
							className="text-xs uppercase tracking-widest flex items-center gap-2"
							style={{ color: "var(--text-muted)" }}
						>
							<Activity className="w-3 h-3" /> Son Servisler
						</h2>
						<div className="flex items-center gap-2">
							<AddServiceDialog />
							<Link
								to="/services"
								className="text-xs transition-colors flex items-center gap-1"
								style={{ color: "var(--text-muted)" }}
							>
								Tümünü Gör <ArrowRight className="w-3 h-3" />
							</Link>
						</div>
					</div>

					{isLoading ? (
						<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
							{[1, 2, 3].map((i) => (
								<Card
									key={i}
									className="p-4 rounded animate-pulse"
									style={{
										background: "var(--surface-card)",
										border: "2px solid var(--border-default)",
									}}
								>
									<div className="flex items-center gap-3 mb-3">
										<div
											className="w-9 h-9 rounded"
											style={{
												backgroundColor: "var(--color-teal-subtle)",
												border: "1.5px solid var(--color-teal-border)",
											}}
										/>
										<div className="flex-1">
											<div
												className="h-3.5 w-28 rounded mb-1.5"
												style={{ backgroundColor: "var(--color-teal-subtle)" }}
											/>
											<div
												className="h-2.5 w-20 rounded"
												style={{ backgroundColor: "var(--color-teal-subtle)" }}
											/>
										</div>
									</div>
									<div
										className="h-1.5 w-full rounded-full"
										style={{ backgroundColor: "var(--color-teal-subtle)" }}
									/>
								</Card>
							))}
						</div>
					) : (
						<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
							{services.slice(0, 6).map((service, index) => {
								const statusDotVar =
									service.status === "up"
										? "var(--status-up)"
										: service.status === "degraded"
											? "var(--status-warn)"
											: "var(--status-down)";
								const StatusIcon =
									service.status === "up"
										? CheckCircle2
										: service.status === "degraded"
											? AlertTriangle
											: XCircle;
								const cardBorderVar =
									service.status === "up"
										? "var(--color-teal-border)"
										: service.status === "degraded"
											? "var(--status-warn-border)"
											: "var(--status-down-border)";
								const iconBgVar =
									service.status === "up"
										? "var(--color-teal-subtle)"
										: service.status === "degraded"
											? "var(--status-warn-subtle)"
											: "var(--status-down-subtle)";
								const iconColorVar =
									service.status === "up"
										? "var(--color-teal)"
										: service.status === "degraded"
											? "var(--status-warn)"
											: "var(--status-down)";
								return (
									<motion.div
										key={service.id}
										initial={{ opacity: 0, y: 12 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{ duration: 0.3, delay: 0.55 + index * 0.06 }}
										whileHover={{ y: -2 }}
									>
										<Link
											to={`/services/${service.id}`}
											className="block group"
										>
											<Card
												className="relative rounded p-4 transition-all duration-200 overflow-hidden"
												style={{
													background: "var(--surface-card)",
													border: `2px solid ${cardBorderVar}`,
													boxShadow: "var(--card-shadow)",
												}}
											>
												{service.status === "up" && (
													<div
														className="absolute inset-x-0 top-0 h-px"
														style={{
															background: `linear-gradient(to right, transparent, var(--color-teal-border), transparent)`,
														}}
													/>
												)}
												<div className="flex items-center gap-3">
													<div
														className="w-9 h-9 rounded flex items-center justify-center shrink-0"
														style={{
															backgroundColor: iconBgVar,
															border: `1.5px solid ${iconColorVar}`,
														}}
													>
														<Server
															className="w-4 h-4"
															style={{ color: iconColorVar }}
														/>
													</div>
													<div className="flex-1 min-w-0">
														<div className="flex items-center gap-2">
															<div className="relative shrink-0">
																<div
																	className="w-2 h-2 rounded-full"
																	style={{ backgroundColor: statusDotVar }}
																/>
																{service.status === "up" && (
																	<div
																		className="absolute inset-0 w-2 h-2 rounded-full animate-pulse-ring"
																		style={{
																			backgroundColor: "var(--status-up)",
																		}}
																	/>
																)}
															</div>
															<h3
																className="text-xs font-(--font-mono) truncate transition-colors"
																style={{ color: "var(--text-secondary)" }}
															>
																{service.name}
															</h3>
														</div>
														<div className="flex items-center justify-between mt-1">
															<p
																className="text-[10px] font-(--font-mono)"
																style={{ color: "var(--text-faint)" }}
															>
																{service.host}:{service.port}
															</p>
															<div className="flex items-center gap-1">
																<Clock
																	className="w-2.5 h-2.5"
																	style={{ color: "var(--text-faint)" }}
																/>
																<span
																	className="text-[10px]"
																	style={{ color: "var(--text-faint)" }}
																>
																	{service.poll_interval_sec}s
																</span>
															</div>
														</div>
													</div>
													<StatusIcon
														className="w-4 h-4 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity"
														style={{ color: iconColorVar }}
													/>
												</div>
											</Card>
										</Link>
									</motion.div>
								);
							})}
						</div>
					)}
				</motion.div>
			)}

			{/* Recent Alerts + AI Insights — 2-column live feed */}
			{services.length > 0 && (
				<motion.div
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.6, delay: 0.65 }}
					className="grid grid-cols-1 lg:grid-cols-2 gap-4"
				>
					{/* Son Alertler */}
					<Card
						className="rounded p-4"
						style={{
							background: "var(--surface-card)",
							border: "2px solid var(--border-default)",
							boxShadow: "var(--card-shadow)",
						}}
					>
						<div className="flex items-center justify-between mb-3">
							<div className="flex items-center gap-2">
								<BellRing
									className="w-3.5 h-3.5"
									style={{ color: "var(--color-pink)" }}
								/>
								<h3
									className="text-xs font-semibold uppercase tracking-wider"
									style={{ color: "var(--text-muted)" }}
								>
									Son Alertler
								</h3>
								{recentAlerts.length > 0 && (
									<span
										className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
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
								to="/alerts"
								className="text-[10px] flex items-center gap-1 transition-colors"
								style={{ color: "var(--text-faint)" }}
							>
								Tümü <ArrowRight className="w-3 h-3" />
							</Link>
						</div>

						{recentAlerts.length === 0 ? (
							<div className="py-8 text-center">
								<CheckCircle2
									className="w-8 h-8 mx-auto mb-2 opacity-20"
									style={{ color: "var(--status-up)" }}
								/>
								<p className="text-xs" style={{ color: "var(--text-muted)" }}>
									Aktif alert yok
								</p>
							</div>
						) : (
							<div className="space-y-2">
								{recentAlerts.map((alert) => {
									const sevColor =
										alert.severity === "crit"
											? "var(--status-down-text)"
											: alert.severity === "warn"
												? "var(--status-warn-text)"
												: "var(--color-blue)";
									const sevBg =
										alert.severity === "crit"
											? "var(--status-down-subtle)"
											: alert.severity === "warn"
												? "var(--status-warn-subtle)"
												: "var(--color-blue-subtle)";
									const sevBorder =
										alert.severity === "crit"
											? "var(--status-down-border)"
											: alert.severity === "warn"
												? "var(--status-warn-border)"
												: "var(--color-blue-border)";
									return (
										<div
											key={alert.id}
											className="flex items-start gap-2.5 p-2.5 rounded"
											style={{
												background: "var(--surface-sunken)",
												border: "1.5px solid var(--border-default)",
											}}
										>
											<AlertCircle
												className="w-3.5 h-3.5 mt-0.5 shrink-0"
												style={{ color: sevColor }}
											/>
											<div className="min-w-0 flex-1">
												<p
													className="text-xs truncate"
													style={{ color: "var(--text-secondary)" }}
												>
													{alert.message}
												</p>
												<div className="flex items-center gap-2 mt-1">
													<Badge
														className="text-[8px] px-1.5 py-0 rounded border"
														style={{
															background: sevBg,
															color: sevColor,
															borderColor: sevBorder,
														}}
													>
														{(alert.severity || "").toUpperCase()}
													</Badge>
													<span
														className="text-[10px]"
														style={{ color: "var(--text-faint)" }}
													>
														<Clock className="w-2.5 h-2.5 inline mr-0.5" />
														{new Date(alert.triggered_at).toLocaleTimeString(
															"tr-TR",
															{ hour: "2-digit", minute: "2-digit" },
														)}
													</span>
												</div>
											</div>
										</div>
									);
								})}
							</div>
						)}
					</Card>

					{/* Son AI Insights */}
					<Card
						className="rounded p-4"
						style={{
							background: "var(--surface-card)",
							border: "2px solid var(--color-lavender-border)",
							boxShadow: "var(--card-shadow)",
						}}
					>
						<div className="flex items-center justify-between mb-3">
							<div className="flex items-center gap-2">
								<Brain
									className="w-3.5 h-3.5"
									style={{ color: "var(--color-lavender)" }}
								/>
								<h3
									className="text-xs font-semibold uppercase tracking-wider"
									style={{ color: "var(--text-muted)" }}
								>
									AI Insights
								</h3>
							</div>
							<Link
								to="/ai-insights"
								className="text-[10px] flex items-center gap-1 transition-colors"
								style={{ color: "var(--text-faint)" }}
							>
								Tümü <ArrowRight className="w-3 h-3" />
							</Link>
						</div>

						{recentInsights.length === 0 ? (
							<div className="py-8 text-center">
								<Sparkles
									className="w-8 h-8 mx-auto mb-2 opacity-20"
									style={{ color: "var(--color-lavender)" }}
								/>
								<p className="text-xs" style={{ color: "var(--text-muted)" }}>
									Henüz AI analizi yok
								</p>
								<Button
									size="sm"
									onClick={() => navigate("/ai-insights")}
									className="mt-3 rounded text-xs h-7 text-white"
									style={{
										background: "var(--gradient-btn-primary)",
										boxShadow: "var(--btn-shadow)",
									}}
								>
									<Zap className="w-3 h-3 mr-1" /> Analiz Başlat
								</Button>
							</div>
						) : (
							<div className="space-y-2">
								{recentInsights.map((insight) => {
									const topPriority =
										insight.recommendations?.[0]?.priority ?? "low";
									const priColor =
										topPriority === "high"
											? "var(--status-down-text)"
											: topPriority === "medium"
												? "var(--status-warn-text)"
												: "var(--color-teal)";
									const priBg =
										topPriority === "high"
											? "var(--status-down-subtle)"
											: topPriority === "medium"
												? "var(--status-warn-subtle)"
												: "var(--color-teal-subtle)";
									const priBorder =
										topPriority === "high"
											? "var(--status-down-border)"
											: topPriority === "medium"
												? "var(--status-warn-border)"
												: "var(--color-teal-border)";
									return (
										<div
											key={insight.id}
											className="flex items-start gap-2.5 p-2.5 rounded"
											style={{
												background: "var(--surface-sunken)",
												border: "1.5px solid var(--color-lavender-border)",
											}}
										>
											<Lightbulb
												className="w-3.5 h-3.5 mt-0.5 shrink-0"
												style={{ color: "var(--color-lavender)" }}
											/>
											<div className="min-w-0 flex-1">
												<p
													className="text-xs line-clamp-2 leading-relaxed"
													style={{ color: "var(--text-secondary)" }}
												>
													{insight.summary}
												</p>
												<div className="flex items-center gap-2 mt-1">
													{insight.recommendations &&
														insight.recommendations.length > 0 && (
															<Badge
																className="text-[8px] px-1.5 py-0 rounded border"
																style={{
																	background: priBg,
																	color: priColor,
																	borderColor: priBorder,
																}}
															>
																<Target className="w-2 h-2 inline mr-0.5" />
																{insight.recommendations.length} öneri
															</Badge>
														)}
													<span
														className="text-[10px]"
														style={{ color: "var(--text-faint)" }}
													>
														<Clock className="w-2.5 h-2.5 inline mr-0.5" />
														{new Date(insight.created_at).toLocaleDateString(
															"tr-TR",
														)}
													</span>
												</div>
											</div>
										</div>
									);
								})}
							</div>
						)}
					</Card>
				</motion.div>
			)}

			{/* Footer */}
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ duration: 0.6, delay: 0.9 }}
				className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 py-3 text-[10px]"
				style={{ color: "var(--text-faint)" }}
			>
				<span className="flex items-center gap-1.5">
					<Shield className="w-3 h-3" style={{ color: "var(--status-up)" }} />
					{totalServices > 0
						? `%${healthPercent} çalışma süresi`
						: "İzlenen servis yok"}
				</span>
				<span style={{ color: "var(--color-lavender)" }}>·</span>
				<span className="flex items-center gap-1.5">
					<Zap className="w-3 h-3" style={{ color: "var(--color-blue)" }} />
					{totalServices} kayıtlı
				</span>
				<span
					className="hidden sm:inline"
					style={{ color: "var(--color-lavender)" }}
				>
					·
				</span>
				<span className="hidden sm:flex items-center gap-1.5">
					<Heart className="w-3 h-3" style={{ color: "var(--color-pink)" }} />
					NanoNet v2.0
				</span>
			</motion.div>
		</div>
	);
}

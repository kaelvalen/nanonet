import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Activity,
	AlertTriangle,
	Brain,
	Clock,
	RefreshCw,
	Server,
	Sparkles,
	TrendingUp,
	X,
	Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import { type AnalysisResult, metricsApi } from "@/api/metrics";
import type { Service } from "@/types/service";
import { STATUS_COLOR, STATUS_LABEL } from "./constants";
import { StatusIcon } from "./StatusIcon";

interface RightPanelProps {
	service: Service;
	onClose: () => void;
}

export function RightPanel({ service, onClose }: RightPanelProps) {
	const color = STATUS_COLOR[service.status] ?? STATUS_COLOR.unknown;
	const queryClient = useQueryClient();
	const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
		null,
	);

	const { data: alerts = [] } = useQuery({
		queryKey: ["mapAlerts", service.id],
		queryFn: () => metricsApi.getAlerts(service.id, false),
		staleTime: 30_000,
	});

	const { data: metricsRaw = [] } = useQuery({
		queryKey: ["mapMetrics", service.id],
		queryFn: () => metricsApi.getHistory(service.id, "1h", 5),
		staleTime: 20_000,
		refetchInterval: 30_000,
	});

	const latestMetric = metricsRaw[metricsRaw.length - 1];

	const analyzeMutation = useMutation({
		mutationFn: () => metricsApi.analyze(service.id, 30, false),
		onSuccess: (result: AnalysisResult) => {
			setAnalysisResult(result);
			queryClient.invalidateQueries({ queryKey: ["insights"] });
			toast.success("AI analizi tamamlandı");
		},
		onError: () => toast.error("AI analizi şu anda kullanılamıyor"),
	});

	const metricItems = [
		{
			label: "CPU",
			value:
				latestMetric?.cpu_percent != null
					? `${latestMetric.cpu_percent.toFixed(1)}%`
					: "—",
			icon: Zap,
		},
		{
			label: "Bellek",
			value:
				latestMetric?.memory_used_mb != null
					? `${latestMetric.memory_used_mb.toFixed(0)} MB`
					: "—",
			icon: Server,
		},
		{
			label: "Gecikme",
			value:
				latestMetric?.latency_ms != null
					? `${latestMetric.latency_ms.toFixed(0)} ms`
					: "—",
			icon: Clock,
		},
		{
			label: "Hata Oranı",
			value:
				latestMetric?.error_rate != null
					? `${(latestMetric.error_rate * 100).toFixed(1)}%`
					: "—",
			icon: AlertTriangle,
		},
	];

	return (
		<motion.div
			initial={{ x: 340, opacity: 0 }}
			animate={{ x: 0, opacity: 1 }}
			exit={{ x: 340, opacity: 0 }}
			transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
			className="flex flex-col h-full overflow-y-auto"
			style={{
				width: 340,
				minWidth: 340,
				background: "var(--surface-card)",
				borderLeft: "1px solid var(--border-subtle)",
			}}
		>
			<div
				className="flex items-center gap-3 px-5 py-4 shrink-0 sticky top-0 z-10"
				style={{
					borderBottom: "1px solid var(--border-subtle)",
					background:
						"color-mix(in srgb, var(--surface-card) 92%, transparent)",
					backdropFilter: "blur(8px)",
				}}
			>
				<span
					className="relative flex items-center justify-center w-5 h-5 shrink-0"
					aria-hidden
				>
					{service.status === "up" && (
						<span
							className="absolute inset-0 rounded-full"
							style={{
								background: color,
								opacity: 0.22,
								animation: "nn-orb-breathe 2.4s ease-in-out infinite",
							}}
						/>
					)}
					<span
						className="relative w-2.5 h-2.5 rounded-full"
						style={{
							background: color,
							boxShadow: `0 0 0 2px color-mix(in srgb, ${color} 22%, transparent)`,
						}}
					/>
				</span>
				<div className="flex-1 min-w-0">
					<p
						className="text-[14px] font-semibold tracking-tight truncate leading-none"
						style={{ color: "var(--text-primary)" }}
					>
						{service.name}
					</p>
					<p
						className="text-[11px] truncate mt-1 font-mono"
						style={{ color: "var(--text-faint)" }}
					>
						{service.host}:{service.port}
					</p>
				</div>
				<button
					type="button"
					onClick={onClose}
					className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors hover:bg-[var(--surface-sunken)]"
					style={{ color: "var(--text-muted)" }}
					aria-label="Kapat"
				>
					<X className="w-4 h-4" />
				</button>
			</div>

			<div className="p-5 space-y-5">
				<div
					className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl"
					style={{
						background: `color-mix(in srgb, ${color} 8%, transparent)`,
						border: `1px solid color-mix(in srgb, ${color} 22%, transparent)`,
					}}
				>
					<div className="flex items-center gap-2 min-w-0">
						<StatusIcon status={service.status} />
						<span
							className="text-[13px] font-semibold tracking-tight"
							style={{ color }}
						>
							{STATUS_LABEL[service.status] ?? service.status}
						</span>
					</div>
					<span
						className="text-[11px] font-medium tabular-nums shrink-0"
						style={{ color: "var(--text-muted)" }}
					>
						{service.poll_interval_sec}s döngü
					</span>
				</div>

				{latestMetric && (
					<div>
						<div className="flex items-center gap-2 mb-2.5">
							<Activity
								className="w-3.5 h-3.5"
								style={{ color: "var(--text-muted)" }}
							/>
							<h3
								className="text-[13px] font-semibold tracking-tight"
								style={{ color: "var(--text-primary)" }}
							>
								Anlık metrikler
							</h3>
						</div>
						<div className="grid grid-cols-2 gap-2.5">
							{metricItems.map(({ label, value, icon: Icon }) => (
								<div
									key={label}
									className="p-3 rounded-xl"
									style={{
										background: "var(--surface-sunken)",
										border: "1px solid var(--border-subtle)",
									}}
								>
									<div className="flex items-center gap-1.5 mb-1.5">
										<Icon
											className="w-3 h-3"
											style={{ color: "var(--text-faint)" }}
										/>
										<p
											className="text-[11px] font-medium"
											style={{ color: "var(--text-muted)" }}
										>
											{label}
										</p>
									</div>
									<p
										className="text-[16px] font-semibold tabular-nums tracking-tight leading-none"
										style={{ color: "var(--text-primary)" }}
									>
										{value}
									</p>
								</div>
							))}
						</div>
					</div>
				)}

				{alerts.length > 0 && (
					<div>
						<div className="flex items-center gap-2 mb-2.5">
							<AlertTriangle
								className="w-3.5 h-3.5"
								style={{ color: "var(--status-down)" }}
							/>
							<h3
								className="text-[13px] font-semibold tracking-tight"
								style={{ color: "var(--text-primary)" }}
							>
								Aktif uyarılar
							</h3>
							<span
								className="text-[11px] font-medium px-1.5 py-0.5 rounded-full"
								style={{
									color: "var(--status-down-text)",
									background: "var(--status-down-subtle)",
								}}
							>
								{alerts.length}
							</span>
						</div>
						<div className="space-y-2">
							{alerts.slice(0, 4).map((alert) => {
								const tone =
									alert.severity === "crit"
										? "var(--status-down)"
										: alert.severity === "warn"
											? "var(--status-warn)"
											: "var(--color-blue)";
								return (
									<div
										key={alert.id}
										className="px-3 py-2.5 rounded-xl flex items-start gap-2.5"
										style={{
											background: "var(--surface-sunken)",
											border: "1px solid var(--border-subtle)",
										}}
									>
										<span
											className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5"
											style={{ background: tone }}
										/>
										<p
											className="text-[12px] font-medium leading-relaxed line-clamp-2 flex-1"
											style={{ color: "var(--text-secondary)" }}
										>
											{alert.message}
										</p>
									</div>
								);
							})}
						</div>
					</div>
				)}

				<div
					className="p-4 rounded-xl"
					style={{
						background:
							"color-mix(in srgb, var(--color-lavender) 8%, transparent)",
						border:
							"1px solid color-mix(in srgb, var(--color-lavender) 22%, transparent)",
					}}
				>
					<div className="flex items-center gap-2 mb-3">
						<Brain
							className="w-4 h-4"
							style={{ color: "var(--color-lavender)" }}
						/>
						<h3
							className="text-[13px] font-semibold tracking-tight"
							style={{ color: "var(--text-primary)" }}
						>
							AI analizi
						</h3>
					</div>
					<button
						type="button"
						onClick={() => analyzeMutation.mutate()}
						disabled={analyzeMutation.isPending}
						className="w-full flex items-center justify-center gap-2 h-9 rounded-full text-[12px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
						style={{
							background: "var(--gradient-btn-primary)",
							boxShadow: "var(--btn-shadow)",
						}}
					>
						{analyzeMutation.isPending ? (
							<>
								<RefreshCw className="w-3.5 h-3.5 animate-spin" />
								Analiz ediliyor…
							</>
						) : (
							<>
								<Sparkles className="w-3.5 h-3.5" />
								Bu servisi analiz et
							</>
						)}
					</button>

					<AnimatePresence>
						{analysisResult && (
							<motion.div
								initial={{ height: 0, opacity: 0 }}
								animate={{ height: "auto", opacity: 1 }}
								exit={{ height: 0, opacity: 0 }}
								transition={{ duration: 0.22 }}
								className="mt-4 space-y-3 overflow-hidden"
							>
								<div
									className="pt-3"
									style={{
										borderTop:
											"1px solid color-mix(in srgb, var(--color-lavender) 22%, transparent)",
									}}
								>
									<p
										className="text-[11px] font-medium mb-1.5"
										style={{ color: "var(--color-lavender)" }}
									>
										Özet
									</p>
									<p
										className="text-[12px] leading-relaxed"
										style={{ color: "var(--text-secondary)" }}
									>
										{analysisResult.summary}
									</p>
								</div>
								{analysisResult.recommendations?.slice(0, 3).map((rec) => (
									<div key={rec.action} className="flex items-start gap-2">
										<TrendingUp
											className="w-3.5 h-3.5 mt-0.5 shrink-0"
											style={{ color: "var(--color-lavender)" }}
										/>
										<p
											className="text-[12px] leading-relaxed"
											style={{ color: "var(--text-secondary)" }}
										>
											{rec.action}
										</p>
									</div>
								))}
							</motion.div>
						)}
					</AnimatePresence>
				</div>
			</div>
		</motion.div>
	);
}

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
import {
	STATUS_BG,
	STATUS_BORDER,
	STATUS_COLOR,
	STATUS_LABEL,
} from "./constants";
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
			initial={{ x: 320, opacity: 0 }}
			animate={{ x: 0, opacity: 1 }}
			exit={{ x: 320, opacity: 0 }}
			transition={{ duration: 0.22, ease: "easeOut" }}
			className="flex flex-col h-full overflow-y-auto"
			style={{
				width: 300,
				minWidth: 300,
				background: "var(--surface-card)",
				borderLeft: "1px solid var(--border-default)",
			}}
		>
			{/* Header */}
			<div
				className="flex items-center gap-2 px-4 py-3 shrink-0"
				style={{ borderBottom: "1px solid var(--border-default)" }}
			>
				<div
					className="w-7 h-7 rounded flex items-center justify-center shrink-0"
					style={{
						background: STATUS_BG[service.status],
						border: `1px solid ${STATUS_BORDER[service.status]}`,
					}}
				>
					<Server className="w-3.5 h-3.5" style={{ color }} />
				</div>
				<div className="flex-1 min-w-0">
					<p
						className="text-xs font-semibold truncate"
						style={{ color: "var(--text-secondary)" }}
					>
						{service.name}
					</p>
					<p
						className="text-[10px] truncate"
						style={{
							color: "var(--text-faint)",
							fontFamily: "var(--font-mono)",
						}}
					>
						{service.host}:{service.port}
					</p>
				</div>
				<button
					type="button"
					onClick={onClose}
					className="w-6 h-6 rounded flex items-center justify-center shrink-0 transition-opacity hover:opacity-70"
					style={{ color: "var(--text-faint)" }}
				>
					<X className="w-3.5 h-3.5" />
				</button>
			</div>

			<div className="p-4 space-y-4">
				{/* Status badge */}
				<div
					className="flex items-center gap-2 px-3 py-2 rounded"
					style={{
						background: STATUS_BG[service.status],
						border: `1px solid ${STATUS_BORDER[service.status]}`,
					}}
				>
					<StatusIcon status={service.status} />
					<span className="text-xs font-semibold" style={{ color }}>
						{STATUS_LABEL[service.status] ?? service.status}
					</span>
					<span
						className="text-[10px] ml-auto"
						style={{ color: "var(--text-faint)" }}
					>
						{service.poll_interval_sec}s polling
					</span>
				</div>

				{/* Live metrics */}
				{latestMetric && (
					<div>
						<p
							className="text-[10px] uppercase tracking-wider mb-2 flex items-center gap-1"
							style={{ color: "var(--text-muted)" }}
						>
							<Activity className="w-3 h-3" /> Anlık Metrikler
						</p>
						<div className="grid grid-cols-2 gap-2">
							{metricItems.map(({ label, value, icon: Icon }) => (
								<div
									key={label}
									className="p-2 rounded"
									style={{
										background: "var(--surface-sunken)",
										border: "1px solid var(--border-default)",
									}}
								>
									<div className="flex items-center gap-1 mb-0.5">
										<Icon
											className="w-3 h-3"
											style={{ color: "var(--text-faint)" }}
										/>
										<p
											className="text-[9px] uppercase tracking-wider"
											style={{ color: "var(--text-faint)" }}
										>
											{label}
										</p>
									</div>
									<p
										className="text-sm font-bold tabular-nums"
										style={{ color: "var(--text-secondary)" }}
									>
										{value}
									</p>
								</div>
							))}
						</div>
					</div>
				)}

				{/* Active alerts */}
				{alerts.length > 0 && (
					<div>
						<p
							className="text-[10px] uppercase tracking-wider mb-2 flex items-center gap-1"
							style={{ color: "var(--text-muted)" }}
						>
							<AlertTriangle
								className="w-3 h-3"
								style={{ color: "var(--status-down)" }}
							/>
							Aktif Uyarılar ({alerts.length})
						</p>
						<div className="space-y-1.5">
							{alerts.slice(0, 4).map((alert) => (
								<div
									key={alert.id}
									className="px-2.5 py-2 rounded"
									style={{
										background:
											alert.severity === "crit"
												? "var(--status-down-subtle)"
												: alert.severity === "warn"
													? "var(--status-warn-subtle)"
													: "var(--color-blue-subtle)",
										border: `1px solid ${
											alert.severity === "crit"
												? "var(--status-down-border)"
												: alert.severity === "warn"
													? "var(--status-warn-border)"
													: "var(--color-blue-border)"
										}`,
									}}
								>
									<p
										className="text-[10px] font-medium line-clamp-2"
										style={{ color: "var(--text-secondary)" }}
									>
										{alert.message}
									</p>
								</div>
							))}
						</div>
					</div>
				)}

				{/* AI Analysis */}
				<div
					className="p-3 rounded"
					style={{
						background: "var(--color-lavender-subtle)",
						border: "1px solid var(--color-lavender-border)",
					}}
				>
					<div className="flex items-center gap-2 mb-2">
						<Brain
							className="w-3.5 h-3.5"
							style={{ color: "var(--color-lavender)" }}
						/>
						<p
							className="text-[10px] font-semibold uppercase tracking-wider"
							style={{ color: "var(--color-lavender)" }}
						>
							AI Analizi
						</p>
					</div>
					<button
						type="button"
						onClick={() => analyzeMutation.mutate()}
						disabled={analyzeMutation.isPending}
						className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
						style={{
							background: "var(--gradient-btn-primary)",
							color: "white",
							boxShadow: "var(--btn-shadow)",
						}}
					>
						{analyzeMutation.isPending ? (
							<>
								<RefreshCw className="w-3 h-3 animate-spin" /> Analiz
								ediliyor...
							</>
						) : (
							<>
								<Sparkles className="w-3 h-3" /> Bu servisi analiz et
							</>
						)}
					</button>

					<AnimatePresence>
						{analysisResult && (
							<motion.div
								initial={{ height: 0, opacity: 0 }}
								animate={{ height: "auto", opacity: 1 }}
								exit={{ height: 0, opacity: 0 }}
								transition={{ duration: 0.2 }}
								className="mt-3 space-y-2 overflow-hidden"
							>
								<div
									className="pt-2"
									style={{
										borderTop: "1px solid var(--color-lavender-border)",
									}}
								>
									<p
										className="text-[10px] uppercase tracking-wider mb-1"
										style={{ color: "var(--color-lavender)" }}
									>
										Özet
									</p>
									<p
										className="text-[10px] leading-relaxed"
										style={{ color: "var(--text-secondary)" }}
									>
										{analysisResult.summary}
									</p>
								</div>
								{analysisResult.recommendations?.slice(0, 3).map((rec) => (
									<div key={rec.action} className="flex items-start gap-1.5">
										<TrendingUp
											className="w-3 h-3 mt-0.5 shrink-0"
											style={{ color: "var(--color-lavender)" }}
										/>
										<p
											className="text-[10px] leading-relaxed"
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

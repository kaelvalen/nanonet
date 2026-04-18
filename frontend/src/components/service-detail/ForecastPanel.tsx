import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Clock, Cpu, HardDrive, TrendingUp } from "lucide-react";
import { useState } from "react";
import {
	Area,
	AreaChart,
	CartesianGrid,
	ReferenceLine,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { type ForecastMetric, metricsApi } from "@/api/metrics";

const METRICS: { key: ForecastMetric; label: string; icon: typeof Cpu; color: string; unit: string; threshold?: number }[] = [
	{ key: "cpu", label: "CPU", icon: Cpu, color: "#2dd4bf", unit: "%", threshold: 80 },
	{ key: "memory", label: "Bellek", icon: HardDrive, color: "#22d3ee", unit: "MB" },
	{ key: "latency", label: "Gecikme", icon: Clock, color: "#818cf8", unit: "ms", threshold: 500 },
	{ key: "error_rate", label: "Hata", icon: AlertTriangle, color: "#fb7185", unit: "%", threshold: 5 },
];

export function ForecastPanel({ serviceId }: { serviceId: string }) {
	const [metric, setMetric] = useState<ForecastMetric>("cpu");
	const meta = METRICS.find((m) => m.key === metric)!;

	const { data, isLoading } = useQuery({
		queryKey: ["metric-forecast", serviceId, metric, meta.threshold],
		queryFn: () =>
			metricsApi.getForecast(serviceId, metric, 12, meta.threshold),
		refetchInterval: 60_000,
		enabled: !!serviceId,
	});

	const series = data?.forecast.series ?? [];
	const points = series.map((p) => ({
		time: new Date(p.timestamp).toLocaleTimeString("tr-TR", {
			hour: "2-digit",
			minute: "2-digit",
		}),
		value: Number(p.value.toFixed(2)),
		lower: Number(p.lower.toFixed(2)),
		upper: Number(p.upper.toFixed(2)),
	}));

	const confidence = data?.forecast.confidence ?? 0;
	const next = data?.forecast.next_value;
	const nextAlert = data?.forecast.next_alert_at
		? new Date(data.forecast.next_alert_at)
		: null;

	const Icon = meta.icon;

	return (
		<div
			className="rounded-lg overflow-hidden flex flex-col relative"
			style={{
				background:
					"linear-gradient(135deg, var(--surface-card) 0%, var(--surface-card) 60%, color-mix(in srgb, " +
					meta.color +
					" 6%, var(--surface-card)) 100%)",
				border: `1px solid color-mix(in srgb, ${meta.color} 35%, var(--border-default))`,
				boxShadow: `0 1px 0 color-mix(in srgb, ${meta.color} 18%, transparent), 0 8px 24px -16px color-mix(in srgb, ${meta.color} 60%, transparent)`,
			}}
		>
			<span
				aria-hidden
				className="absolute top-0 left-0 right-0 h-px"
				style={{
					background: `linear-gradient(90deg, transparent, ${meta.color}, transparent)`,
					opacity: 0.7,
				}}
			/>
			<div
				className="flex items-center justify-between gap-3 px-4 py-2.5"
				style={{ borderBottom: "1px solid var(--border-subtle)" }}
			>
				<div className="flex items-center gap-2 min-w-0">
					<span
						className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
						style={{
							background: `${meta.color}1c`,
							border: `1px solid ${meta.color}55`,
						}}
					>
						<TrendingUp
							className="w-3.5 h-3.5"
							style={{ color: meta.color }}
						/>
					</span>
					<div className="min-w-0">
						<p
							className="text-[10px] uppercase tracking-[0.2em] font-bold leading-none flex items-center gap-1.5"
							style={{ color: meta.color }}
						>
							Tahmin
							<span
								className="text-[9px] font-mono normal-case tracking-normal opacity-70"
								style={{ color: "var(--text-faint)" }}
							>
								12 adım
							</span>
						</p>
						<p
							className="text-[10px] font-mono mt-0.5 truncate"
							style={{ color: "var(--text-muted)" }}
						>
							güven:{" "}
							<span
								className="tabular-nums font-bold"
								style={{ color: "var(--text-primary)" }}
							>
								{(confidence * 100).toFixed(0)}%
							</span>
							{next != null && (
								<>
									{" "}
									· sonraki:{" "}
									<span
										className="tabular-nums font-bold"
										style={{ color: meta.color }}
									>
										{next.toFixed(2)}
										<span className="ml-0.5" style={{ color: "var(--text-faint)" }}>
											{meta.unit}
										</span>
									</span>
								</>
							)}
							{nextAlert && (
								<>
									{" "}
									· tahmini eşik:{" "}
									<span
										className="tabular-nums font-bold"
										style={{ color: "var(--status-warn-text)" }}
									>
										{nextAlert.toLocaleTimeString("tr-TR", {
											hour: "2-digit",
											minute: "2-digit",
										})}
									</span>
								</>
							)}
						</p>
					</div>
				</div>

				<div className="flex items-center gap-1 shrink-0">
					{METRICS.map((m) => {
						const I = m.icon;
						const active = m.key === metric;
						return (
							<button
								key={m.key}
								type="button"
								onClick={() => setMetric(m.key)}
								className="h-7 px-2 rounded flex items-center gap-1 transition-colors"
								style={{
									background: active
										? `${m.color}1f`
										: "var(--surface-sunken)",
									border: `1px solid ${active ? m.color : "var(--border-default)"}`,
								}}
								title={m.label}
							>
								<I
									className="w-3 h-3"
									style={{
										color: active ? m.color : "var(--text-muted)",
									}}
								/>
							</button>
						);
					})}
				</div>
			</div>

			<div className="px-1 pb-2 pt-3">
				{isLoading ? (
					<div
						className="h-[160px] rounded animate-pulse"
						style={{ background: "var(--surface-sunken)" }}
					/>
				) : points.length === 0 ? (
					<div
						className="h-[160px] flex items-center justify-center text-[11px] font-mono"
						style={{ color: "var(--text-muted)" }}
					>
						Yeterli veri yok — en az 4 örnek gerekli.
					</div>
				) : (
					<ResponsiveContainer width="100%" height={160}>
						<AreaChart
							data={points}
							margin={{ top: 6, right: 12, left: 0, bottom: 0 }}
						>
							<defs>
								<linearGradient
									id={`fc-${metric}`}
									x1="0"
									y1="0"
									x2="0"
									y2="1"
								>
									<stop
										offset="0%"
										stopColor={meta.color}
										stopOpacity={0.25}
									/>
									<stop
										offset="95%"
										stopColor={meta.color}
										stopOpacity={0}
									/>
								</linearGradient>
							</defs>
							<CartesianGrid
								strokeDasharray="2 4"
								vertical={false}
								stroke="var(--border-subtle)"
							/>
							<XAxis
								dataKey="time"
								tick={{
									fontSize: 9,
									fontFamily: "IBM Plex Mono, monospace",
									fill: "var(--text-faint)",
								}}
								stroke="var(--border-subtle)"
								tickLine={false}
								axisLine={false}
								interval="preserveStartEnd"
								minTickGap={32}
							/>
							<YAxis
								tick={{
									fontSize: 9,
									fontFamily: "IBM Plex Mono, monospace",
									fill: "var(--text-faint)",
								}}
								stroke="var(--border-subtle)"
								tickLine={false}
								axisLine={false}
								width={32}
							/>
							<Tooltip
								cursor={{
									stroke: meta.color,
									strokeWidth: 1,
									strokeDasharray: "3 3",
								}}
								contentStyle={{
									background: "var(--surface-overlay)",
									border: "1px solid var(--border-strong)",
									fontSize: 11,
									fontFamily: "IBM Plex Mono, monospace",
								}}
								labelStyle={{ color: "var(--text-faint)" }}
							/>
							{meta.threshold != null && (
								<ReferenceLine
									y={meta.threshold}
									stroke="var(--status-warn)"
									strokeDasharray="4 4"
									label={{
										value: `eşik ${meta.threshold}${meta.unit}`,
										position: "insideTopRight",
										fontSize: 9,
										fill: "var(--status-warn-text)",
									}}
								/>
							)}
							<Area
								type="monotone"
								dataKey="upper"
								stroke="none"
								fill={`url(#fc-${metric})`}
								fillOpacity={0.35}
								isAnimationActive={false}
							/>
							<Area
								type="monotone"
								dataKey="lower"
								stroke="none"
								fill="var(--surface-card)"
								fillOpacity={1}
								isAnimationActive={false}
							/>
							<Area
								type="monotone"
								dataKey="value"
								stroke={meta.color}
								strokeWidth={1.75}
								strokeDasharray="4 3"
								fill="none"
								dot={false}
								isAnimationActive={false}
							/>
						</AreaChart>
					</ResponsiveContainer>
				)}
			</div>
		</div>
	);
}

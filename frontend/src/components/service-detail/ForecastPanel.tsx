import { useQueries, useQueryClient } from "@tanstack/react-query";
import {
	AlertTriangle,
	Clock,
	Cpu,
	HardDrive,
	TrendingDown,
	TrendingUp,
	Minus,
} from "lucide-react";
import { useState, useMemo } from "react";
import {
	Area,
	CartesianGrid,
	ComposedChart,
	Line,
	ReferenceLine,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { type ForecastMetric, metricsApi } from "@/api/metrics";
import type { ServiceMetrics } from "@/types/service";

// ── Config ────────────────────────────────────────────────────────────────────

const METRICS = [
	{ key: "cpu"        as ForecastMetric, label: "CPU",     icon: Cpu,           color: "#2dd4bf", unit: "%",  threshold: 80  },
	{ key: "memory"     as ForecastMetric, label: "Bellek",  icon: HardDrive,     color: "#22d3ee", unit: "MB"                 },
	{ key: "latency"    as ForecastMetric, label: "Gecikme", icon: Clock,         color: "#818cf8", unit: "ms", threshold: 500 },
	{ key: "error_rate" as ForecastMetric, label: "Hata",    icon: AlertTriangle, color: "#fb7185", unit: "%",  threshold: 5   },
] as const;

const HORIZONS = [6, 12, 24] as const;
type Horizon = (typeof HORIZONS)[number];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(v: number, unit: string) {
	if (unit === "MB") return v >= 1024 ? `${(v / 1024).toFixed(1)}G` : `${Math.round(v)}MB`;
	if (unit === "%") return `${v.toFixed(1)}%`;
	if (unit === "ms") return v >= 1000 ? `${(v / 1000).toFixed(2)}s` : `${Math.round(v)}ms`;
	return String(v);
}

function alertIn(isoDate?: string | null): string | null {
	if (!isoDate) return null;
	const ms = new Date(isoDate).getTime() - Date.now();
	if (ms <= 0) return "şimdi";
	const s = Math.floor(ms / 1000);
	if (s < 60) return `~${s}s`;
	const m = Math.floor(s / 60);
	if (m < 60) return `~${m}dk`;
	return `~${Math.floor(m / 60)}sa`;
}

function metricValue(m: ServiceMetrics, key: ForecastMetric): number | null {
	switch (key) {
		case "cpu":        return m.cpu_percent    ?? null;
		case "memory":     return m.memory_used_mb ?? null;
		case "latency":    return m.latency_ms     ?? null;
		case "error_rate": return m.error_rate     ?? null;
	}
}

// ── Summary card ──────────────────────────────────────────────────────────────

function MetricCard({
	meta,
	isSelected,
	onClick,
	currentVal,
	nextVal,
	confidence,
	alertAt,
	isLoading,
}: {
	meta: (typeof METRICS)[number];
	isSelected: boolean;
	onClick: () => void;
	currentVal: number | null;
	nextVal: number | null;
	confidence: number;
	alertAt?: string | null;
	isLoading: boolean;
}) {
	const Icon = meta.icon;
	const alertLabel = alertIn(alertAt);

	const trend = currentVal != null && nextVal != null
		? nextVal > currentVal * 1.03 ? "up"
		: nextVal < currentVal * 0.97 ? "down"
		: "flat"
		: null;

	const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
	const trendColor = trend === "up"
		? (meta.key === "error_rate" || meta.key === "latency" ? "var(--status-down-text)" : "var(--status-up-text)")
		: trend === "down"
		? (meta.key === "error_rate" || meta.key === "latency" ? "var(--status-up-text)" : "var(--status-down-text)")
		: "var(--text-faint)";

	return (
		<button
			type="button"
			onClick={onClick}
			className="flex flex-col gap-2 p-3 rounded-[8px] text-left transition-all"
			style={{
				background: isSelected
					? `color-mix(in srgb, ${meta.color} 10%, var(--surface-sunken))`
					: "var(--surface-sunken)",
				border: `1px solid ${isSelected
					? `color-mix(in srgb, ${meta.color} 40%, var(--border-subtle))`
					: "var(--border-subtle)"}`,
				outline: "none",
			}}
		>
			{/* Top row */}
			<div className="flex items-center justify-between gap-2">
				<div className="flex items-center gap-1.5">
					<Icon className="w-3.5 h-3.5 shrink-0" style={{ color: meta.color }} />
					<span className="text-[11px] font-semibold uppercase tracking-wider"
						style={{ color: "var(--text-faint)" }}>
						{meta.label}
					</span>
				</div>
				{/* Confidence bar */}
				<div className="flex items-center gap-1.5">
					<div className="w-12 h-1 rounded-full overflow-hidden"
						style={{ background: "var(--border-subtle)" }}>
						<div className="h-full rounded-full transition-all"
							style={{ width: `${(confidence * 100).toFixed(0)}%`, background: meta.color, opacity: 0.7 }} />
					</div>
					<span className="text-[10px] tnum" style={{ color: "var(--text-faint)" }}>
						%{(confidence * 100).toFixed(0)}
					</span>
				</div>
			</div>

			{/* Values */}
			{isLoading ? (
				<div className="h-8 rounded animate-pulse" style={{ background: "var(--border-subtle)" }} />
			) : (
				<div className="flex items-end justify-between gap-2">
					<div>
						{currentVal != null ? (
							<div className="flex items-center gap-1.5">
								<span className="text-[18px] font-semibold tnum leading-none"
									style={{ color: "var(--text-primary)" }}>
									{fmt(currentVal, meta.unit).replace(meta.unit, "")}
								</span>
								<span className="text-[11px]" style={{ color: "var(--text-faint)" }}>
									{meta.unit}
								</span>
								{trend && nextVal != null && (
									<>
										<span style={{ color: "var(--text-faint)" }}>→</span>
										<span className="text-[13px] font-semibold tnum"
											style={{ color: meta.color }}>
											{fmt(nextVal, meta.unit)}
										</span>
									</>
								)}
							</div>
						) : (
							<span className="text-[11px]" style={{ color: "var(--text-faint)" }}>veri yok</span>
						)}
					</div>
					<div className="flex flex-col items-end gap-1">
						{trend && (
							<TrendIcon className="w-4 h-4" style={{ color: trendColor }} />
						)}
						{alertLabel && (
							<span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
								style={{
									background: "var(--status-down-subtle)",
									color: "var(--status-down-text)",
								}}>
								⚠ {alertLabel}
							</span>
						)}
					</div>
				</div>
			)}
		</button>
	);
}

// ── Main component ────────────────────────────────────────────────────────────

export function ForecastPanel({ serviceId }: { serviceId: string }) {
	const [selected, setSelected] = useState<ForecastMetric>("cpu");
	const [horizon, setHorizon] = useState<Horizon>(12);
	const qc = useQueryClient();

	const meta = METRICS.find((m) => m.key === selected) ?? METRICS[0];

	// Fetch all 4 forecasts in parallel
	const forecasts = useQueries({
		queries: METRICS.map((m) => ({
			queryKey: ["metric-forecast", serviceId, m.key, horizon, m.threshold],
			queryFn: () => metricsApi.getForecast(serviceId, m.key, horizon, m.threshold),
			refetchInterval: 60_000,
			enabled: !!serviceId,
			staleTime: 50_000,
		})),
	});

	// Latest historical value per metric (from WS cache)
	const historicalData = useMemo(() => {
		const cached = qc.getQueryData<ServiceMetrics[]>(["serviceMetrics", serviceId]);
		if (!cached?.length) return {} as Record<ForecastMetric, number | null>;
		const last = cached[cached.length - 1];
		return {
			cpu:        last.cpu_percent    ?? null,
			memory:     last.memory_used_mb ?? null,
			latency:    last.latency_ms     ?? null,
			error_rate: last.error_rate     ?? null,
		} as Record<ForecastMetric, number | null>;
	}, [qc, serviceId]);

	// Build combined chart data: last 20 historical + all forecast points
	const chartData = useMemo(() => {
		const forecastIdx = METRICS.findIndex((m) => m.key === selected);
		const forecastData = forecasts[forecastIdx]?.data?.forecast;
		const cached = qc.getQueryData<ServiceMetrics[]>(["serviceMetrics", serviceId]);

		const historical = (cached ?? []).slice(-20).map((p) => ({
			time: new Date(p.time).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
			hist: metricValue(p, selected),
			pred: null as number | null,
			lo:   null as number | null,
			hi:   null as number | null,
			isNow: false,
		}));

		const predicted = (forecastData?.series ?? []).map((p) => ({
			time: new Date(p.timestamp).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
			hist: null as number | null,
			pred: Number(p.value.toFixed(2)),
			lo:   Number(p.lower.toFixed(2)),
			hi:   Number(p.upper.toFixed(2)),
			isNow: false,
		}));

		// Add "now" divider point
		if (historical.length && predicted.length) {
			const lastHist = historical[historical.length - 1];
			const firstPred = predicted[0];
			return [
				...historical,
				{ ...lastHist, pred: lastHist.hist, lo: lastHist.hist, hi: lastHist.hist, isNow: true },
				...predicted.map((p, i) => ({ ...p, hist: i === 0 ? lastHist.hist : null })),
			];
		}

		return [...historical, ...predicted];
	}, [forecasts, selected, serviceId, qc]);

	const nowIndex = chartData.findIndex((p) => p.isNow);
	const nowTime = nowIndex >= 0 ? chartData[nowIndex].time : undefined;

	const selectedForecast = forecasts[METRICS.findIndex((m) => m.key === selected)]?.data?.forecast;

	return (
		<div
			className="rounded-[10px] flex flex-col"
			style={{
				background: "var(--surface-base)",
				border: "1px solid var(--border-subtle)",
			}}
		>
			{/* Header */}
			<div className="flex items-center justify-between px-4 py-3"
				style={{ borderBottom: "1px solid var(--border-subtle)" }}>
				<div className="flex items-center gap-2">
					<TrendingUp className="w-4 h-4" style={{ color: "var(--brand-primary)" }} />
					<span className="text-[13px] font-semibold" style={{ color: "var(--text-primary)" }}>
						Tahmin
					</span>
				</div>
				{/* Horizon selector */}
				<div className="flex items-center gap-0.5 p-0.5 rounded-[6px]"
					style={{ background: "var(--surface-sunken)", border: "1px solid var(--border-subtle)" }}>
					{HORIZONS.map((h) => (
						<button
							key={h}
							type="button"
							onClick={() => setHorizon(h)}
							className="px-2.5 h-6 rounded-[4px] text-[11px] font-medium transition-all"
							style={{
								background: horizon === h ? "var(--surface-base)" : "transparent",
								color: horizon === h ? "var(--text-primary)" : "var(--text-faint)",
								boxShadow: horizon === h ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
							}}
						>
							{h} adım
						</button>
					))}
				</div>
			</div>

			{/* 4 metric cards */}
			<div className="grid grid-cols-2 gap-2 p-3">
				{METRICS.map((m, i) => {
					const f = forecasts[i];
					return (
						<MetricCard
							key={m.key}
							meta={m}
							isSelected={selected === m.key}
							onClick={() => setSelected(m.key)}
							currentVal={historicalData[m.key]}
							nextVal={f.data?.forecast.next_value ?? null}
							confidence={f.data?.forecast.confidence ?? 0}
							alertAt={f.data?.forecast.next_alert_at}
							isLoading={f.isLoading}
						/>
					);
				})}
			</div>

			{/* Full chart for selected metric */}
			<div className="mx-3 mb-3 px-2 pt-2 pb-1 rounded-[8px]"
				style={{ background: "var(--surface-sunken)", border: "1px solid var(--border-subtle)" }}>

				{/* Chart subtitle */}
				<div className="flex items-center justify-between mb-1 px-1">
					<span className="text-[10px] font-medium" style={{ color: "var(--text-faint)" }}>
						{meta.label} — geçmiş + tahmin
					</span>
					{selectedForecast?.next_alert_at && (
						<span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
							style={{ background: "var(--status-down-subtle)", color: "var(--status-down-text)" }}>
							⚠ eşik {alertIn(selectedForecast.next_alert_at)}
						</span>
					)}
				</div>

				{chartData.length < 2 ? (
					<div className="h-[160px] flex items-center justify-center text-[11px] font-mono"
						style={{ color: "var(--text-faint)" }}>
						Yeterli veri yok — agent bağlı ve veri gönderiyor mu?
					</div>
				) : (
					<ResponsiveContainer width="100%" height={160}>
						<ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
							<defs>
								<linearGradient id={`fg-hist-${meta.key}`} x1="0" y1="0" x2="0" y2="1">
									<stop offset="0%" stopColor={meta.color} stopOpacity={0.15} />
									<stop offset="100%" stopColor={meta.color} stopOpacity={0.02} />
								</linearGradient>
								<linearGradient id={`fg-band-${meta.key}`} x1="0" y1="0" x2="0" y2="1">
									<stop offset="0%" stopColor={meta.color} stopOpacity={0.25} />
									<stop offset="100%" stopColor={meta.color} stopOpacity={0.05} />
								</linearGradient>
							</defs>

							<CartesianGrid strokeDasharray="2 4" vertical={false} stroke="var(--border-subtle)" />

							<XAxis
								dataKey="time"
								tick={{ fontSize: 9, fill: "var(--text-faint)" }}
								stroke="transparent"
								tickLine={false}
								axisLine={false}
								interval="preserveStartEnd"
								minTickGap={40}
								height={22}
							/>
							<YAxis
								tick={{ fontSize: 9, fill: "var(--text-faint)" }}
								stroke="transparent"
								tickLine={false}
								axisLine={false}
								width={32}
								tickFormatter={(v: number) => fmt(v, meta.unit).replace(meta.unit, "")}
								domain={["auto", "auto"]}
							/>

							<Tooltip
								contentStyle={{
									background: "var(--surface-overlay)",
									border: "1px solid var(--border-strong)",
									fontSize: 11,
									fontFamily: "var(--font-mono, monospace)",
									borderRadius: 6,
								}}
								labelStyle={{ color: "var(--text-faint)", marginBottom: 4 }}
								formatter={(val: number, name: string) => {
									const labels: Record<string, string> = {
										hist: "Gerçek",
										pred: "Tahmin",
										hi:   "Üst sınır",
										lo:   "Alt sınır",
									};
									return [val != null ? fmt(val, meta.unit) : "—", labels[name] ?? name];
								}}
							/>

							{/* Threshold */}
							{meta.threshold != null && (
								<ReferenceLine
									y={meta.threshold}
									stroke="var(--status-down)"
									strokeDasharray="4 4"
									strokeWidth={1}
									label={{
										value: `eşik ${meta.threshold}${meta.unit}`,
										position: "insideTopRight",
										fontSize: 9,
										fill: "var(--status-down-text)",
									}}
								/>
							)}

							{/* Now divider */}
							{nowTime && (
								<ReferenceLine
									x={nowTime}
									stroke="var(--border-strong)"
									strokeDasharray="3 3"
									strokeWidth={1}
									label={{
										value: "şimdi",
										position: "insideTopLeft",
										fontSize: 9,
										fill: "var(--text-faint)",
									}}
								/>
							)}

							{/* Upper confidence band */}
							<Area
								dataKey="hi"
								stroke="none"
								fill={`url(#fg-band-${meta.key})`}
								connectNulls={false}
								dot={false}
								isAnimationActive={false}
							/>
							{/* Lower confidence band (fills down) */}
							<Area
								dataKey="lo"
								stroke="none"
								fill="var(--surface-sunken)"
								connectNulls={false}
								dot={false}
								isAnimationActive={false}
							/>

							{/* Historical solid line */}
							<Line
								dataKey="hist"
								stroke={meta.color}
								strokeWidth={2}
								dot={false}
								connectNulls={false}
								isAnimationActive={false}
								strokeOpacity={0.9}
							/>

							{/* Forecast dashed line */}
							<Line
								dataKey="pred"
								stroke={meta.color}
								strokeWidth={1.5}
								strokeDasharray="5 3"
								dot={false}
								connectNulls={false}
								isAnimationActive={false}
								strokeOpacity={0.7}
							/>
						</ComposedChart>
					</ResponsiveContainer>
				)}
			</div>
		</div>
	);
}

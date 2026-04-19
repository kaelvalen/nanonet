import { Activity, AlertTriangle, Clock, Cpu, HardDrive } from "lucide-react";
import {
	Area,
	AreaChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";

export type ServiceChartPoint = {
	time: string;
	cpu?: number;
	memory?: number;
	latency?: number;
	error_rate?: number;
	disk?: number;
};

type SeriesConfig = {
	key: keyof Omit<ServiceChartPoint, "time">;
	label: string;
	unit: string;
	icon: typeof Cpu;
	color: string;
	domain?: [number, number | "auto"];
	threshold?: number;
	decimals: number;
};

const SERIES: SeriesConfig[] = [
	{
		key: "cpu",
		label: "CPU",
		unit: "%",
		icon: Cpu,
		color: "#2dd4bf",
		domain: [0, 100],
		threshold: 80,
		decimals: 1,
	},
	{
		key: "memory",
		label: "Bellek",
		unit: "MB",
		icon: HardDrive,
		color: "#22d3ee",
		decimals: 0,
	},
	{
		key: "latency",
		label: "Gecikme",
		unit: "ms",
		icon: Clock,
		color: "#818cf8",
		threshold: 500,
		decimals: 0,
	},
	{
		key: "error_rate",
		label: "Hata Oranı",
		unit: "%",
		icon: AlertTriangle,
		color: "#fb7185",
		domain: [0, "auto"],
		threshold: 5,
		decimals: 2,
	},
];

function ChartTooltip({
	active,
	payload,
	label,
	unit,
	decimals,
	color,
}: {
	active?: boolean;
	payload?: { value?: number }[];
	label?: string;
	unit: string;
	decimals: number;
	color: string;
}) {
	if (!active || !payload || payload.length === 0) return null;
	const v = payload[0].value;
	return (
		<div
			className="flex flex-col gap-0.5 px-2.5 py-1.5 rounded"
			style={{
				background: "var(--surface-overlay)",
				border: "1px solid var(--border-strong)",
				boxShadow: "var(--panel-shadow)",
			}}
		>
			<span
				className="text-[9px] font-mono uppercase tracking-wider"
				style={{ color: "var(--text-faint)" }}
			>
				{label}
			</span>
			<span
				className="text-[13px] font-mono font-bold tabular-nums"
				style={{ color }}
			>
				{typeof v === "number" ? v.toFixed(decimals) : "—"}
				<span
					className="text-[10px] ml-1"
					style={{ color: "var(--text-muted)" }}
				>
					{unit}
				</span>
			</span>
		</div>
	);
}

function SingleChart({
	series,
	data,
}: {
	series: SeriesConfig;
	data: ServiceChartPoint[];
}) {
	const Icon = series.icon;
	const gradientId = `nn-grad-${series.key}`;
	const values = data
		.map((d) => d[series.key])
		.filter((v): v is number => typeof v === "number");
	const latest = values.length > 0 ? values[values.length - 1] : null;
	const peak = values.length > 0 ? Math.max(...values) : null;
	const avg =
		values.length > 0
			? values.reduce((a, b) => a + b, 0) / values.length
			: null;

	return (
		<div
			className="relative flex flex-col rounded-lg overflow-hidden"
			style={{
				background: "var(--surface-card)",
				border: "1px solid var(--border-default)",
			}}
		>
			<div
				className="flex items-center justify-between gap-3 px-4 py-2.5"
				style={{ borderBottom: "1px solid var(--border-subtle)" }}
			>
				<div className="flex items-center gap-2">
					<span
						className="w-6 h-6 rounded flex items-center justify-center shrink-0"
						style={{
							background: `${series.color}12`,
							border: `1px solid ${series.color}33`,
						}}
					>
						<Icon className="w-3 h-3" style={{ color: series.color }} />
					</span>
					<div>
						<p
							className="text-[10px] uppercase tracking-[0.2em] font-bold leading-none"
							style={{ color: "var(--text-faint)" }}
						>
							{series.label}
						</p>
						<p
							className="text-[10px] font-mono mt-0.5"
							style={{ color: "var(--text-muted)" }}
						>
							son:{" "}
							<span
								className="tabular-nums font-bold"
								style={{ color: "var(--text-primary)" }}
							>
								{latest != null ? latest.toFixed(series.decimals) : "—"}
							</span>
							<span style={{ color: "var(--text-faint)" }}> {series.unit}</span>
						</p>
					</div>
				</div>

				<div className="flex items-center gap-4 text-[10px] font-mono tabular-nums">
					<div className="text-right hidden sm:block">
						<p
							className="uppercase tracking-wider"
							style={{ color: "var(--text-faint)" }}
						>
							ort
						</p>
						<p style={{ color: "var(--text-secondary)" }}>
							{avg != null ? avg.toFixed(series.decimals) : "—"}
						</p>
					</div>
					<div className="text-right">
						<p
							className="uppercase tracking-wider"
							style={{ color: "var(--text-faint)" }}
						>
							tepe
						</p>
						<p style={{ color: "var(--text-secondary)" }}>
							{peak != null ? peak.toFixed(series.decimals) : "—"}
						</p>
					</div>
				</div>
			</div>

			<div className="px-1 pb-2 pt-3">
				<ResponsiveContainer width="100%" height={180}>
					<AreaChart
						data={data}
						margin={{ top: 6, right: 12, left: 0, bottom: 0 }}
					>
						<defs>
							<linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
								<stop offset="0%" stopColor={series.color} stopOpacity={0.3} />
								<stop offset="95%" stopColor={series.color} stopOpacity={0} />
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
							domain={series.domain ?? ["auto", "auto"]}
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
								stroke: series.color,
								strokeWidth: 1,
								strokeDasharray: "3 3",
							}}
							content={
								<ChartTooltip
									unit={series.unit}
									decimals={series.decimals}
									color={series.color}
								/>
							}
						/>
						<Area
							type="monotone"
							dataKey={series.key}
							stroke={series.color}
							fill={`url(#${gradientId})`}
							strokeWidth={1.75}
							animationDuration={700}
							dot={false}
							activeDot={{
								r: 3.5,
								stroke: series.color,
								strokeWidth: 1.5,
								fill: "var(--surface-card)",
							}}
						/>
					</AreaChart>
				</ResponsiveContainer>
			</div>
		</div>
	);
}

export function ServiceMetricsCharts({
	chartData,
}: {
	chartData: ServiceChartPoint[];
}) {
	const hasDisk = chartData.some(
		(d) => typeof d.disk === "number" && d.disk > 0,
	);
	const series: SeriesConfig[] = hasDisk
		? [
				...SERIES,
				{
					key: "disk",
					label: "Disk",
					unit: "GB",
					icon: Activity,
					color: "#fbbf24",
					decimals: 1,
				},
			]
		: SERIES;

	return (
		<div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
			{series.map((s) => (
				<SingleChart key={s.key} series={s} data={chartData} />
			))}
		</div>
	);
}

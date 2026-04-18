import {
	Area,
	AreaChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Clock, Cpu, HardDrive, Zap } from "lucide-react";

export type ServiceChartPoint = {
	time: string;
	cpu?: number;
	memory?: number;
	latency?: number;
	error_rate?: number;
};

export function ServiceMetricsCharts({ chartData }: { chartData: ServiceChartPoint[] }) {
	return (
		<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
			{/* CPU Chart */}
			<Card
				className="p-4 rounded"
				style={{
					background: "var(--surface-card)",
					border: "1px solid var(--color-teal-border)",
				}}
			>
				<h3
					className="text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5"
					style={{ color: "var(--text-muted)" }}
				>
					<Cpu className="w-3 h-3" style={{ color: "var(--color-teal)" }} /> CPU
					Kullanımı (%)
				</h3>
				<ResponsiveContainer width="100%" height={200}>
					<AreaChart data={chartData}>
						<defs>
							<linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
								<stop offset="5%" stopColor="#39c5bb" stopOpacity={0.15} />
								<stop offset="95%" stopColor="#39c5bb" stopOpacity={0} />
							</linearGradient>
						</defs>
						<CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
						<XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="#b0bdd5" />
						<YAxis
							tick={{ fontSize: 10 }}
							stroke="#b0bdd5"
							domain={[0, 100]}
						/>
						<Tooltip
							contentStyle={{
								borderRadius: 0,
								border: "1px solid #39c5bb",
								fontSize: 11,
							}}
						/>
						<Area
							type="monotone"
							dataKey="cpu"
							stroke="#39c5bb"
							fill="url(#cpuGrad)"
							strokeWidth={2}
						/>
					</AreaChart>
				</ResponsiveContainer>
			</Card>

			{/* Memory Chart */}
			<Card
				className="p-4 rounded"
				style={{
					background: "var(--surface-card)",
					border: "1px solid var(--color-blue-border)",
				}}
			>
				<h3
					className="text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5"
					style={{ color: "var(--text-muted)" }}
				>
					<HardDrive className="w-3 h-3" style={{ color: "var(--color-blue)" }} />{" "}
					Bellek (MB)
				</h3>
				<ResponsiveContainer width="100%" height={200}>
					<AreaChart data={chartData}>
						<defs>
							<linearGradient id="memGrad" x1="0" y1="0" x2="0" y2="1">
								<stop offset="5%" stopColor="#93c5fd" stopOpacity={0.15} />
								<stop offset="95%" stopColor="#93c5fd" stopOpacity={0} />
							</linearGradient>
						</defs>
						<CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
						<XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="#b0bdd5" />
						<YAxis tick={{ fontSize: 10 }} stroke="#b0bdd5" />
						<Tooltip
							contentStyle={{
								borderRadius: 0,
								border: "1px solid #93c5fd",
								fontSize: 11,
							}}
						/>
						<Area
							type="monotone"
							dataKey="memory"
							stroke="#93c5fd"
							fill="url(#memGrad)"
							strokeWidth={2}
						/>
					</AreaChart>
				</ResponsiveContainer>
			</Card>

			{/* Latency Chart */}
			<Card
				className="p-4 rounded"
				style={{
					background: "var(--surface-card)",
					border: "1px solid var(--color-lavender-border)",
				}}
			>
				<h3
					className="text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5"
					style={{ color: "var(--text-muted)" }}
				>
					<Clock className="w-3 h-3" style={{ color: "var(--color-lavender)" }} />{" "}
					Gecikme (ms)
				</h3>
				<ResponsiveContainer width="100%" height={200}>
					<AreaChart data={chartData}>
						<defs>
							<linearGradient id="latGrad" x1="0" y1="0" x2="0" y2="1">
								<stop offset="5%" stopColor="#c4b5fd" stopOpacity={0.15} />
								<stop offset="95%" stopColor="#c4b5fd" stopOpacity={0} />
							</linearGradient>
						</defs>
						<CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
						<XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="#b0bdd5" />
						<YAxis tick={{ fontSize: 10 }} stroke="#b0bdd5" />
						<Tooltip
							contentStyle={{
								borderRadius: 0,
								border: "1px solid #c4b5fd",
								fontSize: 11,
							}}
						/>
						<Area
							type="monotone"
							dataKey="latency"
							stroke="#c4b5fd"
							fill="url(#latGrad)"
							strokeWidth={2}
						/>
					</AreaChart>
				</ResponsiveContainer>
			</Card>

			{/* Error Rate Chart */}
			<Card
				className="p-4 rounded"
				style={{
					background: "var(--surface-card)",
					border: "1px solid var(--status-down-border)",
				}}
			>
				<h3
					className="text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5"
					style={{ color: "var(--text-muted)" }}
				>
					<Zap className="w-3 h-3" style={{ color: "var(--status-down)" }} /> Hata
					Oranı (%)
				</h3>
				<ResponsiveContainer width="100%" height={200}>
					<AreaChart data={chartData}>
						<defs>
							<linearGradient id="errGrad" x1="0" y1="0" x2="0" y2="1">
								<stop offset="5%" stopColor="#fda4af" stopOpacity={0.15} />
								<stop offset="95%" stopColor="#fda4af" stopOpacity={0} />
							</linearGradient>
						</defs>
						<CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
						<XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="#b0bdd5" />
						<YAxis
							tick={{ fontSize: 10 }}
							stroke="#b0bdd5"
							domain={[0, "auto"]}
						/>
						<Tooltip
							contentStyle={{
								borderRadius: 0,
								border: "1px solid #fda4af",
								fontSize: 11,
							}}
						/>
						<Area
							type="monotone"
							dataKey="error_rate"
							stroke="#fda4af"
							fill="url(#errGrad)"
							strokeWidth={2}
						/>
					</AreaChart>
				</ResponsiveContainer>
			</Card>
		</div>
	);
}


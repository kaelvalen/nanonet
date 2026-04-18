import { useQueries, useQuery } from "@tanstack/react-query";
import { GitCompare, X } from "lucide-react";
import { useMemo, useState } from "react";
import {
	CartesianGrid,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { type AggregatedMetric, metricsApi } from "@/api/metrics";
import { servicesApi } from "@/api/services";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import {
	EmptyState as SharedEmptyState,
	Panel,
	PanelBody,
	PanelHeader,
	seriesColor as paletteColor,
} from "@/components/ui/primitives";
import type { Service } from "@/types/service";

type MetricKey = "avg_cpu" | "avg_memory" | "avg_latency";
const METRIC_LABELS: Record<MetricKey, string> = {
	avg_cpu: "CPU %",
	avg_memory: "Bellek %",
	avg_latency: "Latency (ms)",
};

function formatBucket(b: string) {
	try {
		return new Date(b).toLocaleTimeString("tr-TR", {
			hour: "2-digit",
			minute: "2-digit",
		});
	} catch {
		return b;
	}
}

interface MergedRow {
	bucket: string;
	[serviceId: string]: number | string | null;
}

function mergeSeries(
	results: { service: Service; data: AggregatedMetric[] }[],
	metric: MetricKey,
): MergedRow[] {
	const byBucket = new Map<string, MergedRow>();
	for (const { service, data } of results) {
		for (const row of data) {
			const key = row.bucket;
			if (!byBucket.has(key)) byBucket.set(key, { bucket: key });
			const target = byBucket.get(key)!;
			target[service.id] = row[metric];
		}
	}
	return Array.from(byBucket.values()).sort((a, b) =>
		(a.bucket as string).localeCompare(b.bucket as string),
	);
}

function StatusHeatmap({ services }: { services: Service[] }) {
	const HOURS = 24;
	const heatQueries = useQueries({
		queries: services.map((s) => ({
			queryKey: ["compare-heatmap", s.id],
			queryFn: () => metricsApi.getAggregated(s.id, "24h", "1 hour"),
			staleTime: 60_000,
		})),
	});

	const slots = useMemo(() => {
		const out: Date[] = [];
		const now = new Date();
		now.setMinutes(0, 0, 0);
		for (let i = HOURS - 1; i >= 0; i--) {
			out.push(new Date(now.getTime() - i * 3600_000));
		}
		return out;
	}, []);

	function cellColor(row: AggregatedMetric | undefined) {
		if (!row) return "var(--surface-sunken)";
		const cpu = row.avg_cpu ?? 0;
		const lat = row.max_latency ?? 0;
		if (cpu > 90 || lat > 1500) return "var(--status-down)";
		if (cpu > 70 || lat > 800) return "var(--status-warn)";
		if (cpu > 0 || lat > 0) return "var(--status-up)";
		return "var(--surface-sunken)";
	}

	return (
		<Panel>
			<PanelHeader
				dense
				actions={
					<div className="flex items-center gap-2 text-[10px]" style={{ color: "var(--text-faint)" }}>
						<span className="flex items-center gap-1">
							<span className="w-2 h-2 rounded-sm" style={{ background: "var(--status-up)" }} />
							Sağlıklı
						</span>
						<span className="flex items-center gap-1">
							<span className="w-2 h-2 rounded-sm" style={{ background: "var(--status-warn)" }} />
							Yüklü
						</span>
						<span className="flex items-center gap-1">
							<span className="w-2 h-2 rounded-sm" style={{ background: "var(--status-down)" }} />
							Kritik
						</span>
					</div>
				}
			>
				24 Saatlik Sağlık Heatmap
			</PanelHeader>
			<PanelBody scroll={false}>
				<div className="overflow-x-auto">
				<table className="text-xs w-full border-separate" style={{ borderSpacing: "2px" }}>
					<thead>
						<tr>
							<th className="text-left px-2 py-1" style={{ color: "var(--text-faint)" }} />
							{slots.map((s) => (
								<th
									key={s.toISOString()}
									className="text-[9px] font-mono"
									style={{ color: "var(--text-faint)" }}
								>
									{s.getHours().toString().padStart(2, "0")}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{services.map((svc, idx) => {
							const data = heatQueries[idx]?.data ?? [];
							const byHour = new Map<number, AggregatedMetric>();
							for (const row of data) {
								const d = new Date(row.bucket);
								d.setMinutes(0, 0, 0);
								byHour.set(d.getTime(), row);
							}
							return (
								<tr key={svc.id}>
									<td
										className="text-[11px] font-mono pr-3 py-0.5 truncate max-w-[140px]"
										style={{ color: "var(--text-secondary)" }}
									>
										{svc.name}
									</td>
									{slots.map((s) => {
										const row = byHour.get(s.getTime());
										return (
											<td
												key={s.toISOString()}
												title={`${svc.name} · ${s.toLocaleString("tr-TR")} · CPU ${row?.avg_cpu?.toFixed(0) ?? "—"}% · Lat ${row?.max_latency?.toFixed(0) ?? "—"}ms`}
												style={{
													background: cellColor(row),
													width: 14,
													height: 14,
													borderRadius: 3,
												}}
											/>
										);
									})}
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
			</PanelBody>
		</Panel>
	);
}

export function ComparePage() {
	const [selectedIds, setSelectedIds] = useState<string[]>([]);
	const [metric, setMetric] = useState<MetricKey>("avg_cpu");
	const [duration, setDuration] = useState<"1h" | "6h" | "24h">("6h");

	const { data: services = [] } = useQuery({
		queryKey: ["services"],
		queryFn: () => servicesApi.list(),
	});

	const selectedServices = useMemo(
		() => services.filter((s) => selectedIds.includes(s.id)),
		[services, selectedIds],
	);

	const seriesQueries = useQueries({
		queries: selectedServices.map((svc) => ({
			queryKey: ["compare-series", svc.id, duration],
			queryFn: () =>
				metricsApi.getAggregated(
					svc.id,
					duration,
					duration === "1h" ? "1 minute" : duration === "6h" ? "5 minutes" : "15 minutes",
				),
			staleTime: 30_000,
		})),
	});

	const merged = useMemo(() => {
		const valid = selectedServices
			.map((s, i) => ({ service: s, data: seriesQueries[i]?.data ?? [] }))
			.filter((r) => r.data.length > 0);
		return mergeSeries(valid, metric);
	}, [selectedServices, seriesQueries, metric]);

	function toggle(id: string) {
		setSelectedIds((prev) => {
			if (prev.includes(id)) return prev.filter((p) => p !== id);
			if (prev.length >= 4) return prev;
			return [...prev, id];
		});
	}

	return (
		<PageShell width="wide" fill>
			<PageHeader
				eyebrow="Karşılaştırma"
				title="Servis Karşılaştırması"
				description="2-4 servisi yan yana koyup CPU, bellek veya latency'lerini aynı eksen üzerinde inceleyin."
				meta={
					<div className="flex items-center gap-4 flex-wrap">
						<div
							className="inline-flex rounded-lg p-0.5 gap-0.5"
							style={{
								background: "var(--surface-sunken)",
								border: "1px solid var(--border-default)",
							}}
						>
							{(["avg_cpu", "avg_memory", "avg_latency"] as MetricKey[]).map((m) => (
								<button
									type="button"
									key={m}
									onClick={() => setMetric(m)}
									className="text-[10px] px-3 py-1.5 rounded-md uppercase tracking-wider font-bold transition-colors"
									style={{
										background:
											metric === m ? "var(--brand-primary)" : "transparent",
										color:
											metric === m ? "#ffffff" : "var(--text-muted)",
									}}
								>
									{METRIC_LABELS[m]}
								</button>
							))}
						</div>
						<div
							className="inline-flex rounded-lg p-0.5 gap-0.5"
							style={{
								background: "var(--surface-sunken)",
								border: "1px solid var(--border-default)",
							}}
						>
							{(["1h", "6h", "24h"] as const).map((d) => (
								<button
									type="button"
									key={d}
									onClick={() => setDuration(d)}
									className="text-[10px] px-3 py-1.5 rounded-md font-mono font-bold transition-colors"
									style={{
										background:
											duration === d ? "var(--brand-primary)" : "transparent",
										color:
											duration === d ? "#ffffff" : "var(--text-muted)",
									}}
								>
									{d}
								</button>
							))}
						</div>
					</div>
				}
			/>

			<div className="flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col gap-4">
				<Panel>
					<PanelHeader
						dense
						actions={
							selectedIds.length > 0 ? (
								<button
									type="button"
									onClick={() => setSelectedIds([])}
									className="text-[10px] px-2 py-1 rounded-md flex items-center gap-1 font-mono"
									style={{
										background: "var(--surface-sunken)",
										color: "var(--text-muted)",
										border: "1px solid var(--border-subtle)",
									}}
								>
									<X className="w-3 h-3" />
									Temizle
								</button>
							) : null
						}
						icon={<GitCompare className="w-4 h-4" />}
					>
						Servis Seçimi
						<span className="text-[10px] font-normal ml-2" style={{ color: "var(--text-faint)" }}>
							{selectedIds.length}/4
						</span>
					</PanelHeader>
					<PanelBody scroll={false}>
						<div className="flex flex-wrap gap-1.5">
							{services.map((s) => {
								const active = selectedIds.includes(s.id);
								const idx = selectedIds.indexOf(s.id);
								const color = active ? paletteColor(idx) : null;
								return (
									<button
										type="button"
										key={s.id}
										onClick={() => toggle(s.id)}
										disabled={!active && selectedIds.length >= 4}
										className="text-[11px] px-2.5 py-1.5 rounded-md font-mono flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
										style={{
											background: color
												? `color-mix(in srgb, ${color} 14%, transparent)`
												: "var(--surface-sunken)",
											border: `1px solid ${color ?? "var(--border-default)"}`,
											color: color ?? "var(--text-secondary)",
											fontWeight: active ? 600 : 500,
										}}
									>
										{active && (
											<span
												className="w-2 h-2 rounded-sm"
												style={{ background: color ?? undefined }}
											/>
										)}
										{s.name}
									</button>
								);
							})}
						</div>
					</PanelBody>
				</Panel>

				{selectedServices.length === 0 ? (
					<SharedEmptyState
						icon={GitCompare}
						title="Karşılaştırmaya başlayın"
						description="Yukarıdan en az iki servis seçtiğinizde grafik ve heatmap burada belirir."
						tone="accent"
					/>
				) : (
					<>
						<Panel>
							<PanelHeader dense>
								{METRIC_LABELS[metric]} — Son {duration}
							</PanelHeader>
							<PanelBody scroll={false}>
								<div className="h-64 sm:h-72">
									<ResponsiveContainer width="100%" height="100%">
										<LineChart data={merged}>
											<CartesianGrid stroke="var(--border-subtle)" strokeDasharray="3 3" />
											<XAxis
												dataKey="bucket"
												tickFormatter={formatBucket}
												tick={{ fill: "var(--text-faint)", fontSize: 10 }}
												stroke="var(--border-subtle)"
											/>
											<YAxis
												tick={{ fill: "var(--text-faint)", fontSize: 10 }}
												stroke="var(--border-subtle)"
												width={40}
											/>
											<Tooltip
												contentStyle={{
													background: "var(--surface-raised)",
													border: "1px solid var(--border-default)",
													borderRadius: 6,
													fontSize: 11,
												}}
												labelFormatter={formatBucket}
											/>
											{selectedServices.map((svc, i) => (
												<Line
													key={svc.id}
													type="monotone"
													dataKey={svc.id}
													name={svc.name}
													stroke={paletteColor(i)}
													strokeWidth={1.8}
													dot={false}
													isAnimationActive={false}
													connectNulls
												/>
											))}
										</LineChart>
									</ResponsiveContainer>
								</div>
							</PanelBody>
						</Panel>

						<StatusHeatmap services={selectedServices} />
					</>
				)}
			</div>
		</PageShell>
	);
}

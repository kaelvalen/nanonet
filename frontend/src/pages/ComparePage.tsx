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
	Panel,
	PanelBody,
	PanelHeader,
	seriesColor as paletteColor,
	EmptyState as SharedEmptyState,
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
			let target = byBucket.get(key);
			if (!target) {
				target = { bucket: key };
				byBucket.set(key, target);
			}
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
		if (cpu > 70 || lat > 800) return "var(--status-degraded)";
		if (cpu > 0 || lat > 0) return "var(--status-up)";
		return "var(--surface-sunken)";
	}

	return (
		<Panel padding="none">
			<PanelHeader
				dense
				actions={
					<div
						className="flex items-center gap-3 text-[10px]"
						style={{ color: "var(--text-faint)" }}
					>
						<span className="flex items-center gap-1">
							<span
								className="w-2 h-2 rounded-[2px]"
								style={{ background: "var(--status-up)" }}
							/>
							Sağlıklı
						</span>
						<span className="flex items-center gap-1">
							<span
								className="w-2 h-2 rounded-[2px]"
								style={{ background: "var(--status-degraded)" }}
							/>
							Yüklü
						</span>
						<span className="flex items-center gap-1">
							<span
								className="w-2 h-2 rounded-[2px]"
								style={{ background: "var(--status-down)" }}
							/>
							Kritik
						</span>
					</div>
				}
			>
				24 saatlik sağlık heatmap
			</PanelHeader>
			<PanelBody scroll={false}>
				<div className="overflow-x-auto">
					<table
						className="text-xs w-full border-separate"
						style={{ borderSpacing: "2px" }}
					>
						<thead>
							<tr>
								<th
									className="text-left px-2 py-1"
									style={{ color: "var(--text-faint)" }}
								/>
								{slots.map((s) => (
									<th
										key={s.toISOString()}
										className="text-[9px] font-mono tnum"
										style={{ color: "var(--text-faint)" }}
									>
										{s.getHours().toString().padStart(2, "0")}
									</th>
								))}
							</tr>
						</thead>
						<tbody>
							{services.map((svc, idx) => {
								const raw = heatQueries[idx]?.data;
								const data = Array.isArray(raw) ? raw : [];
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
														borderRadius: 2,
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

function Segmented<T extends string>({
	value,
	onChange,
	options,
	ariaLabel,
	mono,
}: {
	value: T;
	onChange: (v: T) => void;
	options: { value: T; label: string }[];
	ariaLabel: string;
	mono?: boolean;
}) {
	return (
		<div
			role="radiogroup"
			aria-label={ariaLabel}
			className="inline-flex p-0.5 gap-0.5 rounded-[6px]"
			style={{
				background: "var(--surface-sunken)",
				border: "1px solid var(--border-subtle)",
			}}
		>
			{options.map((o) => {
				const active = value === o.value;
				return (
					// biome-ignore lint/a11y/useSemanticElements: segmented control inside explicit radiogroup
					<button
						type="button"
						key={o.value}
						role="radio"
						aria-checked={active}
						onClick={() => onChange(o.value)}
						className={`text-[12px] px-2.5 h-7 rounded-[4px] transition-colors ${mono ? "font-mono tnum" : "font-medium"}`}
						style={{
							background: active ? "var(--surface-base)" : "transparent",
							color: active ? "var(--text-primary)" : "var(--text-tertiary)",
							boxShadow: active ? "0 0 0 1px var(--border-subtle)" : "none",
						}}
					>
						{o.label}
					</button>
				);
			})}
		</div>
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
					duration === "1h"
						? "1 minute"
						: duration === "6h"
							? "5 minutes"
							: "15 minutes",
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
				title="Servis karşılaştırması"
				description="2-4 servisi yan yana koyup CPU, bellek veya latency'lerini aynı eksen üzerinde inceleyin."
				meta={
					<div className="flex items-center gap-2 flex-wrap">
						<Segmented
							ariaLabel="Metrik"
							value={metric}
							onChange={(v) => setMetric(v as MetricKey)}
							options={(
								["avg_cpu", "avg_memory", "avg_latency"] as MetricKey[]
							).map((m) => ({ value: m, label: METRIC_LABELS[m] }))}
						/>
						<Segmented
							ariaLabel="Süre"
							value={duration}
							onChange={(v) => setDuration(v as "1h" | "6h" | "24h")}
							options={(["1h", "6h", "24h"] as const).map((d) => ({
								value: d,
								label: d,
							}))}
							mono
						/>
					</div>
				}
			/>

			<div className="flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col gap-4">
				<Panel padding="none">
					<PanelHeader
						dense
						actions={
							selectedIds.length > 0 ? (
								<button
									type="button"
									onClick={() => setSelectedIds([])}
									className="text-[11px] px-2 py-1 rounded-[4px] flex items-center gap-1 transition-colors hover:bg-[var(--surface-sunken)]"
									style={{ color: "var(--text-tertiary)" }}
								>
									<X className="w-3 h-3" />
									Temizle
								</button>
							) : null
						}
						icon={
							<GitCompare
								className="w-4 h-4"
								style={{ color: "var(--text-tertiary)" }}
							/>
						}
					>
						Servis seçimi
						<span
							className="text-[10px] font-normal ml-2 tnum"
							style={{ color: "var(--text-faint)" }}
						>
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
										className="text-[12px] px-2.5 h-8 rounded-[6px] font-mono flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
										style={{
											background: color
												? `color-mix(in srgb, ${color} 14%, transparent)`
												: "transparent",
											border: `1px solid ${color ?? "var(--border-subtle)"}`,
											color: color ?? "var(--text-tertiary)",
											fontWeight: active ? 600 : 500,
										}}
									>
										{active && (
											<span
												className="w-1.5 h-1.5 rounded-full"
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
						<Panel padding="none">
							<PanelHeader dense>
								{METRIC_LABELS[metric]} ·{" "}
								<span
									className="font-mono tnum ml-1"
									style={{ color: "var(--text-tertiary)" }}
								>
									son {duration}
								</span>
							</PanelHeader>
							<PanelBody scroll={false}>
								<div className="h-64 sm:h-72">
									<ResponsiveContainer width="100%" height="100%">
										<LineChart data={merged}>
											<CartesianGrid
												stroke="var(--border-subtle)"
												strokeDasharray="3 3"
												vertical={false}
											/>
											<XAxis
												dataKey="bucket"
												tickFormatter={formatBucket}
												tick={{
													fill: "var(--text-faint)",
													fontSize: 10,
													fontFamily: "var(--font-mono)",
												}}
												stroke="var(--border-subtle)"
												tickLine={false}
											/>
											<YAxis
												tick={{
													fill: "var(--text-faint)",
													fontSize: 10,
													fontFamily: "var(--font-mono)",
												}}
												stroke="var(--border-subtle)"
												width={40}
												tickLine={false}
											/>
											<Tooltip
												contentStyle={{
													background: "var(--surface-overlay)",
													border: "1px solid var(--border-subtle)",
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
													strokeWidth={1.5}
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

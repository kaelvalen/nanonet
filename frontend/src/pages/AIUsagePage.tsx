import { useQuery } from "@tanstack/react-query";
import {
	Activity,
	AlertTriangle,
	CheckCircle2,
	CircleDollarSign,
	Cpu,
	Loader2,
	Wallet,
} from "lucide-react";
import { useMemo } from "react";
import { aiUsageApi } from "@/api/aiUsage";
import { PageHeader, PageShell } from "@/components/ui/page-shell";

const fmtUSD = (n: number) =>
	new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: n < 0.01 ? 4 : 2,
		maximumFractionDigits: n < 0.01 ? 4 : 2,
	}).format(n);

const fmtInt = (n: number) => new Intl.NumberFormat("en-US").format(n);

const fmtRel = (iso: string) => {
	const t = new Date(iso).getTime();
	const diff = Date.now() - t;
	const m = Math.round(diff / 60_000);
	if (m < 1) return "az önce";
	if (m < 60) return `${m}dk önce`;
	const h = Math.round(m / 60);
	if (h < 24) return `${h}sa önce`;
	return new Date(iso).toLocaleString();
};

export function AIUsagePage() {
	const { data: summary, isLoading: sumLoading } = useQuery({
		queryKey: ["ai-usage-summary"],
		queryFn: aiUsageApi.summary,
		refetchInterval: 30_000,
	});

	const { data: recent } = useQuery({
		queryKey: ["ai-usage-recent"],
		queryFn: () => aiUsageApi.recent(50),
		refetchInterval: 30_000,
	});

	const usedPct = summary?.budget_used_pct ?? 0;
	const overBudget = usedPct >= 100;
	const nearBudget = usedPct >= 80 && !overBudget;

	const cacheRate = useMemo(() => {
		if (!summary || summary.month_call_count === 0) return 0;
		return (summary.month_cache_hits / summary.month_call_count) * 100;
	}, [summary]);

	return (
		<PageShell>
			<PageHeader
				eyebrow="AI"
				title="AI Maliyetleri"
				description="Bu ay kullanılan Claude tokenlarını ve aylık bütçenizi izleyin"
			/>

			{sumLoading ? (
				<div className="flex items-center justify-center py-20">
					<Loader2 className="size-6 animate-spin text-muted-foreground" />
				</div>
			) : (
				<>
					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
						<MetricCard
							icon={CircleDollarSign}
							label="Bu ay harcanan"
							value={fmtUSD(summary?.month_spend_usd ?? 0)}
							hint={`${fmtInt(summary?.month_call_count ?? 0)} çağrı`}
						/>
						<MetricCard
							icon={Cpu}
							label="Input tokens"
							value={fmtInt(summary?.month_input_tokens ?? 0)}
							hint="prompt'a giren"
						/>
						<MetricCard
							icon={Activity}
							label="Output tokens"
							value={fmtInt(summary?.month_output_tokens ?? 0)}
							hint="modelden dönen"
						/>
						<MetricCard
							icon={CheckCircle2}
							label="Cache hit oranı"
							value={`%${cacheRate.toFixed(0)}`}
							hint={`${fmtInt(summary?.month_cache_hits ?? 0)} hit`}
						/>
					</div>

					<div
						className="mt-4 rounded border p-5"
						style={{
							background: "var(--card-bg)",
							borderColor: "var(--border-subtle)",
						}}
					>
						<div className="flex items-center justify-between mb-3">
							<div className="flex items-center gap-2">
								<Wallet className="size-4 text-muted-foreground" />
								<span
									className="text-sm font-medium"
									style={{ color: "var(--text-primary)" }}
								>
									Aylık bütçe
								</span>
							</div>
							{summary?.budget_usd ? (
								<span
									className="text-xs"
									style={{ color: "var(--text-secondary)" }}
								>
									{fmtUSD(summary.month_spend_usd)} /{" "}
									{fmtUSD(summary.budget_usd)}
								</span>
							) : (
								<span
									className="text-xs"
									style={{ color: "var(--text-faint)" }}
								>
									Henüz bütçe ayarlanmadı — Settings → AI Analiz
								</span>
							)}
						</div>

						{summary?.budget_usd ? (
							<>
								<div
									className="h-2 w-full overflow-hidden rounded"
									style={{ background: "var(--input-bg)" }}
								>
									<div
										className="h-full transition-[width] duration-500"
										style={{
											width: `${Math.min(100, usedPct)}%`,
											background: overBudget
												? "var(--severity-critical, #ef4444)"
												: nearBudget
													? "var(--severity-warning, #f59e0b)"
													: "var(--accent-success, #22c55e)",
										}}
									/>
								</div>
								<div className="mt-2 flex items-center justify-between text-[11px]">
									<span style={{ color: "var(--text-faint)" }}>
										{summary.budget_remaining_usd != null &&
											`${fmtUSD(summary.budget_remaining_usd)} kaldı`}
									</span>
									{overBudget && (
										<span className="flex items-center gap-1 text-red-400">
											<AlertTriangle className="size-3" /> Bütçe aşıldı —
											yeni AI çağrıları engellenir
										</span>
									)}
									{nearBudget && (
										<span className="flex items-center gap-1 text-amber-400">
											<AlertTriangle className="size-3" /> Bütçeye yakın
										</span>
									)}
								</div>
							</>
						) : null}
					</div>

					<div
						className="mt-4 rounded border overflow-hidden"
						style={{
							background: "var(--card-bg)",
							borderColor: "var(--border-subtle)",
						}}
					>
						<div
							className="px-4 py-3 border-b text-xs font-medium uppercase tracking-wider"
							style={{
								color: "var(--text-secondary)",
								borderColor: "var(--border-subtle)",
							}}
						>
							Son 50 çağrı
						</div>
						{!recent || recent.length === 0 ? (
							<div
								className="p-6 text-center text-xs"
								style={{ color: "var(--text-faint)" }}
							>
								Henüz AI çağrısı kaydı yok.
							</div>
						) : (
							<div className="overflow-x-auto">
								<table className="w-full text-xs">
									<thead>
										<tr
											className="border-b text-left"
											style={{
												borderColor: "var(--border-subtle)",
												color: "var(--text-faint)",
											}}
										>
											<th className="px-4 py-2 font-medium">Zaman</th>
											<th className="px-4 py-2 font-medium">Tür</th>
											<th className="px-4 py-2 font-medium">Model</th>
											<th className="px-4 py-2 font-medium text-right">In</th>
											<th className="px-4 py-2 font-medium text-right">
												Out
											</th>
											<th className="px-4 py-2 font-medium text-right">
												Cost
											</th>
											<th className="px-4 py-2 font-medium text-right">
												Latency
											</th>
											<th className="px-4 py-2 font-medium">Cache</th>
										</tr>
									</thead>
									<tbody>
										{recent.map((row) => (
											<tr
												key={row.id}
												className="border-b last:border-0 hover:bg-[var(--surface-sunken)]"
												style={{ borderColor: "var(--border-divider)" }}
											>
												<td
													className="px-4 py-2 whitespace-nowrap"
													style={{ color: "var(--text-secondary)" }}
												>
													{fmtRel(row.created_at)}
												</td>
												<td
													className="px-4 py-2"
													style={{ color: "var(--text-secondary)" }}
												>
													{row.kind}
												</td>
												<td
													className="px-4 py-2 font-mono"
													style={{ color: "var(--text-faint)" }}
												>
													{row.model}
												</td>
												<td
													className="px-4 py-2 text-right tabular-nums"
													style={{ color: "var(--text-secondary)" }}
												>
													{fmtInt(row.input_tokens)}
												</td>
												<td
													className="px-4 py-2 text-right tabular-nums"
													style={{ color: "var(--text-secondary)" }}
												>
													{fmtInt(row.output_tokens)}
												</td>
												<td
													className="px-4 py-2 text-right tabular-nums font-medium"
													style={{ color: "var(--text-primary)" }}
												>
													{fmtUSD(row.cost_usd)}
												</td>
												<td
													className="px-4 py-2 text-right tabular-nums"
													style={{ color: "var(--text-secondary)" }}
												>
													{row.latency_ms > 0
														? `${row.latency_ms}ms`
														: "—"}
												</td>
												<td className="px-4 py-2">
													{row.cache_hit ? (
														<span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
															<CheckCircle2 className="size-3" /> hit
														</span>
													) : (
														<span
															className="text-[10px]"
															style={{ color: "var(--text-faint)" }}
														>
															miss
														</span>
													)}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
					</div>
				</>
			)}
		</PageShell>
	);
}

function MetricCard({
	icon: Icon,
	label,
	value,
	hint,
}: {
	icon: typeof Activity;
	label: string;
	value: string;
	hint?: string;
}) {
	return (
		<div
			className="rounded border p-4"
			style={{
				background: "var(--card-bg)",
				borderColor: "var(--border-subtle)",
			}}
		>
			<div className="flex items-center gap-2 text-[11px] uppercase tracking-wider">
				<Icon className="size-3.5" style={{ color: "var(--text-faint)" }} />
				<span style={{ color: "var(--text-faint)" }}>{label}</span>
			</div>
			<div
				className="mt-2 text-xl font-semibold tabular-nums"
				style={{ color: "var(--text-primary)" }}
			>
				{value}
			</div>
			{hint && (
				<div
					className="mt-1 text-[11px]"
					style={{ color: "var(--text-secondary)" }}
				>
					{hint}
				</div>
			)}
		</div>
	);
}

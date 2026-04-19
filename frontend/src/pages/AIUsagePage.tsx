import { useQuery } from "@tanstack/react-query";
import {
	Activity,
	AlertTriangle,
	CheckCircle2,
	CircleDollarSign,
	Cpu,
	Wallet,
} from "lucide-react";
import { useMemo } from "react";
import { aiUsageApi } from "@/api/aiUsage";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import {
	EmptyState,
	Panel,
	PanelHeader,
	SkeletonGrid,
	StatCard,
} from "@/components/ui/primitives";

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
		<PageShell width="wide" fill={false}>
			<PageHeader
				eyebrow="AI"
				title="AI maliyetleri"
				description="Bu ay kullanılan Claude tokenlarını ve aylık bütçenizi izleyin."
			/>

			{sumLoading ? (
				<SkeletonGrid cols={4} cells={4} />
			) : (
				<>
					<div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
						<StatCard
							icon={CircleDollarSign}
							label="Bu ay harcanan"
							value={fmtUSD(summary?.month_spend_usd ?? 0)}
							hint={`${fmtInt(summary?.month_call_count ?? 0)} çağrı`}
							tone="violet"
						/>
						<StatCard
							icon={Cpu}
							label="Input tokens"
							value={fmtInt(summary?.month_input_tokens ?? 0)}
							hint="prompt'a giren"
							tone="info"
						/>
						<StatCard
							icon={Activity}
							label="Output tokens"
							value={fmtInt(summary?.month_output_tokens ?? 0)}
							hint="modelden dönen"
							tone="accent"
						/>
						<StatCard
							icon={CheckCircle2}
							label="Cache hit oranı"
							value={`%${cacheRate.toFixed(0)}`}
							hint={`${fmtInt(summary?.month_cache_hits ?? 0)} hit`}
							tone="success"
						/>
					</div>

					<Panel padding="none" className="mt-4">
						<PanelHeader
							dense
							icon={
								<Wallet
									className="w-3.5 h-3.5"
									style={{ color: "var(--text-tertiary)" }}
								/>
							}
							actions={
								summary?.budget_usd ? (
									<span
										className="text-[12px] tnum font-mono"
										style={{ color: "var(--text-secondary)" }}
									>
										{fmtUSD(summary.month_spend_usd)} /{" "}
										{fmtUSD(summary.budget_usd)}
									</span>
								) : (
									<span
										className="text-[12px]"
										style={{ color: "var(--text-faint)" }}
									>
										Henüz bütçe ayarlanmadı
									</span>
								)
							}
						>
							Aylık bütçe
						</PanelHeader>
						<div className="px-4 py-4">
							{summary?.budget_usd ? (
								<>
									<div
										className="h-1.5 w-full overflow-hidden rounded-full"
										style={{ background: "var(--surface-sunken)" }}
									>
										<div
											className="h-full transition-[width] duration-500"
											style={{
												width: `${Math.min(100, usedPct)}%`,
												background: overBudget
													? "var(--status-down)"
													: nearBudget
														? "var(--status-degraded)"
														: "var(--status-up)",
											}}
										/>
									</div>
									<div className="mt-2.5 flex items-center justify-between text-[12px]">
										<span style={{ color: "var(--text-faint)" }}>
											{summary.budget_remaining_usd != null &&
												`${fmtUSD(summary.budget_remaining_usd)} kaldı`}
										</span>
										{overBudget && (
											<span
												className="flex items-center gap-1.5 font-medium"
												style={{ color: "var(--status-down-text)" }}
											>
												<AlertTriangle className="size-3.5" /> Bütçe aşıldı —
												yeni AI çağrıları engellenir
											</span>
										)}
										{nearBudget && (
											<span
												className="flex items-center gap-1.5 font-medium"
												style={{ color: "var(--status-degraded-text)" }}
											>
												<AlertTriangle className="size-3.5" /> Bütçeye yakın
											</span>
										)}
									</div>
								</>
							) : (
								<p
									className="text-[12px]"
									style={{ color: "var(--text-tertiary)" }}
								>
									Settings → AI analiz menüsünden aylık bütçenizi
									belirleyebilirsiniz.
								</p>
							)}
						</div>
					</Panel>

					<Panel padding="none" className="mt-4 overflow-hidden">
						<PanelHeader dense>Son 50 çağrı</PanelHeader>
						{!recent || recent.length === 0 ? (
							<EmptyState
								icon={Activity}
								title="Henüz AI çağrısı kaydı yok"
								description="Sistem AI çağrıları yaptıkça burada listeleneceklerdir."
								tone="muted"
								size="md"
							/>
						) : (
							<div className="overflow-x-auto">
								<table className="w-full text-[12px]">
									<thead>
										<tr
											className="text-left"
											style={{
												borderBottom: "1px solid var(--border-subtle)",
												color: "var(--text-faint)",
											}}
										>
											<th className="px-4 py-2 font-medium uppercase tracking-wider text-[10px]">
												Zaman
											</th>
											<th className="px-4 py-2 font-medium uppercase tracking-wider text-[10px]">
												Tür
											</th>
											<th className="px-4 py-2 font-medium uppercase tracking-wider text-[10px]">
												Model
											</th>
											<th className="px-4 py-2 font-medium uppercase tracking-wider text-[10px] text-right">
												In
											</th>
											<th className="px-4 py-2 font-medium uppercase tracking-wider text-[10px] text-right">
												Out
											</th>
											<th className="px-4 py-2 font-medium uppercase tracking-wider text-[10px] text-right">
												Cost
											</th>
											<th className="px-4 py-2 font-medium uppercase tracking-wider text-[10px] text-right">
												Latency
											</th>
											<th className="px-4 py-2 font-medium uppercase tracking-wider text-[10px]">
												Cache
											</th>
										</tr>
									</thead>
									<tbody>
										{recent.map((row) => (
											<tr
												key={row.id}
												className="hover:bg-[var(--surface-sunken)] transition-colors"
												style={{
													borderTop: "1px solid var(--border-subtle)",
												}}
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
													className="px-4 py-2 font-mono text-[11px]"
													style={{ color: "var(--text-tertiary)" }}
												>
													{row.model}
												</td>
												<td
													className="px-4 py-2 text-right tnum"
													style={{ color: "var(--text-secondary)" }}
												>
													{fmtInt(row.input_tokens)}
												</td>
												<td
													className="px-4 py-2 text-right tnum"
													style={{ color: "var(--text-secondary)" }}
												>
													{fmtInt(row.output_tokens)}
												</td>
												<td
													className="px-4 py-2 text-right tnum font-medium"
													style={{ color: "var(--text-primary)" }}
												>
													{fmtUSD(row.cost_usd)}
												</td>
												<td
													className="px-4 py-2 text-right tnum"
													style={{ color: "var(--text-secondary)" }}
												>
													{row.latency_ms > 0 ? `${row.latency_ms}ms` : "—"}
												</td>
												<td className="px-4 py-2">
													{row.cache_hit ? (
														<span
															className="inline-flex items-center gap-1 rounded-[4px] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
															style={{
																background: "var(--status-up-subtle)",
																color: "var(--status-up-text)",
															}}
														>
															<CheckCircle2 className="size-3" /> hit
														</span>
													) : (
														<span
															className="text-[11px]"
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
					</Panel>
				</>
			)}
		</PageShell>
	);
}

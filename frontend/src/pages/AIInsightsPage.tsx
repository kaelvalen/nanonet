import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	AlertTriangle,
	BarChart3,
	Brain,
	CheckCircle2,
	ChevronDown,
	ChevronRight,
	Clock,
	Eye,
	Lightbulb,
	RefreshCw,
	Search,
	Server,
	Sparkles,
	Target,
	TrendingUp,
	Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { type AIInsight, type AnalysisResult, metricsApi } from "@/api/metrics";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useServices } from "@/hooks/useServices";

/* ── Thinking dots animation ─────────────────────────────────────── */
function ThinkingDots() {
	return (
		<div className="flex items-center gap-1.5">
			{[0, 0.2, 0.4].map((d) => (
				<span
					key={d}
					className="w-2 h-2 rounded-full animate-bounce"
					style={{
						background: "var(--color-lavender)",
						animationDelay: `${d}s`,
					}}
				/>
			))}
		</div>
	);
}

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

function priorityStyle(p: string) {
	if (p === "high")
		return {
			bg: "var(--status-down-subtle)",
			text: "var(--status-down-text)",
			border: "var(--status-down-border)",
		};
	if (p === "medium")
		return {
			bg: "var(--status-warn-subtle)",
			text: "var(--status-warn-text)",
			border: "var(--status-warn-border)",
		};
	return {
		bg: "var(--color-teal-subtle)",
		text: "var(--color-teal)",
		border: "var(--color-teal-border)",
	};
}

function PriorityBadge({ priority }: { priority: string }) {
	const s = priorityStyle(priority);
	const labels: Record<string, string> = {
		high: "Yüksek",
		medium: "Orta",
		low: "Düşük",
	};
	return (
		<span
			className="text-[10px] font-medium px-1.5 py-0.5 rounded-md"
			style={{
				background: s.bg,
				color: s.text,
				border: `1px solid ${s.border}`,
			}}
		>
			{labels[priority] ?? priority}
		</span>
	);
}

export function AIInsightsPage() {
	const queryClient = useQueryClient();
	const { services } = useServices();

	const [selectedServiceId, setSelectedServiceId] = useState<string>("all");
	const [search, setSearch] = useState("");
	const [priorityFilter, setPriorityFilter] = useState<
		"all" | "high" | "medium" | "low"
	>("all");
	const [page, setPage] = useState(0);
	const PAGE_SIZE = 10;
	const [expandedInsight, setExpandedInsight] = useState<string | null>(null);

	const [analyzeServiceId, setAnalyzeServiceId] = useState<string>("");
	const [deepAnalysis, setDeepAnalysis] = useState(false);
	const [liveResult, setLiveResult] = useState<AnalysisResult | null>(null);

	const { data: insightsData, isLoading } = useQuery({
		queryKey: ["insights", selectedServiceId, page],
		queryFn: () =>
			selectedServiceId === "all"
				? metricsApi.getAllInsights(20)
				: metricsApi.getInsights(selectedServiceId, page + 1),
		enabled: selectedServiceId === "all" || !!selectedServiceId,
	});

	const allInsights: AIInsight[] = insightsData?.insights ?? [];
	const totalInsights = insightsData?.total ?? 0;

	const filtered = useMemo(() => {
		return allInsights
			.filter((ins) => {
				const matchSearch =
					!search ||
					ins.summary.toLowerCase().includes(search.toLowerCase()) ||
					(ins.root_cause ?? "").toLowerCase().includes(search.toLowerCase());
				const topPriority = ins.recommendations?.[0]?.priority ?? "low";
				const matchPriority =
					priorityFilter === "all" || topPriority === priorityFilter;
				return matchSearch && matchPriority;
			})
			.sort((a, b) => {
				const pa =
					PRIORITY_ORDER[a.recommendations?.[0]?.priority ?? "low"] ?? 2;
				const pb =
					PRIORITY_ORDER[b.recommendations?.[0]?.priority ?? "low"] ?? 2;
				return (
					pa - pb ||
					new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
				);
			});
	}, [allInsights, search, priorityFilter]);

	const statHigh = allInsights.filter(
		(i) => i.recommendations?.[0]?.priority === "high",
	).length;
	const statMedium = allInsights.filter(
		(i) => i.recommendations?.[0]?.priority === "medium",
	).length;
	const statLow = allInsights.filter(
		(i) => !i.recommendations?.[0] || i.recommendations[0].priority === "low",
	).length;

	const analyzeMutation = useMutation({
		mutationFn: () => metricsApi.analyze(analyzeServiceId, 30, deepAnalysis),
		onSuccess: (result) => {
			setLiveResult(result);
			toast.success("AI analiz tamamlandı");
			queryClient.invalidateQueries({ queryKey: ["insights"] });
		},
		onError: () => toast.error("AI analiz başarısız oldu"),
	});

	const confPct = Math.round((liveResult?.confidence ?? 0) * 100);
	const r = 20;
	const circ = 2 * Math.PI * r;
	const confOffset = circ - (confPct / 100) * circ;

	return (
		<div className="space-y-4">
			{/* ── Page header ─────────────────────────────────────────── */}
			<motion.div
				className="flex items-start justify-between gap-4"
				initial={{ opacity: 0, y: -6 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.25 }}
			>
				<div>
					<h1
						className="text-lg font-bold leading-none"
						style={{ color: "var(--text-primary)" }}
					>
						AI İçgörüler
					</h1>
					<p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
						Claude AI destekli servis analizi ve önerileri
					</p>
				</div>
			</motion.div>

			{/* ── Stat tiles ─────────────────────────────────────────── */}
			<motion.div
				className="grid grid-cols-2 sm:grid-cols-4 gap-3"
				initial={{ opacity: 0, y: 8 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.3 }}
			>
				{(
					[
						{
							label: "Toplam İçgörü",
							value: totalInsights,
							icon: BarChart3,
							color: "var(--color-lavender)",
							bg: "var(--color-lavender-subtle)",
							border: "var(--color-lavender-border)",
						},
						{
							label: "Yüksek Öncelik",
							value: statHigh,
							icon: AlertTriangle,
							color: "var(--status-down)",
							bg: "var(--status-down-subtle)",
							border: "var(--status-down-border)",
						},
						{
							label: "Orta Öncelik",
							value: statMedium,
							icon: TrendingUp,
							color: "var(--status-warn)",
							bg: "var(--status-warn-subtle)",
							border: "var(--status-warn-border)",
						},
						{
							label: "Düşük Öncelik",
							value: statLow,
							icon: CheckCircle2,
							color: "var(--status-up)",
							bg: "var(--status-up-subtle)",
							border: "var(--status-up-border)",
						},
					] as const
				).map(({ label, value, icon: Icon, color, bg, border }) => (
					<Card
						key={label}
						className="relative overflow-hidden px-4 py-3.5"
						style={{ background: bg, border: `1px solid ${border}` }}
					>
						<div
							className="absolute left-0 top-3 bottom-3 w-0.5 rounded-r-full"
							style={{ background: color }}
						/>
						<div className="flex items-center justify-between">
							<div>
								<p
									className="text-[11px] font-medium mb-1"
									style={{ color: "var(--text-faint)" }}
								>
									{label}
								</p>
								<p
									className="text-3xl font-bold tabular-nums leading-none"
									style={{ color }}
								>
									{value}
								</p>
							</div>
							<div
								className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
								style={{
									background: "var(--surface-card)",
									border: `1px solid ${border}`,
								}}
							>
								<Icon className="w-4 h-4" style={{ color }} />
							</div>
						</div>
					</Card>
				))}
			</motion.div>

			{/* ── 2-column layout ────────────────────────────────────── */}
			<div className="grid grid-cols-12 gap-4">
				{/* ── LEFT: Analyze panel ──────────────────────────── */}
				<motion.div
					className="col-span-12 lg:col-span-4"
					initial={{ opacity: 0, x: -10 }}
					animate={{ opacity: 1, x: 0 }}
					transition={{ duration: 0.35, delay: 0.1 }}
				>
					<Card
						className="flex flex-col overflow-hidden"
						style={{
							background: "var(--surface-card)",
							border: "1px solid var(--color-lavender-border)",
						}}
					>
						{/* Top accent */}
						<div
							className="h-0.5 shrink-0"
							style={{ background: "var(--gradient-btn-primary)" }}
						/>

						<div className="p-5 space-y-5 flex flex-col">
							{/* Panel title */}
							<div className="flex items-center gap-2.5">
								<div
									className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
									style={{
										background: "var(--color-lavender-subtle)",
										border: "1px solid var(--color-lavender-border)",
									}}
								>
									<Brain
										className="w-4 h-4"
										style={{ color: "var(--color-lavender)" }}
									/>
								</div>
								<div>
									<p
										className="text-sm font-bold leading-none"
										style={{ color: "var(--text-primary)" }}
									>
										AI Analiz
									</p>
									<p
										className="text-[10px] mt-0.5"
										style={{ color: "var(--text-faint)" }}
									>
										Servis bazlı derin analiz
									</p>
								</div>
							</div>

							{/* Service selector */}
							<div className="space-y-2">
								<p
									className="text-[11px] font-semibold uppercase tracking-wider"
									style={{ color: "var(--text-faint)" }}
								>
									Servis
								</p>
								<Select
									value={analyzeServiceId}
									onValueChange={setAnalyzeServiceId}
								>
									<SelectTrigger
										className="w-full text-sm h-9"
										style={{
											borderColor: "var(--color-lavender-border)",
											background: "var(--surface-sunken)",
										}}
									>
										<SelectValue placeholder="Servis seçin..." />
									</SelectTrigger>
									<SelectContent>
										{services.map((s) => (
											<SelectItem key={s.id} value={s.id} className="text-sm">
												<span className="flex items-center gap-1.5">
													<Server className="w-3 h-3" />
													{s.name}
												</span>
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							{/* Mode toggle */}
							<div className="space-y-2">
								<p
									className="text-[11px] font-semibold uppercase tracking-wider"
									style={{ color: "var(--text-faint)" }}
								>
									Analiz Modu
								</p>
								<div className="grid grid-cols-2 gap-2">
									{(
										[
											{ label: "Hızlı", val: false, desc: "~30 sn" },
											{ label: "Derin", val: true, desc: "~2 dk" },
										] as const
									).map(({ label, val, desc }) => (
										<button
											key={label}
											type="button"
											onClick={() => setDeepAnalysis(val)}
											className="flex flex-col items-start px-3 py-2.5 rounded-xl text-left transition-all"
											style={
												deepAnalysis === val
													? {
															background: "var(--color-lavender-subtle)",
															border:
																"1.5px solid var(--color-lavender-border)",
															color: "var(--color-lavender)",
														}
													: {
															background: "var(--surface-sunken)",
															border: "1.5px solid var(--border-subtle)",
															color: "var(--text-muted)",
														}
											}
										>
											<span className="text-xs font-semibold">{label}</span>
											<span className="text-[10px] mt-0.5 opacity-70">
												{desc}
											</span>
										</button>
									))}
								</div>
							</div>

							{/* Analyze button */}
							<Button
								onClick={() => analyzeMutation.mutate()}
								disabled={analyzeMutation.isPending || !analyzeServiceId}
								className="w-full text-white h-10 text-sm font-semibold"
								style={{ background: "var(--gradient-btn-primary)" }}
							>
								{analyzeMutation.isPending ? (
									<span className="flex items-center gap-2">
										<RefreshCw className="w-4 h-4 animate-spin" />
										Analiz ediliyor...
									</span>
								) : (
									<span className="flex items-center gap-2">
										<Zap className="w-4 h-4" />
										Analiz Başlat
									</span>
								)}
							</Button>

							{/* Thinking animation */}
							{analyzeMutation.isPending && (
								<div className="flex flex-col gap-3 pt-1">
									<div className="flex items-center gap-2.5">
										<ThinkingDots />
										<span
											className="text-xs"
											style={{ color: "var(--color-lavender)" }}
										>
											Model yanıt üretiyor...
										</span>
									</div>
									<div className="space-y-2">
										{[75, 55, 85, 40, 65].map((w) => (
											<div
												key={w}
												className="h-1.5 rounded-full animate-pulse"
												style={{
													width: `${w}%`,
													background: "var(--color-lavender-subtle)",
												}}
											/>
										))}
									</div>
								</div>
							)}

							{/* Idle placeholder — only shown when no result and not analyzing */}
							{!liveResult && !analyzeMutation.isPending && (
								<div
									className="rounded-xl px-4 py-5 flex flex-col items-center gap-3 text-center"
									style={{
										background: "var(--surface-sunken)",
										border: "1px solid var(--border-subtle)",
									}}
								>
									<div
										className="w-10 h-10 rounded-xl flex items-center justify-center"
										style={{
											background: "var(--color-lavender-subtle)",
											border: "1px solid var(--color-lavender-border)",
										}}
									>
										<Sparkles
											className="w-5 h-5"
											style={{ color: "var(--color-lavender)" }}
										/>
									</div>
									<div>
										<p
											className="text-xs font-semibold mb-1"
											style={{ color: "var(--text-secondary)" }}
										>
											Analiz yapmaya hazır
										</p>
										<p
											className="text-[11px] leading-relaxed"
											style={{ color: "var(--text-faint)" }}
										>
											Servis seçip mod belirledikten sonra analiz başlatın.
											Sonuçlar burada görünür.
										</p>
									</div>
									<div className="w-full space-y-1.5">
										{["Kök neden tespiti", "Öneri listesi", "Güven skoru"].map(
											(feat) => (
												<div
													key={feat}
													className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
													style={{ background: "var(--surface-card)" }}
												>
													<CheckCircle2
														className="w-3 h-3 shrink-0"
														style={{ color: "var(--color-lavender)" }}
													/>
													<span
														className="text-[11px]"
														style={{ color: "var(--text-muted)" }}
													>
														{feat}
													</span>
												</div>
											),
										)}
									</div>
								</div>
							)}

							{/* Live result */}
							<AnimatePresence>
								{liveResult && !analyzeMutation.isPending && (
									<motion.div
										key="live"
										initial={{ opacity: 0, y: 8 }}
										animate={{ opacity: 1, y: 0 }}
										exit={{ opacity: 0 }}
										className="flex flex-col space-y-3 pt-1"
									>
										{/* Confidence ring */}
										{liveResult.confidence !== undefined && (
											<div
												className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
												style={{
													background: "var(--color-lavender-subtle)",
													border: "1px solid var(--color-lavender-border)",
												}}
											>
												<div className="relative shrink-0">
													<svg
														width="44"
														height="44"
														className="-rotate-90"
														aria-hidden="true"
													>
														<circle
															cx="22"
															cy="22"
															r={r}
															fill="none"
															stroke="var(--border-subtle)"
															strokeWidth="3"
														/>
														<circle
															cx="22"
															cy="22"
															r={r}
															fill="none"
															stroke="var(--color-lavender)"
															strokeWidth="3"
															strokeDasharray={circ}
															strokeDashoffset={confOffset}
															strokeLinecap="round"
															style={{
																transition: "stroke-dashoffset 1s ease",
															}}
														/>
													</svg>
													<span
														className="absolute inset-0 flex items-center justify-center text-[10px] font-bold"
														style={{ color: "var(--color-lavender)" }}
													>
														{confPct}%
													</span>
												</div>
												<div>
													<p
														className="text-xs font-semibold"
														style={{ color: "var(--text-secondary)" }}
													>
														Güven Skoru
													</p>
													<p
														className="text-[10px]"
														style={{ color: "var(--text-faint)" }}
													>
														{confPct >= 80
															? "Yüksek güven"
															: confPct >= 60
																? "Orta güven"
																: "Düşük güven"}{" "}
														· {deepAnalysis ? "Derin" : "Hızlı"} mod
													</p>
												</div>
											</div>
										)}

										{/* Summary */}
										<div
											className="p-3 rounded-xl"
											style={{ background: "var(--surface-sunken)" }}
										>
											<p
												className="text-[10px] font-bold uppercase tracking-wider mb-1.5"
												style={{ color: "var(--text-faint)" }}
											>
												Özet
											</p>
											<p
												className="text-xs leading-relaxed"
												style={{ color: "var(--text-secondary)" }}
											>
												{liveResult.summary}
											</p>
										</div>

										{/* Root cause */}
										{liveResult.root_cause && (
											<div
												className="p-3 rounded-xl"
												style={{
													background: "var(--status-down-subtle)",
													border: "1px solid var(--status-down-border)",
												}}
											>
												<div className="flex items-center gap-1.5 mb-1.5">
													<Target
														className="w-3.5 h-3.5"
														style={{ color: "var(--status-down)" }}
													/>
													<p
														className="text-[10px] font-bold uppercase tracking-wider"
														style={{ color: "var(--status-down-text)" }}
													>
														Kök Neden
													</p>
												</div>
												<p
													className="text-xs leading-relaxed"
													style={{ color: "var(--text-secondary)" }}
												>
													{liveResult.root_cause}
												</p>
											</div>
										)}

										{/* Recommendations */}
										{liveResult.recommendations &&
											liveResult.recommendations.length > 0 && (
												<div
													className="p-3 rounded-xl"
													style={{
														background: "var(--color-teal-subtle)",
														border: "1px solid var(--color-teal-border)",
													}}
												>
													<div className="flex items-center gap-1.5 mb-2">
														<Lightbulb
															className="w-3.5 h-3.5"
															style={{ color: "var(--color-teal)" }}
														/>
														<p
															className="text-[10px] font-bold uppercase tracking-wider"
															style={{ color: "var(--color-teal)" }}
														>
															Öneriler
														</p>
													</div>
													<ul className="space-y-2">
														{liveResult.recommendations.map((rec) => (
															<li
																key={rec.action}
																className="flex items-start gap-2"
															>
																<PriorityBadge priority={rec.priority} />
																<span
																	className="text-xs leading-relaxed"
																	style={{ color: "var(--text-secondary)" }}
																>
																	{rec.action}
																</span>
															</li>
														))}
													</ul>
												</div>
											)}
									</motion.div>
								)}
							</AnimatePresence>
						</div>
					</Card>
				</motion.div>

				{/* ── RIGHT: Insights feed ─────────────────────────── */}
				<motion.div
					className="col-span-12 lg:col-span-8 flex flex-col gap-3"
					initial={{ opacity: 0, x: 10 }}
					animate={{ opacity: 1, x: 0 }}
					transition={{ duration: 0.35, delay: 0.15 }}
				>
					{/* Filter bar */}
					<div className="flex flex-col sm:flex-row gap-2">
						<Select
							value={selectedServiceId}
							onValueChange={(v) => {
								setSelectedServiceId(v);
								setPage(0);
							}}
						>
							<SelectTrigger
								className="w-44 text-sm h-9 shrink-0"
								style={{
									background: "var(--surface-card)",
									borderColor: "var(--border-default)",
								}}
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all" className="text-sm">
									Tüm Servisler
								</SelectItem>
								{services.map((s) => (
									<SelectItem key={s.id} value={s.id} className="text-sm">
										<span className="flex items-center gap-1.5">
											<Server className="w-3 h-3" />
											{s.name}
										</span>
									</SelectItem>
								))}
							</SelectContent>
						</Select>

						<div className="relative flex-1">
							<Search
								className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2"
								style={{ color: "var(--text-faint)" }}
							/>
							<Input
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								placeholder="Özet veya kök neden ara..."
								className="pl-9 h-9 text-sm"
								style={{
									background: "var(--surface-card)",
									borderColor: "var(--border-default)",
								}}
							/>
						</div>

						<div
							className="flex items-center gap-0.5 px-1 rounded-lg shrink-0"
							style={{
								background: "var(--surface-card)",
								border: "1px solid var(--border-default)",
							}}
						>
							{(["all", "high", "medium", "low"] as const).map((p) => {
								const labels = {
									all: "Tümü",
									high: "Yüksek",
									medium: "Orta",
									low: "Düşük",
								};
								const s = p !== "all" ? priorityStyle(p) : null;
								return (
									<button
										key={p}
										type="button"
										onClick={() => setPriorityFilter(p)}
										className="px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors"
										style={
											priorityFilter === p
												? s
													? { background: s.bg, color: s.text }
													: {
															background: "var(--color-lavender-subtle)",
															color: "var(--color-lavender)",
														}
												: { color: "var(--text-muted)" }
										}
									>
										{labels[p]}
									</button>
								);
							})}
						</div>
					</div>

					{/* Feed */}
					{services.length === 0 ? (
						<EmptyState
							icon={Sparkles}
							title="Servis bulunamadı"
							description="Önce bir servis ekleyin."
						/>
					) : isLoading ? (
						<div className="space-y-2">
							{[1, 2, 3, 4].map((i) => (
								<Card
									key={i}
									className="px-4 py-3.5 animate-pulse"
									style={{
										background: "var(--surface-card)",
										border: "1px solid var(--border-default)",
									}}
								>
									<div
										className="h-3.5 w-3/4 rounded mb-2"
										style={{ background: "var(--surface-sunken)" }}
									/>
									<div
										className="h-2.5 w-1/2 rounded"
										style={{ background: "var(--surface-sunken)" }}
									/>
								</Card>
							))}
						</div>
					) : filtered.length === 0 ? (
						<EmptyState
							icon={Brain}
							title={
								search || priorityFilter !== "all"
									? "Sonuç bulunamadı"
									: "Henüz AI içgörüsü yok"
							}
							description={
								search || priorityFilter !== "all"
									? "Filtre kriterlerini değiştirin."
									: "Sol panelden analiz başlatın."
							}
						/>
					) : (
						<>
							<div className="space-y-2">
								<AnimatePresence mode="popLayout">
									{filtered.map((insight: AIInsight, index: number) => {
										const topPriority =
											insight.recommendations?.[0]?.priority ?? "low";
										const ps = priorityStyle(topPriority);
										const isExpanded = expandedInsight === insight.id;
										return (
											<motion.div
												key={insight.id}
												initial={{ opacity: 0, y: 6 }}
												animate={{ opacity: 1, y: 0 }}
												exit={{ opacity: 0, scale: 0.98 }}
												transition={{ duration: 0.18, delay: index * 0.03 }}
												layout
											>
												<Card
													className="overflow-hidden"
													style={{
														background: "var(--surface-card)",
														border: "1px solid var(--border-default)",
														borderLeft: `3px solid ${ps.text}`,
													}}
												>
													<button
														type="button"
														className="w-full px-4 py-3.5 text-left hover:opacity-90 transition-opacity"
														onClick={() =>
															setExpandedInsight(isExpanded ? null : insight.id)
														}
													>
														<div className="flex items-start justify-between gap-3">
															<div className="flex items-start gap-3 min-w-0">
																<div
																	className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
																	style={{
																		background: ps.bg,
																		border: `1px solid ${ps.border}`,
																	}}
																>
																	<Sparkles
																		className="w-3.5 h-3.5"
																		style={{ color: ps.text }}
																	/>
																</div>
																<div className="min-w-0">
																	<p
																		className="text-sm leading-snug line-clamp-2 font-medium"
																		style={{ color: "var(--text-secondary)" }}
																	>
																		{insight.summary}
																	</p>
																	<div className="flex items-center gap-2 mt-1.5 flex-wrap">
																		<span
																			className="text-[11px] flex items-center gap-1"
																			style={{ color: "var(--text-faint)" }}
																		>
																			<Clock className="w-3 h-3" />
																			{new Date(
																				insight.created_at,
																			).toLocaleString("tr-TR", {
																				dateStyle: "short",
																				timeStyle: "short",
																			})}
																		</span>
																		<span
																			className="text-[10px] px-1.5 py-0.5 rounded-md font-mono"
																			style={{
																				background:
																					"var(--color-lavender-subtle)",
																				color: "var(--color-lavender)",
																				border:
																					"1px solid var(--color-lavender-border)",
																			}}
																		>
																			{insight.model}
																		</span>
																		<PriorityBadge priority={topPriority} />
																		{insight.recommendations &&
																			insight.recommendations.length > 0 && (
																				<span
																					className="text-[10px] flex items-center gap-1"
																					style={{ color: "var(--text-faint)" }}
																				>
																					<Eye className="w-2.5 h-2.5" />
																					{insight.recommendations.length} öneri
																				</span>
																			)}
																	</div>
																</div>
															</div>
															{isExpanded ? (
																<ChevronDown
																	className="w-4 h-4 shrink-0 mt-1"
																	style={{ color: "var(--text-faint)" }}
																/>
															) : (
																<ChevronRight
																	className="w-4 h-4 shrink-0 mt-1"
																	style={{ color: "var(--text-faint)" }}
																/>
															)}
														</div>
													</button>

													<AnimatePresence>
														{isExpanded && (
															<motion.div
																initial={{ height: 0, opacity: 0 }}
																animate={{ height: "auto", opacity: 1 }}
																exit={{ height: 0, opacity: 0 }}
																transition={{ duration: 0.2 }}
																className="px-4 pb-4 pt-3 space-y-3"
																style={{
																	borderTop: "1px solid var(--border-subtle)",
																}}
															>
																{insight.root_cause && (
																	<div
																		className="p-3 rounded-xl"
																		style={{
																			background: "var(--status-down-subtle)",
																			border:
																				"1px solid var(--status-down-border)",
																		}}
																	>
																		<div className="flex items-center gap-1.5 mb-1.5">
																			<Target
																				className="w-3.5 h-3.5"
																				style={{ color: "var(--status-down)" }}
																			/>
																			<span
																				className="text-[10px] font-bold uppercase tracking-wider"
																				style={{
																					color: "var(--status-down-text)",
																				}}
																			>
																				Kök Neden
																			</span>
																		</div>
																		<p
																			className="text-sm leading-relaxed"
																			style={{ color: "var(--text-secondary)" }}
																		>
																			{insight.root_cause}
																		</p>
																	</div>
																)}
																{insight.recommendations &&
																	insight.recommendations.length > 0 && (
																		<div
																			className="p-3 rounded-xl"
																			style={{
																				background: "var(--color-teal-subtle)",
																				border:
																					"1px solid var(--color-teal-border)",
																			}}
																		>
																			<div className="flex items-center gap-1.5 mb-2">
																				<Lightbulb
																					className="w-3.5 h-3.5"
																					style={{ color: "var(--color-teal)" }}
																				/>
																				<span
																					className="text-[10px] font-bold uppercase tracking-wider"
																					style={{ color: "var(--color-teal)" }}
																				>
																					Öneriler
																				</span>
																			</div>
																			<ul className="space-y-2">
																				{insight.recommendations.map((rec) => (
																					<li
																						key={rec.action}
																						className="flex items-start gap-2"
																					>
																						<PriorityBadge
																							priority={rec.priority}
																						/>
																						<span
																							className="text-xs leading-relaxed"
																							style={{
																								color: "var(--text-secondary)",
																							}}
																						>
																							{rec.action}
																						</span>
																					</li>
																				))}
																			</ul>
																		</div>
																	)}
															</motion.div>
														)}
													</AnimatePresence>
												</Card>
											</motion.div>
										);
									})}
								</AnimatePresence>
							</div>

							{/* Pagination */}
							{totalInsights > PAGE_SIZE && (
								<div className="flex items-center justify-between pt-1">
									<Button
										size="sm"
										variant="outline"
										onClick={() => setPage((p) => Math.max(0, p - 1))}
										disabled={page === 0}
										className="text-xs h-8"
									>
										Önceki
									</Button>
									<span
										className="text-xs"
										style={{ color: "var(--text-faint)" }}
									>
										{page + 1} / {Math.ceil(totalInsights / PAGE_SIZE)} ·{" "}
										{totalInsights} kayıt
									</span>
									<Button
										size="sm"
										variant="outline"
										onClick={() => setPage((p) => p + 1)}
										disabled={(page + 1) * PAGE_SIZE >= totalInsights}
										className="text-xs h-8"
									>
										Sonraki
									</Button>
								</div>
							)}
						</>
					)}
				</motion.div>
			</div>
		</div>
	);
}

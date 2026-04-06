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
	const r = 22;
	const circ = 2 * Math.PI * r;
	const confOffset = circ - (confPct / 100) * circ;

	return (
		<div className="space-y-5">
			{/* Stats row */}
			{allInsights.length > 0 && (
				<motion.div
					initial={{ opacity: 0, y: 8 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.35, delay: 0.05 }}
					className="grid grid-cols-2 sm:grid-cols-4 gap-3"
				>
					{[
						{
							label: "Toplam",
							value: totalInsights,
							icon: BarChart3,
							color: "var(--color-lavender)",
							bg: "var(--color-lavender-subtle)",
							border: "var(--color-lavender-border)",
						},
						{
							label: "Yüksek",
							value: statHigh,
							icon: AlertTriangle,
							color: "var(--status-down)",
							bg: "var(--status-down-subtle)",
							border: "var(--status-down-border)",
						},
						{
							label: "Orta",
							value: statMedium,
							icon: TrendingUp,
							color: "var(--status-warn)",
							bg: "var(--status-warn-subtle)",
							border: "var(--status-warn-border)",
						},
						{
							label: "Düşük",
							value: statLow,
							icon: CheckCircle2,
							color: "var(--status-up)",
							bg: "var(--status-up-subtle)",
							border: "var(--status-up-border)",
						},
					].map(({ label, value, icon: Icon, color, bg, border }) => (
						<Card
							key={label}
							className="p-4"
							style={{ background: bg, border: `1px solid ${border}` }}
						>
							<div className="flex items-center gap-2 mb-1.5">
								<Icon className="w-3.5 h-3.5 shrink-0" style={{ color }} />
								<p
									className="text-xs font-medium"
									style={{ color: "var(--text-muted)" }}
								>
									{label}
								</p>
							</div>
							<p className="text-2xl font-bold tabular-nums" style={{ color }}>
								{value}
							</p>
						</Card>
					))}
				</motion.div>
			)}

			{/* Analyze panel */}
			<motion.div
				initial={{ opacity: 0, y: 8 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.35, delay: 0.1 }}
			>
				<Card
					className="p-4"
					style={{
						background: "var(--surface-card)",
						border: "1px solid var(--color-lavender-border)",
					}}
				>
					<div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
						<div className="flex items-center gap-2 shrink-0">
							<Brain
								className="w-4 h-4"
								style={{ color: "var(--color-lavender)" }}
							/>
							<span
								className="text-sm font-semibold"
								style={{ color: "var(--text-primary)" }}
							>
								Analiz Başlat
							</span>
						</div>
						<div className="flex flex-1 items-center gap-2 flex-wrap">
							<Select
								value={analyzeServiceId}
								onValueChange={setAnalyzeServiceId}
							>
								<SelectTrigger
									className="w-44 text-sm h-8"
									style={{ borderColor: "var(--input-border)" }}
								>
									<SelectValue placeholder="Servis seçin..." />
								</SelectTrigger>
								<SelectContent>
									{services.map((s) => (
										<SelectItem key={s.id} value={s.id} className="text-sm">
											{s.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>

							{/* Quick / Deep toggle */}
							<div
								className="flex rounded-lg overflow-hidden"
								style={{ border: "1px solid var(--color-lavender-border)" }}
							>
								{[
									{ label: "Hızlı", value: false },
									{ label: "Derin", value: true },
								].map(({ label, value }) => (
									<button
										key={label}
										type="button"
										onClick={() => setDeepAnalysis(value)}
										className="px-3 py-1.5 text-xs font-medium transition-colors"
										style={
											deepAnalysis === value
												? {
														background: "var(--color-lavender-subtle)",
														color: "var(--color-lavender)",
													}
												: { color: "var(--text-muted)" }
										}
									>
										{label}
									</button>
								))}
							</div>

							<Button
								onClick={() => analyzeMutation.mutate()}
								disabled={analyzeMutation.isPending || !analyzeServiceId}
								className="text-white text-xs h-8 ml-auto"
								style={{ background: "var(--gradient-btn-primary)" }}
							>
								{analyzeMutation.isPending ? (
									<>
										<RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />{" "}
										Analiz ediliyor...
									</>
								) : (
									<>
										<Zap className="w-3.5 h-3.5 mr-1.5" /> Analiz Et
									</>
								)}
							</Button>
						</div>
					</div>
				</Card>
			</motion.div>

			{/* Analyzing skeleton */}
			{analyzeMutation.isPending && (
				<Card
					className="p-5 space-y-3"
					style={{
						background: "var(--surface-card)",
						border: "1px solid var(--color-lavender-border)",
					}}
				>
					<div className="flex items-center gap-2">
						<Brain
							className="w-4 h-4 animate-pulse"
							style={{ color: "var(--color-lavender)" }}
						/>
						<div
							className="h-3 w-40 rounded animate-pulse"
							style={{ background: "var(--color-lavender-subtle)" }}
						/>
					</div>
					{[80, 55, 90, 40].map((w) => (
						<div
							key={w}
							className="h-2 rounded animate-pulse"
							style={{
								width: `${w}%`,
								background: "var(--color-lavender-subtle)",
							}}
						/>
					))}
				</Card>
			)}

			{/* Live result */}
			<AnimatePresence>
				{liveResult && !analyzeMutation.isPending && (
					<motion.div
						key="live-result"
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -8 }}
					>
						<Card
							className="overflow-hidden"
							style={{
								background: "var(--surface-card)",
								border: "1px solid var(--color-lavender-border)",
							}}
						>
							<div
								className="h-0.5"
								style={{ background: "var(--gradient-btn-primary)" }}
							/>
							<div className="p-5 space-y-4">
								{/* Header row */}
								<div className="flex items-center gap-3">
									<div
										className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
										style={{
											background: "var(--color-lavender-subtle)",
											border: "1px solid var(--color-lavender-border)",
										}}
									>
										<Brain
											className="w-4.5 h-4.5"
											style={{ color: "var(--color-lavender)" }}
										/>
									</div>
									<div className="flex-1">
										<p
											className="text-sm font-semibold"
											style={{ color: "var(--text-primary)" }}
										>
											Analiz Sonucu
										</p>
										<p
											className="text-xs"
											style={{ color: "var(--text-faint)" }}
										>
											{deepAnalysis ? "Derin analiz" : "Hızlı analiz"} · Son 30
											dakika
										</p>
									</div>
									{liveResult.confidence !== undefined && (
										<div className="flex items-center gap-2 shrink-0">
											<div className="relative">
												<svg
													width="52"
													height="52"
													className="-rotate-90"
													aria-hidden="true"
												>
													<circle
														cx="26"
														cy="26"
														r={r}
														fill="none"
														stroke="var(--border-track)"
														strokeWidth="3.5"
													/>
													<circle
														cx="26"
														cy="26"
														r={r}
														fill="none"
														stroke="var(--color-lavender)"
														strokeWidth="3.5"
														strokeDasharray={circ}
														strokeDashoffset={confOffset}
														strokeLinecap="round"
														style={{ transition: "stroke-dashoffset 1s ease" }}
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
													className="text-xs font-medium"
													style={{ color: "var(--text-secondary)" }}
												>
													Güven
												</p>
												<p
													className="text-[10px]"
													style={{ color: "var(--text-faint)" }}
												>
													{confPct >= 80
														? "Yüksek"
														: confPct >= 60
															? "Orta"
															: "Düşük"}
												</p>
											</div>
										</div>
									)}
								</div>

								{/* Summary */}
								<div
									className="p-3 rounded-lg"
									style={{ background: "var(--surface-sunken)" }}
								>
									<p
										className="text-xs font-medium mb-1.5"
										style={{ color: "var(--text-faint)" }}
									>
										ÖZET
									</p>
									<p
										className="text-sm leading-relaxed"
										style={{ color: "var(--text-secondary)" }}
									>
										{liveResult.summary}
									</p>
								</div>

								{/* Root cause + Recommendations */}
								<div className="grid sm:grid-cols-2 gap-3">
									{liveResult.root_cause && (
										<div
											className="p-3 rounded-lg"
											style={{
												background: "var(--status-down-subtle)",
												border: "1px solid var(--status-down-border)",
											}}
										>
											<div className="flex items-center gap-1.5 mb-2">
												<Target
													className="w-3.5 h-3.5"
													style={{ color: "var(--color-pink)" }}
												/>
												<span
													className="text-xs font-medium"
													style={{ color: "var(--text-muted)" }}
												>
													Kök Neden
												</span>
											</div>
											<p
												className="text-xs leading-relaxed"
												style={{ color: "var(--text-secondary)" }}
											>
												{liveResult.root_cause}
											</p>
										</div>
									)}
									{liveResult.recommendations &&
										liveResult.recommendations.length > 0 && (
											<div
												className="p-3 rounded-lg"
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
													<span
														className="text-xs font-medium"
														style={{ color: "var(--text-muted)" }}
													>
														Öneriler
													</span>
												</div>
												<ul className="space-y-1.5">
													{liveResult.recommendations.map((rec) => (
														<li
															key={rec.action}
															className="flex items-start gap-2"
														>
															<PriorityBadge priority={rec.priority} />
															<span
																className="text-xs"
																style={{ color: "var(--text-secondary)" }}
															>
																{rec.action}
															</span>
														</li>
													))}
												</ul>
											</div>
										)}
								</div>
							</div>
						</Card>
					</motion.div>
				)}
			</AnimatePresence>

			{/* Filters */}
			<motion.div
				initial={{ opacity: 0, y: 8 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.35, delay: 0.2 }}
				className="flex flex-col sm:flex-row gap-2"
			>
				<Select
					value={selectedServiceId}
					onValueChange={(v) => {
						setSelectedServiceId(v);
						setPage(0);
					}}
				>
					<SelectTrigger
						className="w-44 text-sm h-9"
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
									<Server className="w-3 h-3" /> {s.name}
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
						placeholder="İçerik ara..."
						className="pl-9 h-9 text-sm"
						style={{
							background: "var(--surface-card)",
							borderColor: "var(--border-default)",
						}}
					/>
				</div>

				<div
					className="flex items-center gap-0.5 px-1 rounded-lg"
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
			</motion.div>

			{/* Insights feed */}
			<motion.div
				initial={{ opacity: 0, y: 8 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.35, delay: 0.25 }}
			>
				{services.length === 0 && selectedServiceId !== "all" ? (
					<EmptyState
						icon={Sparkles}
						title="Servis bulunamadı"
						description="Önce bir servis ekleyin."
					/>
				) : isLoading ? (
					<div className="space-y-2">
						{[1, 2, 3].map((i) => (
							<Card
								key={i}
								className="p-4 animate-pulse"
								style={{
									background: "var(--surface-card)",
									border: "1px solid var(--border-default)",
								}}
							>
								<div
									className="h-3.5 w-56 rounded mb-2"
									style={{ background: "var(--surface-sunken)" }}
								/>
								<div
									className="h-2.5 w-36 rounded"
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
								: '"Analiz Et" ile ilk analizi başlatın.'
						}
					/>
				) : (
					<>
						<div className="space-y-2">
							<AnimatePresence mode="popLayout">
								{filtered.map((insight: AIInsight, index: number) => {
									const topPriority =
										insight.recommendations?.[0]?.priority ?? "low";
									const isExpanded = expandedInsight === insight.id;
									return (
										<motion.div
											key={insight.id}
											initial={{ opacity: 0, y: 8 }}
											animate={{ opacity: 1, y: 0 }}
											exit={{ opacity: 0, scale: 0.98 }}
											transition={{ duration: 0.2, delay: index * 0.03 }}
											layout
										>
											<Card
												className="overflow-hidden transition-shadow"
												style={{
													background: "var(--surface-card)",
													border: "1px solid var(--border-default)",
												}}
											>
												<button
													type="button"
													className="w-full px-4 py-3.5 text-left"
													onClick={() =>
														setExpandedInsight(isExpanded ? null : insight.id)
													}
												>
													<div className="flex items-start justify-between gap-3">
														<div className="flex items-start gap-3 min-w-0">
															<div
																className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
																style={{
																	background: "var(--color-lavender-subtle)",
																	border:
																		"1px solid var(--color-lavender-border)",
																}}
															>
																<Zap
																	className="w-3.5 h-3.5"
																	style={{ color: "var(--color-lavender)" }}
																/>
															</div>
															<div className="min-w-0">
																<p
																	className="text-sm leading-snug line-clamp-2"
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
																		).toLocaleString("tr-TR")}
																	</span>
																	<span
																		className="text-[10px] px-1.5 py-0.5 rounded-md"
																		style={{
																			background: "var(--color-blue-subtle)",
																			color: "var(--color-blue)",
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
																className="p-3 rounded-lg"
																style={{
																	background: "var(--status-down-subtle)",
																	border: "1px solid var(--status-down-border)",
																}}
															>
																<div className="flex items-center gap-1.5 mb-1.5">
																	<Target
																		className="w-3.5 h-3.5"
																		style={{ color: "var(--color-pink)" }}
																	/>
																	<span
																		className="text-xs font-medium"
																		style={{ color: "var(--text-muted)" }}
																	>
																		Kök Neden
																	</span>
																</div>
																<p
																	className="text-sm"
																	style={{ color: "var(--text-secondary)" }}
																>
																	{insight.root_cause}
																</p>
															</div>
														)}
														{insight.recommendations &&
															insight.recommendations.length > 0 && (
																<div
																	className="p-3 rounded-lg"
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
																			className="text-xs font-medium"
																			style={{ color: "var(--text-muted)" }}
																		>
																			Öneriler
																		</span>
																	</div>
																	<ul className="space-y-1.5">
																		{insight.recommendations.map((rec) => (
																			<li
																				key={rec.action}
																				className="flex items-start gap-2"
																			>
																				<PriorityBadge
																					priority={rec.priority}
																				/>
																				<span
																					className="text-xs"
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
											</Card>
										</motion.div>
									);
								})}
							</AnimatePresence>
						</div>

						{/* Pagination */}
						{totalInsights > PAGE_SIZE && (
							<div className="flex items-center justify-between pt-3">
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
	);
}

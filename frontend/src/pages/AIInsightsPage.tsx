import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Activity,
	AlertTriangle,
	BarChart3,
	Brain,
	CheckCircle2,
	ChevronDown,
	ChevronRight,
	Clock,
	Eye,
	Filter,
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
import { Badge } from "@/components/ui/badge";
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

export function AIInsightsPage() {
	const queryClient = useQueryClient();
	const { services } = useServices();

	// Feed state
	const [selectedServiceId, setSelectedServiceId] = useState<string>("all");
	const [search, setSearch] = useState("");
	const [priorityFilter, setPriorityFilter] = useState<
		"all" | "high" | "medium" | "low"
	>("all");
	const [page, setPage] = useState(0);
	const PAGE_SIZE = 10;
	const [expandedInsight, setExpandedInsight] = useState<string | null>(null);

	// Per-service analysis
	const [analyzeServiceId, setAnalyzeServiceId] = useState<string>("");
	const [deepAnalysis, setDeepAnalysis] = useState(false);
	const [liveResult, setLiveResult] = useState<AnalysisResult | null>(null);

	const serviceForInsights =
		selectedServiceId === "all" ? (services[0]?.id ?? "") : selectedServiceId;

	const { data: insightsData, isLoading } = useQuery({
		queryKey: ["insights", serviceForInsights, page],
		queryFn: () => metricsApi.getInsights(serviceForInsights, page + 1),
		enabled: !!serviceForInsights,
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

	// Stats
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

	const confidence = liveResult?.confidence ?? 0;
	const confPct = Math.round(confidence * 100);
	const r = 22;
	const circ = 2 * Math.PI * r;
	const confOffset = circ - (confPct / 100) * circ;

	const priorityBadgeStyle = (priority: string) => ({
		background:
			priority === "high"
				? "var(--status-down-subtle)"
				: priority === "medium"
					? "var(--status-warn-subtle)"
					: "var(--color-teal-subtle)",
		color:
			priority === "high"
				? "var(--status-down-text)"
				: priority === "medium"
					? "var(--status-warn-text)"
					: "var(--color-teal)",
		borderColor:
			priority === "high"
				? "var(--status-down-border)"
				: priority === "medium"
					? "var(--status-warn-border)"
					: "var(--color-teal-border)",
	});

	return (
		<div className="space-y-6">
			{/* Header */}
			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.5 }}
			>
				<h1
					className="text-2xl font-bold bg-clip-text text-transparent"
					style={{ backgroundImage: "var(--gradient-heading)" }}
				>
					AI Insights
				</h1>
				<p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
					Yapay zeka destekli anomali tespiti ve öneriler
				</p>
			</motion.div>

			{/* Stats row */}
			{allInsights.length > 0 && (
				<motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.4, delay: 0.05 }}
				>
					<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
						].map(({ label, value, icon: Icon, color, bg, border }) => (
							<Card
								key={label}
								className="p-3 rounded text-center"
								style={{
									background: bg,
									border: `2px solid ${border}`,
									boxShadow: "var(--card-shadow)",
								}}
							>
								<Icon className="w-4 h-4 mx-auto mb-1" style={{ color }} />
								<p className="text-xl font-bold tabular-nums" style={{ color }}>
									{value}
								</p>
								<p
									className="text-[10px] uppercase tracking-wider mt-0.5"
									style={{ color: "var(--text-muted)" }}
								>
									{label}
								</p>
							</Card>
						))}
					</div>
				</motion.div>
			)}

			{/* Analyze Panel */}
			<motion.div
				initial={{ opacity: 0, y: 10 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.4, delay: 0.1 }}
			>
				<Card
					className="p-4 rounded"
					style={{
						background: "var(--surface-card)",
						border: "2px solid var(--color-lavender-border)",
						boxShadow: "var(--card-shadow)",
					}}
				>
					<div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
						<div className="flex items-center gap-2">
							<Brain
								className="w-4 h-4"
								style={{ color: "var(--color-lavender)" }}
							/>
							<span
								className="text-xs font-semibold"
								style={{ color: "var(--text-secondary)" }}
							>
								Yeni Analiz Başlat
							</span>
						</div>
						<div className="flex flex-1 items-center gap-2 flex-wrap">
							<Select
								value={analyzeServiceId}
								onValueChange={setAnalyzeServiceId}
							>
								<SelectTrigger
									className="w-44 rounded text-xs h-8"
									style={{
										background: "var(--input-bg)",
										borderColor: "var(--input-border)",
										color: "var(--text-secondary)",
									}}
								>
									<SelectValue placeholder="Servis seçin..." />
								</SelectTrigger>
								<SelectContent
									className="rounded"
									style={{
										background: "var(--surface-card)",
										borderColor: "var(--border-default)",
									}}
								>
									{services.map((s) => (
										<SelectItem key={s.id} value={s.id} className="text-xs">
											{s.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<div
								className="flex rounded overflow-hidden border-2"
								style={{ borderColor: "var(--color-lavender-border)" }}
							>
								<button
									onClick={() => setDeepAnalysis(false)}
									className="px-3 py-1.5 text-[10px] font-medium transition-all"
									style={
										!deepAnalysis
											? {
													background: "var(--color-lavender-subtle)",
													color: "var(--color-lavender)",
												}
											: { color: "var(--text-muted)" }
									}
								>
									Hızlı
								</button>
								<button
									onClick={() => setDeepAnalysis(true)}
									className="px-3 py-1.5 text-[10px] font-medium transition-all"
									style={
										deepAnalysis
											? {
													background: "var(--color-lavender-subtle)",
													color: "var(--color-lavender)",
												}
											: { color: "var(--text-muted)" }
									}
								>
									Derin
								</button>
							</div>
							<Button
								onClick={() => analyzeMutation.mutate()}
								disabled={analyzeMutation.isPending || !analyzeServiceId}
								className="text-white rounded text-xs h-8 transition-all ml-auto"
								style={{
									background: "var(--gradient-btn-primary)",
									boxShadow: "var(--btn-shadow)",
								}}
							>
								{analyzeMutation.isPending ? (
									<>
										<RefreshCw className="w-3 h-3 mr-1 animate-spin" /> Analiz
										ediliyor...
									</>
								) : (
									<>
										<Zap className="w-3 h-3 mr-1" /> Analiz Et
									</>
								)}
							</Button>
						</div>
					</div>
				</Card>
			</motion.div>

			{/* Analyzing skeleton */}
			{analyzeMutation.isPending && (
				<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
					<Card
						className="rounded p-5 space-y-3"
						style={{
							background: "var(--surface-card)",
							border: "2px solid var(--color-lavender-border)",
						}}
					>
						<div className="flex items-center gap-3 mb-2">
							<Brain
								className="w-5 h-5 animate-pulse"
								style={{ color: "var(--color-lavender)" }}
							/>
							<div
								className="h-3 w-48 rounded animate-pulse"
								style={{ background: "var(--color-lavender-subtle)" }}
							/>
						</div>
						{[80, 60, 90, 50].map((w, i) => (
							<div
								key={i}
								className="h-2 rounded animate-pulse"
								style={{
									width: `${w}%`,
									animationDelay: `${i * 0.15}s`,
									background: "var(--color-lavender-subtle)",
								}}
							/>
						))}
					</Card>
				</motion.div>
			)}

			{/* Live Result */}
			<AnimatePresence>
				{liveResult && !analyzeMutation.isPending && (
					<motion.div
						key="live-result"
						initial={{ opacity: 0, y: 12 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -8 }}
						transition={{ duration: 0.4 }}
					>
						<Card
							className="rounded overflow-hidden"
							style={{
								background: "var(--surface-card)",
								border: "2px solid var(--color-lavender-border)",
								boxShadow: "var(--card-shadow)",
							}}
						>
							<div
								className="h-1"
								style={{ background: "var(--gradient-btn-primary)" }}
							/>
							<div className="p-5 space-y-4">
								<div className="flex items-center gap-4">
									<div
										className="w-10 h-10 rounded flex items-center justify-center shrink-0"
										style={{
											backgroundColor: "var(--color-lavender-subtle)",
											border: "1.5px solid var(--color-lavender-border)",
										}}
									>
										<Brain
											className="w-5 h-5"
											style={{ color: "var(--color-lavender)" }}
										/>
									</div>
									<div className="flex-1">
										<h3
											className="text-sm font-semibold"
											style={{ color: "var(--text-secondary)" }}
										>
											Canlı Analiz Sonucu
										</h3>
										<p
											className="text-[10px]"
											style={{ color: "var(--text-faint)" }}
										>
											{deepAnalysis ? "Derin analiz" : "Hızlı analiz"} · Son 30
											dakika
										</p>
									</div>
									{liveResult.confidence !== undefined && (
										<div className="flex items-center gap-2 shrink-0">
											<div className="relative flex items-center justify-center">
												<svg width="56" height="56" className="-rotate-90">
													<circle
														cx="28"
														cy="28"
														r={r}
														fill="none"
														stroke="var(--border-track)"
														strokeWidth="4"
													/>
													<circle
														cx="28"
														cy="28"
														r={r}
														fill="none"
														stroke="var(--color-lavender)"
														strokeWidth="4"
														strokeDasharray={circ}
														strokeDashoffset={confOffset}
														strokeLinecap="round"
														style={{ transition: "stroke-dashoffset 1s ease" }}
													/>
												</svg>
												<span
													className="absolute text-[10px] font-bold"
													style={{ color: "var(--color-lavender)" }}
												>
													{confPct}%
												</span>
											</div>
											<div>
												<p
													className="text-[10px] font-medium"
													style={{ color: "var(--text-secondary)" }}
												>
													Güven
												</p>
												<p
													className="text-[9px]"
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

								<div
									className="p-4 rounded"
									style={{
										background: "var(--surface-sunken)",
										border: "2px solid var(--border-default)",
									}}
								>
									<div className="flex items-center gap-1.5 mb-2">
										<Activity
											className="w-3 h-3"
											style={{ color: "var(--color-lavender)" }}
										/>
										<span
											className="text-[10px] uppercase tracking-wider"
											style={{ color: "var(--text-muted)" }}
										>
											Özet
										</span>
									</div>
									<p
										className="text-xs leading-relaxed"
										style={{ color: "var(--text-secondary)" }}
									>
										{liveResult.summary}
									</p>
								</div>

								<div className="grid sm:grid-cols-2 gap-4">
									{liveResult.root_cause && (
										<div
											className="p-4 rounded"
											style={{
												background: "var(--status-down-subtle)",
												border: "2px solid var(--status-down-border)",
											}}
										>
											<div className="flex items-center gap-1.5 mb-2">
												<Target
													className="w-3 h-3"
													style={{ color: "var(--color-pink)" }}
												/>
												<span
													className="text-[10px] uppercase tracking-wider"
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
												className="p-4 rounded"
												style={{
													background: "var(--color-teal-subtle)",
													border: "2px solid var(--color-teal-border)",
												}}
											>
												<div className="flex items-center gap-1.5 mb-3">
													<Lightbulb
														className="w-3 h-3"
														style={{ color: "var(--color-teal)" }}
													/>
													<span
														className="text-[10px] uppercase tracking-wider"
														style={{ color: "var(--text-muted)" }}
													>
														Öneriler
													</span>
												</div>
												<ul className="space-y-2">
													{liveResult.recommendations.map((rec, i) => (
														<li key={i} className="flex items-start gap-2">
															<Badge
																className="text-[9px] px-1.5 py-0 rounded shrink-0 mt-0.5 border-2"
																style={priorityBadgeStyle(rec.priority)}
															>
																{rec.priority}
															</Badge>
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

			{/* Feed Header + Filters */}
			<motion.div
				initial={{ opacity: 0, y: 10 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.4, delay: 0.2 }}
			>
				<Card
					className="p-3 rounded"
					style={{
						background: "var(--surface-card)",
						border: "2px solid var(--border-default)",
						boxShadow: "var(--card-shadow)",
					}}
				>
					<div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
						{/* Service filter */}
						<Select
							value={selectedServiceId}
							onValueChange={(v) => {
								setSelectedServiceId(v);
								setPage(0);
							}}
						>
							<SelectTrigger
								className="w-44 rounded text-xs h-8"
								style={{
									background: "var(--input-bg)",
									borderColor: "var(--input-border)",
									color: "var(--text-secondary)",
								}}
							>
								<SelectValue />
							</SelectTrigger>
							<SelectContent
								className="rounded"
								style={{
									background: "var(--surface-card)",
									borderColor: "var(--border-default)",
								}}
							>
								<SelectItem value="all" className="text-xs">
									Tüm Servisler
								</SelectItem>
								{services.map((s) => (
									<SelectItem key={s.id} value={s.id} className="text-xs">
										<span className="flex items-center gap-1.5">
											<Server className="w-3 h-3" />
											{s.name}
										</span>
									</SelectItem>
								))}
							</SelectContent>
						</Select>

						{/* Search */}
						<div className="relative flex-1">
							<Search
								className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2"
								style={{ color: "var(--text-faint)" }}
							/>
							<Input
								value={search}
								onChange={(e) => setSearch(e.target.value)}
								placeholder="İçerik ara..."
								className="rounded text-xs h-8 pl-7"
								style={{
									background: "var(--input-bg)",
									borderColor: "var(--input-border)",
									color: "var(--text-secondary)",
								}}
							/>
						</div>

						{/* Priority filter */}
						<div className="flex items-center gap-1">
							<Filter
								className="w-3 h-3 shrink-0"
								style={{ color: "var(--text-faint)" }}
							/>
							{(["all", "high", "medium", "low"] as const).map((p) => (
								<button
									key={p}
									onClick={() => setPriorityFilter(p)}
									className="px-2 py-0.5 rounded text-[10px] font-medium border-2 transition-all"
									style={
										priorityFilter === p
											? p === "all"
												? {
														background: "var(--color-lavender-subtle)",
														color: "var(--color-lavender)",
														borderColor: "var(--color-lavender-border)",
													}
												: priorityBadgeStyle(p)
											: {
													color: "var(--text-faint)",
													borderColor: "transparent",
												}
									}
								>
									{p === "all"
										? "Tümü"
										: p === "high"
											? "Yüksek"
											: p === "medium"
												? "Orta"
												: "Düşük"}
								</button>
							))}
						</div>
					</div>
				</Card>
			</motion.div>

			{/* Insights Feed */}
			<motion.div
				initial={{ opacity: 0, y: 10 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.4, delay: 0.25 }}
			>
				{!serviceForInsights ? (
					<EmptyState
						icon={Sparkles}
						title="Servis bulunamadı"
						description="Önce bir servis ekleyin."
					/>
				) : isLoading ? (
					<div className="space-y-3">
						{[1, 2, 3].map((i) => (
							<Card
								key={i}
								className="p-4 rounded animate-pulse"
								style={{
									background: "var(--surface-card)",
									border: "2px solid var(--border-default)",
								}}
							>
								<div
									className="h-4 w-64 rounded mb-2"
									style={{ background: "var(--color-lavender-subtle)" }}
								/>
								<div
									className="h-3 w-40 rounded"
									style={{ background: "var(--color-lavender-subtle)" }}
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
								: "Henüz AI insight yok"
						}
						description={
							search || priorityFilter !== "all"
								? "Arama veya filtre kriterlerinizi değiştirin."
								: 'Yukarıdaki "Analiz Et" butonuyla ilk analizi başlatın.'
						}
					/>
				) : (
					<>
						<div className="space-y-3">
							<AnimatePresence mode="popLayout">
								{filtered.map((insight: AIInsight, index: number) => {
									const topPriority =
										insight.recommendations?.[0]?.priority ?? "low";
									return (
										<motion.div
											key={insight.id}
											initial={{ opacity: 0, y: 10 }}
											animate={{ opacity: 1, y: 0 }}
											exit={{ opacity: 0, scale: 0.97 }}
											transition={{ duration: 0.25, delay: index * 0.04 }}
											layout
										>
											<Card
												className="rounded overflow-hidden transition-all duration-200"
												style={{
													background: "var(--surface-card)",
													border: "2px solid var(--border-default)",
													boxShadow: "var(--card-shadow)",
												}}
											>
												<button
													className="w-full p-4 text-left"
													onClick={() =>
														setExpandedInsight(
															expandedInsight === insight.id
																? null
																: insight.id,
														)
													}
												>
													<div className="flex items-start justify-between gap-3">
														<div className="flex items-start gap-3 min-w-0">
															<div
																className="w-8 h-8 rounded flex items-center justify-center shrink-0 mt-0.5"
																style={{
																	backgroundColor:
																		"var(--color-lavender-subtle)",
																	border:
																		"1.5px solid var(--color-lavender-border)",
																}}
															>
																<Zap
																	className="w-4 h-4"
																	style={{ color: "var(--color-lavender)" }}
																/>
															</div>
															<div className="min-w-0">
																<p
																	className="text-xs font-medium leading-relaxed line-clamp-2"
																	style={{ color: "var(--text-secondary)" }}
																>
																	{insight.summary}
																</p>
																<div className="flex items-center gap-2 mt-1.5 flex-wrap">
																	<span
																		className="text-[10px] flex items-center gap-1"
																		style={{ color: "var(--text-faint)" }}
																	>
																		<Clock className="w-3 h-3" />
																		{new Date(
																			insight.created_at,
																		).toLocaleString("tr-TR")}
																	</span>
																	<Badge
																		className="text-[8px] rounded-full px-1.5 py-0 border-2"
																		style={{
																			background: "var(--color-blue-subtle)",
																			color: "var(--color-blue)",
																			borderColor: "var(--color-blue-border)",
																		}}
																	>
																		{insight.model}
																	</Badge>
																	{insight.recommendations &&
																		insight.recommendations.length > 0 && (
																			<Badge
																				className="text-[8px] px-1.5 py-0 rounded border-2"
																				style={priorityBadgeStyle(topPriority)}
																			>
																				<Eye className="w-2 h-2 mr-0.5 inline" />
																				{insight.recommendations.length} öneri
																			</Badge>
																		)}
																</div>
															</div>
														</div>
														{expandedInsight === insight.id ? (
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

												{expandedInsight === insight.id && (
													<motion.div
														initial={{ height: 0, opacity: 0 }}
														animate={{ height: "auto", opacity: 1 }}
														exit={{ height: 0, opacity: 0 }}
														transition={{ duration: 0.2 }}
														className="px-4 pb-4"
														style={{
															borderTop: "2px solid var(--border-default)",
														}}
													>
														<div className="pt-3 space-y-3">
															{insight.root_cause && (
																<div
																	className="p-3 rounded"
																	style={{
																		background: "var(--status-down-subtle)",
																		border:
																			"2px solid var(--status-down-border)",
																	}}
																>
																	<span
																		className="text-[10px] uppercase tracking-wider flex items-center gap-1 mb-1"
																		style={{ color: "var(--text-muted)" }}
																	>
																		<Target
																			className="w-3 h-3"
																			style={{ color: "var(--color-pink)" }}
																		/>{" "}
																		Kök Neden
																	</span>
																	<p
																		className="text-xs"
																		style={{ color: "var(--text-secondary)" }}
																	>
																		{insight.root_cause}
																	</p>
																</div>
															)}
															{insight.recommendations &&
																insight.recommendations.length > 0 && (
																	<div
																		className="p-3 rounded"
																		style={{
																			background: "var(--color-teal-subtle)",
																			border:
																				"2px solid var(--color-teal-border)",
																		}}
																	>
																		<span
																			className="text-[10px] uppercase tracking-wider flex items-center gap-1 mb-2"
																			style={{ color: "var(--text-muted)" }}
																		>
																			<Lightbulb
																				className="w-3 h-3"
																				style={{ color: "var(--color-teal)" }}
																			/>{" "}
																			Öneriler
																		</span>
																		<ul className="space-y-1.5">
																			{insight.recommendations.map(
																				(
																					rec: {
																						action: string;
																						priority: string;
																					},
																					i: number,
																				) => (
																					<li
																						key={i}
																						className="flex items-start gap-2"
																					>
																						<Badge
																							className="text-[8px] px-1 py-0 rounded-full shrink-0 mt-0.5 border"
																							style={priorityBadgeStyle(
																								rec.priority,
																							)}
																						>
																							{rec.priority}
																						</Badge>
																						<span
																							className="text-[11px]"
																							style={{
																								color: "var(--text-secondary)",
																							}}
																						>
																							{rec.action}
																						</span>
																					</li>
																				),
																			)}
																		</ul>
																	</div>
																)}
														</div>
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
							<div className="flex items-center justify-between pt-2">
								<Button
									size="sm"
									variant="outline"
									onClick={() => setPage((p) => Math.max(0, p - 1))}
									disabled={page === 0}
									className="rounded text-xs h-8"
								>
									Önceki
								</Button>
								<span
									className="text-[10px]"
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
									className="rounded text-xs h-8"
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

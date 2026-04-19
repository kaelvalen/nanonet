import { useQuery } from "@tanstack/react-query";
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
	Search,
	Server,
	Sparkles,
	Target,
	TrendingUp,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { type AIInsight, metricsApi } from "@/api/metrics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useServices } from "@/hooks/useServices";
import { useAIAssistantStore } from "@/store/aiAssistantStore";

/* AIInsightsPage — historical archive of AI-generated insights.

   Shape:
     [stat strip × 4]                                   [filters: service · priority · search]
     [feed of expandable insight cards]                              [paginator]

   Live ad-hoc analysis lives in the AIAssistant slide-in panel — opened from
   ⌘K + ? or the TopBar sparkle. The page header surfaces this as the primary
   action so the discovery path is obvious. */

type Priority = "all" | "high" | "medium" | "low";

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

const PRIORITY_LABEL: Record<Priority, string> = {
	all: "Tümü",
	high: "Yüksek",
	medium: "Orta",
	low: "Düşük",
};

function priorityTokens(p: string) {
	if (p === "high") {
		return {
			text: "var(--status-down-text)",
			bg: "var(--status-down-subtle)",
			accent: "var(--status-down)",
		};
	}
	if (p === "medium") {
		return {
			text: "var(--status-degraded-text)",
			bg: "var(--status-degraded-subtle)",
			accent: "var(--status-degraded)",
		};
	}
	return {
		text: "var(--status-up-text)",
		bg: "var(--status-up-subtle)",
		accent: "var(--status-up)",
	};
}

function PriorityPill({ priority }: { priority: string }) {
	const t = priorityTokens(priority);
	return (
		<span
			className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-[4px]"
			style={{ background: t.bg, color: t.text }}
		>
			{PRIORITY_LABEL[priority as Priority] ?? priority}
		</span>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Stat strip

function StatTile({
	label,
	value,
	icon: Icon,
	accent,
}: {
	label: string;
	value: number;
	icon: React.ElementType;
	accent: string;
}) {
	return (
		<div
			className="relative rounded-[6px] px-4 py-3 flex items-center gap-3 overflow-hidden"
			style={{
				background: "var(--surface-base)",
				border: "1px solid var(--border-subtle)",
			}}
		>
			<span
				aria-hidden
				className="absolute left-0 top-3 bottom-3 w-[2px] rounded-r-full"
				style={{ background: accent }}
			/>
			<div
				className="w-9 h-9 rounded-[6px] flex items-center justify-center shrink-0 ml-1"
				style={{
					background: "var(--surface-sunken)",
					border: "1px solid var(--border-subtle)",
				}}
			>
				<Icon className="w-4 h-4" style={{ color: accent }} />
			</div>
			<div className="min-w-0 flex-1">
				<p
					className="text-[10px] uppercase tracking-wider font-semibold leading-none"
					style={{ color: "var(--text-faint)" }}
				>
					{label}
				</p>
				<p
					className="text-[22px] font-semibold tnum leading-none mt-2"
					style={{ color: "var(--text-primary)" }}
				>
					{value}
				</p>
			</div>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Insight row

function InsightRow({
	insight,
	expanded,
	onToggle,
}: {
	insight: AIInsight;
	expanded: boolean;
	onToggle: () => void;
}) {
	const topPriority = insight.recommendations?.[0]?.priority ?? "low";
	const t = priorityTokens(topPriority);

	return (
		<article
			className="relative rounded-[6px] overflow-hidden"
			style={{
				background: "var(--surface-base)",
				border: "1px solid var(--border-subtle)",
			}}
		>
			<span
				aria-hidden
				className="absolute left-0 top-3 bottom-3 w-[2px] rounded-r-full"
				style={{ background: t.accent }}
			/>
			<button
				type="button"
				onClick={onToggle}
				aria-expanded={expanded}
				className="w-full text-left px-4 py-3 hover:bg-[var(--surface-sunken)] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
			>
				<div className="flex items-start justify-between gap-3 pl-2">
					<div className="flex items-start gap-3 min-w-0 flex-1">
						<div
							className="w-7 h-7 rounded-[4px] flex items-center justify-center shrink-0 mt-0.5"
							style={{
								background: "var(--surface-sunken)",
								border: "1px solid var(--border-subtle)",
							}}
						>
							<Sparkles className="w-3.5 h-3.5" style={{ color: t.accent }} />
						</div>
						<div className="min-w-0 flex-1">
							<p
								className="text-[13px] leading-snug line-clamp-2 font-medium"
								style={{ color: "var(--text-primary)" }}
							>
								{insight.summary}
							</p>
							<div className="flex items-center gap-2 mt-2 flex-wrap">
								<PriorityPill priority={topPriority} />
								<span
									className="text-[10px] inline-flex items-center gap-1 tnum"
									style={{ color: "var(--text-faint)" }}
								>
									<Clock className="w-3 h-3" />
									{new Date(insight.created_at).toLocaleString("tr-TR", {
										dateStyle: "short",
										timeStyle: "short",
									})}
								</span>
								<span
									className="text-[10px] font-mono px-1.5 py-0.5 rounded-[4px]"
									style={{
										background: "var(--surface-sunken)",
										color: "var(--text-tertiary)",
										border: "1px solid var(--border-subtle)",
									}}
								>
									{insight.model}
								</span>
								{insight.recommendations &&
									insight.recommendations.length > 0 && (
										<span
											className="text-[10px] inline-flex items-center gap-1 tnum"
											style={{ color: "var(--text-faint)" }}
										>
											<Eye className="w-2.5 h-2.5" />
											{insight.recommendations.length} öneri
										</span>
									)}
							</div>
						</div>
					</div>
					{expanded ? (
						<ChevronDown
							className="w-4 h-4 shrink-0 mt-1"
							style={{ color: "var(--text-tertiary)" }}
						/>
					) : (
						<ChevronRight
							className="w-4 h-4 shrink-0 mt-1"
							style={{ color: "var(--text-tertiary)" }}
						/>
					)}
				</div>
			</button>

			<AnimatePresence initial={false}>
				{expanded && (
					<motion.div
						key="exp"
						initial={{ height: 0, opacity: 0 }}
						animate={{ height: "auto", opacity: 1 }}
						exit={{ height: 0, opacity: 0 }}
						transition={{ duration: 0.18 }}
						className="overflow-hidden"
						style={{ borderTop: "1px solid var(--border-subtle)" }}
					>
						<div className="px-4 py-3 pl-6 space-y-3">
							{insight.root_cause && (
								<section>
									<header className="flex items-center gap-1.5 mb-1.5">
										<Target
											className="w-3 h-3"
											style={{ color: "var(--status-down)" }}
										/>
										<h3
											className="text-[10px] uppercase tracking-wider font-semibold"
											style={{ color: "var(--status-down-text)" }}
										>
											Kök neden
										</h3>
									</header>
									<p
										className="text-[13px] leading-relaxed"
										style={{ color: "var(--text-secondary)" }}
									>
										{insight.root_cause}
									</p>
								</section>
							)}
							{insight.recommendations &&
								insight.recommendations.length > 0 && (
									<section>
										<header className="flex items-center gap-1.5 mb-2">
											<Lightbulb
												className="w-3 h-3"
												style={{ color: "var(--brand-primary)" }}
											/>
											<h3
												className="text-[10px] uppercase tracking-wider font-semibold"
												style={{ color: "var(--brand-primary)" }}
											>
												Öneriler
											</h3>
										</header>
										<ul className="space-y-2">
											{insight.recommendations.map((rec) => (
												<li key={rec.action} className="flex items-start gap-2">
													<PriorityPill priority={rec.priority} />
													<span
														className="text-[12px] leading-relaxed"
														style={{ color: "var(--text-secondary)" }}
													>
														{rec.action}
													</span>
												</li>
											))}
										</ul>
									</section>
								)}
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</article>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton + empty

function FeedSkeleton() {
	return (
		<div className="flex flex-col gap-2">
			{[1, 2, 3, 4].map((i) => (
				<div
					key={i}
					className="rounded-[6px] px-4 py-3 animate-pulse"
					style={{
						background: "var(--surface-base)",
						border: "1px solid var(--border-subtle)",
					}}
				>
					<div
						className="h-3 w-3/4 rounded mb-2"
						style={{ background: "var(--surface-sunken)" }}
					/>
					<div
						className="h-2 w-1/2 rounded"
						style={{ background: "var(--surface-sunken)" }}
					/>
				</div>
			))}
		</div>
	);
}

function FeedEmpty({
	icon: Icon,
	title,
	description,
}: {
	icon: React.ElementType;
	title: string;
	description: string;
}) {
	return (
		<div
			className="flex flex-col items-center justify-center py-12 px-6 rounded-[6px] text-center"
			style={{
				background: "var(--surface-base)",
				border: "1px dashed var(--border-default)",
			}}
		>
			<span
				className="w-10 h-10 rounded-[6px] flex items-center justify-center mb-3"
				style={{
					background: "var(--surface-sunken)",
					border: "1px solid var(--border-subtle)",
				}}
			>
				<Icon className="w-4 h-4" style={{ color: "var(--text-tertiary)" }} />
			</span>
			<p
				className="text-[14px] font-semibold mb-1"
				style={{ color: "var(--text-primary)" }}
			>
				{title}
			</p>
			<p
				className="text-[12px] leading-relaxed max-w-md"
				style={{ color: "var(--text-tertiary)" }}
			>
				{description}
			</p>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Page

export function AIInsightsPage() {
	const { services } = useServices();
	const openAIAssistant = useAIAssistantStore((s) => s.open);
	const [searchParams, setSearchParams] = useSearchParams();

	const [selectedServiceId, setSelectedServiceId] = useState<string>("all");
	const [search, setSearch] = useState("");
	const [priorityFilter, setPriorityFilter] = useState<Priority>("all");
	const [page, setPage] = useState(0);
	const PAGE_SIZE = 10;
	const [expandedId, setExpandedId] = useState<string | null>(null);

	// Backwards compat: if someone arrives with ?q=... (legacy CommandPalette),
	// route them to the AI Assistant panel instead and strip the param.
	useEffect(() => {
		const q = searchParams.get("q");
		if (q?.trim()) {
			openAIAssistant({ mode: "chat", seed: q });
			searchParams.delete("q");
			setSearchParams(searchParams, { replace: true });
		}
	}, [searchParams, setSearchParams, openAIAssistant]);

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
				const q = search.trim().toLocaleLowerCase("tr-TR");
				const matchSearch =
					!q ||
					ins.summary.toLocaleLowerCase("tr-TR").includes(q) ||
					(ins.root_cause ?? "").toLocaleLowerCase("tr-TR").includes(q);
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

	const counts = useMemo(() => {
		let high = 0;
		let medium = 0;
		let low = 0;
		for (const ins of allInsights) {
			const p = ins.recommendations?.[0]?.priority ?? "low";
			if (p === "high") high++;
			else if (p === "medium") medium++;
			else low++;
		}
		return { high, medium, low };
	}, [allInsights]);

	return (
		<PageShell width="wide" fill>
			<PageHeader
				eyebrow="AI"
				title="AI içgörüler"
				description="Geçmiş analizlerin arşivi. Yeni bir analiz için sağ üstteki AI asistanı kullan."
				actions={
					<Button size="sm" onClick={() => openAIAssistant({ mode: "chat" })}>
						<Sparkles className="w-3.5 h-3.5 mr-1.5" />
						AI asistan
					</Button>
				}
			/>

			{/* Stat strip */}
			<div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 shrink-0">
				<StatTile
					label="Toplam"
					value={totalInsights}
					icon={BarChart3}
					accent="var(--brand-primary)"
				/>
				<StatTile
					label="Yüksek"
					value={counts.high}
					icon={AlertTriangle}
					accent="var(--status-down)"
				/>
				<StatTile
					label="Orta"
					value={counts.medium}
					icon={TrendingUp}
					accent="var(--status-degraded)"
				/>
				<StatTile
					label="Düşük"
					value={counts.low}
					icon={CheckCircle2}
					accent="var(--status-up)"
				/>
			</div>

			{/* Filter bar */}
			<div className="flex flex-col lg:flex-row gap-2 mb-3 shrink-0">
				<Select
					value={selectedServiceId}
					onValueChange={(v) => {
						setSelectedServiceId(v);
						setPage(0);
					}}
				>
					<SelectTrigger className="w-full lg:w-56 h-9 text-[13px]">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all" className="text-[13px]">
							Tüm servisler
						</SelectItem>
						{services.map((s) => (
							<SelectItem key={s.id} value={s.id} className="text-[13px]">
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
						placeholder="Özet veya kök neden ara…"
						className="pl-9 h-9 text-[13px]"
					/>
				</div>

				<div
					role="radiogroup"
					aria-label="Öncelik filtresi"
					className="inline-flex items-center h-9 rounded-[6px] p-0.5 self-start lg:self-auto"
					style={{
						background: "var(--surface-sunken)",
						border: "1px solid var(--border-subtle)",
					}}
				>
					{(["all", "high", "medium", "low"] as const).map((p) => {
						const active = priorityFilter === p;
						return (
							// biome-ignore lint/a11y/useSemanticElements: visual segmented control inside an explicit radiogroup
							<button
								key={p}
								type="button"
								role="radio"
								aria-checked={active}
								onClick={() => setPriorityFilter(p)}
								className="px-3 h-8 rounded-[4px] text-[12px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
								style={{
									background: active ? "var(--surface-base)" : "transparent",
									color: active
										? "var(--text-primary)"
										: "var(--text-tertiary)",
									border: active
										? "1px solid var(--border-subtle)"
										: "1px solid transparent",
								}}
							>
								{PRIORITY_LABEL[p]}
							</button>
						);
					})}
				</div>
			</div>

			{/* Feed */}
			<div className="flex-1 min-h-0 overflow-y-auto -mx-1 px-1 pb-2">
				{isLoading ? (
					<FeedSkeleton />
				) : services.length === 0 ? (
					<FeedEmpty
						icon={Sparkles}
						title="Henüz servis yok"
						description="AI içgörüleri için önce bir servis ekleyin."
					/>
				) : filtered.length === 0 ? (
					<FeedEmpty
						icon={Brain}
						title={
							search || priorityFilter !== "all"
								? "Sonuç bulunamadı"
								: "Henüz AI içgörüsü yok"
						}
						description={
							search || priorityFilter !== "all"
								? "Filtreleri değiştirip tekrar dene."
								: "AI asistan paneline geç ve bir servis için analiz başlat — sonuçlar burada arşivlenir."
						}
					/>
				) : (
					<>
						<ul className="flex flex-col gap-2">
							<AnimatePresence mode="popLayout">
								{filtered.map((insight, index) => (
									<motion.li
										key={insight.id}
										layout
										initial={{ opacity: 0, y: 4 }}
										animate={{ opacity: 1, y: 0 }}
										exit={{ opacity: 0 }}
										transition={{
											duration: 0.18,
											delay: Math.min(index, 5) * 0.02,
										}}
									>
										<InsightRow
											insight={insight}
											expanded={expandedId === insight.id}
											onToggle={() =>
												setExpandedId(
													expandedId === insight.id ? null : insight.id,
												)
											}
										/>
									</motion.li>
								))}
							</AnimatePresence>
						</ul>

						{totalInsights > PAGE_SIZE && (
							<div className="flex items-center justify-between pt-3 px-1">
								<Button
									size="sm"
									variant="outline"
									onClick={() => setPage((p) => Math.max(0, p - 1))}
									disabled={page === 0}
								>
									Önceki
								</Button>
								<span
									className="text-[11px] tnum"
									style={{ color: "var(--text-tertiary)" }}
								>
									{page + 1} / {Math.ceil(totalInsights / PAGE_SIZE)} ·{" "}
									{totalInsights} kayıt
								</span>
								<Button
									size="sm"
									variant="outline"
									onClick={() => setPage((p) => p + 1)}
									disabled={(page + 1) * PAGE_SIZE >= totalInsights}
								>
									Sonraki
								</Button>
							</div>
						)}
					</>
				)}
			</div>
		</PageShell>
	);
}

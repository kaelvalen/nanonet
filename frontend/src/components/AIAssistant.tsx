import {
	AlertTriangle,
	Bot,
	CheckCircle2,
	Clock,
	Download,
	Eye,
	FileText,
	MessageSquare,
	Send,
	Sparkles,
	Trash2,
	TrendingUp,
	X,
	Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useLocation, useParams } from "react-router";
import remarkGfm from "remark-gfm";
import {
	aiChatApi,
	aiReportApi,
	type ChatMessage,
	type ReportEvent,
	type ReportResult,
	TIME_RANGE_LABELS,
	type TimeRange,
} from "@/api/metrics";
import {
	AI_CHAT_DEFAULT_MESSAGE,
	type AIAssistantMode,
	useAIAssistantStore,
} from "@/store/aiAssistantStore";
import { useServiceStore } from "@/store/serviceStore";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

/* AIAssistant — global slide-in panel.

   Mounted once at the layout level. Open/close is driven by useAIAssistantStore:
   - CommandPalette `?` mode opens with seed query in chat mode.
   - TopBar sparkle button toggles open in chat mode.
   - The `seed` value (if any) is consumed once and submitted automatically.

   Two modes: `chat` (free-form Q&A) and `report` (period-scoped synthesis with
   PDF export). Both share the same chrome — header, mode tabs, body, footer.

   Layout: 420px wide on desktop, full-screen overlay below md. Right-aligned. */

const TIME_RANGES: TimeRange[] = ["1h", "24h", "7d", "30d"];

const CATEGORY_TOKENS: Record<
	ReportEvent["category"],
	{ label: string; color: string; icon: React.ReactNode }
> = {
	tamamlandı: {
		label: "Tamamlandı",
		color: "var(--status-up-text)",
		icon: <CheckCircle2 className="w-3 h-3" />,
	},
	müdahale_gerekli: {
		label: "Müdahale Gerekli",
		color: "var(--status-down-text)",
		icon: <AlertTriangle className="w-3 h-3" />,
	},
	izleniyor: {
		label: "İzleniyor",
		color: "var(--status-degraded-text)",
		icon: <Eye className="w-3 h-3" />,
	},
	trend: {
		label: "Trend",
		color: "var(--brand-primary)",
		icon: <TrendingUp className="w-3 h-3" />,
	},
};

const SCORE_TOKENS: Record<
	ReportResult["system_score"],
	{ accent: string; bg: string; text: string }
> = {
	SAĞLIKLI: {
		accent: "var(--status-up)",
		bg: "var(--status-up-subtle)",
		text: "var(--status-up-text)",
	},
	DİKKAT: {
		accent: "var(--status-degraded)",
		bg: "var(--status-degraded-subtle)",
		text: "var(--status-degraded-text)",
	},
	KRİTİK: {
		accent: "var(--status-down)",
		bg: "var(--status-down-subtle)",
		text: "var(--status-down-text)",
	},
};

const PRIORITY_TEXT: Record<string, string> = {
	high: "var(--status-down-text)",
	medium: "var(--status-degraded-text)",
	low: "var(--status-up-text)",
};

const SUGGESTIONS = [
	{ icon: Sparkles, label: "Sistem durumu nedir?" },
	{ icon: AlertTriangle, label: "Son anomalileri analiz et" },
	{ icon: Zap, label: "Performans önerileri ver" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Report view

function ReportView({
	report,
	onReset,
}: {
	report: ReportResult;
	onReset: () => void;
}) {
	const tokens = SCORE_TOKENS[report.system_score] ?? SCORE_TOKENS.DİKKAT;
	const [isExporting, setIsExporting] = useState(false);

	const handleExport = async () => {
		if (isExporting) return;
		setIsExporting(true);
		try {
			const { downloadReportPDF } = await import("./ReportPDF");
			await downloadReportPDF(report);
		} catch (err) {
			console.error("PDF export hatası:", err);
		} finally {
			setIsExporting(false);
		}
	};

	return (
		<div className="flex flex-col flex-1 min-h-0">
			<div className="flex-1 min-h-0 overflow-y-auto">
				{/* Score banner */}
				<div
					className="mx-3 mt-3 rounded-[6px] px-3.5 py-3 relative overflow-hidden"
					style={{
						background: tokens.bg,
						border: `1px solid var(--border-subtle)`,
					}}
				>
					<span
						aria-hidden
						className="absolute left-0 top-3 bottom-3 w-[2px] rounded-r-full"
						style={{ background: tokens.accent }}
					/>
					<div className="flex items-center justify-between mb-1 pl-2">
						<span
							className="text-[10px] font-bold uppercase tracking-wider tnum"
							style={{ color: tokens.text }}
						>
							{report.system_score}
						</span>
						<span
							className="text-[10px] tnum"
							style={{ color: "var(--text-faint)" }}
						>
							{report.period_label}
						</span>
					</div>
					<p
						className="text-[13px] font-semibold leading-snug pl-2"
						style={{ color: "var(--text-primary)" }}
					>
						{report.headline}
					</p>
					<div className="flex items-center gap-3 mt-2 pl-2">
						<span
							className="text-[11px] inline-flex items-center gap-1 tnum"
							style={{ color: "var(--status-down-text)" }}
						>
							<AlertTriangle className="w-3 h-3" />
							{report.critical_events} kritik
						</span>
						<span
							className="text-[11px] inline-flex items-center gap-1 tnum"
							style={{ color: "var(--status-up-text)" }}
						>
							<CheckCircle2 className="w-3 h-3" />
							{report.resolved_events} çözüldü
						</span>
					</div>
				</div>

				<div className="px-3 py-3 space-y-3">
					{/* Events */}
					{report.events.length > 0 && (
						<div>
							<p
								className="text-[10px] uppercase tracking-wider font-semibold px-0.5 mb-2"
								style={{ color: "var(--text-faint)" }}
							>
								Tespit edilen olaylar
							</p>
							<div className="space-y-2">
								{report.events.map((event) => {
									const cat =
										CATEGORY_TOKENS[event.category] ??
										CATEGORY_TOKENS.izleniyor;
									return (
										<div
											key={`${event.service}-${event.time}`}
											className="rounded-[6px] px-3 py-2.5"
											style={{
												background: "var(--surface-base)",
												border: "1px solid var(--border-subtle)",
											}}
										>
											<div className="flex items-start justify-between gap-2 mb-1.5">
												<div className="flex items-center gap-2 min-w-0">
													<span
														className="text-[12px] font-medium truncate"
														style={{ color: "var(--text-primary)" }}
													>
														{event.service}
													</span>
													<span
														className="text-[10px] tnum shrink-0"
														style={{ color: "var(--text-faint)" }}
													>
														{event.time}
													</span>
												</div>
												<span
													className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold shrink-0 px-1.5 py-0.5 rounded-[4px]"
													style={{
														color: cat.color,
														background: "var(--surface-sunken)",
														border: "1px solid var(--border-subtle)",
													}}
												>
													{cat.icon}
													{cat.label}
												</span>
											</div>
											<p
												className="text-[12px] leading-relaxed mb-2"
												style={{ color: "var(--text-secondary)" }}
											>
												{event.observation}
											</p>
											<dl
												className="text-[11px] space-y-1 pt-2"
												style={{
													borderTop: "1px solid var(--border-subtle)",
													color: "var(--text-tertiary)",
												}}
											>
												<div>
													<dt
														className="inline font-medium"
														style={{ color: "var(--text-secondary)" }}
													>
														Kök neden:
													</dt>{" "}
													<dd className="inline">{event.root_cause}</dd>
												</div>
												<div>
													<dt
														className="inline font-medium"
														style={{ color: "var(--text-secondary)" }}
													>
														Müdahale:
													</dt>{" "}
													<dd className="inline">{event.action}</dd>
												</div>
												{event.outcome && (
													<div>
														<dt
															className="inline font-medium"
															style={{ color: "var(--status-up-text)" }}
														>
															Sonuç:
														</dt>{" "}
														<dd className="inline">{event.outcome}</dd>
													</div>
												)}
											</dl>
										</div>
									);
								})}
							</div>
						</div>
					)}

					{/* Actions */}
					{report.actions.length > 0 && (
						<div>
							<p
								className="text-[10px] uppercase tracking-wider font-semibold px-0.5 mb-2"
								style={{ color: "var(--text-faint)" }}
							>
								Önerilen aksiyonlar
							</p>
							<div className="space-y-1.5">
								{report.actions.map((action) => (
									<div
										key={`${action.action}-${action.priority}`}
										className="flex items-start gap-2.5 rounded-[6px] px-3 py-2"
										style={{
											background: "var(--surface-base)",
											border: "1px solid var(--border-subtle)",
										}}
									>
										<span
											className="text-[10px] font-semibold uppercase tracking-wider mt-0.5 shrink-0 px-1.5 py-0.5 rounded-[4px]"
											style={{
												color:
													PRIORITY_TEXT[action.priority] ??
													"var(--text-tertiary)",
												background: "var(--surface-sunken)",
											}}
										>
											{action.priority}
										</span>
										<div className="min-w-0">
											<p
												className="text-[12px] font-medium"
												style={{ color: "var(--text-primary)" }}
											>
												{action.action}
											</p>
											{action.estimated_impact && (
												<p
													className="text-[11px] mt-0.5"
													style={{ color: "var(--text-tertiary)" }}
												>
													{action.estimated_impact}
												</p>
											)}
										</div>
									</div>
								))}
							</div>
						</div>
					)}

					{/* Risk forecast */}
					{report.risk_forecast && (
						<div
							className="rounded-[6px] px-3 py-2.5 relative"
							style={{
								background: "var(--brand-primary-subtle)",
								border: "1px solid var(--border-subtle)",
							}}
						>
							<span
								aria-hidden
								className="absolute left-0 top-3 bottom-3 w-[2px] rounded-r-full"
								style={{ background: "var(--brand-primary)" }}
							/>
							<p
								className="text-[10px] uppercase tracking-wider font-semibold mb-1 pl-2"
								style={{ color: "var(--brand-primary)" }}
							>
								Önümüzdeki 7 gün riski
							</p>
							<p
								className="text-[12px] leading-relaxed pl-2"
								style={{ color: "var(--text-secondary)" }}
							>
								{report.risk_forecast}
							</p>
						</div>
					)}
				</div>
			</div>

			<footer
				className="px-3 py-3 shrink-0 flex gap-2"
				style={{ borderTop: "1px solid var(--border-subtle)" }}
			>
				<Button
					variant="outline"
					size="sm"
					onClick={onReset}
					className="flex-1"
				>
					Yeni rapor
				</Button>
				<Button
					size="sm"
					onClick={handleExport}
					disabled={isExporting}
					className="flex-1"
				>
					{isExporting ? (
						<>
							<span className="w-3 h-3 border-2 border-current/40 border-t-current rounded-full animate-spin mr-1.5" />
							Hazırlanıyor…
						</>
					) : (
						<>
							<Download className="w-3.5 h-3.5 mr-1.5" />
							PDF indir
						</>
					)}
				</Button>
			</footer>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main panel

export function AIAssistant() {
	const {
		isOpen,
		mode,
		setMode,
		close,
		consumeSeed,
		appendChatMessage,
		resetChatMessages,
	} = useAIAssistantStore();
	const [message, setMessage] = useState("");
	const [isAnalyzing, setIsAnalyzing] = useState(false);
	const [selectedRange, setSelectedRange] = useState<TimeRange>("24h");
	const [report, setReport] = useState<ReportResult | null>(null);
	const [isGeneratingReport, setIsGeneratingReport] = useState(false);

	const { services } = useServiceStore();
	const { id: urlServiceId } = useParams<{ id: string }>();
	const { pathname } = useLocation();
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	const contextServiceId = useMemo(() => {
		if (urlServiceId) return urlServiceId;
		const match = pathname.match(/\/services\/([^/]+)/);
		return match?.[1] ?? undefined;
	}, [urlServiceId, pathname]);

	const contextServiceName = useMemo(
		() => services.find((s) => s.id === contextServiceId)?.name,
		[services, contextServiceId],
	);
	const chatContextKey = contextServiceId
		? `service:${contextServiceId}`
		: "global";
	const chatMessages = useAIAssistantStore(
		(s) => s.chatByContext[chatContextKey] ?? [AI_CHAT_DEFAULT_MESSAGE],
	);
	const chatMessagesRef = useRef(chatMessages);

	useEffect(() => {
		chatMessagesRef.current = chatMessages;
	}, [chatMessages]);

	const now = () =>
		new Date().toLocaleTimeString("tr-TR", {
			hour: "2-digit",
			minute: "2-digit",
		});

	const sendMessage = async (text: string) => {
		if (!text.trim() || isAnalyzing) return;
		appendChatMessage(chatContextKey, {
			id: `user-${Date.now()}`,
			role: "user",
			text,
			time: now(),
		});
		setMessage("");
		setIsAnalyzing(true);
		try {
			const history: ChatMessage[] = chatMessagesRef.current.slice(-10).map((m) => ({
				role: m.role === "user" ? "user" : "assistant",
				content: m.text,
			}));
			const result = await aiChatApi.chat(
				text,
				history,
				contextServiceId ?? "global",
			);
			appendChatMessage(chatContextKey, {
				id: `ai-${Date.now()}`,
				role: "ai",
				text: result.reply,
				time: now(),
			});
		} catch {
			appendChatMessage(chatContextKey, {
				id: `ai-err-${Date.now()}`,
				role: "ai",
				text: "AI asistanı geçici olarak kullanılamıyor.",
				time: now(),
			});
		} finally {
			setIsAnalyzing(false);
		}
	};

	// Consume seed from store on open and auto-submit. We intentionally only
	// re-run when the panel opens or the mode changes; sendMessage closes over
	// fresh state via setChatMessages updater functions.
	// biome-ignore lint/correctness/useExhaustiveDependencies: sendMessage is a stable closure within a single open
	useEffect(() => {
		if (!isOpen) return;
		const seed = consumeSeed();
		if (seed?.trim()) {
			void sendMessage(seed);
		}
		if (mode === "chat") {
			requestAnimationFrame(() => inputRef.current?.focus());
		}
	}, [isOpen, consumeSeed, mode, chatContextKey]);

	// Auto-scroll on new messages or while analyzing.
	// biome-ignore lint/correctness/useExhaustiveDependencies: chatMessages/isAnalyzing are intentional triggers
	useEffect(() => {
		if (isOpen && mode === "chat") {
			messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
		}
	}, [chatMessages, isAnalyzing, isOpen, mode]);

	// Close on Escape
	useEffect(() => {
		if (!isOpen) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") close();
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [isOpen, close]);

	const handleGenerateReport = async () => {
		setIsGeneratingReport(true);
		setReport(null);
		try {
			const result = await aiReportApi.generate(
				selectedRange,
				contextServiceId,
			);
			setReport(result);
		} catch {
			setMode("chat");
			appendChatMessage(chatContextKey, {
				id: `ai-err-${Date.now()}`,
				role: "ai",
				text: "Rapor oluşturulamadı, lütfen tekrar deneyin.",
				time: now(),
			});
		} finally {
			setIsGeneratingReport(false);
		}
	};

	const onlineServices = services.filter((s) => s.status === "up").length;
	const isBusy = isAnalyzing || isGeneratingReport;

	const tabs: {
		id: AIAssistantMode;
		label: string;
		icon: React.ElementType;
	}[] = [
		{ id: "chat", label: "Sohbet", icon: MessageSquare },
		{ id: "report", label: "Rapor", icon: FileText },
	];

	return (
		<AnimatePresence>
			{isOpen && (
				<>
					{/* Scrim */}
					<motion.div
						key="ai-scrim"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.16 }}
						className="fixed inset-0 z-40"
						style={{ background: "rgba(0,0,0,0.35)" }}
						onClick={close}
						aria-hidden
					/>

					{/* Panel */}
					<motion.aside
						key="ai-panel"
						role="dialog"
						aria-label="AI Asistan"
						aria-modal
						initial={{ x: "100%" }}
						animate={{ x: 0 }}
						exit={{ x: "100%" }}
						transition={{
							duration: 0.24,
							ease: [0.2, 0, 0, 1],
						}}
						className="fixed top-0 right-0 bottom-0 z-50 flex flex-col w-full sm:w-[420px]"
						style={{
							background: "var(--surface-overlay)",
							borderLeft: "1px solid var(--border-subtle)",
							boxShadow: "var(--shadow-lg)",
						}}
					>
						{/* Header */}
						<header
							className="flex items-center justify-between px-4 py-3 shrink-0"
							style={{ borderBottom: "1px solid var(--border-subtle)" }}
						>
							<div className="flex items-center gap-2.5 min-w-0">
								<div
									className="relative w-8 h-8 rounded-[6px] flex items-center justify-center shrink-0"
									style={{
										background: "var(--surface-sunken)",
										border: "1px solid var(--border-subtle)",
									}}
								>
									<Bot
										className="w-4 h-4"
										style={{ color: "var(--brand-primary)" }}
									/>
									<span
										className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full"
										style={{
											background: isBusy
												? "var(--status-degraded)"
												: "var(--status-up)",
											border: "2px solid var(--surface-overlay)",
										}}
									/>
								</div>
								<div className="min-w-0">
									<p
										className="text-[13px] font-semibold leading-none truncate"
										style={{ color: "var(--text-primary)" }}
									>
										NanoNet SRE Agent
									</p>
									<p
										className="text-[10px] uppercase tracking-wider font-semibold mt-1.5 truncate"
										style={{
											color: isBusy
												? "var(--status-degraded-text)"
												: "var(--text-tertiary)",
										}}
									>
										{isBusy
											? mode === "report"
												? "Rapor hazırlanıyor…"
												: "Analiz ediyor…"
											: contextServiceName
												? `Bağlam · ${contextServiceName}`
												: "Aktif izleniyor"}
									</p>
								</div>
							</div>
							<div className="flex items-center gap-1 shrink-0">
								{mode === "chat" && chatMessages.length > 1 && (
									<button
										type="button"
										onClick={() => {
											resetChatMessages(chatContextKey);
											requestAnimationFrame(() => inputRef.current?.focus());
										}}
										disabled={isAnalyzing}
										className="w-8 h-8 rounded-[6px] flex items-center justify-center transition-colors hover:bg-[var(--surface-sunken)] disabled:opacity-40 outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
										aria-label="Sohbeti temizle"
										title="Sohbeti temizle"
										style={{ color: "var(--text-tertiary)" }}
									>
										<Trash2 className="w-4 h-4" />
									</button>
								)}
								<button
									type="button"
									onClick={close}
									className="w-8 h-8 rounded-[6px] flex items-center justify-center transition-colors hover:bg-[var(--surface-sunken)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
									aria-label="Kapat"
									style={{ color: "var(--text-tertiary)" }}
								>
									<X className="w-4 h-4" />
								</button>
							</div>
						</header>

						{/* Mode tabs */}
						<div
							role="tablist"
							aria-label="Asistan modu"
							className="flex items-center gap-1 px-3 shrink-0"
							style={{ borderBottom: "1px solid var(--border-subtle)" }}
						>
							{tabs.map((t) => {
								const isActive = mode === t.id;
								const Icon = t.icon;
								return (
									<button
										key={t.id}
										type="button"
										role="tab"
										aria-selected={isActive}
										onClick={() => setMode(t.id)}
										className="relative inline-flex items-center gap-1.5 px-2.5 h-10 text-[12px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] rounded-[4px]"
										style={{
											color: isActive
												? "var(--text-primary)"
												: "var(--text-tertiary)",
										}}
									>
										<Icon
											className="w-3.5 h-3.5"
											style={{
												color: isActive
													? "var(--brand-primary)"
													: "currentColor",
											}}
										/>
										{t.label}
										{isActive && (
											<span
												aria-hidden
												className="absolute left-2 right-2 -bottom-px h-[2px] rounded-t-full"
												style={{ background: "var(--brand-primary)" }}
											/>
										)}
									</button>
								);
							})}
						</div>

						{/* Body */}
						{mode === "chat" ? (
							<>
								<div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-3">
									{chatMessages.map((msg) => (
										<div
											key={msg.id}
											className={`flex ${
												msg.role === "user" ? "justify-end" : "justify-start"
											}`}
										>
											<div
												className={
													msg.role === "user" ? "max-w-[80%]" : "max-w-[92%]"
												}
											>
												<div
													className="px-3 py-2 text-[13px] leading-relaxed rounded-[6px]"
													style={
														msg.role === "ai"
															? {
																	background: "var(--surface-base)",
																	color: "var(--text-secondary)",
																	border: "1px solid var(--border-subtle)",
																}
															: {
																	background: "var(--brand-primary)",
																	color: "var(--brand-on-primary)",
																}
													}
												>
													<div className="prose prose-sm max-w-none prose-p:my-0 prose-p:leading-relaxed prose-headings:font-semibold prose-code:text-[12px]">
														<ReactMarkdown remarkPlugins={[remarkGfm]}>
															{msg.text}
														</ReactMarkdown>
													</div>
												</div>
												<p
													className={`text-[10px] tnum mt-1 px-1 ${
														msg.role === "user" ? "text-right" : ""
													}`}
													style={{ color: "var(--text-faint)" }}
												>
													{msg.time}
												</p>
											</div>
										</div>
									))}

									{isAnalyzing && (
										<div className="flex justify-start">
											<div
												className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[6px]"
												style={{
													background: "var(--surface-base)",
													border: "1px solid var(--border-subtle)",
												}}
											>
												{[0, 0.15, 0.3].map((d) => (
													<span
														key={d}
														className="w-1.5 h-1.5 rounded-full animate-bounce"
														style={{
															background: "var(--text-tertiary)",
															animationDelay: `${d}s`,
														}}
													/>
												))}
											</div>
										</div>
									)}

									{/* Suggestions — only on first turn */}
									{chatMessages.length <= 1 && !isAnalyzing && (
										<div className="space-y-2 pt-1">
											<p
												className="text-[10px] uppercase tracking-wider font-semibold px-1"
												style={{ color: "var(--text-faint)" }}
											>
												Hızlı sorgular
											</p>
											{SUGGESTIONS.map(({ icon: Icon, label }) => (
												<button
													key={label}
													type="button"
													onClick={() => sendMessage(label)}
													className="w-full flex items-center gap-2 px-3 py-2 rounded-[6px] text-[12px] transition-colors hover:bg-[var(--surface-sunken)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
													style={{
														background: "var(--surface-base)",
														border: "1px solid var(--border-subtle)",
														color: "var(--text-secondary)",
													}}
												>
													<Icon
														className="w-3.5 h-3.5 shrink-0"
														style={{ color: "var(--brand-primary)" }}
													/>
													<span className="truncate">{label}</span>
												</button>
											))}

											{services.length > 0 && (
												<div
													className="rounded-[6px] px-3 py-2.5 flex items-center justify-between mt-3"
													style={{
														background: "var(--surface-base)",
														border: "1px solid var(--border-subtle)",
													}}
												>
													<div>
														<p
															className="text-[10px] uppercase tracking-wider font-semibold"
															style={{ color: "var(--text-faint)" }}
														>
															Sistem sağlığı
														</p>
														<p
															className="text-[11px] mt-0.5"
															style={{ color: "var(--text-tertiary)" }}
														>
															{contextServiceName ?? "Tüm servisler"}
														</p>
													</div>
													<p
														className="text-[15px] font-semibold tnum"
														style={{ color: "var(--text-primary)" }}
													>
														{onlineServices}
														<span style={{ color: "var(--text-faint)" }}>
															/{services.length}
														</span>
													</p>
												</div>
											)}
										</div>
									)}

									<div ref={messagesEndRef} />
								</div>

								{/* Composer */}
								<div
									className="px-3 py-3 shrink-0"
									style={{ borderTop: "1px solid var(--border-subtle)" }}
								>
									<div
										className="flex items-center gap-2 pr-1.5 pl-3 rounded-[6px]"
										style={{
											background: "var(--surface-base)",
											border: "1px solid var(--border-subtle)",
										}}
									>
										<Input
											ref={inputRef}
											placeholder="Bir şey sor…"
											value={message}
											onChange={(e) => setMessage(e.target.value)}
											onKeyDown={(e) => {
												if (e.key === "Enter" && !e.shiftKey) {
													e.preventDefault();
													sendMessage(message);
												}
											}}
											disabled={isAnalyzing}
											className="flex-1 border-0 shadow-none focus-visible:ring-0 focus-visible:shadow-none px-0 h-9 text-[13px]"
											// Input bileşeni bg/border'ı inline style ile bastığından
											// className override'ları kazanmaz; pill'e karışması için
											// burada da inline olarak nötrle.
											style={{ background: "transparent", borderColor: "transparent" }}
										/>
										<button
											type="button"
											onClick={() => sendMessage(message)}
											disabled={isAnalyzing || !message.trim()}
											className="w-7 h-7 rounded-[4px] flex items-center justify-center shrink-0 transition-colors disabled:opacity-40 outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
											style={{
												background: "var(--brand-primary)",
												color: "var(--brand-on-primary)",
											}}
											aria-label="Gönder"
										>
											<Send className="w-3.5 h-3.5" />
										</button>
									</div>
								</div>
							</>
						) : (
							<>
								{/* Report mode */}
								{!report && !isGeneratingReport && (
									<div className="flex-1 flex flex-col justify-center px-4 py-6 gap-5">
										<div className="text-center">
											<div
												className="w-12 h-12 rounded-[6px] flex items-center justify-center mx-auto mb-3"
												style={{
													background: "var(--surface-sunken)",
													border: "1px solid var(--border-subtle)",
												}}
											>
												<FileText
													className="w-5 h-5"
													style={{ color: "var(--brand-primary)" }}
												/>
											</div>
											<p
												className="text-[14px] font-semibold"
												style={{ color: "var(--text-primary)" }}
											>
												Dönemsel rapor
											</p>
											<p
												className="text-[12px] mt-1 leading-relaxed"
												style={{ color: "var(--text-tertiary)" }}
											>
												{contextServiceName
													? `${contextServiceName} servisi için`
													: "Tüm servisler için"}{" "}
												bir aralık seç ve rapor oluştur.
											</p>
										</div>

										<div
											role="radiogroup"
											aria-label="Zaman aralığı"
											className="grid grid-cols-2 gap-2"
										>
											{TIME_RANGES.map((range) => {
												const active = selectedRange === range;
												return (
													// biome-ignore lint/a11y/useSemanticElements: visual segmented control inside an explicit radiogroup
													<button
														key={range}
														type="button"
														role="radio"
														aria-checked={active}
														onClick={() => setSelectedRange(range)}
														className="flex flex-col items-center justify-center py-3 rounded-[6px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
														style={{
															background: active
																? "var(--brand-primary-subtle)"
																: "var(--surface-base)",
															border: `1px solid ${
																active
																	? "var(--brand-primary)"
																	: "var(--border-subtle)"
															}`,
															color: active
																? "var(--brand-primary)"
																: "var(--text-secondary)",
														}}
													>
														<Clock className="w-4 h-4 mb-1" />
														<span className="text-[12px] font-semibold">
															{TIME_RANGE_LABELS[range]}
														</span>
													</button>
												);
											})}
										</div>

										<Button
											size="default"
											onClick={handleGenerateReport}
											className="w-full"
										>
											<Sparkles className="w-4 h-4 mr-1.5" />
											Rapor oluştur
										</Button>
									</div>
								)}

								{isGeneratingReport && (
									<div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
										<div
											className="w-12 h-12 rounded-[6px] flex items-center justify-center"
											style={{
												background: "var(--surface-sunken)",
												border: "1px solid var(--border-subtle)",
											}}
										>
											<Sparkles
												className="w-5 h-5 animate-pulse"
												style={{ color: "var(--brand-primary)" }}
											/>
										</div>
										<div className="text-center">
											<p
												className="text-[13px] font-semibold"
												style={{ color: "var(--text-primary)" }}
											>
												Sistemi tarıyorum…
											</p>
											<p
												className="text-[11px] mt-1"
												style={{ color: "var(--text-tertiary)" }}
											>
												{TIME_RANGE_LABELS[selectedRange]} verisi analiz
												ediliyor
											</p>
										</div>
										<div className="flex gap-1">
											{[0, 0.2, 0.4].map((d) => (
												<span
													key={d}
													className="w-1.5 h-1.5 rounded-full animate-bounce"
													style={{
														background: "var(--brand-primary)",
														animationDelay: `${d}s`,
													}}
												/>
											))}
										</div>
									</div>
								)}

								{report && !isGeneratingReport && (
									<ReportView report={report} onReset={() => setReport(null)} />
								)}
							</>
						)}
					</motion.aside>
				</>
			)}
		</AnimatePresence>
	);
}

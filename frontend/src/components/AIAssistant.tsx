import {
	AlertTriangle,
	Bot,
	CheckCircle2,
	ChevronRight,
	Clock,
	Download,
	Eye,
	FileText,
	Maximize2,
	MessageSquare,
	Minimize2,
	Send,
	Sparkles,
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
	TIME_RANGE_LABELS,
	type TimeRange,
	aiChatApi,
	aiReportApi,
	type ChatMessage,
	type ReportEvent,
	type ReportResult,
} from "@/api/metrics";
import { downloadReportPDF } from "./ReportPDF";
import { useServiceStore } from "@/store/serviceStore";
import { Input } from "./ui/input";

type PanelMode = "chat" | "report";

const TIME_RANGES: TimeRange[] = ["1h", "24h", "7d", "30d"];

const CATEGORY_CONFIG: Record<
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
		color: "var(--status-warn-text)",
		icon: <Eye className="w-3 h-3" />,
	},
	trend: {
		label: "Trend",
		color: "var(--color-lavender)",
		icon: <TrendingUp className="w-3 h-3" />,
	},
};

const SCORE_CONFIG: Record<
	ReportResult["system_score"],
	{ bg: string; text: string; border: string }
> = {
	SAĞLIKLI: {
		bg: "var(--status-up-subtle)",
		text: "var(--status-up-text)",
		border: "var(--status-up-border)",
	},
	DİKKAT: {
		bg: "var(--status-warn-subtle)",
		text: "var(--status-warn-text)",
		border: "var(--status-warn-border)",
	},
	KRİTİK: {
		bg: "var(--status-down-subtle)",
		text: "var(--status-down-text)",
		border: "var(--status-down-border)",
	},
};

const PRIORITY_COLOR: Record<string, string> = {
	high: "var(--status-down-text)",
	medium: "var(--status-warn-text)",
	low: "var(--status-up-text)",
};


function ReportView({
	report,
	onClose,
}: {
	report: ReportResult;
	onClose: () => void;
}) {
	const scoreConfig = SCORE_CONFIG[report.system_score] ?? SCORE_CONFIG["DİKKAT"];
	const [isExporting, setIsExporting] = useState(false);

	const handleExport = () => {
		if (isExporting) return;
		setIsExporting(true);
		try {
			downloadReportPDF(report);
		} finally {
			setIsExporting(false);
		}
	};

	return (
			<div className="flex flex-col h-full">
			<div className="flex-1 overflow-y-auto">
			<div>
			{/* Period + score banner */}
			<div
				className="mx-3 mt-3 rounded-xl px-3.5 py-3 shrink-0"
				style={{
					background: scoreConfig.bg,
					border: `1px solid ${scoreConfig.border}`,
				}}
			>
				<div className="flex items-center justify-between mb-1">
					<span
						className="text-[10px] font-bold tracking-widest uppercase"
						style={{ color: scoreConfig.text }}
					>
						{report.system_score}
					</span>
					<span
						className="text-[10px] font-medium"
						style={{ color: "var(--text-faint)" }}
					>
						{report.period_label}
					</span>
				</div>
				<p
					className="text-sm font-semibold leading-snug"
					style={{ color: "var(--text-primary)" }}
				>
					{report.headline}
				</p>
				<div className="flex items-center gap-3 mt-2">
					<span
						className="text-[11px] flex items-center gap-1"
						style={{ color: "var(--status-down-text)" }}
					>
						<AlertTriangle className="w-3 h-3" />
						{report.critical_events} kritik
					</span>
					<span
						className="text-[11px] flex items-center gap-1"
						style={{ color: "var(--status-up-text)" }}
					>
						<CheckCircle2 className="w-3 h-3" />
						{report.resolved_events} çözüldü
					</span>
				</div>
			</div>

			<div className="px-3 py-2.5 space-y-2">
				{/* Events */}
				{report.events.length > 0 && (
					<div>
						<p
							className="text-[10px] font-bold tracking-widest uppercase px-0.5 mb-1.5"
							style={{ color: "var(--text-faint)" }}
						>
							Tespit Edilen Olaylar
						</p>
						<div className="space-y-2">
							{report.events.map((event, i) => {
								const cat =
									CATEGORY_CONFIG[event.category] ??
									CATEGORY_CONFIG["izleniyor"];
								return (
									<div
										key={`evt-${i}`}
										className="rounded-xl px-3 py-2.5"
										style={{
											background: "var(--surface-sunken)",
											border: "1px solid var(--border-subtle)",
										}}
									>
										<div className="flex items-start justify-between gap-2 mb-1.5">
											<div className="flex items-center gap-1.5 min-w-0">
												<span
													className="font-semibold text-xs truncate"
													style={{ color: "var(--text-primary)" }}
												>
													{event.service}
												</span>
												<span
													className="text-[10px]"
													style={{ color: "var(--text-faint)" }}
												>
													{event.time}
												</span>
											</div>
											<span
												className="flex items-center gap-1 text-[10px] font-semibold shrink-0 px-1.5 py-0.5 rounded-full"
												style={{
													color: cat.color,
													background: "var(--surface-raised)",
													border: "1px solid var(--border-subtle)",
												}}
											>
												{cat.icon}
												{cat.label}
											</span>
										</div>
										<p
											className="text-xs leading-relaxed mb-1"
											style={{ color: "var(--text-secondary)" }}
										>
											{event.observation}
										</p>
										<div
											className="text-[11px] space-y-0.5 pt-1.5"
											style={{
												borderTop: "1px solid var(--border-subtle)",
												color: "var(--text-faint)",
											}}
										>
											<p>
												<span className="font-medium" style={{ color: "var(--text-secondary)" }}>
													Kök neden:
												</span>{" "}
												{event.root_cause}
											</p>
											<p>
												<span className="font-medium" style={{ color: "var(--text-secondary)" }}>
													Müdahale:
												</span>{" "}
												{event.action}
											</p>
											{event.outcome && (
												<p>
													<span className="font-medium" style={{ color: "var(--status-up-text)" }}>
														Sonuç:
													</span>{" "}
													{event.outcome}
												</p>
											)}
										</div>
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
							className="text-[10px] font-bold tracking-widest uppercase px-0.5 mb-1.5"
							style={{ color: "var(--text-faint)" }}
						>
							Önerilen Aksiyonlar
						</p>
						<div className="space-y-1.5">
							{report.actions.map((action, i) => (
								<div
									key={`act-${i}`}
									className="flex items-start gap-2.5 rounded-lg px-3 py-2"
									style={{
										background: "var(--surface-sunken)",
										border: "1px solid var(--border-subtle)",
									}}
								>
									<span
										className="text-[10px] font-bold uppercase mt-0.5 shrink-0 px-1.5 py-0.5 rounded"
										style={{
											color: PRIORITY_COLOR[action.priority] ?? "var(--text-faint)",
											background: "var(--surface-raised)",
											border: "1px solid var(--border-subtle)",
										}}
									>
										{action.priority}
									</span>
									<div className="min-w-0">
										<p
											className="text-xs font-medium"
											style={{ color: "var(--text-primary)" }}
										>
											{action.action}
										</p>
										{action.estimated_impact && (
											<p
												className="text-[11px] mt-0.5"
												style={{ color: "var(--text-faint)" }}
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
						className="rounded-xl px-3 py-2.5"
						style={{
							background: "var(--color-lavender-subtle)",
							border: "1px solid var(--color-lavender-border)",
						}}
					>
						<p
							className="text-[10px] font-bold tracking-widest uppercase mb-1"
							style={{ color: "var(--color-lavender)" }}
						>
							Önümüzdeki 7 Gün Riski
						</p>
						<p
							className="text-xs leading-relaxed"
							style={{ color: "var(--text-secondary)" }}
						>
							{report.risk_forecast}
						</p>
					</div>
				)}
			</div>
			</div>
			</div>

			<div className="px-3 pb-3 pt-1 shrink-0 flex gap-2">
				<button
					type="button"
					onClick={onClose}
					className="flex-1 py-2 rounded-xl text-xs font-semibold transition-opacity hover:opacity-80"
					style={{
						background: "var(--surface-sunken)",
						color: "var(--text-secondary)",
						border: "1px solid var(--border-default)",
					}}
				>
					Yeni rapor
				</button>
				<motion.button
					type="button"
					onClick={handleExport}
					disabled={isExporting}
					className="flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
					style={{
						background: "var(--gradient-btn-primary)",
						color: "#fff",
						boxShadow: "0 3px 8px rgba(79,70,229,0.25)",
					}}
					whileHover={{ scale: isExporting ? 1 : 1.02 }}
					whileTap={{ scale: 0.97 }}
				>
					{isExporting ? (
						<>
							<span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
							Hazırlanıyor...
						</>
					) : (
						<>
							<Download className="w-3.5 h-3.5" />
							PDF İndir
						</>
					)}
				</motion.button>
			</div>
		</div>
	);
}

export function AIAssistant() {
	const [isOpen, setIsOpen] = useState(false);
	const [isMinimized, setIsMinimized] = useState(false);
	const [mode, setMode] = useState<PanelMode>("chat");
	const [message, setMessage] = useState("");
	const [chatMessages, setChatMessages] = useState<
		{ id: string; role: "ai" | "user"; text: string; time: string }[]
	>([
		{
			id: "init",
			role: "ai",
			text: "Zaten baktım. Bir şeyler var — rapor oluşturmamı ister misin yoksa soru mu sormak istiyorsun?",
			time: "Şimdi",
		},
	]);
	const [isAnalyzing, setIsAnalyzing] = useState(false);
	const [selectedRange, setSelectedRange] = useState<TimeRange>("24h");
	const [report, setReport] = useState<ReportResult | null>(null);
	const [isGeneratingReport, setIsGeneratingReport] = useState(false);
	const { services } = useServiceStore();
	const { id: urlServiceId } = useParams<{ id: string }>();
	const { pathname } = useLocation();
	const messagesEndRef = useRef<HTMLDivElement>(null);

	const contextServiceId = useMemo(() => {
		if (urlServiceId) return urlServiceId;
		const match = pathname.match(/\/services\/([^/]+)/);
		return match?.[1] ?? undefined;
	}, [urlServiceId, pathname]);

	const contextServiceName = useMemo(
		() => services.find((s) => s.id === contextServiceId)?.name,
		[services, contextServiceId],
	);

	useEffect(() => {
		if (isOpen && !isMinimized && mode === "chat") {
			messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
		}
	}, [chatMessages, isOpen, isMinimized, mode]);

	const now = () =>
		new Date().toLocaleTimeString("tr-TR", {
			hour: "2-digit",
			minute: "2-digit",
		});

	const handleSend = async () => {
		if (!message.trim() || isAnalyzing) return;
		const userMsg = message;
		setMessage("");
		setChatMessages((prev) => [
			...prev,
			{ id: `user-${Date.now()}`, role: "user", text: userMsg, time: now() },
		]);
		setIsAnalyzing(true);
		try {
			const history: ChatMessage[] = chatMessages.slice(-10).map((m) => ({
				role: m.role === "user" ? "user" : "assistant",
				content: m.text,
			}));
			const result = await aiChatApi.chat(
				userMsg,
				history,
				contextServiceId ?? "global",
			);
			setChatMessages((prev) => [
				...prev,
				{ id: `ai-${Date.now()}`, role: "ai", text: result.reply, time: now() },
			]);
		} catch {
			setChatMessages((prev) => [
				...prev,
				{
					id: `ai-err-${Date.now()}`,
					role: "ai",
					text: "AI asistanı geçici olarak kullanılamıyor.",
					time: now(),
				},
			]);
		} finally {
			setIsAnalyzing(false);
		}
	};

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
			setChatMessages((prev) => [
				...prev,
				{
					id: `ai-err-${Date.now()}`,
					role: "ai",
					text: "Rapor oluşturulamadı, lütfen tekrar deneyin.",
					time: now(),
				},
			]);
			setMode("chat");
		} finally {
			setIsGeneratingReport(false);
		}
	};

	const onlineServices = services.filter((s) => s.status === "up").length;
	const isBusy = isAnalyzing || isGeneratingReport;

	const SUGGESTION_ITEMS = [
		{
			icon: <Sparkles className="w-3.5 h-3.5" />,
			label: "Sistem durumu nedir?",
		},
		{
			icon: <AlertTriangle className="w-3.5 h-3.5" />,
			label: "Son anomalileri analiz et",
		},
		{ icon: <Zap className="w-3.5 h-3.5" />, label: "Performans önerileri ver" },
	];

	return (
		<>
			{/* Trigger button */}
			<AnimatePresence>
				{!isOpen && (
					<motion.button
						type="button"
						initial={{ scale: 0, opacity: 0 }}
						animate={{ scale: 1, opacity: 1 }}
						exit={{ scale: 0, opacity: 0 }}
						onClick={() => setIsOpen(true)}
						className="fixed bottom-20 right-4 md:bottom-8 md:right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95"
						style={{
							background: "var(--gradient-logo)",
							boxShadow: "0 4px 20px rgba(79,70,229,0.35)",
						}}
					>
						<Sparkles className="w-4 h-4 text-white" />
						<span className="text-white text-xs font-bold tracking-wide">AI</span>
					</motion.button>
				)}
			</AnimatePresence>

			{/* Chat / Report panel */}
			<AnimatePresence>
				{isOpen && (
					<motion.div
						initial={{ opacity: 0, y: 24, scale: 0.94 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: 20, scale: 0.94 }}
						transition={{ type: "spring", stiffness: 400, damping: 32 }}
						className={`fixed z-50 flex flex-col rounded-2xl overflow-hidden
						bottom-20 right-4 left-4
						md:bottom-8 md:right-6 md:left-auto md:w-96
						${isMinimized ? "h-14" : "h-[78vh] max-h-175"}`}
						style={{
							background: "var(--surface-card)",
							border: "1px solid var(--border-default)",
							boxShadow:
								"0 24px 64px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08)",
						}}
					>
						{/* Header */}
						<div
							className="flex items-center justify-between px-4 py-3 shrink-0"
							style={{
								background: "var(--surface-raised)",
								borderBottom: "1px solid var(--border-default)",
							}}
						>
							<div className="flex items-center gap-2.5">
								<div className="relative shrink-0">
									<div
										className="w-8 h-8 rounded-full flex items-center justify-center"
										style={{
											background: "var(--color-lavender-subtle)",
											border: "1px solid var(--color-lavender-border)",
										}}
									>
										<Bot
											className="w-4 h-4"
											style={{ color: "var(--color-lavender)" }}
										/>
									</div>
									<span
										className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2"
										style={{
											background: isBusy
												? "var(--status-warn)"
												: "var(--status-up)",
											borderColor: "var(--surface-raised)",
										}}
									/>
								</div>
								<div>
									<p
										className="text-sm font-bold leading-none"
										style={{ color: "var(--text-primary)" }}
									>
										NanoNet SRE Agent
									</p>
									<p
										className="text-[10px] font-semibold tracking-wider uppercase mt-0.5"
										style={{
											color: isBusy
												? "var(--status-warn-text)"
												: "var(--status-up-text)",
										}}
									>
										{isBusy
											? mode === "report"
												? "Rapor hazırlanıyor..."
												: "Analiz ediliyor..."
											: contextServiceName
												? contextServiceName
												: "Aktif izleniyor"}
									</p>
								</div>
							</div>
							<div className="flex items-center gap-1">
								<button
									type="button"
									onClick={() => setIsMinimized(!isMinimized)}
									className="w-7 h-7 rounded-full flex items-center justify-center hover:opacity-70"
									style={{ color: "var(--text-faint)" }}
								>
									{isMinimized ? (
										<Maximize2 className="w-3.5 h-3.5" />
									) : (
										<Minimize2 className="w-3.5 h-3.5" />
									)}
								</button>
								<button
									type="button"
									onClick={() => setIsOpen(false)}
									className="w-7 h-7 rounded-full flex items-center justify-center hover:opacity-70"
									style={{ color: "var(--text-faint)" }}
								>
									<X className="w-3.5 h-3.5" />
								</button>
							</div>
						</div>

						{!isMinimized && (
							<>
								{/* Mode tabs */}
								<div
									className="flex shrink-0 px-3 pt-2.5 pb-0 gap-1"
									style={{ borderBottom: "1px solid var(--border-subtle)" }}
								>
									{(["chat", "report"] as PanelMode[]).map((m) => (
										<button
											key={m}
											type="button"
											onClick={() => setMode(m)}
											className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-all"
											style={
												mode === m
													? {
															color: "var(--color-lavender)",
															borderBottom: "2px solid var(--color-lavender)",
															background: "var(--surface-card)",
														}
													: {
															color: "var(--text-faint)",
															borderBottom: "2px solid transparent",
														}
											}
										>
											{m === "chat" ? (
												<MessageSquare className="w-3.5 h-3.5" />
											) : (
												<FileText className="w-3.5 h-3.5" />
											)}
											{m === "chat" ? "Sohbet" : "Rapor"}
										</button>
									))}
								</div>

								{/* Chat mode */}
								{mode === "chat" && (
									<>
										<div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
											{chatMessages.map((msg) => (
												<div
													key={msg.id}
													className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
												>
													<div
														className={
															msg.role === "user"
																? "max-w-[80%]"
																: "max-w-[90%]"
														}
													>
														<div
															className="px-3.5 py-2.5 text-sm leading-relaxed"
															style={
																msg.role === "ai"
																	? {
																			background: "var(--surface-sunken)",
																			color: "var(--text-secondary)",
																			borderRadius: "0 1.25rem 1.25rem 1.25rem",
																		}
																	: {
																			background:
																				"var(--gradient-btn-primary)",
																			color: "#fff",
																			borderRadius:
																				"1.25rem 1.25rem 0 1.25rem",
																		}
															}
														>
															<div className="prose prose-sm max-w-none prose-p:my-0 prose-p:leading-relaxed prose-headings:font-semibold">
																<ReactMarkdown remarkPlugins={[remarkGfm]}>
																	{msg.text}
																</ReactMarkdown>
															</div>
														</div>
														<p
															className={`text-[10px] mt-1.5 px-1 ${msg.role === "user" ? "text-right" : ""}`}
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
														className="px-4 py-2.5 flex items-center gap-1.5"
														style={{
															background: "var(--surface-sunken)",
															borderRadius: "0 1.25rem 1.25rem 1.25rem",
														}}
													>
														{[0, 0.15, 0.3].map((d) => (
															<span
																key={d}
																className="w-2 h-2 rounded-full animate-bounce"
																style={{
																	background: "var(--text-faint)",
																	animationDelay: `${d}s`,
																}}
															/>
														))}
													</div>
												</div>
											)}

											{/* Suggestions + health card */}
											{chatMessages.length <= 1 && !isAnalyzing && (
												<div className="space-y-2.5">
													<div className="space-y-1.5">
														<p
															className="text-[10px] font-bold tracking-widest uppercase px-1"
															style={{ color: "var(--text-faint)" }}
														>
															Hızlı Sorgular
														</p>
														{SUGGESTION_ITEMS.map(({ icon, label }) => (
															<button
																key={label}
																type="button"
																onClick={() => setMessage(label)}
																className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-all group"
																style={{
																	background: "var(--surface-sunken)",
																	border: "1px solid var(--border-subtle)",
																}}
															>
																<div className="flex items-center gap-2.5">
																	<div
																		className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
																		style={{
																			background: "var(--surface-raised)",
																			color: "var(--color-lavender)",
																			border: "1px solid var(--border-default)",
																		}}
																	>
																		<span className="w-3 h-3 [&>svg]:w-3 [&>svg]:h-3">
																			{icon}
																		</span>
																	</div>
																	<span
																		className="text-xs"
																		style={{ color: "var(--text-secondary)" }}
																	>
																		{label}
																	</span>
																</div>
																<ChevronRight
																	className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity"
																	style={{ color: "var(--color-lavender)" }}
																/>
															</button>
														))}
													</div>

													{services.length > 0 && (
														<div
															className="rounded-xl px-3 py-2.5 flex items-center justify-between"
															style={{
																background: "var(--color-lavender-subtle)",
																border: "1px solid var(--color-lavender-border)",
															}}
														>
															<div>
																<p
																	className="text-[10px] font-bold uppercase tracking-wider"
																	style={{ color: "var(--color-lavender)" }}
																>
																	Sistem Sağlığı
																</p>
																<p
																	className="text-xs font-medium mt-0.5"
																	style={{ color: "var(--text-faint)" }}
																>
																	{contextServiceName ?? "Tüm servisler"}
																</p>
															</div>
															<p
																className="text-base font-bold tabular-nums"
																style={{ color: "var(--text-primary)" }}
															>
																{onlineServices}/{services.length}
															</p>
														</div>
													)}
												</div>
											)}

											<div ref={messagesEndRef} />
										</div>

										<div className="px-3 pb-3 pt-2 shrink-0">
											<div
												className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
												style={{
													background: "var(--surface-sunken)",
													border: "1px solid var(--border-default)",
												}}
											>
												<Input
													placeholder="Bir şey sorun..."
													value={message}
													onChange={(e) => setMessage(e.target.value)}
													onKeyDown={(e) =>
														e.key === "Enter" && !e.shiftKey && handleSend()
													}
													disabled={isAnalyzing}
													className="flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0 px-0 h-8 text-sm"
													style={{ color: "var(--text-primary)" }}
												/>
												<motion.button
													type="button"
													onClick={handleSend}
													disabled={isAnalyzing || !message.trim()}
													className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 disabled:opacity-40"
													style={{
														background: "var(--gradient-btn-primary)",
														boxShadow: "0 3px 8px rgba(79,70,229,0.28)",
													}}
													whileHover={{ scale: 1.06 }}
													whileTap={{ scale: 0.92 }}
												>
													<Send className="w-3.5 h-3.5 text-white" />
												</motion.button>
											</div>
										</div>
									</>
								)}

								{/* Report mode */}
								{mode === "report" && (
									<>
										{/* If no report yet — range picker */}
										{!report && !isGeneratingReport && (
											<div className="flex-1 flex flex-col justify-center px-4 py-6 gap-4">
												<div className="text-center">
													<div
														className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
														style={{
															background: "var(--color-lavender-subtle)",
															border: "1px solid var(--color-lavender-border)",
														}}
													>
														<FileText
															className="w-6 h-6"
															style={{ color: "var(--color-lavender)" }}
														/>
													</div>
													<p
														className="text-sm font-bold"
														style={{ color: "var(--text-primary)" }}
													>
														Dönemsel Rapor
													</p>
													<p
														className="text-xs mt-1"
														style={{ color: "var(--text-faint)" }}
													>
														{contextServiceName
															? `${contextServiceName} servisi için`
															: "Tüm servisler için"}{" "}
														bir aralık seç
													</p>
												</div>

												{/* Time range buttons */}
												<div className="grid grid-cols-2 gap-2">
													{TIME_RANGES.map((range) => (
														<button
															key={range}
															type="button"
															onClick={() => setSelectedRange(range)}
															className="flex flex-col items-center py-3 rounded-xl transition-all"
															style={
																selectedRange === range
																	? {
																			background:
																				"var(--color-lavender-subtle)",
																			border: "1.5px solid var(--color-lavender)",
																			color: "var(--color-lavender)",
																		}
																	: {
																			background: "var(--surface-sunken)",
																			border: "1px solid var(--border-subtle)",
																			color: "var(--text-secondary)",
																		}
															}
														>
															<Clock
																className="w-4 h-4 mb-1"
																style={{
																	color:
																		selectedRange === range
																			? "var(--color-lavender)"
																			: "var(--text-faint)",
																}}
															/>
															<span className="text-xs font-semibold">
																{TIME_RANGE_LABELS[range]}
															</span>
														</button>
													))}
												</div>

												<motion.button
													type="button"
													onClick={handleGenerateReport}
													className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
													style={{
														background: "var(--gradient-btn-primary)",
														color: "#fff",
														boxShadow: "0 4px 12px rgba(79,70,229,0.3)",
													}}
													whileHover={{ scale: 1.02 }}
													whileTap={{ scale: 0.97 }}
												>
													<Sparkles className="w-4 h-4" />
													Rapor Oluştur
												</motion.button>
											</div>
										)}

										{/* Generating spinner */}
										{isGeneratingReport && (
											<div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
												<div
													className="w-14 h-14 rounded-2xl flex items-center justify-center"
													style={{
														background: "var(--color-lavender-subtle)",
														border: "1px solid var(--color-lavender-border)",
													}}
												>
													<motion.div
														animate={{ rotate: 360 }}
														transition={{
															duration: 1.5,
															repeat: Infinity,
															ease: "linear",
														}}
													>
														<Sparkles
															className="w-6 h-6"
															style={{ color: "var(--color-lavender)" }}
														/>
													</motion.div>
												</div>
												<div className="text-center">
													<p
														className="text-sm font-bold"
														style={{ color: "var(--text-primary)" }}
													>
														Sistemi tarıyorum...
													</p>
													<p
														className="text-xs mt-1"
														style={{ color: "var(--text-faint)" }}
													>
														{TIME_RANGE_LABELS[selectedRange]} verisi analiz
														ediliyor
													</p>
												</div>
												<div className="flex gap-1">
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
											</div>
										)}

										{/* Report view */}
										{report && !isGeneratingReport && (
											<div className="flex-1 overflow-hidden">
												<ReportView
													report={report}
													onClose={() => setReport(null)}
												/>
											</div>
										)}
									</>
								)}
							</>
						)}
					</motion.div>
				)}
			</AnimatePresence>
		</>
	);
}

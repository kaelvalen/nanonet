import {
	AlertTriangle,
	Bot,
	ChevronRight,
	Maximize2,
	Minimize2,
	Send,
	Sparkles,
	X,
	Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useLocation, useParams } from "react-router";
import remarkGfm from "remark-gfm";
import { aiChatApi, type ChatMessage } from "@/api/metrics";
import { useServiceStore } from "@/store/serviceStore";
import { Input } from "./ui/input";

const _SUGGESTIONS = [
	"Sistem durumu nedir?",
	"Son anomalileri analiz et",
	"Performans önerileri ver",
];

export function AIAssistant() {
	const [isOpen, setIsOpen] = useState(false);
	const [isMinimized, setIsMinimized] = useState(false);
	const [message, setMessage] = useState("");
	const [chatMessages, setChatMessages] = useState<
		{ id: string; role: "ai" | "user"; text: string; time: string }[]
	>([
		{
			id: "init",
			role: "ai",
			text: "Merhaba! Sistem analizi yapmak, anomali tespit etmek veya servisleriniz hakkında bilgi almak için bana soru sorabilirsiniz.",
			time: "Şimdi",
		},
	]);
	const [isAnalyzing, setIsAnalyzing] = useState(false);
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
		if (isOpen && !isMinimized) {
			messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
		}
	}, [isOpen, isMinimized]);

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

	const onlineServices = services.filter((s) => s.status === "up").length;

	const SUGGESTION_ITEMS = [
		{ icon: <Sparkles className="w-4 h-4" />, label: "Sistem durumu nedir?" },
		{
			icon: <AlertTriangle className="w-4 h-4" />,
			label: "Son anomalileri analiz et",
		},
		{ icon: <Zap className="w-4 h-4" />, label: "Performans önerileri ver" },
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
						<span className="text-white text-xs font-bold tracking-wide">
							AI
						</span>
					</motion.button>
				)}
			</AnimatePresence>

			{/* Chat panel */}
			<AnimatePresence>
				{isOpen && (
					<motion.div
						initial={{ opacity: 0, y: 24, scale: 0.94 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: 20, scale: 0.94 }}
						transition={{ type: "spring", stiffness: 400, damping: 32 }}
						className={`fixed z-50 flex flex-col rounded-2xl overflow-hidden
						bottom-20 right-4 left-4
						md:bottom-8 md:right-6 md:left-auto md:w-80
						${isMinimized ? "h-14" : "h-[72vh] max-h-130"}`}
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
								{/* Avatar with online dot */}
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
											background: isAnalyzing
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
										AI Asistan
									</p>
									<p
										className="text-[10px] font-semibold tracking-wider uppercase mt-0.5"
										style={{
											color: isAnalyzing
												? "var(--status-warn-text)"
												: "var(--status-up-text)",
										}}
									>
										{isAnalyzing
											? "Analiz ediliyor..."
											: contextServiceName
												? contextServiceName
												: "Çevrimiçi"}
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
								{/* Messages */}
								<div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
									{chatMessages.map((msg) => (
										<div
											key={msg.id}
											className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
										>
											<div
												className={
													msg.role === "user" ? "max-w-[80%]" : "max-w-[88%]"
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
																	background: "var(--gradient-btn-primary)",
																	color: "#fff",
																	borderRadius: "1.25rem 1.25rem 0 1.25rem",
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

									{/* Suggestions + system health card */}
									{chatMessages.length <= 1 && !isAnalyzing && (
										<div className="space-y-2.5">
											{/* Suggestion chips */}
											<div className="space-y-1.5">
												<p
													className="text-[10px] font-bold tracking-widest uppercase px-1"
													style={{ color: "var(--text-faint)" }}
												>
													Önerilen Sorgular
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

											{/* System health mini-card */}
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

								{/* Input */}
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
									l
								</div>
							</>
						)}
					</motion.div>
				)}
			</AnimatePresence>
		</>
	);
}

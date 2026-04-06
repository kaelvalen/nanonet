import { Maximize2, Minimize2, Send, Sparkles, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useLocation, useParams } from "react-router";
import remarkGfm from "remark-gfm";
import { aiChatApi, type ChatMessage } from "@/api/metrics";
import { useServiceStore } from "@/store/serviceStore";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

const SUGGESTIONS = [
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
						className="fixed bottom-20 right-4 md:bottom-8 md:right-6 z-50 flex items-center gap-2 px-3.5 py-2 rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95"
						style={{
							background: "var(--gradient-logo)",
							boxShadow: "0 4px 16px rgba(79,70,229,0.3)",
						}}
					>
						<Sparkles className="w-4 h-4 text-white" />
						<span className="text-white text-xs font-semibold">AI</span>
					</motion.button>
				)}
			</AnimatePresence>

			{/* Chat panel */}
			<AnimatePresence>
				{isOpen && (
					<motion.div
						initial={{ opacity: 0, y: 20, scale: 0.95 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: 16, scale: 0.95 }}
						transition={{ type: "spring", stiffness: 420, damping: 34 }}
						className={`fixed z-50 flex flex-col rounded-2xl overflow-hidden
							bottom-20 right-4 left-4
							md:bottom-8 md:right-6 md:left-auto md:w-95
							${isMinimized ? "h-14" : "h-[72vh] max-h-145"}`}
						style={{
							background: "var(--surface-raised)",
							border: "1px solid var(--border-default)",
							boxShadow: "0 16px 48px rgba(0,0,0,0.16), 0 2px 8px rgba(0,0,0,0.08)",
						}}
					>
						{/* Header — gradient accent strip + clean layout */}
						<div className="shrink-0 relative">
							{/* Top gradient line */}
							<div
								className="absolute inset-x-0 top-0 h-0.5"
								style={{ background: "var(--gradient-btn-primary)" }}
							/>
							<div
								className="flex items-center gap-3 px-4 h-14"
								style={{ borderBottom: "1px solid var(--border-default)" }}
							>
								{/* Avatar */}
								<div
									className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
									style={{ background: "var(--gradient-logo)" }}
								>
									<Sparkles className="w-4 h-4 text-white" />
								</div>
								<div className="flex-1 min-w-0">
									<p className="text-sm font-semibold leading-none mb-0.5" style={{ color: "var(--text-primary)" }}>
										AI Asistan
									</p>
									<div className="flex items-center gap-1.5">
										<span
											className="w-1.5 h-1.5 rounded-full"
											style={{
												background: isAnalyzing ? "var(--status-warn)" : "var(--status-up)",
												boxShadow: isAnalyzing ? "none" : "0 0 5px var(--status-up)",
											}}
										/>
										<p className="text-[11px] truncate" style={{ color: "var(--text-faint)" }}>
											{isAnalyzing ? "Analiz ediliyor..." : contextServiceName ? contextServiceName : "Tüm servisler"}
										</p>
									</div>
								</div>
								<div className="flex items-center gap-0.5">
									<Button
										variant="ghost"
										size="icon"
										className="h-7 w-7 rounded-lg"
										style={{ color: "var(--text-faint)" }}
										onClick={() => setIsMinimized(!isMinimized)}
									>
										{isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
									</Button>
									<Button
										variant="ghost"
										size="icon"
										className="h-7 w-7 rounded-lg"
										style={{ color: "var(--text-faint)" }}
										onClick={() => setIsOpen(false)}
									>
										<X className="w-3.5 h-3.5" />
									</Button>
								</div>
							</div>
						</div>

						{!isMinimized && (
							<>
								{/* Messages */}
								<div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
									{chatMessages.map((msg) => (
										<div
											key={msg.id}
											className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "items-start"}`}
										>
											{msg.role === "ai" && (
												<div
													className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
													style={{ background: "var(--gradient-logo)" }}
												>
													<Sparkles className="w-3.5 h-3.5 text-white" />
												</div>
											)}
											<div className={msg.role === "user" ? "max-w-[78%]" : "flex-1 min-w-0"}>
												<div
													className="rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed"
													style={
														msg.role === "ai"
															? {
																background: "var(--surface-sunken)",
																color: "var(--text-secondary)",
																borderBottomLeftRadius: "6px",
															}
															: {
																background: "var(--gradient-btn-primary)",
																color: "#fff",
																borderBottomRightRadius: "6px",
															}
													}
												>
													<div className="prose prose-sm max-w-none prose-p:my-0 prose-p:leading-relaxed prose-headings:font-semibold prose-invert:text-white">
														<ReactMarkdown remarkPlugins={[remarkGfm]}>
															{msg.text}
														</ReactMarkdown>
													</div>
												</div>
												<p
													className={`text-[10px] mt-1 px-1 ${msg.role === "user" ? "text-right" : ""}`}
													style={{ color: "var(--text-faint)" }}
												>
													{msg.time}
												</p>
											</div>
										</div>
									))}

									{isAnalyzing && (
										<div className="flex gap-2.5 items-start">
											<div
												className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
												style={{ background: "var(--gradient-logo)" }}
											>
												<Sparkles className="w-3.5 h-3.5 text-white animate-pulse" />
											</div>
											<div
												className="rounded-2xl px-4 py-3 flex items-center gap-1.5"
												style={{ background: "var(--surface-sunken)", borderBottomLeftRadius: "6px" }}
											>
												{[0, 0.15, 0.3].map((d) => (
													<span
														key={d}
														className="w-1.5 h-1.5 rounded-full animate-bounce"
														style={{ background: "var(--text-faint)", animationDelay: `${d}s` }}
													/>
												))}
											</div>
										</div>
									)}

									{/* Suggestions */}
									{chatMessages.length <= 1 && !isAnalyzing && (
										<div className="pt-1">
											<p className="text-[11px] font-medium px-1 mb-2" style={{ color: "var(--text-faint)" }}>
												Önerilen sorular
											</p>
											<div className="flex flex-col gap-1.5">
												{SUGGESTIONS.map((s) => (
													<button
														key={s}
														type="button"
														onClick={() => setMessage(s)}
														className="w-full text-left px-3.5 py-2.5 rounded-xl text-sm transition-all hover:scale-[1.01]"
														style={{
															background: "var(--surface-sunken)",
															color: "var(--text-secondary)",
															border: "1px solid var(--border-default)",
														}}
													>
														{s}
													</button>
												))}
											</div>
										</div>
									)}

									<div ref={messagesEndRef} />
								</div>

								{/* Input */}
								<div
									className="px-3 pb-3 pt-2.5"
									style={{ borderTop: "1px solid var(--border-default)" }}
								>
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
											onKeyDown={(e) => e.key === "Enter" && handleSend()}
											disabled={isAnalyzing}
											className="text-sm flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0 px-0 h-8"
											style={{ color: "var(--text-primary)" }}
										/>
										<motion.button
											type="button"
											onClick={handleSend}
											disabled={isAnalyzing || !message.trim()}
											className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 disabled:opacity-40"
											style={{ background: "var(--gradient-btn-primary)" }}
											whileHover={{ scale: 1.05 }}
											whileTap={{ scale: 0.92 }}
										>
											<Send className="w-3.5 h-3.5 text-white" />
										</motion.button>
									</div>
								</div>
							</>
						)}
					</motion.div>
				)}
			</AnimatePresence>
		</>
	);
}

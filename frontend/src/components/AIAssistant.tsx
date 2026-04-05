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
		{ role: "ai" | "user"; text: string; time: string }[]
	>([
		{
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
	}, [chatMessages, isOpen, isMinimized]);

	const now = () =>
		new Date().toLocaleTimeString("tr-TR", {
			hour: "2-digit",
			minute: "2-digit",
		});

	const handleSend = async () => {
		if (!message.trim() || isAnalyzing) return;
		const userMsg = message;
		setMessage("");
		setChatMessages((prev) => [...prev, { role: "user", text: userMsg, time: now() }]);
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
				{ role: "ai", text: result.reply, time: now() },
			]);
		} catch {
			setChatMessages((prev) => [
				...prev,
				{
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
						initial={{ opacity: 0, y: 16, scale: 0.96 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: 16, scale: 0.96 }}
						transition={{ type: "spring", stiffness: 400, damping: 32 }}
						className={`fixed z-50 flex flex-col rounded-xl overflow-hidden shadow-xl
							bottom-20 right-4 left-4
							md:bottom-8 md:right-6 md:left-auto md:w-96
							${isMinimized ? "h-14" : "h-[70vh] max-h-[560px]"}`}
						style={{
							background: "var(--surface-raised)",
							border: "1px solid var(--border-default)",
							boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
						}}
					>
						{/* Header */}
						<div
							className="flex items-center gap-2.5 px-4 h-14 shrink-0"
							style={{ borderBottom: "1px solid var(--border-default)" }}
						>
							<div
								className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
								style={{ background: "var(--gradient-logo)" }}
							>
								<Sparkles className="w-3.5 h-3.5 text-white" />
							</div>
							<div className="flex-1 min-w-0">
								<p
									className="text-sm font-semibold"
									style={{ color: "var(--text-primary)" }}
								>
									AI Asistan
								</p>
								<p className="text-xs truncate" style={{ color: "var(--text-faint)" }}>
									{isAnalyzing
										? "Analiz ediliyor..."
										: contextServiceName
											? contextServiceName
											: "Tüm servisler"}
								</p>
							</div>
							<div className="flex items-center gap-0.5">
								<Button
									variant="ghost"
									size="icon"
									className="h-7 w-7"
									style={{ color: "var(--text-faint)" }}
									onClick={() => setIsMinimized(!isMinimized)}
								>
									{isMinimized ? (
										<Maximize2 className="w-3.5 h-3.5" />
									) : (
										<Minimize2 className="w-3.5 h-3.5" />
									)}
								</Button>
								<Button
									variant="ghost"
									size="icon"
									className="h-7 w-7"
									style={{ color: "var(--text-faint)" }}
									onClick={() => setIsOpen(false)}
								>
									<X className="w-3.5 h-3.5" />
								</Button>
							</div>
						</div>

						{!isMinimized && (
							<>
								{/* Messages */}
								<div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
									{chatMessages.map((msg, i) => (
										<div
											key={i}
											className={`flex gap-2 ${msg.role === "user" ? "justify-end" : ""}`}
										>
											{msg.role === "ai" && (
												<div
													className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5"
													style={{ background: "var(--gradient-logo)" }}
												>
													<Sparkles className="w-3 h-3 text-white" />
												</div>
											)}
											<div className={msg.role === "user" ? "max-w-[80%]" : "flex-1 min-w-0"}>
												<div
													className="rounded-xl px-3 py-2.5 text-sm"
													style={
														msg.role === "ai"
															? {
																	background: "var(--surface-sunken)",
																	color: "var(--text-secondary)",
																}
															: {
																	background: "var(--color-teal-subtle)",
																	border: "1px solid var(--color-teal-border)",
																	color: "var(--text-secondary)",
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
													className="text-[10px] mt-1 px-1"
													style={{ color: "var(--text-faint)" }}
												>
													{msg.time}
												</p>
											</div>
										</div>
									))}

									{isAnalyzing && (
										<div className="flex gap-2">
											<div
												className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
												style={{ background: "var(--gradient-logo)" }}
											>
												<Sparkles className="w-3 h-3 text-white animate-pulse" />
											</div>
											<div
												className="rounded-xl px-3 py-2.5 flex items-center gap-1.5"
												style={{ background: "var(--surface-sunken)" }}
											>
												{[0, 0.15, 0.3].map((d) => (
													<span
														key={d}
														className="w-1.5 h-1.5 rounded-full animate-bounce"
														style={{
															background: "var(--text-faint)",
															animationDelay: `${d}s`,
														}}
													/>
												))}
											</div>
										</div>
									)}

									{/* Suggestions */}
									{chatMessages.length <= 1 && (
										<div className="space-y-1.5 pt-1">
											<p
												className="text-xs px-1"
												style={{ color: "var(--text-faint)" }}
											>
												Önerilen sorular
											</p>
											{SUGGESTIONS.map((s) => (
												<button
													key={s}
													type="button"
													onClick={() => setMessage(s)}
													className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors"
													style={{
														background: "var(--surface-sunken)",
														color: "var(--text-secondary)",
														border: "1px solid var(--border-subtle)",
													}}
												>
													{s}
												</button>
											))}
										</div>
									)}

									<div ref={messagesEndRef} />
								</div>

								{/* Input */}
								<div
									className="px-3 pb-3 pt-2"
									style={{ borderTop: "1px solid var(--border-subtle)" }}
								>
									<div className="flex gap-2">
										<Input
											placeholder="Bir şey sorun..."
											value={message}
											onChange={(e) => setMessage(e.target.value)}
											onKeyDown={(e) => e.key === "Enter" && handleSend()}
											disabled={isAnalyzing}
											className="text-sm flex-1"
											style={{
												background: "var(--surface-sunken)",
												borderColor: "var(--border-default)",
											}}
										/>
										<Button
											size="icon"
											onClick={handleSend}
											disabled={isAnalyzing || !message.trim()}
											className="shrink-0"
											style={{ background: "var(--gradient-btn-primary)" }}
										>
											<Send className="w-4 h-4 text-white" />
										</Button>
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

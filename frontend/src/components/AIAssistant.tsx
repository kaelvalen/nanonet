import { Maximize2, Minimize2, Send, Sparkles, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useLocation, useParams } from "react-router";
import remarkGfm from "remark-gfm";
import { aiChatApi, type ChatMessage } from "@/api/metrics";
import { useServiceStore } from "@/store/serviceStore";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Input } from "./ui/input";

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

	// Prefer the service in the current URL; fall back to "global"
	const contextServiceId = useMemo(() => {
		if (urlServiceId) return urlServiceId;
		// /services/:id pattern without useParams (e.g. nested routes)
		const match = pathname.match(/\/services\/([^/]+)/);
		if (match?.[1]) return match[1];
		return undefined;
	}, [urlServiceId, pathname]);

	const contextServiceName = useMemo(
		() => services.find((s) => s.id === contextServiceId)?.name,
		[services, contextServiceId],
	);

	const suggestions = [
		"Sistem durumu nedir?",
		"Son anomalileri analiz et",
		"Performans önerileri ver",
	];

	const handleSend = async () => {
		if (!message.trim()) return;
		const userMsg = message;
		const now = new Date().toLocaleTimeString("tr-TR", {
			hour: "2-digit",
			minute: "2-digit",
		});
		setMessage("");
		setChatMessages((prev) => [
			...prev,
			{ role: "user", text: userMsg, time: now },
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
				{
					role: "ai",
					text: result.reply,
					time: new Date().toLocaleTimeString("tr-TR", {
						hour: "2-digit",
						minute: "2-digit",
					}),
				},
			]);
		} catch {
			setChatMessages((prev) => [
				...prev,
				{
					role: "ai",
					text: "AI asistanı geçici olarak kullanılamıyor. Lütfen daha sonra tekrar deneyin.",
					time: new Date().toLocaleTimeString("tr-TR", {
						hour: "2-digit",
						minute: "2-digit",
					}),
				},
			]);
		} finally {
			setIsAnalyzing(false);
		}
	};

	return (
		<>
			{/* AI Assistant Button */}
			<AnimatePresence>
				{!isOpen && (
					<motion.div
						initial={{ scale: 0, opacity: 0 }}
						animate={{ scale: 1, opacity: 1 }}
						exit={{ scale: 0, opacity: 0 }}
						className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50"
					>
						<button
							type="button"
							onClick={() => setIsOpen(true)}
							className="flex items-center gap-2.5 px-4 py-2.5 rounded-full transition-all duration-200 hover:scale-105 active:scale-95"
							style={{
								background: "var(--gradient-logo)",
								border: "2px solid var(--border-default)",
								boxShadow: "0 4px 20px rgba(0,0,0,0.3), var(--btn-shadow)",
							}}
						>
							<Sparkles className="w-4 h-4 text-white shrink-0" />
							<span className="text-white text-xs font-semibold">AI</span>
						</button>
					</motion.div>
				)}
			</AnimatePresence>

			{/* AI Chat Panel */}
			<AnimatePresence>
				{isOpen && (
					<motion.div
						initial={{ opacity: 0, y: 20, scale: 0.95 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: 20, scale: 0.95 }}
						className="fixed bottom-6 right-6 z-50 md:bottom-8 md:right-8"
					>
						<Card
							className={`${isMinimized ? "w-72 h-16" : "w-[calc(100vw-2rem)] max-w-sm h-[70vh] md:w-96 md:h-150"} transition-all duration-200 flex flex-col rounded-2xl`}
							style={{
								background: "var(--surface-card)",
								border: "2px solid var(--border-default)",
								boxShadow: "var(--panel-shadow)",
							}}
						>
							{/* Header */}
							<div
								className="flex items-center justify-between p-4"
								style={{ borderBottom: "2px solid var(--border-default)" }}
							>
								<div className="flex items-center gap-2">
									<div className="relative">
										<Sparkles
											className="w-5 h-5 animate-glow"
											style={{ color: "var(--color-ai)" }}
										/>
										<div
											className="absolute -top-1 -right-1 w-2 h-2 rounded-full animate-pulse"
											style={{ backgroundColor: "var(--status-up)" }}
										></div>
									</div>
									<div>
										<h3
											className="text-sm font-semibold"
											style={{ color: "var(--color-ai)" }}
										>
											AI Asistan
										</h3>
										<p
											className="text-xs"
											style={{ color: "var(--text-muted)" }}
										>
											{isAnalyzing
												? "Analiz ediliyor..."
												: contextServiceName
													? `Bağlam: ${contextServiceName}`
													: "Tüm servisler"}
										</p>
									</div>
								</div>
								<div className="flex items-center gap-1">
									<Button
										variant="ghost"
										size="icon"
										className="h-8 w-8"
										style={{ color: "var(--text-muted)" }}
										onClick={() => setIsMinimized(!isMinimized)}
										aria-label={
											isMinimized
												? "AI asistanı genişlet"
												: "AI asistanı küçült"
										}
									>
										{isMinimized ? (
											<Maximize2 className="w-4 h-4" />
										) : (
											<Minimize2 className="w-4 h-4" />
										)}
									</Button>
									<Button
										variant="ghost"
										size="icon"
										className="h-8 w-8"
										style={{ color: "var(--text-muted)" }}
										onClick={() => setIsOpen(false)}
										aria-label="AI asistanı kapat"
									>
										<X className="w-4 h-4" />
									</Button>
								</div>
							</div>

							{!isMinimized && (
								<>
									{/* Messages */}
									<div className="flex-1 p-4 space-y-4 overflow-y-auto">
										{chatMessages.map((msg) => (
											<div
												key={msg.time + msg.role}
												className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
											>
												{msg.role === "ai" && (
													<div
														className="w-8 h-8 rounded flex items-center justify-center shrink-0"
														style={{
															background: "var(--gradient-logo)",
															border: "2px solid var(--border-default)",
														}}
													>
														<Sparkles className="w-4 h-4 text-white" />
													</div>
												)}
												<div
													className={`flex-1 ${msg.role === "user" ? "max-w-[80%] ml-auto" : ""}`}
												>
													<div
														className={`rounded p-3`}
														style={
															msg.role === "ai"
																? {
																		background: "var(--color-lavender-subtle)",
																		border:
																			"2px solid var(--color-lavender-border)",
																	}
																: {
																		background: "var(--color-teal-subtle)",
																		border:
																			"2px solid var(--color-teal-border)",
																	}
														}
													>
														<div
															className="text-sm prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-slate-900 prose-pre:border prose-pre:border-slate-800 prose-headings:font-bold prose-headings:text-indigo-600 dark:prose-headings:text-indigo-400"
															style={{ color: "var(--text-secondary)" }}
														>
															<ReactMarkdown remarkPlugins={[remarkGfm]}>
																{msg.text}
															</ReactMarkdown>
														</div>
													</div>
													<p
														className="text-xs mt-1"
														style={{ color: "var(--text-faint)" }}
													>
														{msg.time}
													</p>
												</div>
											</div>
										))}

										{/* Suggestions (only show initially) */}
										{chatMessages.length <= 1 && (
											<div className="space-y-2">
												<p
													className="text-xs px-2"
													style={{ color: "var(--text-muted)" }}
												>
													Önerilen sorular:
												</p>
												{suggestions.map((suggestion) => (
													<button
														type="button"
														key={suggestion}
														className="w-full text-left px-3 py-2 rounded text-sm transition-all"
														style={{
															background: "var(--surface-sunken)",
															border: "2px solid var(--border-default)",
															color: "var(--text-secondary)",
															boxShadow: "2px 2px 0px var(--border-default)",
														}}
														onClick={() => setMessage(suggestion)}
													>
														{suggestion}
													</button>
												))}
											</div>
										)}
									</div>

									{/* Input */}
									<div
										className="p-4"
										style={{ borderTop: "2px solid var(--border-default)" }}
									>
										<div className="flex gap-2">
											<Input
												placeholder="AI'ya bir şey sorun..."
												value={message}
												onChange={(e) => setMessage(e.target.value)}
												className="rounded"
												style={{
													background: "var(--input-bg)",
													borderColor: "var(--border-default)",
													color: "var(--text-secondary)",
												}}
												onKeyDown={(e) => {
													if (e.key === "Enter") handleSend();
												}}
												disabled={isAnalyzing}
											/>
											<Button
												size="icon"
												className="rounded"
												style={{
													background: "var(--gradient-btn-primary)",
													boxShadow: "var(--btn-shadow)",
												}}
												onClick={handleSend}
												disabled={isAnalyzing}
												aria-label="Mesaj gönder"
											>
												<Send className="w-4 h-4" />
											</Button>
										</div>
									</div>
								</>
							)}
						</Card>
					</motion.div>
				)}
			</AnimatePresence>
		</>
	);
}

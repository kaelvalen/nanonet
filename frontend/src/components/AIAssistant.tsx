import { Maximize2, Minimize2, Send, Sparkles, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { type ChatMessage, aiChatApi } from "@/api/metrics";
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
	const contextServiceId = services[0]?.id;

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
			const history: ChatMessage[] = chatMessages
				.slice(-10)
				.map((m) => ({
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
						className="fixed inset-x-0 bottom-0 z-50 md:inset-x-auto md:bottom-6 md:right-6"
					>
						<Card
							className={`w-full md:${isMinimized ? "w-80" : "w-96"} ${isMinimized ? "h-16" : "h-[85vh] md:h-150"} transition-all duration-200 flex flex-col rounded-t-2xl md:rounded`}
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
											AI Assistant
										</h3>
										<p
											className="text-xs"
											style={{ color: "var(--text-muted)" }}
										>
											{isAnalyzing ? "Analyzing..." : "Online"}
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
												? "Expand AI assistant"
												: "Minimize AI assistant"
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
										aria-label="Close AI assistant"
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
														<p
															className="text-sm"
															style={{ color: "var(--text-secondary)" }}
														>
															{msg.text}
														</p>
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
												aria-label="Send message"
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

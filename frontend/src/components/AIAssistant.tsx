import { useState } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Sparkles, X, Send, Minimize2, Maximize2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { metricsApi } from "@/api/metrics";
import { useServiceStore } from "@/store/serviceStore";

export function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [message, setMessage] = useState("");
  const [chatMessages, setChatMessages] = useState<{ role: "ai" | "user"; text: string; time: string }[]>([
    {
      role: "ai",
      text: "Merhaba! Sistem analizi yapmak, anomali tespit etmek veya servisleriniz hakkında bilgi almak için bana soru sorabilirsiniz.",
      time: "Şimdi",
    },
  ]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { services } = useServiceStore();

  const suggestions = [
    "Sistem durumu nedir?",
    "Son anomalileri analiz et",
    "Performans önerileri ver",
  ];

  const handleSend = async () => {
    if (!message.trim()) return;
    const userMsg = message;
    setMessage("");
    setChatMessages((prev) => [...prev, { role: "user", text: userMsg, time: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }) }]);

    // Try to run analysis on first service if available
    if (services.length > 0) {
      setIsAnalyzing(true);
      try {
        const result = await metricsApi.analyze(services[0].id, 30);
        setChatMessages((prev) => [
          ...prev,
          {
            role: "ai",
            text: result?.summary || "Analiz tamamlandı, şu an bir anomali tespit edilmedi.",
            time: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      } catch {
        setChatMessages((prev) => [
          ...prev,
          {
            role: "ai",
            text: "Analiz çalıştırılırken bir hata oluştu. Lütfen daha sonra tekrar deneyin.",
            time: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      } finally {
        setIsAnalyzing(false);
      }
    } else {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: "Henüz kayıtlı servis bulunmuyor. Önce bir servis ekleyin.",
          time: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
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
            className="fixed bottom-6 right-6 z-50"
          >
            <button
              onClick={() => setIsOpen(true)}
              className="relative w-16 h-16 bg-linear-to-br from-[#a78bfa] to-[#00b4d8] dark:from-[#a78bfa] dark:to-[#00e6ff] rounded-full shadow-lg hover:shadow-[#a78bfa]/40 transition-all duration-300 group"
            >
              <div className="absolute inset-0 rounded-full bg-[#c4b5fd] opacity-15 animate-pulse-ring"></div>
              <div className="absolute inset-0 rounded-full bg-[#c4b5fd] opacity-10 animate-pulse-ring" style={{ animationDelay: "0.5s" }}></div>
              <Sparkles className="w-8 h-8 text-white absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-glow" />
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
            className="fixed bottom-6 right-6 z-50"
          >
            <Card className={`${isMinimized ? "w-80" : "w-96"} ${isMinimized ? "h-16" : "h-150"} bg-white/95 dark:bg-[#0a161e]/97 backdrop-blur-xl border-[#a78bfa]/20 dark:border-[#a78bfa]/15 shadow-xl shadow-[#a78bfa]/10 dark:shadow-[#00e6ff]/5 transition-all duration-300 flex flex-col`}>
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-[#a78bfa]/15 dark:border-[#a78bfa]/12">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Sparkles className="w-5 h-5 text-[#8b5cf6] animate-glow" />
                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-[#34d399] rounded-full animate-pulse"></div>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#7c3aed] dark:text-[#a78bfa]">AI Assistant</h3>
                    <p className="text-xs text-[#7c8db5] dark:text-[#527a8a]">{isAnalyzing ? "Analyzing..." : "Online"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-[#7c8db5] hover:text-[#8b5cf6]" onClick={() => setIsMinimized(!isMinimized)}>
                    {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-[#7c8db5] hover:text-[#fb7185]" onClick={() => setIsOpen(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {!isMinimized && (
                <>
                  {/* Messages */}
                  <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                    {chatMessages.map((msg, i) => (
                      <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
                        {msg.role === "ai" && (
                          <div className="w-8 h-8 rounded-full bg-linear-to-br from-[#c4b5fd] to-[#93c5fd] flex items-center justify-center shrink-0">
                            <Sparkles className="w-4 h-4 text-white" />
                          </div>
                        )}
                        <div className={`flex-1 ${msg.role === "user" ? "max-w-[80%] ml-auto" : ""}`}>
                          <div className={`rounded-2xl p-3 ${
                            msg.role === "ai"
                              ? "bg-[#f5f0ff] dark:bg-[#1a2e3a] border border-[#a78bfa]/15 dark:border-[#a78bfa]/12 rounded-tl-sm"
                              : "bg-[#00b4d8]/8 dark:bg-[#00e6ff]/6 border border-[#00b4d8]/15 dark:border-[#00e6ff]/12 rounded-tr-sm"
                          }`}>
                            <p className="text-sm text-[#3b4563] dark:text-[#d0f4ff]">{msg.text}</p>
                          </div>
                          <p className="text-xs text-[#b0bdd5] dark:text-[#3a6070] mt-1">{msg.time}</p>
                        </div>
                      </div>
                    ))}

                    {/* Suggestions (only show initially) */}
                    {chatMessages.length <= 1 && (
                      <div className="space-y-2">
                        <p className="text-xs text-[#7c8db5] dark:text-[#527a8a] px-2">Önerilen sorular:</p>
                        {suggestions.map((suggestion, i) => (
                          <button
                            key={i}
                            className="w-full text-left px-3 py-2 bg-[#f0f7ff] dark:bg-[#0f1e28] border border-[#00b4d8]/15 dark:border-[#00e6ff]/12 rounded-xl text-sm text-[#3b4563] dark:text-[#d0f4ff] hover:bg-[#e8f4fd] dark:hover:bg-[#162534] hover:border-[#00b4d8]/30 dark:hover:border-[#00e6ff]/25 transition-all"
                            onClick={() => setMessage(suggestion)}
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Input */}
                  <div className="p-4 border-t border-[#a78bfa]/15 dark:border-[#a78bfa]/10">
                    <div className="flex gap-2">
                      <Input
                        placeholder="AI'ya bir şey sorun..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="bg-[#f5f8ff] dark:bg-[#0f1e28] border-[#a78bfa]/20 dark:border-[#a78bfa]/15 text-[#3b4563] dark:text-[#d0f4ff] placeholder:text-[#b0bdd5] dark:placeholder:text-[#3a6070] rounded-xl"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSend();
                        }}
                        disabled={isAnalyzing}
                      />
                      <Button
                        size="icon"
                        className="bg-linear-to-br from-[#c4b5fd] to-[#93c5fd] hover:from-[#a78bfa] hover:to-[#60a5fa] rounded-xl"
                        onClick={handleSend}
                        disabled={isAnalyzing}
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

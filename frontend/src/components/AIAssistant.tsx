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
              className="relative w-16 h-16 rounded-full shadow-lg transition-all duration-300 group"
              style={{ background: "var(--gradient-logo)" }}
            >
              <div className="absolute inset-0 rounded-full opacity-15 animate-pulse-ring" style={{ backgroundColor: "var(--color-lavender)" }}></div>
              <div className="absolute inset-0 rounded-full opacity-10 animate-pulse-ring" style={{ backgroundColor: "var(--color-lavender)", animationDelay: "0.5s" }}></div>
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
            <Card className={`${isMinimized ? "w-80" : "w-96"} ${isMinimized ? "h-16" : "h-150"} backdrop-blur-xl transition-all duration-300 flex flex-col`}
              style={{ background: "var(--surface-glass-heavy)", border: "1px solid var(--color-lavender-border)" }}>
              {/* Header */}
              <div className="flex items-center justify-between p-4" style={{ borderBottom: "1px solid var(--color-lavender-border)" }}>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Sparkles className="w-5 h-5 animate-glow" style={{ color: "var(--color-ai)" }} />
                    <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: "var(--status-up)" }}></div>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold" style={{ color: "var(--color-ai)" }}>AI Assistant</h3>
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>{isAnalyzing ? "Analyzing..." : "Online"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" style={{ color: "var(--text-muted)" }} onClick={() => setIsMinimized(!isMinimized)}>
                    {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" style={{ color: "var(--text-muted)" }} onClick={() => setIsOpen(false)}>
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
                          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: "var(--gradient-logo)" }}>
                            <Sparkles className="w-4 h-4 text-white" />
                          </div>
                        )}
                        <div className={`flex-1 ${msg.role === "user" ? "max-w-[80%] ml-auto" : ""}`}>
                          <div className={`rounded-2xl p-3 ${msg.role === "ai" ? "rounded-tl-sm" : "rounded-tr-sm"}`}
                            style={msg.role === "ai"
                              ? { background: "var(--color-lavender-subtle)", border: "1px solid var(--color-lavender-border)" }
                              : { background: "var(--color-teal-subtle)", border: "1px solid var(--color-teal-border)" }}>
                            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{msg.text}</p>
                          </div>
                          <p className="text-xs mt-1" style={{ color: "var(--text-faint)" }}>{msg.time}</p>
                        </div>
                      </div>
                    ))}

                    {/* Suggestions (only show initially) */}
                    {chatMessages.length <= 1 && (
                      <div className="space-y-2">
                        <p className="text-xs px-2" style={{ color: "var(--text-muted)" }}>Önerilen sorular:</p>
                        {suggestions.map((suggestion, i) => (
                          <button
                            key={i}
                            className="w-full text-left px-3 py-2 rounded-xl text-sm transition-all"
                            style={{ background: "var(--surface-sunken)", border: "1px solid var(--color-teal-border)", color: "var(--text-secondary)" }}
                            onClick={() => setMessage(suggestion)}
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Input */}
                  <div className="p-4" style={{ borderTop: "1px solid var(--color-lavender-border)" }}>
                    <div className="flex gap-2">
                      <Input
                        placeholder="AI'ya bir şey sorun..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="rounded-xl"
                        style={{ background: "var(--input-bg)", borderColor: "var(--color-lavender-border)", color: "var(--text-secondary)" }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSend();
                        }}
                        disabled={isAnalyzing}
                      />
                      <Button
                        size="icon"
                        className="rounded-xl"
                        style={{ background: "var(--gradient-btn-primary)" }}
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

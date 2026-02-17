import { useState } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Sparkles, X, Send, Minimize2, Maximize2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [message, setMessage] = useState("");

  const suggestions = [
    "Why is payment-service slow?",
    "Analyze last 24h incidents",
    "Optimize resource usage",
  ];

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
              className="relative w-16 h-16 bg-gradient-to-br from-[#c4b5fd] to-[#93c5fd] rounded-full shadow-lg hover:shadow-[#c4b5fd]/40 transition-all duration-300 group"
            >
              {/* Pulse rings */}
              <div className="absolute inset-0 rounded-full bg-[#c4b5fd] opacity-15 animate-pulse-ring"></div>
              <div className="absolute inset-0 rounded-full bg-[#c4b5fd] opacity-10 animate-pulse-ring" style={{ animationDelay: "0.5s" }}></div>
              
              <Sparkles className="w-8 h-8 text-white absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-glow" />
              
              {/* Badge */}
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-[#fb7185] rounded-full flex items-center justify-center text-white text-xs font-bold animate-bounce">
                3
              </div>
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
            <Card className={`${isMinimized ? 'w-80' : 'w-96'} ${isMinimized ? 'h-16' : 'h-[600px]'} bg-white/95 backdrop-blur-xl border-[#c4b5fd]/20 shadow-xl shadow-[#c4b5fd]/10 transition-all duration-300`}>
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-[#c4b5fd]/15">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Sparkles className="w-5 h-5 text-[#8b5cf6] animate-glow" />
                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-[#34d399] rounded-full animate-pulse"></div>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#6d28d9]">AI Assistant</h3>
                    <p className="text-xs text-[#7c8db5]">Online</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-[#7c8db5] hover:text-[#8b5cf6]"
                    onClick={() => setIsMinimized(!isMinimized)}
                  >
                    {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-[#7c8db5] hover:text-[#fb7185]"
                    onClick={() => setIsOpen(false)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {!isMinimized && (
                <>
                  {/* Messages */}
                  <div className="flex-1 p-4 space-y-4 overflow-y-auto h-[440px]">
                    {/* AI Message */}
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#c4b5fd] to-[#93c5fd] flex items-center justify-center flex-shrink-0">
                        <Sparkles className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="bg-[#f5f0ff] border border-[#c4b5fd]/15 rounded-2xl rounded-tl-sm p-3">
                          <p className="text-sm text-[#3b4563]">
                            Hi! I've detected 3 anomalies in your system. 
                            <br /><br />
                            <span className="text-[#8b5cf6] font-semibold">payment-service</span> latency spiked by 340% at 14:32.
                            <br /><br />
                            Would you like me to investigate?
                          </p>
                        </div>
                        <p className="text-xs text-[#b0bdd5] mt-1">Just now</p>
                      </div>
                    </div>

                    {/* Suggestions */}
                    <div className="space-y-2">
                      <p className="text-xs text-[#7c8db5] px-2">Suggested questions:</p>
                      {suggestions.map((suggestion, i) => (
                        <button
                          key={i}
                          className="w-full text-left px-3 py-2 bg-[#f0f7ff] border border-[#93c5fd]/15 rounded-xl text-sm text-[#3b4563] hover:bg-[#e8f4fd] hover:border-[#93c5fd]/30 transition-all"
                          onClick={() => setMessage(suggestion)}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Input */}
                  <div className="p-4 border-t border-[#c4b5fd]/15">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Ask AI anything..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="bg-[#f5f8ff] border-[#c4b5fd]/20 text-[#3b4563] placeholder:text-[#b0bdd5] rounded-xl"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            setMessage("");
                          }
                        }}
                      />
                      <Button
                        size="icon"
                        className="bg-gradient-to-br from-[#c4b5fd] to-[#93c5fd] hover:from-[#a78bfa] hover:to-[#60a5fa] rounded-xl"
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

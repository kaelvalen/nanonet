import { useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { Home, Server, AlertCircle, Sparkles, Settings, X } from "lucide-react";

const navItems = [
  { to: "/", label: "Hub", icon: Home, color: "#39c5bb", glowColor: "rgba(57, 197, 187, 0.3)" },
  { to: "/services", label: "Services", icon: Server, color: "#93c5fd", glowColor: "rgba(147, 197, 253, 0.3)" },
  { to: "/alerts", label: "Alerts", icon: AlertCircle, color: "#fda4af", glowColor: "rgba(253, 164, 175, 0.3)" },
  { to: "/ai-insights", label: "AI Insights", icon: Sparkles, color: "#c4b5fd", glowColor: "rgba(196, 181, 253, 0.3)" },
  { to: "/settings", label: "Settings", icon: Settings, color: "#fda4af", glowColor: "rgba(253, 164, 175, 0.3)" },
];

export function RadialMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleNavigate = useCallback(
    (to: string) => {
      navigate(to);
      setIsOpen(false);
    },
    [navigate]
  );

  const radius = 160;
  const startAngle = -100;
  const totalAngle = 120;

  return (
    <div className="fixed bottom-6 left-6 z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-white/40 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen &&
          navItems.map((item, index) => {
            const angle = startAngle + (totalAngle / (navItems.length - 1)) * index;
            const radian = (angle * Math.PI) / 180;
            const x = Math.cos(radian) * radius;
            const y = Math.sin(radian) * radius;
            const isActive =
              location.pathname === item.to || (item.to !== "/" && location.pathname.startsWith(item.to));

            return (
              <motion.div
                key={item.to}
                initial={{ scale: 0, x: 0, y: 0, opacity: 0 }}
                animate={{ scale: 1, x: x, y: y, opacity: 1 }}
                exit={{ scale: 0, x: 0, y: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 20, delay: index * 0.05 }}
                className="absolute bottom-0 left-0 -translate-x-1/2 -translate-y-1/2"
                style={{ originX: 0.5, originY: 0.5 }}
              >
                <button onClick={() => handleNavigate(item.to)} className="group relative flex flex-col items-center gap-1">
                  <div
                    className="absolute inset-0 rounded-full blur-md opacity-40 group-hover:opacity-70 transition-opacity"
                    style={{ backgroundColor: item.glowColor, transform: "scale(1.5)" }}
                  />

                  <div
                    className={`relative w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-200 group-hover:scale-110 ${
                      isActive ? "bg-white scale-110 shadow-md" : "bg-white/90 hover:bg-white shadow-sm"
                    }`}
                    style={{
                      borderColor: item.color,
                      boxShadow: isActive ? `0 4px 15px ${item.glowColor}` : `0 2px 8px ${item.glowColor}`,
                    }}
                  >
                    <item.icon className="w-5 h-5" style={{ color: item.color }} />
                  </div>

                  <motion.span
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 + 0.15 }}
                    className="text-[10px] font-[var(--font-mono)] tracking-wider whitespace-nowrap px-2 py-0.5 rounded-full bg-white/90 border border-[#39c5bb]/15 shadow-sm"
                    style={{ color: item.color }}
                  >
                    {item.label}
                  </motion.span>
                </button>
              </motion.div>
            );
          })}
      </AnimatePresence>

      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-14 h-14 rounded-full flex items-center justify-center z-10"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        {!isOpen && (
          <>
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#39c5bb] to-[#93c5fd] opacity-20 animate-pulse-ring" />
            <div
              className="absolute inset-0 rounded-full bg-gradient-to-br from-[#39c5bb] to-[#93c5fd] opacity-15 animate-pulse-ring"
              style={{ animationDelay: "0.75s" }}
            />
          </>
        )}

        <div
          className={`relative w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300 ${
            isOpen
              ? "bg-white border-2 border-[#fda4af]/50 shadow-lg shadow-[#fda4af]/20"
              : "bg-gradient-to-br from-[#39c5bb] via-[#93c5fd] to-[#c4b5fd] shadow-lg shadow-[#39c5bb]/30"
          }`}
        >
          <AnimatePresence mode="wait">
            {isOpen ? (
              <motion.div
                key="close"
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <X className="w-6 h-6 text-[#fb7185]" />
              </motion.div>
            ) : (
              <motion.div
                key="open"
                initial={{ rotate: 90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: -90, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <span className="text-white text-xl animate-glow">✦</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.button>

      {!isOpen && (
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
          <div className="text-[9px] text-[#7c8db5] whitespace-nowrap bg-white/90 px-2 py-1 rounded-full border border-[#39c5bb]/15 shadow-sm">
            Navigate ✦
          </div>
        </div>
      )}
    </div>
  );
}

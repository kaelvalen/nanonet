import { useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { Home, Server, AlertCircle, Sparkles, Settings, X } from "lucide-react";

const navItems = [
  { to: "/", label: "Hub", icon: Home, colorVar: "var(--color-teal)", glowVar: "var(--color-teal-subtle)" },
  { to: "/services", label: "Services", icon: Server, colorVar: "var(--color-blue)", glowVar: "var(--color-blue-subtle)" },
  { to: "/alerts", label: "Alerts", icon: AlertCircle, colorVar: "var(--color-pink)", glowVar: "var(--color-pink-subtle)" },
  { to: "/ai-insights", label: "AI Insights", icon: Sparkles, colorVar: "var(--color-lavender)", glowVar: "var(--color-lavender-subtle)" },
  { to: "/settings", label: "Settings", icon: Settings, colorVar: "var(--color-pink)", glowVar: "var(--color-pink-subtle)" },
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

  const radius = 190;
  const startAngle = -85;
  const totalAngle = 100;

  return (
    <div className="fixed bottom-6 left-6 z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 backdrop-blur-sm"
            style={{ backgroundColor: "var(--surface-glass)" }}
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
                    className="absolute inset-0 rounded-full blur-md opacity-30 group-hover:opacity-60 transition-opacity"
                    style={{ backgroundColor: item.glowVar, transform: "scale(1.5)" }}
                  />

                  <div
                    className="relative w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-200 group-hover:scale-110"
                    style={{
                      background: "var(--surface-raised)",
                      borderColor: item.colorVar,
                      boxShadow: isActive ? `0 4px 15px ${item.glowVar}` : `0 2px 8px ${item.glowVar}`,
                      transform: isActive ? "scale(1.1)" : undefined,
                    }}
                  >
                    <item.icon className="w-5 h-5" style={{ color: item.colorVar }} />
                  </div>

                  <motion.span
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 + 0.15 }}
                    className="text-[10px] font-(--font-mono) tracking-wider whitespace-nowrap px-2 py-0.5 rounded-full shadow-sm"
                    style={{ background: "var(--surface-raised)", border: "1px solid var(--color-teal-border)", color: item.colorVar }}
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
            <div className="absolute inset-0 rounded-full opacity-20 animate-pulse-ring" style={{ background: "var(--gradient-logo)" }} />
            <div
              className="absolute inset-0 rounded-full opacity-15 animate-pulse-ring"
              style={{ background: "var(--gradient-logo)", animationDelay: "0.75s" }}
            />
          </>
        )}

        <div
          className="relative w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300"
          style={isOpen
            ? { background: "var(--surface-raised)", border: "2px solid var(--color-pink-border)", boxShadow: "0 8px 24px var(--shadow-card)" }
            : { background: "var(--gradient-logo)", boxShadow: "0 8px 24px var(--shadow-brand)" }}
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
                <X className="w-6 h-6" style={{ color: "var(--status-down)" }} />
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
          <div className="text-[9px] whitespace-nowrap px-2 py-1 rounded-full shadow-sm" style={{ background: "var(--surface-raised)", border: "1px solid var(--color-teal-border)", color: "var(--text-muted)" }}>
            Navigate ✦
          </div>
        </div>
      )}
    </div>
  );
}

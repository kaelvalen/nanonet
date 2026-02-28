import { useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { Home, Server, AlertCircle, Sparkles, Settings, X, Cloud } from "lucide-react";

const navItems = [
  { to: "/", label: "Ana Sayfa", icon: Home, colorVar: "var(--color-teal)", glowVar: "var(--color-teal-subtle)" },
  { to: "/services", label: "Servisler", icon: Server, colorVar: "var(--color-blue)", glowVar: "var(--color-blue-subtle)" },
  { to: "/alerts", label: "Uyarılar", icon: AlertCircle, colorVar: "var(--color-pink)", glowVar: "var(--color-pink-subtle)" },
  { to: "/ai-insights", label: "AI Analiz", icon: Sparkles, colorVar: "var(--color-lavender)", glowVar: "var(--color-lavender-subtle)" },
  { to: "/kubernetes", label: "K8s", icon: Cloud, colorVar: "var(--status-up)", glowVar: "var(--status-up-subtle)" },
  { to: "/settings", label: "Ayarlar", icon: Settings, colorVar: "var(--color-blue)", glowVar: "var(--color-blue-subtle)" },
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

  // ─── Düzgün simetrik yerleşim ───
  // Sol alt köşeden saat yönünün tersine çeyrek daire (0° = sağ, 90° = yukarı)
  // -10° ile 100° arası → 6 item eşit aralıkla
  const count = navItems.length;
  const radius = 140;
  const arcStart = -5;   // derece — sağ taraftan biraz aşağı
  const arcEnd = 95;     // derece — neredeyse tam yukarı
  const arcSpan = arcEnd - arcStart;

  return (
    <div className="fixed bottom-6 left-6 z-50">
      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0"
            style={{ backgroundColor: "rgba(0,0,0,0.3)", backdropFilter: "blur(4px)" }}
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Nav items */}
      <AnimatePresence>
        {isOpen &&
          navItems.map((item, index) => {
            // Eşit aralıklı açı hesapla
            const angle = arcStart + (arcSpan / (count - 1)) * index;
            const radian = (angle * Math.PI) / 180;
            const x = Math.cos(radian) * radius;
            const y = -Math.sin(radian) * radius; // ekranda yukarı = negatif y
            const isActive =
              location.pathname === item.to || (item.to !== "/" && location.pathname.startsWith(item.to));

            return (
              <motion.div
                key={item.to}
                initial={{ scale: 0, x: 0, y: 0, opacity: 0 }}
                animate={{ scale: 1, x, y, opacity: 1 }}
                exit={{ scale: 0, x: 0, y: 0, opacity: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 500,
                  damping: 28,
                  delay: index * 0.04,
                }}
                className="absolute bottom-2 left-2"
                style={{ zIndex: 51 }}
              >
                <button
                  onClick={() => handleNavigate(item.to)}
                  className="group relative flex flex-col items-center gap-1.5"
                >
                  {/* Glow */}
                  <div
                    className="absolute inset-0 rounded-full blur-lg transition-opacity duration-200"
                    style={{
                      backgroundColor: item.colorVar,
                      opacity: isActive ? 0.35 : 0.15,
                      transform: "scale(2)",
                    }}
                  />

                  {/* Icon circle */}
                  <div
                    className="relative w-11 h-11 rounded-full flex items-center justify-center border transition-all duration-200 group-hover:scale-110"
                    style={{
                      background: "var(--surface-raised)",
                      borderColor: isActive ? item.colorVar : "var(--border-subtle)",
                      borderWidth: isActive ? 2 : 1,
                      boxShadow: isActive
                        ? `0 0 16px ${item.glowVar}`
                        : "0 2px 8px rgba(0,0,0,0.15)",
                    }}
                  >
                    <item.icon
                      className="w-4.5 h-4.5"
                      style={{ color: item.colorVar, width: 18, height: 18 }}
                    />
                  </div>

                  {/* Label */}
                  <motion.span
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.04 + 0.12 }}
                    className="text-[9px] font-medium tracking-wide whitespace-nowrap px-2 py-0.5 rounded-md"
                    style={{
                      background: "var(--surface-raised)",
                      border: `1px solid ${isActive ? item.colorVar : "var(--border-subtle)"}`,
                      color: item.colorVar,
                      boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
                    }}
                  >
                    {item.label}
                  </motion.span>
                </button>
              </motion.div>
            );
          })}
      </AnimatePresence>

      {/* Toggle button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-12 h-12 rounded-full flex items-center justify-center z-[52]"
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
      >
        {/* Pulse rings */}
        {!isOpen && (
          <>
            <div
              className="absolute inset-0 rounded-full opacity-20 animate-pulse-ring"
              style={{ background: "var(--gradient-logo)" }}
            />
            <div
              className="absolute inset-0 rounded-full opacity-10 animate-pulse-ring"
              style={{ background: "var(--gradient-logo)", animationDelay: "1s" }}
            />
          </>
        )}

        <div
          className="relative w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300"
          style={
            isOpen
              ? {
                background: "var(--surface-raised)",
                border: "2px solid var(--status-down-border)",
                boxShadow: "0 4px 16px var(--shadow-card)",
              }
              : {
                background: "var(--gradient-logo)",
                boxShadow: "0 4px 20px var(--shadow-brand)",
              }
          }
        >
          <AnimatePresence mode="wait">
            {isOpen ? (
              <motion.div
                key="close"
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.12 }}
              >
                <X className="w-5 h-5" style={{ color: "var(--status-down)" }} />
              </motion.div>
            ) : (
              <motion.div
                key="open"
                initial={{ rotate: 90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: -90, opacity: 0 }}
                transition={{ duration: 0.12 }}
              >
                <span className="text-white text-lg">✦</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.button>
    </div>
  );
}

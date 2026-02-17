import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "./ui/command";
import {
  Home,
  Server,
  AlertCircle,
  Sparkles,
  Settings,
  Plus,
  RotateCw,
  Search,
  Terminal,
  Activity,
  Cpu,
  Globe,
} from "lucide-react";
import { useServiceStore } from "@/store/serviceStore";

const navigationItems = [
  { label: "Dashboard Hub", icon: Home, path: "/", shortcut: "⌘1" },
  { label: "Services", icon: Server, path: "/services", shortcut: "⌘2" },
  { label: "Alerts", icon: AlertCircle, path: "/alerts", shortcut: "⌘3" },
  { label: "AI Insights", icon: Sparkles, path: "/ai-insights", shortcut: "⌘4" },
  { label: "Settings", icon: Settings, path: "/settings", shortcut: "⌘5" },
];

const actionItems = [
  { label: "Add New Service", icon: Plus, action: "add-service" },
  { label: "Run Full Analysis", icon: Sparkles, action: "analyze" },
  { label: "Restart All Services", icon: RotateCw, action: "restart-all" },
  { label: "System Health Check", icon: Activity, action: "health-check" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { services } = useServiceStore();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (open && e.metaKey) {
        const num = parseInt(e.key);
        if (num >= 1 && num <= 5) {
          e.preventDefault();
          const item = navigationItems[num - 1];
          if (item) {
            navigate(item.path);
            setOpen(false);
          }
        }
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, navigate]);

  const handleNavigate = useCallback(
    (path: string) => {
      navigate(path);
      setOpen(false);
    },
    [navigate]
  );

  const handleAction = useCallback(
    (action: string) => {
      switch (action) {
        case "add-service":
          navigate("/services");
          break;
        case "analyze":
          navigate("/ai-insights");
          break;
        default:
          break;
      }
      setOpen(false);
    },
    [navigate]
  );

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-60 bg-[#3b4563]/20 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed top-[15%] left-1/2 -translate-x-1/2 z-61 w-full max-w-[640px] px-4"
          >
            <div className="absolute -inset-4 bg-gradient-to-b from-[#39c5bb]/10 via-[#c4b5fd]/8 to-transparent rounded-3xl blur-2xl" />

            <div className="relative">
              <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-[#39c5bb]/30 to-transparent z-10 rounded-full" />

              <Command className="bg-white/95 backdrop-blur-xl border border-[#39c5bb]/15 rounded-2xl shadow-xl shadow-[#39c5bb]/5 overflow-hidden">
                <div className="flex items-center gap-3 px-4 pt-3 pb-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[#39c5bb]">✦</span>
                    <span className="text-xs text-[#7c8db5] tracking-wide">NanoNet Command</span>
                  </div>
                  <div className="flex-1" />
                  <div className="flex items-center gap-1">
                    <kbd className="text-[10px] font-[var(--font-mono)] px-1.5 py-0.5 bg-[#f0f7ff] border border-[#39c5bb]/15 rounded text-[#7c8db5]">ESC</kbd>
                    <span className="text-[10px] text-[#b0bdd5]">to close</span>
                  </div>
                </div>

                <CommandInput
                  placeholder="Type a command or search..."
                  className="text-[#3b4563] placeholder:text-[#b0bdd5]"
                />

                <CommandList className="max-h-[400px] p-2">
                  <CommandEmpty className="text-[#7c8db5] text-xs">
                    <div className="flex flex-col items-center gap-2 py-8">
                      <Search className="w-8 h-8 text-[#c4b5fd]" />
                      <span>No results found</span>
                    </div>
                  </CommandEmpty>

                  {/* Navigation */}
                  <CommandGroup
                    heading={<span className="text-[10px] tracking-widest text-[#39c5bb] uppercase">Navigation</span>}
                  >
                    {navigationItems.map((item) => (
                      <CommandItem
                        key={item.path}
                        onSelect={() => handleNavigate(item.path)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer text-[#3b4563] data-[selected=true]:bg-[#39c5bb]/8 data-[selected=true]:text-[#2da89e] data-[selected=true]:border-l-2 data-[selected=true]:border-[#39c5bb]"
                      >
                        <item.icon className="w-4 h-4" />
                        <span className="flex-1">{item.label}</span>
                        <kbd className="text-[10px] font-[var(--font-mono)] px-1.5 py-0.5 bg-[#f0f7ff] border border-[#39c5bb]/10 rounded text-[#7c8db5]">
                          {item.shortcut}
                        </kbd>
                      </CommandItem>
                    ))}
                  </CommandGroup>

                  <CommandSeparator className="bg-[#39c5bb]/8 my-2" />

                  {/* Real Services */}
                  {services.length > 0 && (
                    <>
                      <CommandGroup
                        heading={<span className="text-[10px] tracking-widest text-[#93c5fd] uppercase">Services</span>}
                      >
                        {services.map((service) => (
                          <CommandItem
                            key={service.id}
                            onSelect={() => handleNavigate(`/services/${service.id}`)}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer text-[#3b4563] data-[selected=true]:bg-[#93c5fd]/10 data-[selected=true]:text-[#3b82f6]"
                          >
                            <div className="relative">
                              <Cpu className="w-4 h-4 text-[#7c8db5]" />
                              <div
                                className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ${
                                  service.status === "up"
                                    ? "bg-[#34d399]"
                                    : service.status === "degraded"
                                    ? "bg-[#fbbf24]"
                                    : "bg-[#fb7185]"
                                }`}
                              />
                            </div>
                            <span className="flex-1 font-[var(--font-mono)] text-xs">{service.name}</span>
                            <span
                              className={`text-[10px] font-[var(--font-mono)] px-1.5 py-0.5 rounded-full ${
                                service.status === "up"
                                  ? "bg-[#a7f3d0]/30 text-[#059669] border border-[#a7f3d0]/50"
                                  : service.status === "degraded"
                                  ? "bg-[#fef3c7]/50 text-[#d97706] border border-[#fcd34d]/50"
                                  : "bg-[#fda4af]/20 text-[#e11d48] border border-[#fda4af]/30"
                              }`}
                            >
                              {service.status.toUpperCase()}
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>

                      <CommandSeparator className="bg-[#c4b5fd]/10 my-2" />
                    </>
                  )}

                  {/* Actions */}
                  <CommandGroup
                    heading={<span className="text-[10px] tracking-widest text-[#c4b5fd] uppercase">Actions</span>}
                  >
                    {actionItems.map((action) => (
                      <CommandItem
                        key={action.action}
                        onSelect={() => handleAction(action.action)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer text-[#3b4563] data-[selected=true]:bg-[#c4b5fd]/10 data-[selected=true]:text-[#7c3aed]"
                      >
                        <action.icon className="w-4 h-4" />
                        <span className="flex-1">{action.label}</span>
                        <Globe className="w-3 h-3 text-[#b0bdd5]" />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>

                {/* Footer */}
                <div className="flex items-center gap-4 px-4 py-2 border-t border-[#39c5bb]/10 text-[10px] text-[#b0bdd5] font-[var(--font-mono)]">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1 py-0.5 bg-[#f0f7ff] border border-[#39c5bb]/10 rounded">↑↓</kbd>
                    navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1 py-0.5 bg-[#f0f7ff] border border-[#39c5bb]/10 rounded">↵</kbd>
                    select
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1 py-0.5 bg-[#f0f7ff] border border-[#39c5bb]/10 rounded">⌘K</kbd>
                    toggle
                  </span>
                </div>
              </Command>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

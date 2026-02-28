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
  Play,
  Power,
  RefreshCw,
  Cloud,
} from "lucide-react";
import { useServiceStore } from "@/store/serviceStore";
import { servicesApi } from "@/api/services";
import { toast } from "sonner";

const navigationItems = [
  { label: "Ana Sayfa", icon: Home, path: "/", shortcut: "⌘1" },
  { label: "Servisler", icon: Server, path: "/services", shortcut: "⌘2" },
  { label: "Uyarılar", icon: AlertCircle, path: "/alerts", shortcut: "⌘3" },
  { label: "AI Analiz", icon: Sparkles, path: "/ai-insights", shortcut: "⌘4" },
  { label: "Ayarlar", icon: Settings, path: "/settings", shortcut: "⌘5" },
  { label: "Kubernetes", icon: Cloud, path: "/kubernetes", shortcut: "⌘6" },
];

const actionItems = [
  { label: "Yeni Servis Ekle", icon: Plus, action: "add-service" },
  { label: "Tam Analiz Çalıştır", icon: Sparkles, action: "analyze" },
  { label: "Tüm Servisleri Yeniden Başlat", icon: RotateCw, action: "restart-all" },
  { label: "Sistem Sağlık Kontrolü", icon: Activity, action: "health-check" },
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

  const handleServiceAction = useCallback(
    async (serviceId: string, serviceName: string, action: 'start' | 'restart' | 'stop') => {
      setOpen(false);
      try {
        if (action === 'start') {
          await servicesApi.start(serviceId);
          toast.success(`${serviceName}: start komutu gönderildi`);
        } else if (action === 'restart') {
          await servicesApi.restart(serviceId);
          toast.success(`${serviceName}: restart komutu gönderildi`);
        } else if (action === 'stop') {
          await servicesApi.stop(serviceId);
          toast.success(`${serviceName}: stop komutu gönderildi`);
        }
      } catch {
        toast.error(`${serviceName}: komut gönderilemedi`);
      }
    },
    []
  );

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-60 backdrop-blur-sm"
            style={{ backgroundColor: "var(--surface-glass)" }}
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
            className="fixed top-[15%] left-1/2 -translate-x-1/2 z-61 w-full max-w-160 px-4"
          >
            <div className="absolute -inset-4 rounded-3xl blur-2xl" style={{ background: "linear-gradient(to bottom, var(--color-teal-subtle), var(--color-lavender-subtle), transparent)" }} />

            <div className="relative">
              <div className="absolute inset-x-0 top-0 h-px z-10 rounded-full" style={{ background: "linear-gradient(to right, transparent, var(--color-teal-border), transparent)" }} />

              <Command className="backdrop-blur-xl rounded-2xl overflow-hidden" style={{ background: "var(--surface-glass-heavy)", border: "1px solid var(--color-teal-border)" }}>
                <div className="flex items-center gap-3 px-4 pt-3 pb-0">
                  <div className="flex items-center gap-2">
                    <span style={{ color: "var(--color-teal)" }}>✦</span>
                    <span className="text-xs tracking-wide" style={{ color: "var(--text-muted)" }}>NanoNet Command</span>
                  </div>
                  <div className="flex-1" />
                  <div className="flex items-center gap-1">
                    <kbd className="text-[10px] font-(--font-mono) px-1.5 py-0.5 rounded" style={{ background: "var(--surface-sunken)", border: "1px solid var(--color-teal-border)", color: "var(--text-muted)" }}>ESC</kbd>
                    <span className="text-[10px]" style={{ color: "var(--text-faint)" }}>to close</span>
                  </div>
                </div>

                <CommandInput
                  placeholder="Type a command or search..."
                  style={{ color: "var(--text-secondary)" }}
                />

                <CommandList className="max-h-100 p-2">
                  <CommandEmpty className="text-xs" style={{ color: "var(--text-muted)" }}>
                    <div className="flex flex-col items-center gap-2 py-8">
                      <Search className="w-8 h-8" style={{ color: "var(--color-lavender)" }} />
                      <span>Sonuç bulunamadı</span>
                    </div>
                  </CommandEmpty>

                  {/* Navigation */}
                  <CommandGroup
                    heading={<span className="text-[10px] tracking-widest uppercase" style={{ color: "var(--color-teal)" }}>Navigasyon</span>}
                  >
                    {navigationItems.map((item) => (
                      <CommandItem
                        key={item.path}
                        onSelect={() => handleNavigate(item.path)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        <item.icon className="w-4 h-4" />
                        <span className="flex-1">{item.label}</span>
                        <kbd className="text-[10px] font-(--font-mono) px-1.5 py-0.5 rounded" style={{ background: "var(--surface-sunken)", border: "1px solid var(--color-teal-border)", color: "var(--text-muted)" }}>
                          {item.shortcut}
                        </kbd>
                      </CommandItem>
                    ))}
                  </CommandGroup>

                  <CommandSeparator className="my-2" style={{ backgroundColor: "var(--border-subtle)" }} />

                  {/* Real Services */}
                  {services.length > 0 && (
                    <>
                      <CommandGroup
                        heading={<span className="text-[10px] tracking-widest uppercase" style={{ color: "var(--color-blue)" }}>Servisler</span>}
                      >
                        {services.map((service) => (
                          <CommandItem
                            key={service.id}
                            onSelect={() => handleNavigate(`/services/${service.id}`)}
                            className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            <div className="relative">
                              <Cpu className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                              <div
                                className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
                                style={{ backgroundColor: service.status === "up" ? "var(--status-up)" : service.status === "degraded" ? "var(--status-warn)" : "var(--status-down)" }}
                              />
                            </div>
                            <span className="flex-1 font-(--font-mono) text-xs">{service.name}</span>
                            <span
                              className="text-[10px] font-(--font-mono) px-1.5 py-0.5 rounded-full border"
                              style={{
                                background: service.status === "up" ? "var(--status-up-subtle)" : service.status === "degraded" ? "var(--status-warn-subtle)" : "var(--status-down-subtle)",
                                color: service.status === "up" ? "var(--status-up-text)" : service.status === "degraded" ? "var(--status-warn-text)" : "var(--status-down-text)",
                                borderColor: service.status === "up" ? "var(--status-up-border)" : service.status === "degraded" ? "var(--status-warn-border)" : "var(--status-down-border)",
                              }}
                            >
                              {service.status?.toUpperCase() ?? 'UNKNOWN'}
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>

                      <CommandSeparator className="my-2" style={{ backgroundColor: "var(--border-subtle)" }} />

                      {/* Per-service quick actions */}
                      <CommandGroup
                        heading={<span className="text-[10px] tracking-widest uppercase" style={{ color: "var(--status-up)" }}>Servis Kontrolleri</span>}
                      >
                        {services.slice(0, 5).flatMap((service) => [
                          {
                            key: `${service.id}-start`,
                            icon: Play,
                            label: `Start  ${service.name}`,
                            colorVar: 'var(--status-up-text)',
                            action: () => handleServiceAction(service.id, service.name, 'start'),
                          },
                          {
                            key: `${service.id}-restart`,
                            icon: RefreshCw,
                            label: `Restart  ${service.name}`,
                            colorVar: 'var(--color-teal)',
                            action: () => handleServiceAction(service.id, service.name, 'restart'),
                          },
                          {
                            key: `${service.id}-stop`,
                            icon: Power,
                            label: `Stop  ${service.name}`,
                            colorVar: 'var(--status-warn-text)',
                            action: () => handleServiceAction(service.id, service.name, 'stop'),
                          },
                        ]).map((item) => (
                          <CommandItem
                            key={item.key}
                            onSelect={item.action}
                            className="flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            <item.icon className="w-3.5 h-3.5" style={{ color: item.colorVar }} />
                            <span className="flex-1 text-xs">{item.label}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>

                      <CommandSeparator className="my-2" style={{ backgroundColor: "var(--color-lavender-subtle)" }} />
                    </>
                  )}

                  {/* Actions */}
                  <CommandGroup
                    heading={<span className="text-[10px] tracking-widest uppercase" style={{ color: "var(--color-lavender)" }}>Aksiyonlar</span>}
                  >
                    {actionItems.map((action) => (
                      <CommandItem
                        key={action.action}
                        onSelect={() => handleAction(action.action)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        <action.icon className="w-4 h-4" />
                        <span className="flex-1">{action.label}</span>
                        <Globe className="w-3 h-3" style={{ color: "var(--text-faint)" }} />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>

                {/* Footer */}
                <div className="flex items-center gap-4 px-4 py-2 text-[10px] font-(--font-mono)" style={{ borderTop: "1px solid var(--color-teal-border)", color: "var(--text-faint)" }}>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1 py-0.5 rounded" style={{ background: "var(--surface-sunken)", border: "1px solid var(--color-teal-border)" }}>↑↓</kbd>
                    navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1 py-0.5 rounded" style={{ background: "var(--surface-sunken)", border: "1px solid var(--color-teal-border)" }}>↵</kbd>
                    select
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1 py-0.5 rounded" style={{ background: "var(--surface-sunken)", border: "1px solid var(--color-teal-border)" }}>⌘K</kbd>
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

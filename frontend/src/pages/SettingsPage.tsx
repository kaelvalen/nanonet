import { useState } from "react";
import { motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Bell,
  Palette,
  Zap,
  Heart,
  Info,
  CheckCircle2,
  Sparkles,
  Moon,
  Sun,
  Monitor,
  Layers,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useThemeStore, type ThemeName, type ThemeMode } from "@/store/themeStore";
import { toast } from "sonner";

function SectionHeader({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: "var(--brand-primary-subtle)" }}>
        <Icon className="w-3.5 h-3.5" style={{ color: "var(--brand-primary)" }} />
      </div>
      <h3 className="text-sm font-semibold" style={{ color: "var(--text-secondary)" }}>{label}</h3>
    </div>
  );
}

function SettingRow({ label, desc, checked, onChange }: {
  label: string; desc: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex-1 pr-4">
        <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{label}</p>
        <p className="text-[10px] mt-0.5" style={{ color: "var(--text-faint)" }}>{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} className="shrink-0" />
    </div>
  );
}

const THEME_OPTIONS: {
  name: ThemeName;
  mode: ThemeMode;
  label: string;
  sublabel: string;
  icon: React.ElementType;
  preview: string;
}[] = [
  {
    name: "cinnamiku",
    mode: "light",
    label: "CinnaMiku",
    sublabel: "Pastel Light",
    icon: Sun,
    preview: "linear-gradient(110deg, #D0FAFF 0%, #FED7FF 100%)",
  },
  {
    name: "cinnamiku",
    mode: "dark",
    label: "CinnaMiku",
    sublabel: "Deep Ocean",
    icon: Moon,
    preview: "linear-gradient(110deg, #071012 0%, #324758 60%, #00E6FF 100%)",
  },
  {
    name: "pro",
    mode: "light",
    label: "Pro",
    sublabel: "Clean Light",
    icon: Monitor,
    preview: "linear-gradient(110deg, #f8fafc 0%, #e0e7ff 100%)",
  },
  {
    name: "pro",
    mode: "dark",
    label: "Pro",
    sublabel: "Slate Dark",
    icon: Layers,
    preview: "linear-gradient(110deg, #0a0c10 0%, #1e2240 100%)",
  },
];

export function SettingsPage() {
  const { user } = useAuthStore();
  const { themeName, themeMode, setThemeName, setThemeMode } = useThemeStore();

  const [notifs, setNotifs] = useState({ crit: true, warn: true, down: true, ai: false });
  const [monitoring, setMonitoring] = useState({ pollInterval: 10, autoRecovery: false, wsReconnect: true });
  const [ai, setAi] = useState({ autoAnalyze: true, window: 30 });
  const [appearance, setAppearance] = useState({ matrix: true, radial: true });
  const [saved, setSaved] = useState<string | null>(null);

  const handleSave = (section: string) => {
    setSaved(section);
    toast.success(`${section} settings saved`);
    setTimeout(() => setSaved(null), 2000);
  };

  const handleThemeSelect = (name: ThemeName, mode: ThemeMode) => {
    setThemeName(name);
    setThemeMode(mode);
  };

  const cardStyle = {
    background: "var(--surface-glass)",
    borderColor: "var(--border-subtle)",
  };

  const dividerStyle = { backgroundColor: "var(--border-divider)" };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <h1 className="text-2xl font-bold bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-heading)" }}>
          Settings
        </h1>
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Platform configuration and preferences</p>
      </motion.div>

      {/* Profile */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
        <Card className="rounded-xl p-5 border" style={cardStyle}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-sm shrink-0"
              style={{ background: "var(--gradient-logo)" }}>
              {user?.email?.charAt(0).toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold truncate" style={{ color: "var(--text-secondary)" }}>
                {user?.email || "user@nanonet.dev"}
              </h3>
              <p className="text-[10px] mt-0.5" style={{ color: "var(--text-faint)" }}>
                Since {user?.created_at ? new Date(user.created_at).toLocaleDateString("en-US") : "—"}
              </p>
            </div>
            <Badge className="text-[9px] rounded-full shrink-0"
              style={{ background: "var(--status-up-subtle)", color: "var(--status-up-text)", borderColor: "var(--status-up-border)" }}>
              Active
            </Badge>
          </div>
        </Card>
      </motion.div>

      {/* Notifications */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }}>
        <Card className="rounded-xl p-5 border" style={cardStyle}>
          <div className="flex items-center justify-between mb-1">
            <SectionHeader icon={Bell} label="Notifications" />
            <Button size="sm" variant="outline"
              onClick={() => handleSave("Notifications")}
              className="h-7 px-3 text-[10px] rounded-lg border transition-all mb-4"
              style={saved === "Notifications"
                ? { borderColor: "var(--status-up-border)", color: "var(--status-up-text)", background: "var(--status-up-subtle)" }
                : { borderColor: "var(--color-pink-border)", color: "var(--text-muted)" }}>
              {saved === "Notifications" ? <><CheckCircle2 className="w-3 h-3 mr-1" />Saved</> : "Save"}
            </Button>
          </div>
          <Separator className="mb-3" style={dividerStyle} />
          <div className="space-y-1 divide-y" style={{ borderColor: "var(--border-divider)" }}>
            <SettingRow label="Critical Alerts" desc="Get notified on critical severity alerts" checked={notifs.crit} onChange={(v) => setNotifs(p => ({ ...p, crit: v }))} />
            <SettingRow label="Warning Alerts" desc="Get notified on warning severity alerts" checked={notifs.warn} onChange={(v) => setNotifs(p => ({ ...p, warn: v }))} />
            <SettingRow label="Service Down" desc="Get notified when a service goes offline" checked={notifs.down} onChange={(v) => setNotifs(p => ({ ...p, down: v }))} />
            <SettingRow label="AI Insights" desc="Get notified when a new AI insight is ready" checked={notifs.ai} onChange={(v) => setNotifs(p => ({ ...p, ai: v }))} />
          </div>
        </Card>
      </motion.div>

      {/* Monitoring */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
        <Card className="rounded-xl p-5 border" style={cardStyle}>
          <div className="flex items-center justify-between mb-1">
            <SectionHeader icon={Zap} label="Monitoring" />
            <Button size="sm" variant="outline"
              onClick={() => handleSave("Monitoring")}
              className="h-7 px-3 text-[10px] rounded-lg border transition-all mb-4"
              style={saved === "Monitoring"
                ? { borderColor: "var(--status-up-border)", color: "var(--status-up-text)", background: "var(--status-up-subtle)" }
                : { borderColor: "var(--color-teal-border)", color: "var(--text-muted)" }}>
              {saved === "Monitoring" ? <><CheckCircle2 className="w-3 h-3 mr-1" />Saved</> : "Save"}
            </Button>
          </div>
          <Separator className="mb-3" style={dividerStyle} />
          <div className="space-y-4">
            <div className="grid gap-1.5">
              <Label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Default Poll Interval (seconds)</Label>
              <div className="flex items-center gap-3">
                <Input type="number" min={5} max={300} value={monitoring.pollInterval}
                  onChange={(e) => setMonitoring(p => ({ ...p, pollInterval: parseInt(e.target.value) || 10 }))}
                  className="rounded-xl text-xs h-9 w-24"
                  style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-secondary)" }} />
                <span className="text-[10px]" style={{ color: "var(--text-faint)" }}>Min 5s, Max 300s</span>
              </div>
            </div>
            <Separator style={dividerStyle} />
            <div className="space-y-1 divide-y" style={{ borderColor: "var(--border-divider)" }}>
              <SettingRow label="Auto-Recovery" desc="Automatically restart crashed services" checked={monitoring.autoRecovery} onChange={(v) => setMonitoring(p => ({ ...p, autoRecovery: v }))} />
              <SettingRow label="WebSocket Auto-Reconnect" desc="Reconnect automatically when connection drops" checked={monitoring.wsReconnect} onChange={(v) => setMonitoring(p => ({ ...p, wsReconnect: v }))} />
            </div>
          </div>
        </Card>
      </motion.div>

      {/* AI */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.25 }}>
        <Card className="rounded-xl p-5 border" style={cardStyle}>
          <div className="flex items-center justify-between mb-1">
            <SectionHeader icon={Sparkles} label="AI Analysis" />
            <Button size="sm" variant="outline"
              onClick={() => handleSave("AI")}
              className="h-7 px-3 text-[10px] rounded-lg border transition-all mb-4"
              style={saved === "AI"
                ? { borderColor: "var(--status-up-border)", color: "var(--status-up-text)", background: "var(--status-up-subtle)" }
                : { borderColor: "var(--color-lavender-border)", color: "var(--text-muted)" }}>
              {saved === "AI" ? <><CheckCircle2 className="w-3 h-3 mr-1" />Saved</> : "Save"}
            </Button>
          </div>
          <Separator className="mb-3" style={dividerStyle} />
          <div className="space-y-4">
            <SettingRow label="Auto-Analyze on Critical Alert" desc="Run AI analysis automatically after a critical alert fires" checked={ai.autoAnalyze} onChange={(v) => setAi(p => ({ ...p, autoAnalyze: v }))} />
            <Separator style={dividerStyle} />
            <div className="grid gap-1.5">
              <Label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Analysis Window (minutes)</Label>
              <div className="flex items-center gap-3">
                <Input type="number" min={5} max={120} value={ai.window}
                  onChange={(e) => setAi(p => ({ ...p, window: parseInt(e.target.value) || 30 }))}
                  className="rounded-xl text-xs h-9 w-24"
                  style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-secondary)" }} />
                <span className="text-[10px]" style={{ color: "var(--text-faint)" }}>Min 5m, Max 120m</span>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Appearance */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.3 }}>
        <Card className="rounded-xl p-5 border" style={cardStyle}>
          <SectionHeader icon={Palette} label="Appearance" />
          <Separator className="mb-4" style={dividerStyle} />

          {/* Theme grid */}
          <div className="mb-5">
            <Label className="text-xs font-medium mb-3 block" style={{ color: "var(--text-secondary)" }}>Theme</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {THEME_OPTIONS.map((opt) => {
                const isActive = themeName === opt.name && themeMode === opt.mode;
                const IconComp = opt.icon;
                return (
                  <button
                    key={`${opt.name}-${opt.mode}`}
                    onClick={() => handleThemeSelect(opt.name, opt.mode)}
                    className="relative rounded-xl overflow-hidden border-2 transition-all text-left focus:outline-none"
                    style={{
                      borderColor: isActive ? "var(--brand-primary)" : "var(--border-subtle)",
                      boxShadow: isActive ? "0 0 0 3px var(--brand-primary-muted)" : "none",
                    }}
                  >
                    {/* Preview swatch */}
                    <div className="h-10 w-full" style={{ background: opt.preview }} />
                    {/* Label row */}
                    <div className="px-2 py-1.5" style={{ background: "var(--surface-sunken)" }}>
                      <div className="flex items-center gap-1">
                        <IconComp className="w-3 h-3" style={{ color: "var(--brand-primary)" }} />
                        <span className="text-[10px] font-semibold" style={{ color: "var(--text-secondary)" }}>{opt.label}</span>
                      </div>
                      <p className="text-[9px] mt-0.5" style={{ color: "var(--text-faint)" }}>{opt.sublabel}</p>
                    </div>
                    {/* Active checkmark */}
                    {isActive && (
                      <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center"
                        style={{ background: "var(--brand-primary)" }}>
                        <CheckCircle2 className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <Separator className="mb-4" style={dividerStyle} />

          {/* Effects toggles */}
          <div className="space-y-1 divide-y" style={{ borderColor: "var(--border-divider)" }}>
            <SettingRow label="Matrix Background" desc="Show animated background effect" checked={appearance.matrix} onChange={(v) => setAppearance(p => ({ ...p, matrix: v }))} />
            <SettingRow label="Radial Menu" desc="Show floating radial quick-action menu" checked={appearance.radial} onChange={(v) => setAppearance(p => ({ ...p, radial: v }))} />
          </div>
        </Card>
      </motion.div>

      {/* About */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.35 }}>
        <Card className="rounded-xl p-5 border" style={cardStyle}>
          <SectionHeader icon={Info} label="About" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Platform", value: "NanoNet v2.0" },
              { label: "Theme", value: themeName === "cinnamiku" ? "CinnaMiku" : "Pro" },
              { label: "Stack", value: "React + Go + Rust" },
              { label: "Database", value: "TimescaleDB" },
            ].map(({ label, value }) => (
              <div key={label} className="p-3 rounded-xl" style={{ background: "var(--surface-sunken)" }}>
                <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>{label}</span>
                <p className="mt-1 text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 flex items-center justify-center gap-1.5 text-[10px]"
            style={{ borderTop: "1px solid var(--border-divider)", color: "var(--text-faint)" }}>
            <Heart className="w-3 h-3" style={{ color: "var(--color-pink)" }} />
            Built with love · NanoNet Monitoring Platform
          </div>
        </Card>
      </motion.div>
    </div>
  );
}

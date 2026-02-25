import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Bell,
  Shield,
  Palette,
  Zap,
  Heart,
  Info,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";

function SectionHeader({ icon: Icon, label, color }: { icon: React.ElementType; label: string; color: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center`} style={{ backgroundColor: `${color}15` }}>
        <Icon className="w-3.5 h-3.5" style={{ color }} />
      </div>
      <h3 className="text-sm font-semibold text-[#3b4563] dark:text-[#d0f4ff]">{label}</h3>
    </div>
  );
}

function SettingRow({ label, desc, checked, onChange, color = "#39c5bb" }: {
  label: string; desc: string; checked: boolean; onChange: (v: boolean) => void; color?: string;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex-1 pr-4">
        <p className="text-xs font-medium text-[#3b4563] dark:text-[#d0f4ff]">{label}</p>
        <p className="text-[10px] text-[#b0bdd5] dark:text-[#3a6070] mt-0.5">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} className="data-[state=checked]:bg-current shrink-0" style={{ color }} />
    </div>
  );
}

export function SettingsPage() {
  const { user } = useAuthStore();

  const [notifs, setNotifs] = useState({ crit: true, warn: true, down: true, ai: false });
  const [monitoring, setMonitoring] = useState({ pollInterval: 10, autoRecovery: false, wsReconnect: true });
  const [ai, setAi] = useState({ autoAnalyze: true, window: 30 });
  const [appearance, setAppearance] = useState({
    matrix: true,
    radial: true,
    darkMode: localStorage.getItem("nanonet-theme") === "dark" || document.documentElement.classList.contains("dark"),
  });

  useEffect(() => {
    if (appearance.darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("nanonet-theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("nanonet-theme", "light");
    }
  }, [appearance.darkMode]);
  const [saved, setSaved] = useState<string | null>(null);

  const handleSave = (section: string) => {
    setSaved(section);
    toast.success(`${section} settings saved`);
    setTimeout(() => setSaved(null), 2000);
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <h1 className="text-2xl font-bold bg-linear-to-r from-[#93c5fd] via-[#c4b5fd] to-[#fda4af] bg-clip-text text-transparent">
          Settings
        </h1>
        <p className="text-xs text-[#7c8db5] mt-1">Platform configuration and preferences</p>
      </motion.div>

      {/* Profile */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
        <Card className="bg-white/80 dark:bg-[#0d1c24]/85 border-[#39c5bb]/10 dark:border-[#00e6ff]/8 rounded-xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-linear-to-br from-[#00b4d8] to-[#a78bfa] dark:from-[#00e6ff] dark:to-[#a78bfa] flex items-center justify-center text-white text-sm font-bold shadow-sm shrink-0">
              {user?.email?.charAt(0).toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-[#3b4563] dark:text-[#d0f4ff] truncate">{user?.email || "user@nanonet.dev"}</h3>
              <p className="text-[10px] text-[#b0bdd5] dark:text-[#3a6070] mt-0.5">
                Since {user?.created_at ? new Date(user.created_at).toLocaleDateString("en-US") : "—"}
              </p>
            </div>
            <Badge className="text-[9px] bg-[#34d399]/10 text-[#059669] border border-[#34d399]/25 rounded-full shrink-0">
              Active
            </Badge>
          </div>
        </Card>
      </motion.div>

      {/* Notifications */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }}>
        <Card className="bg-white/80 dark:bg-[#0d1c24]/85 border-[#fda4af]/10 dark:border-[#fda4af]/8 rounded-xl p-5">
          <div className="flex items-center justify-between mb-1">
            <SectionHeader icon={Bell} label="Notifications" color="#fda4af" />
            <Button size="sm" variant="outline"
              onClick={() => handleSave("Notifications")}
              className={`h-7 px-3 text-[10px] rounded-lg border transition-all mb-4 ${saved === "Notifications" ? "border-[#34d399]/30 text-[#059669] bg-[#34d399]/8" : "border-[#fda4af]/20 text-[#7c8db5] hover:border-[#fda4af]/40"}`}>
              {saved === "Notifications" ? <><CheckCircle2 className="w-3 h-3 mr-1" />Saved</> : "Save"}
            </Button>
          </div>
          <Separator className="bg-[#e2e8f0]/50 dark:bg-[#1e3a4a]/60 mb-3" />
          <div className="space-y-1 divide-y divide-[#e2e8f0]/40 dark:divide-[#1e3a4a]/50">
            <SettingRow label="Critical Alerts" desc="Get notified on critical severity alerts" checked={notifs.crit} onChange={(v) => setNotifs(p => ({ ...p, crit: v }))} color="#fda4af" />
            <SettingRow label="Warning Alerts" desc="Get notified on warning severity alerts" checked={notifs.warn} onChange={(v) => setNotifs(p => ({ ...p, warn: v }))} color="#fbbf24" />
            <SettingRow label="Service Down" desc="Get notified when a service goes offline" checked={notifs.down} onChange={(v) => setNotifs(p => ({ ...p, down: v }))} color="#fb7185" />
            <SettingRow label="AI Insights" desc="Get notified when a new AI insight is ready" checked={notifs.ai} onChange={(v) => setNotifs(p => ({ ...p, ai: v }))} color="#c4b5fd" />
          </div>
        </Card>
      </motion.div>

      {/* Monitoring */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
        <Card className="bg-white/80 dark:bg-[#0d1c24]/85 border-[#39c5bb]/10 dark:border-[#00e6ff]/8 rounded-xl p-5">
          <div className="flex items-center justify-between mb-1">
            <SectionHeader icon={Zap} label="Monitoring" color="#39c5bb" />
            <Button size="sm" variant="outline"
              onClick={() => handleSave("Monitoring")}
              className={`h-7 px-3 text-[10px] rounded-lg border transition-all mb-4 ${saved === "Monitoring" ? "border-[#34d399]/30 text-[#059669] bg-[#34d399]/8" : "border-[#39c5bb]/20 text-[#7c8db5] hover:border-[#39c5bb]/40"}`}>
              {saved === "Monitoring" ? <><CheckCircle2 className="w-3 h-3 mr-1" />Saved</> : "Save"}
            </Button>
          </div>
          <Separator className="bg-[#e2e8f0]/50 dark:bg-[#1e3a4a]/60 mb-3" />
          <div className="space-y-4">
            <div className="grid gap-1.5">
              <Label className="text-xs font-medium text-[#3b4563] dark:text-[#d0f4ff]">Default Poll Interval (seconds)</Label>
              <div className="flex items-center gap-3">
                <Input type="number" min={5} max={300} value={monitoring.pollInterval}
                  onChange={(e) => setMonitoring(p => ({ ...p, pollInterval: parseInt(e.target.value) || 10 }))}
                  className="bg-[#f5f8ff] dark:bg-[#0f1e28] border-[#39c5bb]/20 dark:border-[#00e6ff]/12 text-[#3b4563] dark:text-[#d0f4ff] rounded-xl text-xs h-9 w-24" />
                <span className="text-[10px] text-[#b0bdd5] dark:text-[#3a6070]">Min 5s, Max 300s</span>
              </div>
            </div>
            <Separator className="bg-[#e2e8f0]/40 dark:bg-[#1e3a4a]/50" />
            <div className="space-y-1 divide-y divide-[#e2e8f0]/40 dark:divide-[#1e3a4a]/50">
              <SettingRow label="Auto-Recovery" desc="Automatically restart crashed services" checked={monitoring.autoRecovery} onChange={(v) => setMonitoring(p => ({ ...p, autoRecovery: v }))} />
              <SettingRow label="WebSocket Auto-Reconnect" desc="Reconnect automatically when connection drops" checked={monitoring.wsReconnect} onChange={(v) => setMonitoring(p => ({ ...p, wsReconnect: v }))} />
            </div>
          </div>
        </Card>
      </motion.div>

      {/* AI */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.25 }}>
        <Card className="bg-white/80 dark:bg-[#0d1c24]/85 border-[#c4b5fd]/10 dark:border-[#a78bfa]/8 rounded-xl p-5">
          <div className="flex items-center justify-between mb-1">
            <SectionHeader icon={Sparkles} label="AI Analysis" color="#c4b5fd" />
            <Button size="sm" variant="outline"
              onClick={() => handleSave("AI")}
              className={`h-7 px-3 text-[10px] rounded-lg border transition-all mb-4 ${saved === "AI" ? "border-[#34d399]/30 text-[#059669] bg-[#34d399]/8" : "border-[#c4b5fd]/20 text-[#7c8db5] hover:border-[#c4b5fd]/40"}`}>
              {saved === "AI" ? <><CheckCircle2 className="w-3 h-3 mr-1" />Saved</> : "Save"}
            </Button>
          </div>
          <Separator className="bg-[#e2e8f0]/50 dark:bg-[#1e3a4a]/60 mb-3" />
          <div className="space-y-4">
            <SettingRow label="Auto-Analyze on Critical Alert" desc="Run AI analysis automatically after a critical alert fires" checked={ai.autoAnalyze} onChange={(v) => setAi(p => ({ ...p, autoAnalyze: v }))} color="#c4b5fd" />
            <Separator className="bg-[#e2e8f0]/40 dark:bg-[#1e3a4a]/50" />
            <div className="grid gap-1.5">
              <Label className="text-xs font-medium text-[#3b4563] dark:text-[#d0f4ff]">Analysis Window (minutes)</Label>
              <div className="flex items-center gap-3">
                <Input type="number" min={5} max={120} value={ai.window}
                  onChange={(e) => setAi(p => ({ ...p, window: parseInt(e.target.value) || 30 }))}
                  className="bg-[#f5f8ff] dark:bg-[#0f1e28] border-[#c4b5fd]/20 dark:border-[#a78bfa]/12 text-[#3b4563] dark:text-[#d0f4ff] rounded-xl text-xs h-9 w-24" />
                <span className="text-[10px] text-[#b0bdd5] dark:text-[#3a6070]">Min 5m, Max 120m</span>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Appearance */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.3 }}>
        <Card className="bg-white/80 dark:bg-[#0d1c24]/85 border-[#93c5fd]/10 dark:border-[#00e6ff]/8 rounded-xl p-5">
          <div className="flex items-center justify-between mb-1">
            <SectionHeader icon={Palette} label="Appearance" color="#93c5fd" />
            <Button size="sm" variant="outline"
              onClick={() => handleSave("Appearance")}
              className={`h-7 px-3 text-[10px] rounded-lg border transition-all mb-4 ${saved === "Appearance" ? "border-[#34d399]/30 text-[#059669] bg-[#34d399]/8" : "border-[#93c5fd]/20 text-[#7c8db5] hover:border-[#93c5fd]/40"}`}>
              {saved === "Appearance" ? <><CheckCircle2 className="w-3 h-3 mr-1" />Saved</> : "Save"}
            </Button>
          </div>
          <Separator className="bg-[#e2e8f0]/50 dark:bg-[#1e3a4a]/60 mb-3" />
          <div className="space-y-4">
            <div className="space-y-1 divide-y divide-[#e2e8f0]/40 dark:divide-[#1e3a4a]/50">
              <SettingRow label="Dark Mode" desc="Switch to dark theme (deep ocean)" checked={appearance.darkMode} onChange={(v) => setAppearance(p => ({ ...p, darkMode: v }))} color="#00b4d8" />
              <SettingRow label="Matrix Background" desc="Show animated background effect" checked={appearance.matrix} onChange={(v) => setAppearance(p => ({ ...p, matrix: v }))} color="#a78bfa" />
              <SettingRow label="Radial Menu" desc="Show floating radial quick-action menu" checked={appearance.radial} onChange={(v) => setAppearance(p => ({ ...p, radial: v }))} color="#a78bfa" />
            </div>
            <Separator className="bg-[#e2e8f0]/40 dark:bg-[#1e3a4a]/50" />
            <div>
              <Label className="text-xs font-medium text-foreground mb-3 block">Theme Preview</Label>
              <div className="flex items-center gap-3">
                <div
                  className="relative w-12 h-9 rounded-xl border-2 border-[#00b4d8]/40 shadow-sm overflow-hidden cursor-pointer"
                  title="Light theme (active)"
                  onClick={() => setAppearance(p => ({ ...p, darkMode: false }))}
                >
                  <div className="absolute inset-0" style={{ background: "linear-gradient(110.25deg, #D0FAFF 11.11%, #FED7FF 115.41%)" }} />
                  {!appearance.darkMode && (
                    <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[#34d399] rounded-full border-2 border-white flex items-center justify-center">
                      <CheckCircle2 className="w-2 h-2 text-white" />
                    </div>
                  )}
                </div>
                <div
                  className="relative w-12 h-9 rounded-xl border-2 border-[#00e6ff]/30 shadow-sm overflow-hidden cursor-pointer"
                  title="Dark theme"
                  onClick={() => setAppearance(p => ({ ...p, darkMode: true }))}
                >
                  <div className="absolute inset-0" style={{ background: "linear-gradient(106.11deg, #071012 -2.75%, #324758 53.69%, #00E6FF 109.22%)" }} />
                  {appearance.darkMode && (
                    <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[#34d399] rounded-full border-2 border-white flex items-center justify-center">
                      <CheckCircle2 className="w-2 h-2 text-white" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* About */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.35 }}>
        <Card className="bg-white/80 border-[#39c5bb]/10 rounded-xl p-5">
          <SectionHeader icon={Info} label="About" color="#b0bdd5" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Platform", value: "NanoNet v2.0" },
              { label: "Theme", value: "CinnaMiku Pastel" },
              { label: "Stack", value: "React + Go + Rust" },
              { label: "Database", value: "TimescaleDB" },
            ].map(({ label, value }) => (
              <div key={label} className="p-3 bg-[#f5f8ff] rounded-xl">
                <span className="text-[10px] text-[#b0bdd5] uppercase tracking-wider">{label}</span>
                <p className="mt-1 text-xs text-[#3b4563] font-medium">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-[#e2e8f0]/50 flex items-center justify-center gap-1.5 text-[10px] text-[#b0bdd5]">
            <Heart className="w-3 h-3 text-[#fda4af]" />
            Built with love · NanoNet Monitoring Platform
          </div>
        </Card>
      </motion.div>
    </div>
  );
}

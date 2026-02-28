import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  Lock,
  Eye,
  EyeOff,
  ScrollText,
  Clock,
  Shield,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useThemeStore, type ThemeName, type ThemeMode } from "@/store/themeStore";
import { settingsApi, type UpdateSettingsRequest, type AuditLog } from "@/api/settings";
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
    { name: "cinnamiku", mode: "light", label: "CinnaMiku", sublabel: "Pastel Light", icon: Sun, preview: "linear-gradient(110deg, #D0FAFF 0%, #FED7FF 100%)" },
    { name: "cinnamiku", mode: "dark", label: "CinnaMiku", sublabel: "Deep Ocean", icon: Moon, preview: "linear-gradient(110deg, #071012 0%, #324758 60%, #00E6FF 100%)" },
    { name: "pro", mode: "light", label: "Pro", sublabel: "Clean Light", icon: Monitor, preview: "linear-gradient(110deg, #f8fafc 0%, #e0e7ff 100%)" },
    { name: "pro", mode: "dark", label: "Pro", sublabel: "Slate Dark", icon: Layers, preview: "linear-gradient(110deg, #0a0c10 0%, #1e2240 100%)" },
  ];

export function SettingsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { themeName, themeMode, setThemeName, setThemeMode } = useThemeStore();

  // Backend'den ayarları çek
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: () => settingsApi.get(),
  });

  // Local state — backend'den senkronize edilir
  const [notifs, setNotifs] = useState({ crit: true, warn: true, down: true, ai: false });
  const [monitoring, setMonitoring] = useState({ pollInterval: 10, autoRecovery: false });
  const [ai, setAi] = useState({ autoAnalyze: true, window: 30 });

  // Password change
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  // Audit logs
  const [showAuditLogs, setShowAuditLogs] = useState(false);
  const { data: auditData } = useQuery({
    queryKey: ["auditLogs"],
    queryFn: () => settingsApi.getAuditLogs(20, 0),
    enabled: showAuditLogs,
  });

  // Backend verileri geldiğinde local state'i güncelle
  useEffect(() => {
    if (settings) {
      setNotifs({
        crit: settings.notif_crit,
        warn: settings.notif_warn,
        down: settings.notif_down,
        ai: settings.notif_ai,
      });
      setMonitoring({
        pollInterval: settings.poll_interval_sec,
        autoRecovery: settings.auto_recovery,
      });
      setAi({
        autoAnalyze: settings.ai_auto_analyze,
        window: settings.ai_window_minutes,
      });
    }
  }, [settings]);

  // Backend'e kaydet mutation'ları
  const saveMutation = useMutation({
    mutationFn: (data: UpdateSettingsRequest) => settingsApi.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Ayarlar kaydedildi");
    },
    onError: () => {
      toast.error("Ayarlar kaydedilemedi");
    },
  });

  const passwordMutation = useMutation({
    mutationFn: () => settingsApi.changePassword(currentPassword, newPassword),
    onSuccess: () => {
      toast.success("Şifre başarıyla değiştirildi");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordSection(false);
    },
    onError: () => {
      toast.error("Şifre değiştirilemedi — mevcut şifrenizi kontrol edin");
    },
  });

  const handleSaveNotifs = () => {
    saveMutation.mutate({
      notif_crit: notifs.crit,
      notif_warn: notifs.warn,
      notif_down: notifs.down,
      notif_ai: notifs.ai,
    });
  };

  const handleSaveMonitoring = () => {
    saveMutation.mutate({
      poll_interval_sec: monitoring.pollInterval,
      auto_recovery: monitoring.autoRecovery,
    });
  };

  const handleSaveAI = () => {
    saveMutation.mutate({
      ai_auto_analyze: ai.autoAnalyze,
      ai_window_minutes: ai.window,
    });
  };

  const handleChangePassword = () => {
    if (!currentPassword || !newPassword) {
      toast.error("Tüm alanları doldurun");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Yeni şifre en az 8 karakter olmalı");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Şifreler eşleşmiyor");
      return;
    }
    passwordMutation.mutate();
  };

  const handleThemeSelect = (name: ThemeName, mode: ThemeMode) => {
    setThemeName(name);
    setThemeMode(mode);
  };

  const cardStyle = { background: "var(--surface-glass)", borderColor: "var(--border-subtle)" };
  const dividerStyle = { backgroundColor: "var(--border-divider)" };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <h1 className="text-2xl font-bold bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-heading)" }}>
          Ayarlar
        </h1>
        <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>Platform yapılandırması ve tercihler</p>
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
                Üyelik: {user?.created_at ? new Date(user.created_at).toLocaleDateString("tr-TR") : "—"}
              </p>
            </div>
            <Badge className="text-[9px] rounded-full shrink-0"
              style={{ background: "var(--status-up-subtle)", color: "var(--status-up-text)", borderColor: "var(--status-up-border)" }}>
              Aktif
            </Badge>
          </div>
        </Card>
      </motion.div>

      {/* Password Change */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.12 }}>
        <Card className="rounded-xl p-5 border" style={cardStyle}>
          <div className="flex items-center justify-between mb-1">
            <SectionHeader icon={Lock} label="Şifre Değiştir" />
            <Button size="sm" variant="outline"
              onClick={() => setShowPasswordSection(!showPasswordSection)}
              className="h-7 px-3 text-[10px] rounded-lg border transition-all mb-4"
              style={{ borderColor: "var(--color-teal-border)", color: "var(--text-muted)" }}>
              {showPasswordSection ? "Kapat" : "Değiştir"}
            </Button>
          </div>
          {showPasswordSection && (
            <>
              <Separator className="mb-3" style={dividerStyle} />
              <div className="space-y-3">
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Mevcut Şifre</Label>
                  <div className="relative">
                    <Input type={showCurrent ? "text" : "password"} value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="rounded-xl text-xs h-9 pr-9"
                      style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-secondary)" }} />
                    <button onClick={() => setShowCurrent(!showCurrent)} className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: "var(--text-faint)" }}>
                      {showCurrent ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Yeni Şifre</Label>
                  <div className="relative">
                    <Input type={showNew ? "text" : "password"} value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="rounded-xl text-xs h-9 pr-9"
                      style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-secondary)" }} />
                    <button onClick={() => setShowNew(!showNew)} className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: "var(--text-faint)" }}>
                      {showNew ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Yeni Şifre (Tekrar)</Label>
                  <Input type="password" value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="rounded-xl text-xs h-9"
                    style={{ background: "var(--input-bg)", borderColor: newPassword && confirmPassword && newPassword !== confirmPassword ? "var(--status-down)" : "var(--input-border)", color: "var(--text-secondary)" }} />
                  {newPassword && confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-[10px]" style={{ color: "var(--status-down-text)" }}>Şifreler eşleşmiyor</p>
                  )}
                </div>
                <Button size="sm" onClick={handleChangePassword} disabled={passwordMutation.isPending}
                  className="text-white rounded-xl text-xs" style={{ background: "var(--gradient-btn-primary)" }}>
                  {passwordMutation.isPending ? "Kaydediliyor..." : "Şifreyi Değiştir"}
                </Button>
              </div>
            </>
          )}
        </Card>
      </motion.div>

      {/* Notifications */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }}>
        <Card className="rounded-xl p-5 border" style={cardStyle}>
          <div className="flex items-center justify-between mb-1">
            <SectionHeader icon={Bell} label="Bildirimler" />
            <Button size="sm" variant="outline" onClick={handleSaveNotifs} disabled={saveMutation.isPending}
              className="h-7 px-3 text-[10px] rounded-lg border transition-all mb-4"
              style={{ borderColor: "var(--color-pink-border)", color: "var(--text-muted)" }}>
              {saveMutation.isPending ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </div>
          <Separator className="mb-3" style={dividerStyle} />
          <div className="space-y-1 divide-y" style={{ borderColor: "var(--border-divider)" }}>
            <SettingRow label="Kritik Uyarılar" desc="Kritik seviye uyarılarında bildirim al" checked={notifs.crit} onChange={(v) => setNotifs(p => ({ ...p, crit: v }))} />
            <SettingRow label="Uyarı Seviyesi" desc="Orta seviye uyarılarda bildirim al" checked={notifs.warn} onChange={(v) => setNotifs(p => ({ ...p, warn: v }))} />
            <SettingRow label="Servis Çökmesi" desc="Bir servis çevrimdışı olduğunda bildirim al" checked={notifs.down} onChange={(v) => setNotifs(p => ({ ...p, down: v }))} />
            <SettingRow label="AI Analiz Bildirimleri" desc="Yeni AI analiz sonucu hazır olduğunda bildirim al" checked={notifs.ai} onChange={(v) => setNotifs(p => ({ ...p, ai: v }))} />
          </div>
        </Card>
      </motion.div>

      {/* Monitoring */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
        <Card className="rounded-xl p-5 border" style={cardStyle}>
          <div className="flex items-center justify-between mb-1">
            <SectionHeader icon={Zap} label="İzleme" />
            <Button size="sm" variant="outline" onClick={handleSaveMonitoring} disabled={saveMutation.isPending}
              className="h-7 px-3 text-[10px] rounded-lg border transition-all mb-4"
              style={{ borderColor: "var(--color-teal-border)", color: "var(--text-muted)" }}>
              {saveMutation.isPending ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </div>
          <Separator className="mb-3" style={dividerStyle} />
          <div className="space-y-4">
            <div className="grid gap-1.5">
              <Label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Varsayılan Poll Interval (saniye)</Label>
              <div className="flex items-center gap-3">
                <Input type="number" min={5} max={300} value={monitoring.pollInterval}
                  onChange={(e) => setMonitoring(p => ({ ...p, pollInterval: parseInt(e.target.value) || 10 }))}
                  className="rounded-xl text-xs h-9 w-24"
                  style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-secondary)" }} />
                <span className="text-[10px]" style={{ color: "var(--text-faint)" }}>Min 5s, Maks 300s</span>
              </div>
            </div>
            <Separator style={dividerStyle} />
            <div className="space-y-1 divide-y" style={{ borderColor: "var(--border-divider)" }}>
              <SettingRow label="Otomatik Kurtarma" desc="Çöken servisleri otomatik yeniden başlat" checked={monitoring.autoRecovery} onChange={(v) => setMonitoring(p => ({ ...p, autoRecovery: v }))} />
            </div>
          </div>
        </Card>
      </motion.div>

      {/* AI */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.25 }}>
        <Card className="rounded-xl p-5 border" style={cardStyle}>
          <div className="flex items-center justify-between mb-1">
            <SectionHeader icon={Sparkles} label="AI Analiz" />
            <Button size="sm" variant="outline" onClick={handleSaveAI} disabled={saveMutation.isPending}
              className="h-7 px-3 text-[10px] rounded-lg border transition-all mb-4"
              style={{ borderColor: "var(--color-lavender-border)", color: "var(--text-muted)" }}>
              {saveMutation.isPending ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </div>
          <Separator className="mb-3" style={dividerStyle} />
          <div className="space-y-4">
            <SettingRow label="Kritik Uyarıda Otomatik Analiz" desc="Kritik uyarı sonrası otomatik AI analizi çalıştır" checked={ai.autoAnalyze} onChange={(v) => setAi(p => ({ ...p, autoAnalyze: v }))} />
            <Separator style={dividerStyle} />
            <div className="grid gap-1.5">
              <Label className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Analiz Penceresi (dakika)</Label>
              <div className="flex items-center gap-3">
                <Input type="number" min={5} max={120} value={ai.window}
                  onChange={(e) => setAi(p => ({ ...p, window: parseInt(e.target.value) || 30 }))}
                  className="rounded-xl text-xs h-9 w-24"
                  style={{ background: "var(--input-bg)", borderColor: "var(--input-border)", color: "var(--text-secondary)" }} />
                <span className="text-[10px]" style={{ color: "var(--text-faint)" }}>Min 5dk, Maks 120dk</span>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Appearance */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.3 }}>
        <Card className="rounded-xl p-5 border" style={cardStyle}>
          <SectionHeader icon={Palette} label="Görünüm" />
          <Separator className="mb-4" style={dividerStyle} />

          <div className="mb-5">
            <Label className="text-xs font-medium mb-3 block" style={{ color: "var(--text-secondary)" }}>Tema</Label>
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
                    aria-label={`${opt.label} ${opt.sublabel} teması`}
                  >
                    <div className="h-10 w-full" style={{ background: opt.preview }} />
                    <div className="px-2 py-1.5" style={{ background: "var(--surface-sunken)" }}>
                      <div className="flex items-center gap-1">
                        <IconComp className="w-3 h-3" style={{ color: "var(--brand-primary)" }} />
                        <span className="text-[10px] font-semibold" style={{ color: "var(--text-secondary)" }}>{opt.label}</span>
                      </div>
                      <p className="text-[9px] mt-0.5" style={{ color: "var(--text-faint)" }}>{opt.sublabel}</p>
                    </div>
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
        </Card>
      </motion.div>

      {/* Audit Logs */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.35 }}>
        <Card className="rounded-xl p-5 border" style={cardStyle}>
          <div className="flex items-center justify-between mb-1">
            <SectionHeader icon={ScrollText} label="İşlem Geçmişi" />
            <Button size="sm" variant="outline"
              onClick={() => setShowAuditLogs(!showAuditLogs)}
              className="h-7 px-3 text-[10px] rounded-lg border transition-all mb-4"
              style={{ borderColor: "var(--color-blue-border)", color: "var(--text-muted)" }}>
              {showAuditLogs ? "Gizle" : "Göster"}
            </Button>
          </div>
          {showAuditLogs && (
            <>
              <Separator className="mb-3" style={dividerStyle} />
              {auditData?.logs && auditData.logs.length > 0 ? (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {auditData.logs.map((log: AuditLog) => (
                    <div key={log.id} className="flex items-start gap-3 p-2.5 rounded-lg" style={{ background: "var(--surface-sunken)" }}>
                      <Shield className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "var(--color-blue)" }} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                          {log.action} — <span className="font-(--font-mono)" style={{ color: "var(--text-muted)" }}>{log.resource_type}</span>
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-[10px]" style={{ color: "var(--text-faint)" }}>
                          <Clock className="w-2.5 h-2.5" />
                          {new Date(log.created_at).toLocaleString("tr-TR")}
                          {log.ip_address && <span>· {log.ip_address}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-center py-6" style={{ color: "var(--text-muted)" }}>
                  Henüz işlem geçmişi bulunmuyor
                </p>
              )}
            </>
          )}
        </Card>
      </motion.div>

      {/* About */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.4 }}>
        <Card className="rounded-xl p-5 border" style={cardStyle}>
          <SectionHeader icon={Info} label="Hakkında" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Platform", value: "NanoNet v2.0" },
              { label: "Tema", value: themeName === "cinnamiku" ? "CinnaMiku" : "Pro" },
              { label: "Stack", value: "React + Go + Rust" },
              { label: "Veritabanı", value: "TimescaleDB" },
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
            NanoNet İzleme Platformu
          </div>
        </Card>
      </motion.div>
    </div>
  );
}

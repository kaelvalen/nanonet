import { motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Settings,
  Bell,
  Shield,
  Palette,
  Globe,
  Database,
  Zap,
  Heart,
  Info,
  ExternalLink,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";

export function SettingsPage() {
  const { user } = useAuthStore();

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <h1 className="text-2xl font-bold bg-linear-to-r from-[#93c5fd] via-[#c4b5fd] to-[#fda4af] bg-clip-text text-transparent">
          Settings
        </h1>
        <p className="text-xs text-[#7c8db5] mt-1">Platform configuration and preferences</p>
      </motion.div>

      {/* Profile Section */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}>
        <Card className="bg-white/80 border-[#39c5bb]/10 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#39c5bb] to-[#93c5fd] flex items-center justify-center text-white text-sm font-bold">
              {user?.email?.charAt(0).toUpperCase() || "U"}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#3b4563]">{user?.email || "user@nanonet.dev"}</h3>
              <p className="text-[10px] text-[#b0bdd5]">
                Kayıt: {user?.created_at ? new Date(user.created_at).toLocaleDateString("tr-TR") : "—"}
              </p>
            </div>
            <Badge className="ml-auto text-[9px] bg-[#39c5bb]/10 text-[#2da89e] border border-[#39c5bb]/20 rounded-full">
              Active
            </Badge>
          </div>
        </Card>
      </motion.div>

      {/* Notification Settings */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }}>
        <Card className="bg-white/80 border-[#39c5bb]/10 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#fda4af]" />
            <h3 className="text-sm font-semibold text-[#3b4563]">Bildirimler</h3>
          </div>
          <Separator className="bg-[#e2e8f0]/50" />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs text-[#3b4563]">Critical Alert Bildirimleri</Label>
                <p className="text-[10px] text-[#b0bdd5] mt-0.5">Kritik seviye alertlerde bildirim al</p>
              </div>
              <Switch defaultChecked className="data-[state=checked]:bg-[#39c5bb]" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs text-[#3b4563]">Warning Alert Bildirimleri</Label>
                <p className="text-[10px] text-[#b0bdd5] mt-0.5">Uyarı seviyesi alertlerde bildirim al</p>
              </div>
              <Switch defaultChecked className="data-[state=checked]:bg-[#39c5bb]" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs text-[#3b4563]">Service Down Bildirimleri</Label>
                <p className="text-[10px] text-[#b0bdd5] mt-0.5">Servis çöktüğünde bildirim al</p>
              </div>
              <Switch defaultChecked className="data-[state=checked]:bg-[#39c5bb]" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs text-[#3b4563]">AI İç Görü Bildirimleri</Label>
                <p className="text-[10px] text-[#b0bdd5] mt-0.5">AI yeni bir insight ürettiğinde bildirim al</p>
              </div>
              <Switch className="data-[state=checked]:bg-[#39c5bb]" />
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Monitoring Settings */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}>
        <Card className="bg-white/80 border-[#39c5bb]/10 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#39c5bb]" />
            <h3 className="text-sm font-semibold text-[#3b4563]">Monitoring</h3>
          </div>
          <Separator className="bg-[#e2e8f0]/50" />

          <div className="space-y-4">
            <div className="grid gap-2">
              <Label className="text-xs text-[#3b4563]">Varsayılan Poll Interval (saniye)</Label>
              <Input
                type="number"
                defaultValue={10}
                className="bg-[#f5f8ff] border-[#39c5bb]/15 text-[#3b4563] rounded-xl text-xs h-9 w-32"
              />
              <p className="text-[10px] text-[#b0bdd5]">Yeni servislerin varsayılan kontrol aralığı</p>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs text-[#3b4563]">Auto-Recovery</Label>
                <p className="text-[10px] text-[#b0bdd5] mt-0.5">Çöken servisleri otomatik yeniden başlat</p>
              </div>
              <Switch className="data-[state=checked]:bg-[#39c5bb]" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs text-[#3b4563]">WebSocket Reconnect</Label>
                <p className="text-[10px] text-[#b0bdd5] mt-0.5">Bağlantı kesildiğinde otomatik yeniden bağlan</p>
              </div>
              <Switch defaultChecked className="data-[state=checked]:bg-[#39c5bb]" />
            </div>
          </div>
        </Card>
      </motion.div>

      {/* AI Settings */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.25 }}>
        <Card className="bg-white/80 border-[#c4b5fd]/10 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#c4b5fd]" />
            <h3 className="text-sm font-semibold text-[#3b4563]">AI Analiz</h3>
          </div>
          <Separator className="bg-[#e2e8f0]/50" />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs text-[#3b4563]">Otomatik AI Analiz</Label>
                <p className="text-[10px] text-[#b0bdd5] mt-0.5">Critical alert sonrası otomatik analiz çalıştır</p>
              </div>
              <Switch defaultChecked className="data-[state=checked]:bg-[#c4b5fd]" />
            </div>
            <div className="grid gap-2">
              <Label className="text-xs text-[#3b4563]">Analiz Window (dakika)</Label>
              <Input
                type="number"
                defaultValue={30}
                className="bg-[#f5f8ff] border-[#c4b5fd]/15 text-[#3b4563] rounded-xl text-xs h-9 w-32"
              />
              <p className="text-[10px] text-[#b0bdd5]">AI'ın analiz edeceği varsayılan zaman penceresi</p>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Appearance */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.3 }}>
        <Card className="bg-white/80 border-[#93c5fd]/10 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-[#93c5fd]" />
            <h3 className="text-sm font-semibold text-[#3b4563]">Görünüm</h3>
          </div>
          <Separator className="bg-[#e2e8f0]/50" />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs text-[#3b4563]">Matrix Background</Label>
                <p className="text-[10px] text-[#b0bdd5] mt-0.5">Animasyonlu arka plan efektini göster</p>
              </div>
              <Switch defaultChecked className="data-[state=checked]:bg-[#93c5fd]" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs text-[#3b4563]">Radial Menu</Label>
                <p className="text-[10px] text-[#b0bdd5] mt-0.5">Sol alt köşede radial menüyü göster</p>
              </div>
              <Switch defaultChecked className="data-[state=checked]:bg-[#93c5fd]" />
            </div>
            <div>
              <Label className="text-xs text-[#3b4563] mb-2 block">Theme</Label>
              <div className="flex items-center gap-2">
                <button className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#39c5bb] to-[#93c5fd] border-2 border-[#39c5bb] ring-2 ring-[#39c5bb]/20" title="CinnaMiku (default)" />
                <button className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] border-2 border-transparent opacity-40 cursor-not-allowed" title="Coming soon" />
                <button className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1e293b] to-[#334155] border-2 border-transparent opacity-40 cursor-not-allowed" title="Coming soon" />
                <span className="text-[10px] text-[#b0bdd5] ml-2">Yakında daha fazla tema</span>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* About */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.35 }}>
        <Card className="bg-white/80 border-[#39c5bb]/10 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Info className="w-4 h-4 text-[#b0bdd5]" />
            <h3 className="text-sm font-semibold text-[#3b4563]">Hakkında</h3>
          </div>
          <div className="grid grid-cols-2 gap-4 text-xs text-[#7c8db5]">
            <div>
              <span className="text-[10px] text-[#b0bdd5] uppercase tracking-wider">Platform</span>
              <p className="mt-0.5 text-[#3b4563] font-medium">NanoNet v2.0</p>
            </div>
            <div>
              <span className="text-[10px] text-[#b0bdd5] uppercase tracking-wider">Theme</span>
              <p className="mt-0.5 text-[#3b4563] font-medium">CinnaMiku Pastel</p>
            </div>
            <div>
              <span className="text-[10px] text-[#b0bdd5] uppercase tracking-wider">Stack</span>
              <p className="mt-0.5 text-[#3b4563] font-medium">React + Go + Rust</p>
            </div>
            <div>
              <span className="text-[10px] text-[#b0bdd5] uppercase tracking-wider">Database</span>
              <p className="mt-0.5 text-[#3b4563] font-medium">TimescaleDB</p>
            </div>
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

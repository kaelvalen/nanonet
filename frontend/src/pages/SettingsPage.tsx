import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	AlertTriangle,
	Bell,
	Check,
	CheckCircle2,
	ChevronDown,
	ChevronUp,
	Clock,
	Copy,
	Eye,
	EyeOff,
	Filter,
	Heart,
	Info,
	Key,
	Layers,
	Loader2,
	Lock,
	Monitor,
	Palette,
	RefreshCw,
	Save,
	ScrollText,
	Search,
	Send,
	Shield,
	Sparkles,
	Webhook,
	X,
	Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
	type AuditLog,
	settingsApi,
	type UpdateSettingsRequest,
} from "@/api/settings";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useA11yStore } from "@/store/a11yStore";
import { useAuthStore } from "@/store/authStore";
import {
	type ThemeMode,
	type ThemeName,
	useThemeStore,
} from "@/store/themeStore";

function SectionHeader({
	icon: Icon,
	label,
}: {
	icon: React.ElementType;
	label: string;
}) {
	return (
		<div className="flex items-center gap-3 mb-4">
			<div
				className="w-9 h-9 rounded-[6px] flex items-center justify-center"
				style={{
					background: "var(--surface-sunken)",
					border: "1px solid var(--border-subtle)",
				}}
			>
				<Icon className="w-4 h-4" style={{ color: "var(--brand-primary)" }} />
			</div>
			<h3
				className="text-[14px] font-semibold"
				style={{ color: "var(--text-primary)" }}
			>
				{label}
			</h3>
		</div>
	);
}

function SettingRow({
	label,
	desc,
	checked,
	onChange,
}: {
	label: string;
	desc: string;
	checked: boolean;
	onChange: (v: boolean) => void;
}) {
	return (
		<div className="flex items-center justify-between py-3">
			<div className="flex-1 pr-4">
				<p
					className="text-[13px] font-medium"
					style={{ color: "var(--text-primary)" }}
				>
					{label}
				</p>
				<p
					className="text-[12px] mt-1 leading-relaxed"
					style={{ color: "var(--text-tertiary)" }}
				>
					{desc}
				</p>
			</div>
			<Switch
				checked={checked}
				onCheckedChange={onChange}
				className="shrink-0"
			/>
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
	const queryClient = useQueryClient();
	const { i18n } = useTranslation();
	const { user } = useAuthStore();
	const { themeName, themeMode, setThemeName, setThemeMode } = useThemeStore();
	const language = useA11yStore((s) => s.preferences.language);
	const setStoredLanguage = useA11yStore((s) => s.setLanguage);

	const handleLanguageSelect = (lang: "tr" | "en") => {
		i18n.changeLanguage(lang);
		setStoredLanguage(lang);
	};

	// Backend'den ayarları çek
	const { data: settings } = useQuery({
		queryKey: ["settings"],
		queryFn: () => settingsApi.get(),
	});

	// Local state — backend'den senkronize edilir
	const [notifs, setNotifs] = useState({
		crit: true,
		warn: true,
		down: true,
		ai: false,
	});
	const [notifsDirty, setNotifsDirty] = useState(false);
	const [monitoring, setMonitoring] = useState({
		pollInterval: 10,
		autoRecovery: false,
		logRetentionDays: 30,
	});
	const [monitoringDirty, setMonitoringDirty] = useState(false);
	const [ai, setAi] = useState({
		autoAnalyze: true,
		window: 30,
		monthlyBudgetUSD: 0,
	});
	const [aiDirty, setAiDirty] = useState(false);

	// Password change
	const [showPasswordSection, setShowPasswordSection] = useState(false);
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [showCurrent, setShowCurrent] = useState(false);
	const [showNew, setShowNew] = useState(false);

	// Webhook channels
	const [webhookUrl, setWebhookUrl] = useState("");
	const [webhookSecret, setWebhookSecret] = useState("");
	const [slackWebhookUrl, setSlackWebhookUrl] = useState("");
	const [showWebhookSecret, setShowWebhookSecret] = useState(false);
	const [webhookDirty, setWebhookDirty] = useState(false);

	// Audit logs
	const [showAuditLogs, setShowAuditLogs] = useState(false);
	const [auditSearch, setAuditSearch] = useState("");
	const [auditPage, setAuditPage] = useState(0);
	const AUDIT_PAGE_SIZE = 20;
	const { data: auditData, refetch: refetchAudit } = useQuery({
		queryKey: ["auditLogs", auditPage],
		queryFn: () =>
			settingsApi.getAuditLogs(AUDIT_PAGE_SIZE, auditPage * AUDIT_PAGE_SIZE),
		enabled: showAuditLogs,
	});

	// API Key display
	const [showApiKey, setShowApiKey] = useState(false);
	const [apiKeyCopied, setApiKeyCopied] = useState(false);
	const apiKey = `nanonet_${user?.id?.replace(/-/g, "").slice(0, 24) ?? "••••••••••••••••••••••••"}`;

	const handleCopyApiKey = () => {
		navigator.clipboard.writeText(apiKey).then(() => {
			setApiKeyCopied(true);
			toast.success("API anahtarı panoya kopyalandı");
			setTimeout(() => setApiKeyCopied(false), 2000);
		});
	};

	// Danger zone
	const [dangerAsking, setDangerAsking] = useState(false);

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
				logRetentionDays: settings.log_retention_days ?? 30,
			});
			setAi({
				autoAnalyze: settings.ai_auto_analyze,
				window: settings.ai_window_minutes,
				monthlyBudgetUSD: settings.ai_monthly_budget_usd ?? 0,
			});
			setWebhookUrl(settings.webhook_url ?? "");
			setWebhookSecret(settings.webhook_secret ?? "");
			setSlackWebhookUrl(settings.slack_webhook_url ?? "");
			setNotifsDirty(false);
			setMonitoringDirty(false);
			setAiDirty(false);
			setWebhookDirty(false);
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

	const handleSaveAll = () => {
		const payload: UpdateSettingsRequest = {};
		if (notifsDirty) {
			payload.notif_crit = notifs.crit;
			payload.notif_warn = notifs.warn;
			payload.notif_down = notifs.down;
			payload.notif_ai = notifs.ai;
		}
		if (monitoringDirty) {
			payload.poll_interval_sec = monitoring.pollInterval;
			payload.auto_recovery = monitoring.autoRecovery;
			payload.log_retention_days = monitoring.logRetentionDays;
		}
		if (aiDirty) {
			payload.ai_auto_analyze = ai.autoAnalyze;
			payload.ai_window_minutes = ai.window;
			payload.ai_monthly_budget_usd =
				ai.monthlyBudgetUSD > 0 ? ai.monthlyBudgetUSD : null;
		}
		if (webhookDirty) {
			payload.webhook_url = webhookUrl || null;
			payload.webhook_secret = webhookSecret || null;
			payload.slack_webhook_url = slackWebhookUrl || null;
		}
		saveMutation.mutate(payload);
	};

	const anyDirty = notifsDirty || monitoringDirty || aiDirty || webhookDirty;

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

	const filteredAuditLogs = (auditData?.logs ?? []).filter((log) => {
		if (!auditSearch) return true;
		const q = auditSearch.toLowerCase();
		return (
			log.action.toLowerCase().includes(q) ||
			log.resource_type.toLowerCase().includes(q) ||
			(log.ip_address ?? "").toLowerCase().includes(q)
		);
	});

	const handleThemeSelect = (name: ThemeName, mode: ThemeMode) => {
		setThemeName(name);
		setThemeMode(mode);
	};

	const cardStyle = {
		background: "var(--surface-base)",
		border: "1px solid var(--border-subtle)",
	};
	const dividerStyle = { backgroundColor: "var(--border-subtle)" };

	return (
		<PageShell width="default" fill={false}>
			<PageHeader
				eyebrow="Hesap"
				title="Ayarlar"
				description="Platform yapılandırması ve tercihler."
				actions={
					anyDirty ? (
						<Button onClick={handleSaveAll} disabled={saveMutation.isPending}>
							{saveMutation.isPending ? (
								<>
									<Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
									Kaydediliyor...
								</>
							) : (
								<>
									<Save className="w-4 h-4 mr-1.5" />
									Değişiklikleri kaydet
								</>
							)}
						</Button>
					) : null
				}
			/>

			{/* Profile */}
			<Card className="rounded-[6px] p-5" style={cardStyle}>
				<div className="flex items-center gap-4">
					<div
						className="w-11 h-11 rounded-[6px] flex items-center justify-center text-[15px] font-semibold shrink-0"
						style={{
							background: "var(--brand-primary-subtle)",
							color: "var(--brand-primary)",
						}}
					>
						{user?.email?.charAt(0).toUpperCase() || "U"}
					</div>
					<div className="flex-1 min-w-0">
						<h3
							className="text-[14px] font-semibold truncate"
							style={{ color: "var(--text-primary)" }}
						>
							{user?.email || "user@nanonet.dev"}
						</h3>
						<p
							className="text-[12px] mt-1 tnum"
							style={{ color: "var(--text-tertiary)" }}
						>
							Üyelik:{" "}
							{user?.created_at
								? new Date(user.created_at).toLocaleDateString("tr-TR")
								: "—"}
						</p>
					</div>
					<Badge
						className="text-[10px] uppercase tracking-wider rounded-[4px] shrink-0"
						style={{
							background: "var(--status-up-subtle)",
							color: "var(--status-up-text)",
						}}
					>
						Aktif
					</Badge>
				</div>
			</Card>

			{/* Password Change */}
			<Card className="rounded-[6px] p-5" style={cardStyle}>
				<div className="flex items-center justify-between mb-1">
					<SectionHeader icon={Lock} label="Şifre değiştir" />
					<Button
						size="sm"
						variant="outline"
						onClick={() => setShowPasswordSection(!showPasswordSection)}
						className="mb-4"
					>
						{showPasswordSection ? "Kapat" : "Değiştir"}
					</Button>
				</div>
				{showPasswordSection && (
					<>
						<Separator className="mb-3" style={dividerStyle} />
						<div className="space-y-3">
							<div className="grid gap-1.5">
								<Label
									className="text-[11px] font-medium uppercase tracking-wider"
									style={{ color: "var(--text-faint)" }}
								>
									Mevcut şifre
								</Label>
								<div className="relative">
									<Input
										type={showCurrent ? "text" : "password"}
										value={currentPassword}
										onChange={(e) => setCurrentPassword(e.target.value)}
										className="text-[13px] h-9 pr-9"
									/>
									<button
										type="button"
										onClick={() => setShowCurrent(!showCurrent)}
										className="absolute right-2 top-1/2 -translate-y-1/2"
										style={{ color: "var(--text-tertiary)" }}
										aria-label={
											showCurrent ? "Şifreyi gizle" : "Şifreyi göster"
										}
									>
										{showCurrent ? (
											<EyeOff className="w-3.5 h-3.5" />
										) : (
											<Eye className="w-3.5 h-3.5" />
										)}
									</button>
								</div>
							</div>
							<div className="grid gap-1.5">
								<Label
									className="text-[11px] font-medium uppercase tracking-wider"
									style={{ color: "var(--text-faint)" }}
								>
									Yeni şifre
								</Label>
								<div className="relative">
									<Input
										type={showNew ? "text" : "password"}
										value={newPassword}
										onChange={(e) => setNewPassword(e.target.value)}
										className="text-[13px] h-9 pr-9"
									/>
									<button
										type="button"
										onClick={() => setShowNew(!showNew)}
										className="absolute right-2 top-1/2 -translate-y-1/2"
										style={{ color: "var(--text-tertiary)" }}
										aria-label={showNew ? "Şifreyi gizle" : "Şifreyi göster"}
									>
										{showNew ? (
											<EyeOff className="w-3.5 h-3.5" />
										) : (
											<Eye className="w-3.5 h-3.5" />
										)}
									</button>
								</div>
							</div>
							<div className="grid gap-1.5">
								<Label
									className="text-[11px] font-medium uppercase tracking-wider"
									style={{ color: "var(--text-faint)" }}
								>
									Yeni şifre (tekrar)
								</Label>
								<Input
									type="password"
									value={confirmPassword}
									onChange={(e) => setConfirmPassword(e.target.value)}
									className="text-[13px] h-9"
									style={{
										borderColor:
											newPassword &&
											confirmPassword &&
											newPassword !== confirmPassword
												? "var(--status-down)"
												: undefined,
									}}
								/>
								{newPassword &&
									confirmPassword &&
									newPassword !== confirmPassword && (
										<p
											className="text-[11px]"
											style={{ color: "var(--status-down-text)" }}
										>
											Şifreler eşleşmiyor
										</p>
									)}
							</div>
							<Button
								onClick={handleChangePassword}
								disabled={passwordMutation.isPending}
							>
								{passwordMutation.isPending
									? "Kaydediliyor..."
									: "Şifreyi değiştir"}
							</Button>
						</div>
					</>
				)}
			</Card>

			{/* Notifications */}
			<Card className="rounded-[6px] p-5" style={cardStyle}>
				<div className="flex items-center justify-between mb-1">
					<SectionHeader icon={Bell} label="Bildirimler" />
					{notifsDirty && (
						<span
							className="text-[10px] px-1.5 py-0.5 rounded-[4px] uppercase tracking-wider mb-4"
							style={{
								background: "var(--status-degraded-subtle)",
								color: "var(--status-degraded-text)",
							}}
						>
							Kaydedilmemiş değişiklik
						</span>
					)}
				</div>
				<Separator className="mb-3" style={dividerStyle} />
				<div
					className="space-y-1 divide-y"
					style={{ borderColor: "var(--border-subtle)" }}
				>
					<SettingRow
						label="Kritik uyarılar"
						desc="Kritik seviye uyarılarında bildirim al."
						checked={notifs.crit}
						onChange={(v) => {
							setNotifs((p) => ({ ...p, crit: v }));
							setNotifsDirty(true);
						}}
					/>
					<SettingRow
						label="Uyarı seviyesi"
						desc="Orta seviye uyarılarda bildirim al."
						checked={notifs.warn}
						onChange={(v) => {
							setNotifs((p) => ({ ...p, warn: v }));
							setNotifsDirty(true);
						}}
					/>
					<SettingRow
						label="Servis çökmesi"
						desc="Bir servis çevrimdışı olduğunda bildirim al."
						checked={notifs.down}
						onChange={(v) => {
							setNotifs((p) => ({ ...p, down: v }));
							setNotifsDirty(true);
						}}
					/>
					<SettingRow
						label="AI analiz bildirimleri"
						desc="Yeni AI analiz sonucu hazır olduğunda bildirim al."
						checked={notifs.ai}
						onChange={(v) => {
							setNotifs((p) => ({ ...p, ai: v }));
							setNotifsDirty(true);
						}}
					/>
				</div>
			</Card>

			{/* Monitoring */}
			<Card className="rounded-[6px] p-5" style={cardStyle}>
				<div className="flex items-center justify-between mb-1">
					<SectionHeader icon={Zap} label="İzleme" />
					{monitoringDirty && (
						<span
							className="text-[10px] px-1.5 py-0.5 rounded-[4px] uppercase tracking-wider mb-4"
							style={{
								background: "var(--status-degraded-subtle)",
								color: "var(--status-degraded-text)",
							}}
						>
							Kaydedilmemiş değişiklik
						</span>
					)}
				</div>
				<Separator className="mb-3" style={dividerStyle} />
				<div className="space-y-4">
					<div className="grid gap-1.5">
						<Label
							className="text-[11px] font-medium uppercase tracking-wider"
							style={{ color: "var(--text-faint)" }}
						>
							Varsayılan poll interval (saniye)
						</Label>
						<div className="flex items-center gap-3">
							<Input
								type="number"
								min={5}
								max={300}
								value={monitoring.pollInterval}
								onChange={(e) => {
									setMonitoring((p) => ({
										...p,
										pollInterval: parseInt(e.target.value, 10) || 10,
									}));
									setMonitoringDirty(true);
								}}
								className="text-[13px] h-9 w-24 font-mono tnum"
							/>
							<span
								className="text-[11px] font-mono tnum"
								style={{ color: "var(--text-tertiary)" }}
							>
								Min 5s, maks 300s
							</span>
						</div>
					</div>
					<Separator style={dividerStyle} />
					<div className="grid gap-1.5">
						<Label
							className="text-[11px] font-medium uppercase tracking-wider"
							style={{ color: "var(--text-faint)" }}
						>
							Log saklama süresi (gün)
						</Label>
						<div className="flex items-center gap-3">
							<Input
								type="number"
								min={1}
								max={365}
								value={monitoring.logRetentionDays}
								onChange={(e) => {
									setMonitoring((p) => ({
										...p,
										logRetentionDays: parseInt(e.target.value, 10) || 30,
									}));
									setMonitoringDirty(true);
								}}
								className="text-[13px] h-9 w-24 font-mono tnum"
							/>
							<span
								className="text-[11px]"
								style={{ color: "var(--text-tertiary)" }}
							>
								Min 1, maks 365 — eski loglar otomatik silinir.
							</span>
						</div>
					</div>
					<Separator style={dividerStyle} />
					<div
						className="space-y-1 divide-y"
						style={{ borderColor: "var(--border-subtle)" }}
					>
						<SettingRow
							label="Otomatik kurtarma"
							desc="Çöken servisleri otomatik yeniden başlat."
							checked={monitoring.autoRecovery}
							onChange={(v) => {
								setMonitoring((p) => ({ ...p, autoRecovery: v }));
								setMonitoringDirty(true);
							}}
						/>
					</div>
				</div>
			</Card>

			{/* AI */}
			<Card className="rounded-[6px] p-5" style={cardStyle}>
				<div className="flex items-center justify-between mb-1">
					<SectionHeader icon={Sparkles} label="AI analiz" />
					{aiDirty && (
						<span
							className="text-[10px] px-1.5 py-0.5 rounded-[4px] uppercase tracking-wider mb-4"
							style={{
								background: "var(--status-degraded-subtle)",
								color: "var(--status-degraded-text)",
							}}
						>
							Kaydedilmemiş değişiklik
						</span>
					)}
				</div>
				<Separator className="mb-3" style={dividerStyle} />
				<div className="space-y-4">
					<SettingRow
						label="Kritik uyarıda otomatik analiz"
						desc="Kritik uyarı sonrası otomatik AI analizi çalıştır."
						checked={ai.autoAnalyze}
						onChange={(v) => {
							setAi((p) => ({ ...p, autoAnalyze: v }));
							setAiDirty(true);
						}}
					/>
					<Separator style={dividerStyle} />
					<div className="grid gap-1.5">
						<Label
							className="text-[11px] font-medium uppercase tracking-wider"
							style={{ color: "var(--text-faint)" }}
						>
							Analiz penceresi (dakika)
						</Label>
						<div className="flex items-center gap-3">
							<Input
								type="number"
								min={5}
								max={120}
								value={ai.window}
								onChange={(e) => {
									setAi((p) => ({
										...p,
										window: parseInt(e.target.value, 10) || 30,
									}));
									setAiDirty(true);
								}}
								className="text-[13px] h-9 w-24 font-mono tnum"
							/>
							<span
								className="text-[11px] font-mono tnum"
								style={{ color: "var(--text-tertiary)" }}
							>
								Min 5, maks 120
							</span>
						</div>
					</div>
					<Separator style={dividerStyle} />
					<div className="grid gap-1.5">
						<Label
							className="text-[11px] font-medium uppercase tracking-wider"
							style={{ color: "var(--text-faint)" }}
						>
							Aylık bütçe (USD)
						</Label>
						<div className="flex items-center gap-3">
							<Input
								type="number"
								min={0}
								max={10000}
								step={1}
								value={ai.monthlyBudgetUSD}
								onChange={(e) => {
									setAi((p) => ({
										...p,
										monthlyBudgetUSD: parseFloat(e.target.value) || 0,
									}));
									setAiDirty(true);
								}}
								className="text-[13px] h-9 w-24 font-mono tnum"
							/>
							<span
								className="text-[11px]"
								style={{ color: "var(--text-tertiary)" }}
							>
								0 = limitsiz · spend bu değere ulaşırsa AI çağrıları reddedilir.
							</span>
						</div>
					</div>
				</div>
			</Card>

			{/* Appearance */}
			<Card className="rounded-[6px] p-5" style={cardStyle}>
				<SectionHeader icon={Palette} label="Görünüm" />
				<Separator className="mb-4" style={dividerStyle} />

				{/* Language picker — kept inline rather than via LanguageSwitcher so
				    the row matches the surrounding card density and tokens. Updates
				    both i18next runtime and the a11y store so persistence sticks. */}
				<div className="mb-6">
					<Label
						className="text-[11px] font-medium uppercase tracking-wider mb-3 block"
						style={{ color: "var(--text-faint)" }}
					>
						Dil
					</Label>
					<div
						className="inline-flex items-center rounded-[6px] p-1"
						role="radiogroup"
						aria-label="Dil seçimi"
						style={{
							background: "var(--surface-sunken)",
							border: "1px solid var(--border-subtle)",
						}}
					>
						{(
							[
								{ value: "tr", label: "Türkçe" },
								{ value: "en", label: "English" },
							] as const
						).map((opt) => {
							const active = language === opt.value;
							return (
								// biome-ignore lint/a11y/useSemanticElements: segmented control inside explicit radiogroup
								<button
									type="button"
									key={opt.value}
									onClick={() => handleLanguageSelect(opt.value)}
									role="radio"
									aria-checked={active}
									className="h-7 px-3 rounded-[4px] text-[12px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
									style={{
										background: active ? "var(--surface-base)" : "transparent",
										color: active
											? "var(--text-primary)"
											: "var(--text-tertiary)",
										boxShadow: active
											? "0 0 0 1px var(--border-default)"
											: "none",
									}}
								>
									{opt.label}
								</button>
							);
						})}
					</div>
					<p
						className="text-[11px] mt-2 leading-relaxed"
						style={{ color: "var(--text-tertiary)" }}
					>
						Arayüz dilini değiştirir. Tarayıcı tercihinizi değil, bu hesabın
						tercihini saklar.
					</p>
				</div>

				<div className="mb-5">
					<Label
						className="text-[11px] font-medium uppercase tracking-wider mb-3 block"
						style={{ color: "var(--text-faint)" }}
					>
						Tema
					</Label>
					<div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
						{THEME_OPTIONS.map((opt) => {
							const isActive = themeName === opt.name && themeMode === opt.mode;
							const IconComp = opt.icon;
							return (
								<button
									type="button"
									key={`${opt.name}-${opt.mode}`}
									onClick={() => handleThemeSelect(opt.name, opt.mode)}
									aria-pressed={isActive}
									className="relative rounded-[6px] overflow-hidden text-left focus:outline-none transition-colors"
									style={{
										border: `1px solid ${isActive ? "var(--brand-primary)" : "var(--border-subtle)"}`,
									}}
									aria-label={`${opt.label} ${opt.sublabel} teması`}
								>
									<div
										className="h-10 w-full"
										style={{ background: opt.preview }}
									/>
									<div
										className="px-2 py-1.5"
										style={{ background: "var(--surface-sunken)" }}
									>
										<div className="flex items-center gap-1">
											<IconComp
												className="w-3 h-3"
												style={{ color: "var(--brand-primary)" }}
											/>
											<span
												className="text-[11px] font-semibold"
												style={{ color: "var(--text-primary)" }}
											>
												{opt.label}
											</span>
										</div>
										<p
											className="text-[10px] mt-0.5"
											style={{ color: "var(--text-tertiary)" }}
										>
											{opt.sublabel}
										</p>
									</div>
									{isActive && (
										<div
											className="absolute top-1.5 right-1.5 w-4 h-4 rounded-[4px] flex items-center justify-center"
											style={{ background: "var(--brand-primary)" }}
										>
											<CheckCircle2
												className="w-2.5 h-2.5"
												style={{ color: "var(--brand-on-primary)" }}
											/>
										</div>
									)}
								</button>
							);
						})}
					</div>
				</div>
			</Card>

			{/* Webhook / Bildirim Kanalları */}
			<Card className="rounded-[6px] p-5" style={cardStyle}>
				<div className="flex items-center justify-between mb-1">
					<SectionHeader icon={Webhook} label="Bildirim kanalları" />
					{webhookDirty && (
						<span
							className="text-[10px] px-2 py-0.5 rounded-[4px] mb-4 uppercase tracking-wider font-medium"
							style={{
								background: "var(--status-degraded-subtle)",
								color: "var(--status-degraded-text)",
							}}
						>
							Kaydedilmemiş
						</span>
					)}
				</div>
				<Separator className="mb-4" style={dividerStyle} />

				<div className="space-y-4">
					{/* Generic Webhook */}
					<div
						className="p-4 rounded-[6px] space-y-3"
						style={{
							background: "var(--surface-sunken)",
							border: "1px solid var(--border-subtle)",
						}}
					>
						<div className="flex items-center gap-2 mb-1">
							<Send
								className="w-3.5 h-3.5"
								style={{ color: "var(--brand-primary)" }}
							/>
							<p
								className="text-[12px] font-semibold"
								style={{ color: "var(--text-primary)" }}
							>
								Generic Webhook
							</p>
							<span
								className="text-[10px] px-1.5 py-0.5 rounded-[4px] ml-auto uppercase tracking-wider font-medium"
								style={{
									background: webhookUrl
										? "var(--status-up-subtle)"
										: "var(--surface-base)",
									color: webhookUrl
										? "var(--status-up-text)"
										: "var(--text-faint)",
								}}
							>
								{webhookUrl ? "Aktif" : "Pasif"}
							</span>
						</div>
						<div>
							<Label
								className="text-[11px] font-medium block mb-1.5 uppercase tracking-wider"
								style={{ color: "var(--text-faint)" }}
							>
								Webhook URL
							</Label>
							<Input
								value={webhookUrl}
								onChange={(e) => {
									setWebhookUrl(e.target.value);
									setWebhookDirty(true);
								}}
								placeholder="https://hooks.example.com/..."
								className="text-[13px] h-9"
							/>
						</div>
						<div>
							<Label
								className="text-[11px] font-medium block mb-1.5 uppercase tracking-wider"
								style={{ color: "var(--text-faint)" }}
							>
								İmza secret (isteğe bağlı)
							</Label>
							<div className="relative">
								<Input
									type={showWebhookSecret ? "text" : "password"}
									value={webhookSecret}
									onChange={(e) => {
										setWebhookSecret(e.target.value);
										setWebhookDirty(true);
									}}
									placeholder="••••••••••••"
									className="text-[13px] h-9 pr-9 font-mono"
								/>
								<button
									type="button"
									onClick={() => setShowWebhookSecret(!showWebhookSecret)}
									aria-label={
										showWebhookSecret ? "Secret'ı gizle" : "Secret'ı göster"
									}
									className="absolute right-2 top-1/2 -translate-y-1/2"
									style={{ color: "var(--text-tertiary)" }}
								>
									{showWebhookSecret ? (
										<EyeOff className="w-3.5 h-3.5" />
									) : (
										<Eye className="w-3.5 h-3.5" />
									)}
								</button>
							</div>
							<p
								className="text-[11px] mt-1.5 leading-relaxed"
								style={{ color: "var(--text-tertiary)" }}
							>
								Payload HMAC-SHA256 ile imzalanır; X-NanoNet-Signature
								header'ında iletilir.
							</p>
						</div>
					</div>

					{/* Slack */}
					<div
						className="p-4 rounded-[6px] space-y-3"
						style={{
							background: "var(--surface-sunken)",
							border: "1px solid var(--border-subtle)",
						}}
					>
						<div className="flex items-center gap-2 mb-1">
							<svg
								className="w-3.5 h-3.5"
								viewBox="0 0 24 24"
								fill="currentColor"
								role="img"
								aria-label="Slack"
								style={{ color: "var(--text-tertiary)" }}
							>
								<title>Slack</title>
								<path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.122 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zm-2.523 10.122a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
							</svg>
							<p
								className="text-[12px] font-semibold"
								style={{ color: "var(--text-primary)" }}
							>
								Slack
							</p>
							<span
								className="text-[10px] px-1.5 py-0.5 rounded-[4px] ml-auto uppercase tracking-wider font-medium"
								style={{
									background: slackWebhookUrl
										? "var(--status-up-subtle)"
										: "var(--surface-base)",
									color: slackWebhookUrl
										? "var(--status-up-text)"
										: "var(--text-faint)",
								}}
							>
								{slackWebhookUrl ? "Aktif" : "Pasif"}
							</span>
						</div>
						<div>
							<Label
								className="text-[11px] font-medium block mb-1.5 uppercase tracking-wider"
								style={{ color: "var(--text-faint)" }}
							>
								Slack incoming webhook URL
							</Label>
							<Input
								value={slackWebhookUrl}
								onChange={(e) => {
									setSlackWebhookUrl(e.target.value);
									setWebhookDirty(true);
								}}
								placeholder="https://hooks.slack.com/services/..."
								className="text-[13px] h-9"
							/>
							<p
								className="text-[11px] mt-1.5 leading-relaxed"
								style={{ color: "var(--text-tertiary)" }}
							>
								Kritik alertler ve AI analizleri Slack kanalınıza iletilir.
							</p>
						</div>
					</div>
				</div>
			</Card>

			{/* Audit Logs */}
			<Card className="rounded-[6px] p-5" style={cardStyle}>
				<div className="flex items-center justify-between mb-1">
					<SectionHeader icon={ScrollText} label="İşlem geçmişi" />
					<Button
						size="sm"
						variant="outline"
						onClick={() => {
							setShowAuditLogs(!showAuditLogs);
							if (!showAuditLogs) refetchAudit();
						}}
						className="mb-4"
					>
						{showAuditLogs ? (
							<>
								<ChevronUp className="w-3 h-3 mr-1" />
								Gizle
							</>
						) : (
							<>
								<ChevronDown className="w-3 h-3 mr-1" />
								Göster
							</>
						)}
					</Button>
				</div>
				{showAuditLogs && (
					<>
						<Separator className="mb-3" style={dividerStyle} />

						{/* Search + refresh */}
						<div className="flex items-center gap-2 mb-3">
							<div className="relative flex-1">
								<Search
									className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2"
									style={{ color: "var(--text-faint)" }}
								/>
								<Input
									value={auditSearch}
									onChange={(e) => setAuditSearch(e.target.value)}
									placeholder="İşlem ara..."
									className="text-[13px] h-9 pl-7"
								/>
							</div>
							<Button
								size="sm"
								variant="outline"
								onClick={() => refetchAudit()}
								aria-label="Yenile"
							>
								<Filter className="w-3.5 h-3.5" />
							</Button>
						</div>

						{filteredAuditLogs.length > 0 ? (
							<div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
								{filteredAuditLogs.map((log: AuditLog, idx: number) => {
									const actionColorMap: Record<string, string> = {
										CREATE: "var(--status-up-text)",
										UPDATE: "var(--brand-primary)",
										DELETE: "var(--status-down-text)",
										LOGIN: "var(--brand-primary)",
										LOGOUT: "var(--text-tertiary)",
									};
									const actionColor =
										actionColorMap[(log.action || "").toUpperCase()] ??
										"var(--text-tertiary)";
									return (
										<div
											key={log.id || `${log.created_at}-${idx}`}
											className="flex items-start gap-3 p-2.5 rounded-[6px]"
											style={{
												background: "var(--surface-sunken)",
												border: "1px solid var(--border-subtle)",
											}}
										>
											<Shield
												className="w-3.5 h-3.5 mt-0.5 shrink-0"
												style={{ color: "var(--brand-primary)" }}
											/>
											<div className="min-w-0 flex-1">
												<div className="flex items-center gap-2">
													<span
														className="text-[11px] font-semibold uppercase tracking-wider"
														style={{ color: actionColor }}
													>
														{log.action}
													</span>
													<span
														className="text-[12px] font-medium truncate"
														style={{ color: "var(--text-secondary)" }}
													>
														{log.resource_type}
													</span>
												</div>
												{log.details && (
													<p
														className="text-[11px] truncate mt-0.5"
														style={{ color: "var(--text-tertiary)" }}
													>
														{log.details}
													</p>
												)}
												<div
													className="flex items-center gap-2 mt-1 text-[11px] tnum"
													style={{ color: "var(--text-faint)" }}
												>
													<Clock className="w-3 h-3" />
													{new Date(log.created_at).toLocaleString("tr-TR")}
													{log.ip_address && (
														<span className="font-mono">
															· {log.ip_address}
														</span>
													)}
												</div>
											</div>
										</div>
									);
								})}
							</div>
						) : (
							<p
								className="text-[12px] text-center py-6"
								style={{ color: "var(--text-tertiary)" }}
							>
								{auditSearch
									? "Arama sonucu bulunamadı"
									: "Henüz işlem geçmişi bulunmuyor"}
							</p>
						)}

						{/* Pagination */}
						{(auditData?.total ?? 0) > AUDIT_PAGE_SIZE && (
							<div
								className="flex items-center justify-between mt-3 pt-3"
								style={{ borderTop: "1px solid var(--border-subtle)" }}
							>
								<Button
									size="sm"
									variant="outline"
									onClick={() => setAuditPage((p) => Math.max(0, p - 1))}
									disabled={auditPage === 0}
								>
									Önceki
								</Button>
								<span
									className="text-[11px] font-mono tnum"
									style={{ color: "var(--text-tertiary)" }}
								>
									{auditPage + 1} /{" "}
									{Math.ceil((auditData?.total ?? 0) / AUDIT_PAGE_SIZE)}
								</span>
								<Button
									size="sm"
									variant="outline"
									onClick={() => setAuditPage((p) => p + 1)}
									disabled={
										(auditPage + 1) * AUDIT_PAGE_SIZE >= (auditData?.total ?? 0)
									}
								>
									Sonraki
								</Button>
							</div>
						)}
					</>
				)}
			</Card>

			{/* API Key */}
			<Card className="rounded-[6px] p-5" style={cardStyle}>
				<SectionHeader icon={Key} label="API anahtarı" />
				<Separator className="mb-4" style={dividerStyle} />
				<p
					className="text-[11px] mb-3 leading-relaxed"
					style={{ color: "var(--text-tertiary)" }}
				>
					Agent ve dış entegrasyonlar için kullanılır. Anahtarınızı kimseyle
					paylaşmayın.
				</p>
				<div className="flex items-center gap-2">
					<div
						className="flex-1 flex items-center gap-2 px-3 h-9 rounded-[6px] font-mono text-[12px] overflow-hidden"
						style={{
							background: "var(--surface-sunken)",
							border: "1px solid var(--border-subtle)",
							color: showApiKey
								? "var(--text-secondary)"
								: "var(--text-tertiary)",
						}}
					>
						<span className="truncate">
							{showApiKey ? apiKey : `nanonet_${"•".repeat(24)}`}
						</span>
					</div>
					<button
						type="button"
						onClick={() => setShowApiKey((v) => !v)}
						aria-label={showApiKey ? "Anahtarı gizle" : "Anahtarı göster"}
						className="w-9 h-9 rounded-[6px] flex items-center justify-center shrink-0"
						style={{
							background: "var(--surface-sunken)",
							border: "1px solid var(--border-subtle)",
							color: "var(--text-tertiary)",
						}}
					>
						{showApiKey ? (
							<EyeOff className="w-3.5 h-3.5" />
						) : (
							<Eye className="w-3.5 h-3.5" />
						)}
					</button>
					<button
						type="button"
						onClick={handleCopyApiKey}
						aria-label="Kopyala"
						className="w-9 h-9 rounded-[6px] flex items-center justify-center shrink-0 transition-opacity hover:opacity-80"
						style={{
							background: apiKeyCopied
								? "var(--status-up-subtle)"
								: "var(--surface-sunken)",
							border: "1px solid var(--border-subtle)",
							color: apiKeyCopied
								? "var(--status-up-text)"
								: "var(--text-tertiary)",
						}}
					>
						{apiKeyCopied ? (
							<Check className="w-3.5 h-3.5" />
						) : (
							<Copy className="w-3.5 h-3.5" />
						)}
					</button>
				</div>
			</Card>

			{/* Danger Zone */}
			<Card className="relative rounded-[6px] p-5 pl-6" style={cardStyle}>
				<span
					aria-hidden
					className="absolute left-0 top-5 bottom-5 w-[2px] rounded-r-full"
					style={{ background: "var(--status-down)" }}
				/>
				<SectionHeader icon={AlertTriangle} label="Tehlikeli bölge" />
				<Separator className="mb-4" style={dividerStyle} />
				<div className="flex items-center justify-between gap-4">
					<div className="min-w-0">
						<p
							className="text-[13px] font-medium"
							style={{ color: "var(--text-primary)" }}
						>
							Tüm oturumları kapat
						</p>
						<p
							className="text-[12px] mt-1 leading-relaxed"
							style={{ color: "var(--text-tertiary)" }}
						>
							Tüm cihazlardaki aktif oturumlarınızı sonlandırır ve yeniden giriş
							yapmanızı gerektirir.
						</p>
					</div>
					{dangerAsking ? (
						<div className="flex items-center gap-1 shrink-0">
							<Button
								variant="destructive"
								size="sm"
								onClick={() => {
									setDangerAsking(false);
									toast.info("Tüm oturumlar kapatıldı (simüle edildi)");
								}}
							>
								<Check className="w-3 h-3 mr-1" /> Evet, kapat
							</Button>
							<Button
								variant="ghost"
								size="icon"
								onClick={() => setDangerAsking(false)}
								aria-label="İptal"
							>
								<X className="w-3.5 h-3.5" />
							</Button>
						</div>
					) : (
						<Button
							variant="outline"
							size="sm"
							onClick={() => setDangerAsking(true)}
							style={{
								color: "var(--status-down-text)",
								borderColor: "var(--status-down-border)",
							}}
						>
							<RefreshCw className="w-3.5 h-3.5 mr-1.5" />
							Oturumları kapat
						</Button>
					)}
				</div>
			</Card>

			{/* About */}
			<Card className="rounded-[6px] p-5" style={cardStyle}>
				<SectionHeader icon={Info} label="Hakkında" />
				<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
					{[
						{ label: "Platform", value: "NanoNet v2.0" },
						{
							label: "Tema",
							value: "Pro",
						},
						{ label: "Stack", value: "React + Go + Rust" },
						{
							label: "Veritabanı",
							value: "TimescaleDB + PostgreSQL + Redis",
						},
					].map(({ label, value }) => (
						<div
							key={label}
							className="p-3 rounded-[6px]"
							style={{
								background: "var(--surface-sunken)",
								border: "1px solid var(--border-subtle)",
							}}
						>
							<span
								className="text-[11px] font-medium uppercase tracking-wider"
								style={{ color: "var(--text-faint)" }}
							>
								{label}
							</span>
							<p
								className="mt-1 text-[12px] font-medium"
								style={{ color: "var(--text-primary)" }}
							>
								{value}
							</p>
						</div>
					))}
				</div>
				<div
					className="mt-4 pt-3 flex items-center justify-center gap-1.5 text-[11px]"
					style={{
						borderTop: "1px solid var(--border-subtle)",
						color: "var(--text-tertiary)",
					}}
				>
					<Heart
						className="w-3 h-3"
						style={{ color: "var(--brand-primary)" }}
					/>
					NanoNet izleme platformu
				</div>
			</Card>
		</PageShell>
	);
}

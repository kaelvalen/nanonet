import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Activity,
	AlertTriangle,
	ArrowRight,
	Bell,
	BellOff,
	BellRing,
	CheckCircle2,
	Clock,
	Cpu,
	Gauge,
	Info,
	Loader2,
	MemoryStick,
	RefreshCw,
	Save,
	Settings2,
	Shield,
	Timer,
	XOctagon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import React, { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { type AlertRules, metricsApi } from "@/api/metrics";
import { servicesApi } from "@/api/services";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";

// ─── Alert Rules Panel (per-service threshold ayarı) ──────────────────────────
function AlertRulesPanel() {
	const queryClient = useQueryClient();
	const [selectedServiceId, setSelectedServiceId] = useState<string | null>(
		null,
	);
	type RulesDraft = Omit<AlertRules, "service_id" | "is_default">;
	const [draft, setDraft] = useState<RulesDraft | null>(null);

	const { data: services = [], isLoading: servicesLoading } = useQuery({
		queryKey: ["services"],
		queryFn: servicesApi.list,
		staleTime: 30_000,
	});

	const {
		data: rules,
		isLoading: rulesLoading,
		refetch: refetchRules,
	} = useQuery({
		queryKey: ["alert-rules", selectedServiceId],
		queryFn: () => metricsApi.getAlertRules(selectedServiceId ?? ""),
		enabled: !!selectedServiceId,
		staleTime: 10_000,
	});

	// rules yüklendiğinde draft yoksa senkron başlat
	const effectiveDraft: RulesDraft =
		draft ??
		(rules
			? {
					cpu_threshold: rules.cpu_threshold,
					memory_threshold_mb: rules.memory_threshold_mb,
					latency_threshold_ms: rules.latency_threshold_ms,
					error_rate_threshold: rules.error_rate_threshold,
				}
			: {
					cpu_threshold: 80,
					memory_threshold_mb: 1024,
					latency_threshold_ms: 1000,
					error_rate_threshold: 0.1,
				});

	const saveMutation = useMutation({
		mutationFn: () =>
			metricsApi.updateAlertRules(selectedServiceId ?? "", effectiveDraft),
		onSuccess: () => {
			toast.success("Eşik değerleri kaydedildi");
			queryClient.invalidateQueries({
				queryKey: ["alert-rules", selectedServiceId],
			});
			refetchRules();
		},
		onError: () => toast.error("Kaydetme başarısız"),
	});

	const setField = <K extends keyof RulesDraft>(key: K, val: RulesDraft[K]) => {
		setDraft((prev) => ({ ...(prev ?? effectiveDraft), [key]: val }));
	};

	const isDirty =
		draft !== null &&
		rules !== undefined &&
		(draft.cpu_threshold !== rules.cpu_threshold ||
			draft.memory_threshold_mb !== rules.memory_threshold_mb ||
			draft.latency_threshold_ms !== rules.latency_threshold_ms ||
			draft.error_rate_threshold !== rules.error_rate_threshold);

	const fields = [
		{
			key: "cpu_threshold" as const,
			label: "CPU Eşiği",
			icon: Cpu,
			color: "var(--color-lavender)",
			unit: "%",
			min: 10,
			max: 100,
			step: 5,
			value: effectiveDraft.cpu_threshold,
			hint: "Bu değerin üzerinde CPU kullanımı uyarı tetikler",
		},
		{
			key: "memory_threshold_mb" as const,
			label: "Bellek Eşiği",
			icon: MemoryStick,
			color: "var(--color-blue)",
			unit: "MB",
			min: 64,
			max: 32768,
			step: 64,
			value: effectiveDraft.memory_threshold_mb,
			hint: "Bu değerin üzerinde bellek kullanımı uyarı tetikler",
		},
		{
			key: "latency_threshold_ms" as const,
			label: "Gecikme Eşiği",
			icon: Gauge,
			color: "var(--status-warn)",
			unit: "ms",
			min: 50,
			max: 10000,
			step: 50,
			value: effectiveDraft.latency_threshold_ms,
			hint: "Bu değerin üzerinde yanıt süresi uyarı tetikler",
		},
		{
			key: "error_rate_threshold" as const,
			label: "Hata Oranı Eşiği",
			icon: Activity,
			color: "var(--status-down-text)",
			unit: "",
			min: 0,
			max: 1,
			step: 0.01,
			value: effectiveDraft.error_rate_threshold,
			hint: "0.0–1.0 arası; bu değerin üzerinde hata oranı uyarı tetikler",
		},
	];

	return (
		<div className="space-y-4">
			{/* Servis seçimi */}
			<div className="flex flex-wrap gap-2">
				{servicesLoading ? (
					<div
						className="flex items-center gap-2 text-xs"
						style={{ color: "var(--text-faint)" }}
					>
						<Loader2 className="w-3.5 h-3.5 animate-spin" />
						Servisler yükleniyor...
					</div>
				) : services.length === 0 ? (
					<p className="text-xs" style={{ color: "var(--text-faint)" }}>
						Henüz servis yok.
					</p>
				) : (
					services.map((svc) => (
						<button
							type="button"
							key={svc.id}
							onClick={() => {
								setSelectedServiceId(svc.id);
								setDraft(null);
							}}
							className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs border transition-all"
							style={
								selectedServiceId === svc.id
									? {
											background:
												"color-mix(in srgb, var(--color-teal) 12%, transparent)",
											borderColor: "var(--color-teal-border)",
											color: "var(--color-teal)",
										}
									: {
											color: "var(--text-muted)",
											borderColor: "var(--border-subtle)",
											background: "transparent",
										}
							}
						>
							<span
								className="w-1.5 h-1.5 rounded-full shrink-0"
								style={{
									backgroundColor:
										svc.status === "up"
											? "var(--status-up)"
											: svc.status === "down"
												? "var(--status-down)"
												: "var(--status-warn)",
								}}
							/>
							{svc.name}
						</button>
					))
				)}
			</div>

			{!selectedServiceId && (
				<Card
					className="p-10 rounded text-center"
					style={{
						background: "var(--surface-card)",
						border: "1px solid var(--border-default)",
					}}
				>
					<Settings2
						className="w-8 h-8 mx-auto mb-3 opacity-25"
						style={{ color: "var(--text-faint)" }}
					/>
					<p
						className="text-sm font-medium"
						style={{ color: "var(--text-muted)" }}
					>
						Eşik ayarlamak için bir servis seçin
					</p>
					<p className="text-xs mt-1" style={{ color: "var(--text-faint)" }}>
						Her servis bağımsız threshold değerleri kullanabilir
					</p>
				</Card>
			)}

			{selectedServiceId &&
				(rulesLoading ? (
					<div
						className="flex items-center gap-2 py-6 text-xs"
						style={{ color: "var(--text-faint)" }}
					>
						<Loader2 className="w-4 h-4 animate-spin" />
						Eşik değerleri yükleniyor...
					</div>
				) : (
					<div className="space-y-3">
						{rules?.is_default === true && (
							<div
								className="flex items-center gap-2 px-3 py-2 rounded text-xs"
								style={{
									background: "var(--color-blue-subtle)",
									border: "1px solid var(--color-blue-border)",
									color: "var(--color-blue-text)",
								}}
							>
								<Info className="w-3.5 h-3.5 shrink-0" />
								Bu servis şu an global varsayılan eşik değerlerini kullanıyor.
							</div>
						)}
						{fields.map((f) => (
							<Card
								key={f.key}
								className="p-4 rounded"
								style={{
									background: "var(--surface-card)",
									border: "1px solid var(--border-default)",
								}}
							>
								<div className="flex items-center gap-2 mb-3">
									<div
										className="w-8 h-8 rounded flex items-center justify-center shrink-0"
										style={{
											border: `1px solid ${f.color}`,
											backgroundColor: `color-mix(in srgb, ${f.color} 12%, transparent)`,
										}}
									>
										<f.icon className="w-4 h-4" style={{ color: f.color }} />
									</div>
									<div className="flex-1 min-w-0">
										<p
											className="text-xs font-semibold"
											style={{ color: "var(--text-secondary)" }}
										>
											{f.label}
										</p>
										<p
											className="text-[10px] truncate"
											style={{ color: "var(--text-faint)" }}
										>
											{f.hint}
										</p>
									</div>
									<div className="flex items-center gap-1.5 shrink-0">
										<Input
											type="number"
											value={f.value}
											min={f.min}
											max={f.max}
											step={f.step}
											onChange={(e) =>
												setField(f.key, Number(e.target.value) as never)
											}
											className="w-24 h-8 text-xs text-right rounded"
											style={{
												background: "var(--input-bg)",
												borderColor: `color-mix(in srgb, ${f.color} 40%, var(--input-border))`,
												color: "var(--text-secondary)",
											}}
										/>
										<span
											className="text-[10px] w-6"
											style={{ color: "var(--text-faint)" }}
										>
											{f.unit}
										</span>
									</div>
								</div>
								<Slider
									value={[f.value]}
									min={f.min}
									max={f.max}
									step={f.step}
									onValueChange={([v]) => setField(f.key, v as never)}
									className="mt-1"
								/>
								<div
									className="flex justify-between text-[9px] mt-1"
									style={{ color: "var(--text-faint)" }}
								>
									<span>
										{f.min}
										{f.unit}
									</span>
									<span style={{ color: f.color, fontWeight: 600 }}>
										{f.key === "error_rate_threshold"
											? `${(f.value * 100).toFixed(0)}%`
											: f.value + f.unit}
									</span>
									<span>
										{f.max}
										{f.unit}
									</span>
								</div>
							</Card>
						))}

						<div className="flex items-center gap-2 justify-end pt-1">
							{isDirty && (
								<button
									type="button"
									onClick={() => {
										setDraft(null);
									}}
									className="px-3 h-9 rounded text-xs border"
									style={{
										borderColor: "var(--border-default)",
										color: "var(--text-muted)",
										boxShadow: "var(--btn-shadow)",
									}}
								>
									<RefreshCw className="w-3.5 h-3.5 inline mr-1" />
									Sıfırla
								</button>
							)}
							<Button
								onClick={() => saveMutation.mutate()}
								disabled={!isDirty || saveMutation.isPending}
								className="h-9 px-4 rounded text-xs text-white"
								style={{
									background: isDirty
										? "var(--color-teal)"
										: "var(--text-faint)",
								}}
							>
								{saveMutation.isPending ? (
									<>
										<Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
										Kaydediliyor...
									</>
								) : (
									<>
										<Save className="w-3.5 h-3.5 mr-1.5" />
										Kaydet
									</>
								)}
							</Button>
						</div>
					</div>
				))}
		</div>
	);
}

export function AlertsPage() {
	const [severityFilter, setSeverityFilter] = useState<string>("all");
	const [showResolved, setShowResolved] = useState(false);
	const [snoozeOpenId, setSnoozeOpenId] = useState<string | null>(null);
	const snoozeRef = useRef<HTMLDivElement>(null);

	const { data: alerts = [], isLoading, refetch } = useQuery({
		queryKey: ["activeAlerts"],
		queryFn: () => metricsApi.getActiveAlerts(),
		refetchInterval: 15_000,
	});

	const filtered = useMemo(() =>
		alerts
			.filter((a) => {
				if (severityFilter !== "all" && a.severity !== severityFilter) return false;
				if (!showResolved && a.resolved_at) return false;
				return true;
			})
			.sort((a, b) => new Date(b.triggered_at).getTime() - new Date(a.triggered_at).getTime()),
		[alerts, severityFilter, showResolved],
	);

	const severityCounts = useMemo(() => {
		const c = { all: alerts.length, crit: 0, warn: 0, info: 0 };
		alerts.forEach((a) => { if (a.severity in c) c[a.severity as keyof typeof c]++; });
		return c;
	}, [alerts]);

	const activeCount = alerts.filter((a) => !a.resolved_at).length;

	const handleResolve = async (alertId: string) => {
		try { await metricsApi.resolveAlert(alertId); toast.success("Alert çözüldü"); refetch(); }
		catch { toast.error("Alert çözülemedi"); }
	};

	const handleSnooze = async (alertId: string, minutes: number) => {
		setSnoozeOpenId(null);
		try {
			await metricsApi.snoozeAlert(alertId, minutes);
			toast.success(`Alert ${minutes < 60 ? `${minutes}dk` : `${minutes / 60}sa`} ertelendi`);
			refetch();
		} catch { toast.error("Alert ertelenemedi"); }
	};

	const SNOOZE_OPTIONS = [
		{ label: "5 dakika", minutes: 5 },
		{ label: "15 dakika", minutes: 15 },
		{ label: "30 dakika", minutes: 30 },
		{ label: "1 saat", minutes: 60 },
		{ label: "4 saat", minutes: 240 },
	];

	const severityConfig = (severity: string) => {
		if (severity === "crit") return {
			dot: "var(--status-down)",
			bg: "var(--status-down-subtle)",
			text: "var(--status-down-text)",
			border: "var(--status-down-border)",
			label: "Kritik",
		};
		if (severity === "warn") return {
			dot: "var(--status-warn)",
			bg: "var(--status-warn-subtle)",
			text: "var(--status-warn-text)",
			border: "var(--status-warn-border)",
			label: "Uyarı",
		};
		return {
			dot: "var(--color-blue)",
			bg: "var(--color-blue-subtle)",
			text: "var(--color-blue-text)",
			border: "var(--color-blue-border)",
			label: "Bilgi",
		};
	};

	const SeverityIcon = ({ severity, className, style }: { severity: string; className?: string; style?: React.CSSProperties }) => {
		if (severity === "crit") return <XOctagon className={className} style={style} />;
		if (severity === "warn") return <AlertTriangle className={className} style={style} />;
		return <Info className={className} style={style} />;
	};

	return (
		<div className="space-y-4">

			{/* ── Stat tiles ──────────────────────────────────────────── */}
			<motion.div
				className="grid grid-cols-2 sm:grid-cols-4 gap-3"
				initial={{ opacity: 0, y: 8 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.3 }}
			>
				{([
					{ key: "all",  label: "Toplam",  icon: Bell,          color: "var(--color-lavender)",  bg: "var(--color-lavender-subtle)",  border: "var(--color-lavender-border)",  count: severityCounts.all  },
					{ key: "crit", label: "Kritik",  icon: XOctagon,      color: "var(--status-down-text)", bg: "var(--status-down-subtle)",   border: "var(--status-down-border)",   count: severityCounts.crit },
					{ key: "warn", label: "Uyarı",   icon: AlertTriangle, color: "var(--status-warn-text)", bg: "var(--status-warn-subtle)",   border: "var(--status-warn-border)",   count: severityCounts.warn },
					{ key: "info", label: "Bilgi",   icon: Info,          color: "var(--color-blue-text)",  bg: "var(--color-blue-subtle)",    border: "var(--color-blue-border)",    count: severityCounts.info },
				] as const).map(({ key, label, icon: Icon, color, bg, border, count }) => (
					<button
						key={key}
						type="button"
						onClick={() => setSeverityFilter(severityFilter === key ? "all" : key)}
						className="relative overflow-hidden px-4 py-3.5 rounded-xl text-left transition-all"
						style={{
							background: bg,
							border: `1.5px solid ${severityFilter === key ? color : border}`,
							boxShadow: severityFilter === key ? `0 0 0 1px ${border}` : "none",
						}}
					>
						<div className="absolute left-0 top-3 bottom-3 w-0.5 rounded-r-full" style={{ background: color }} />
						<div className="flex items-center justify-between">
							<div>
								<p className="text-[11px] font-medium mb-1" style={{ color: "var(--text-faint)" }}>{label}</p>
								<p className="text-3xl font-bold tabular-nums leading-none" style={{ color }}>{count}</p>
							</div>
							<div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "var(--surface-card)", border: `1px solid ${border}` }}>
								<Icon className="w-4 h-4" style={{ color }} />
							</div>
						</div>
					</button>
				))}
			</motion.div>

			{/* ── 2-column layout ─────────────────────────────────────── */}
			<div className="grid grid-cols-12 gap-4">

				{/* ── LEFT: Alert feed ─────────────────────────────── */}
				<motion.div
					className="col-span-12 lg:col-span-8 flex flex-col gap-3"
					initial={{ opacity: 0, x: -10 }}
					animate={{ opacity: 1, x: 0 }}
					transition={{ duration: 0.35, delay: 0.1 }}
				>
					{/* Filter bar */}
					<div className="flex items-center justify-between gap-2 flex-wrap">
						<div className="flex items-center gap-1.5 flex-wrap">
							{(["all", "crit", "warn", "info"] as const).map((s) => {
								const cfg = s !== "all" ? severityConfig(s) : null;
								const labels = { all: `Tümü (${severityCounts.all})`, crit: `Kritik (${severityCounts.crit})`, warn: `Uyarı (${severityCounts.warn})`, info: `Bilgi (${severityCounts.info})` };
								return (
									<button key={s} type="button" onClick={() => setSeverityFilter(s)}
										className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all border"
										style={severityFilter === s
											? cfg ? { background: cfg.bg, color: cfg.text, borderColor: cfg.border }
												: { background: "var(--color-lavender-subtle)", color: "var(--color-lavender)", borderColor: "var(--color-lavender-border)" }
											: { color: "var(--text-muted)", borderColor: "var(--border-subtle)", background: "transparent" }
										}
									>
										{labels[s]}
									</button>
								);
							})}
						</div>
						<button
							type="button"
							onClick={() => setShowResolved(!showResolved)}
							className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all border"
							style={showResolved
								? { background: "var(--status-up-subtle)", color: "var(--status-up-text)", borderColor: "var(--status-up-border)" }
								: { color: "var(--text-muted)", borderColor: "var(--border-subtle)", background: "transparent" }
							}
						>
							{showResolved ? "✓ Çözülmüşleri Gizle" : "Çözülmüşleri Göster"}
						</button>
					</div>

					{/* Feed */}
					{isLoading ? (
						<div className="space-y-2">
							{[1, 2, 3].map((i) => (
								<Card key={i} className="p-4 animate-pulse" style={{ background: "var(--surface-card)", border: "1px solid var(--border-default)" }}>
									<div className="flex gap-3">
										<div className="w-8 h-8 rounded-lg shrink-0" style={{ background: "var(--surface-sunken)" }} />
										<div className="flex-1 space-y-2">
											<div className="h-3.5 w-2/3 rounded" style={{ background: "var(--surface-sunken)" }} />
											<div className="h-2.5 w-1/3 rounded" style={{ background: "var(--surface-sunken)" }} />
										</div>
									</div>
								</Card>
							))}
						</div>
					) : filtered.length === 0 ? (
						<Card className="py-14 flex flex-col items-center gap-3 text-center" style={{ background: "var(--surface-card)", border: "1px solid var(--status-up-border)" }}>
							<div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "var(--status-up-subtle)", border: "1px solid var(--status-up-border)" }}>
								<Shield className="w-7 h-7" style={{ color: "var(--status-up)" }} />
							</div>
							<div>
								<p className="text-sm font-semibold mb-1" style={{ color: "var(--text-secondary)" }}>Tüm Sistemler Normal</p>
								<p className="text-xs" style={{ color: "var(--text-faint)" }}>
									{severityFilter !== "all" ? "Bu filtreye uygun uyarı bulunamadı" : "Aktif uyarı yok"}
								</p>
							</div>
						</Card>
					) : (
						<div className="space-y-2">
							<AnimatePresence mode="popLayout">
								{filtered.map((alert, index) => {
									const cfg = severityConfig(alert.severity);
									return (
										<motion.div
											key={alert.id}
											initial={{ opacity: 0, y: 6 }}
											animate={{ opacity: 1, y: 0 }}
											exit={{ opacity: 0, scale: 0.98, height: 0 }}
											transition={{ duration: 0.2, delay: index * 0.03 }}
											layout
										>
											<Card
												className={`overflow-hidden transition-opacity ${alert.resolved_at ? "opacity-55" : ""}`}
												style={{
													background: "var(--surface-card)",
													border: "1px solid var(--border-default)",
													borderLeft: `3px solid ${cfg.dot}`,
												}}
											>
												<div className="px-4 py-3.5 flex items-start gap-3">
													{/* Icon */}
													<div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
														<SeverityIcon
															severity={alert.severity}
															className={`w-4 h-4 ${alert.severity === "crit" && !alert.resolved_at ? "animate-pulse" : ""}`}
															style={{ color: cfg.text }}
														/>
													</div>

													{/* Content */}
													<div className="flex-1 min-w-0">
														<div className="flex items-center gap-2 mb-1 flex-wrap">
															<Badge
																className="text-[9px] px-1.5 py-0 rounded border uppercase"
																style={{ background: cfg.bg, color: cfg.text, borderColor: cfg.border }}
															>
																{cfg.label}
															</Badge>
															<span className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={{ color: "var(--text-faint)", background: "var(--surface-sunken)" }}>
																{alert.type}
															</span>
															{alert.resolved_at && (
																<Badge className="text-[9px] px-1.5 py-0 rounded border" style={{ background: "var(--status-up-subtle)", color: "var(--status-up-text)", borderColor: "var(--status-up-border)" }}>
																	<CheckCircle2 className="w-2.5 h-2.5 mr-0.5 inline" /> Çözüldü
																</Badge>
															)}
														</div>
														<p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{alert.message}</p>
														<div className="flex items-center gap-3 mt-1.5 text-[10px]" style={{ color: "var(--text-faint)" }}>
															<span className="flex items-center gap-1">
																<Clock className="w-2.5 h-2.5" />
																{new Date(alert.triggered_at).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })}
															</span>
															{alert.resolved_at && (
																<span className="flex items-center gap-1" style={{ color: "var(--status-up-text)" }}>
																	<ArrowRight className="w-2.5 h-2.5" />
																	{new Date(alert.resolved_at).toLocaleTimeString("tr-TR")}
																</span>
															)}
														</div>
													</div>

													{/* Actions */}
													{!alert.resolved_at && (
														<div className="flex items-center gap-1.5 shrink-0">
															{/* Snooze */}
															<div className="relative" ref={snoozeOpenId === alert.id ? snoozeRef : undefined}>
																<Button
																	variant="outline" size="sm"
																	onClick={() => setSnoozeOpenId(snoozeOpenId === alert.id ? null : alert.id)}
																	className="h-7 w-7 p-0 rounded-lg"
																	style={{ borderColor: "var(--color-blue-border)", color: "var(--color-blue-text)" }}
																	title="Ertele"
																>
																	<Timer className="w-3.5 h-3.5" />
																</Button>
																<AnimatePresence>
																	{snoozeOpenId === alert.id && (
																		<motion.div
																			initial={{ opacity: 0, y: -4, scale: 0.97 }}
																			animate={{ opacity: 1, y: 0, scale: 1 }}
																			exit={{ opacity: 0, y: -4, scale: 0.97 }}
																			transition={{ duration: 0.15 }}
																			className="absolute right-0 top-8 z-20 w-36 rounded-xl overflow-hidden"
																			style={{ background: "var(--surface-card)", border: "1px solid var(--color-blue-border)", boxShadow: "var(--panel-shadow)" }}
																		>
																			<div className="flex items-center gap-1.5 px-3 py-2 border-b" style={{ borderColor: "var(--border-subtle)", color: "var(--text-faint)" }}>
																				<BellRing className="w-3 h-3" />
																				<span className="text-[10px] uppercase tracking-wider">Ertele</span>
																			</div>
																			{SNOOZE_OPTIONS.map((opt) => (
																				<button
																					type="button" key={opt.minutes}
																					onClick={() => handleSnooze(alert.id, opt.minutes)}
																					className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:opacity-80 transition-opacity"
																					style={{ color: "var(--text-secondary)", background: "transparent" }}
																				>
																					<Clock className="w-3 h-3" style={{ color: "var(--color-blue)" }} />
																					{opt.label}
																				</button>
																			))}
																		</motion.div>
																	)}
																</AnimatePresence>
															</div>

															{/* Resolve */}
															<Button
																variant="outline" size="sm"
																onClick={() => handleResolve(alert.id)}
																className="h-7 px-2.5 rounded-lg text-[11px] font-medium"
																style={{ borderColor: "var(--status-up-border)", color: "var(--status-up-text)" }}
															>
																<CheckCircle2 className="w-3 h-3 mr-1" /> Çöz
															</Button>
														</div>
													)}
												</div>
											</Card>
										</motion.div>
									);
								})}
							</AnimatePresence>
						</div>
					)}
				</motion.div>

				{/* ── RIGHT: Rules panel ───────────────────────────── */}
				<motion.div
					className="col-span-12 lg:col-span-4"
					initial={{ opacity: 0, x: 10 }}
					animate={{ opacity: 1, x: 0 }}
					transition={{ duration: 0.35, delay: 0.15 }}
				>
					<Card className="overflow-hidden" style={{ background: "var(--surface-card)", border: "1px solid var(--color-teal-border)" }}>
						<div className="h-0.5" style={{ background: "var(--gradient-btn-primary)" }} />
						<div className="p-4">
							{/* Panel title */}
							<div className="flex items-center gap-2.5 mb-4">
								<div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--color-teal-subtle)", border: "1px solid var(--color-teal-border)" }}>
									<Settings2 className="w-4 h-4" style={{ color: "var(--color-teal)" }} />
								</div>
								<div>
									<p className="text-sm font-bold leading-none" style={{ color: "var(--text-primary)" }}>Eşik Ayarları</p>
									<p className="text-[10px] mt-0.5" style={{ color: "var(--text-faint)" }}>Servis bazlı uyarı limitleri</p>
								</div>
							</div>

							{/* Active status pill */}
							<div
								className="flex items-center gap-1.5 px-3 py-2 rounded-lg mb-4 text-xs font-medium"
								style={activeCount > 0
									? { background: "var(--status-down-subtle)", border: "1px solid var(--status-down-border)", color: "var(--status-down-text)" }
									: { background: "var(--status-up-subtle)", border: "1px solid var(--status-up-border)", color: "var(--status-up-text)" }
								}
							>
								{activeCount > 0
									? <><Bell className="w-3.5 h-3.5 animate-pulse" /> {activeCount} aktif uyarı</>
									: <><BellOff className="w-3.5 h-3.5" /> Sorun yok</>
								}
							</div>

							<AlertRulesPanel />
						</div>
					</Card>
				</motion.div>
			</div>
		</div>
	);
}

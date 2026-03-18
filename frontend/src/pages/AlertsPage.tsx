import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Activity,
	AlertTriangle,
	ArrowRight,
	Bell,
	BellOff,
	CheckCircle2,
	Clock,
	Cpu,
	Filter,
	Gauge,
	Info,
	Loader2,
	MemoryStick,
	RefreshCw,
	Save,
	Settings2,
	Shield,
	XOctagon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
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
		queryFn: () => metricsApi.getAlertRules(selectedServiceId!),
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
			metricsApi.updateAlertRules(selectedServiceId!, effectiveDraft),
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
							key={svc.id}
							onClick={() => {
								setSelectedServiceId(svc.id);
								setDraft(null);
							}}
							className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs border-2 transition-all"
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
						border: "2px solid var(--border-default)",
						boxShadow: "var(--card-shadow)",
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
									border: "2px solid var(--color-blue-border)",
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
									border: "2px solid var(--border-default)",
									boxShadow: "var(--card-shadow)",
								}}
							>
								<div className="flex items-center gap-2 mb-3">
									<div
										className="w-8 h-8 rounded flex items-center justify-center shrink-0"
										style={{
											border: `1.5px solid ${f.color}`,
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
									onClick={() => {
										setDraft(null);
									}}
									className="px-3 h-9 rounded text-xs border-2"
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
	const [activeTab, setActiveTab] = useState<"alerts" | "rules">("alerts");
	const [severityFilter, setSeverityFilter] = useState<string>("all");
	const [showResolved, setShowResolved] = useState(false);

	const {
		data: alerts = [],
		isLoading,
		refetch,
	} = useQuery({
		queryKey: ["activeAlerts"],
		queryFn: () => metricsApi.getActiveAlerts(),
		refetchInterval: 15000,
	});

	const filtered = useMemo(() => {
		return alerts.filter((a) => {
			if (severityFilter !== "all" && a.severity !== severityFilter)
				return false;
			if (!showResolved && a.resolved_at) return false;
			return true;
		});
	}, [alerts, severityFilter, showResolved]);

	const severityCounts = useMemo(() => {
		const counts = { all: alerts.length, crit: 0, warn: 0, info: 0 };
		alerts.forEach((a) => {
			if (a.severity in counts) counts[a.severity as keyof typeof counts]++;
		});
		return counts;
	}, [alerts]);

	const handleResolve = async (alertId: string) => {
		try {
			await metricsApi.resolveAlert(alertId);
			toast.success("Alert çözüldü");
			refetch();
		} catch {
			toast.error("Alert çözülemedi");
		}
	};

	const severityConfig = (severity: string) => {
		switch (severity) {
			case "crit":
				return {
					dotVar: "var(--status-down)",
					badgeBg: "var(--status-down-subtle)",
					badgeText: "var(--status-down-text)",
					badgeBorder: "var(--status-down-border)",
					borderVar: "var(--status-down-border)",
					colorVar: "var(--status-down-text)",
					label: "Kritik",
				};
			case "warn":
				return {
					dotVar: "var(--status-warn)",
					badgeBg: "var(--status-warn-subtle)",
					badgeText: "var(--status-warn-text)",
					badgeBorder: "var(--status-warn-border)",
					borderVar: "var(--status-warn-border)",
					colorVar: "var(--status-warn-text)",
					label: "Uyarı",
				};
			default:
				return {
					dotVar: "var(--color-blue)",
					badgeBg: "var(--color-blue-subtle)",
					badgeText: "var(--color-blue-text)",
					badgeBorder: "var(--color-blue-border)",
					borderVar: "var(--color-blue-border)",
					colorVar: "var(--color-blue-text)",
					label: "Bilgi",
				};
		}
	};

	const activeCount = alerts.filter((a) => !a.resolved_at).length;

	const SeverityIcon = ({
		severity,
		className,
		style,
	}: {
		severity: string;
		className?: string;
		style?: React.CSSProperties;
	}) => {
		if (severity === "crit")
			return <XOctagon className={className} style={style} />;
		if (severity === "warn")
			return <AlertTriangle className={className} style={style} />;
		return <Info className={className} style={style} />;
	};

	return (
		<div className="space-y-6">
			{/* Header */}
			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.5 }}
			>
				<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
					<div>
						<h1
							className="text-2xl font-bold bg-clip-text text-transparent"
							style={{ backgroundImage: "var(--gradient-heading)" }}
						>
							Uyarılar
						</h1>
						<p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
							Gerçek zamanlı olay bildirimleri ve uyarılar
						</p>
					</div>
					<div
						className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs border transition-all"
						style={
							activeCount > 0
								? {
										background: "var(--status-down-subtle)",
										borderColor: "var(--status-down-border)",
										color: "var(--status-down-text)",
									}
								: {
										background: "var(--status-up-subtle)",
										borderColor: "var(--status-up-border)",
										color: "var(--status-up-text)",
									}
						}
					>
						{activeCount > 0 ? (
							<>
								<Bell className="w-3 h-3 animate-pulse" />
								{activeCount} Aktif
							</>
						) : (
							<>
								<BellOff className="w-3 h-3" />
								Sorun Yok
							</>
						)}
					</div>
				</div>
			</motion.div>

			{/* Tabs */}
			<div className="flex items-center gap-1.5">
				{[
					{ key: "alerts" as const, label: "Aktif Uyarılar", icon: Bell },
					{ key: "rules" as const, label: "Eşik Ayarları", icon: Settings2 },
				].map((tab) => (
					<button
						key={tab.key}
						onClick={() => setActiveTab(tab.key)}
						className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border-2 transition-all"
						style={
							activeTab === tab.key
								? {
										background:
											"color-mix(in srgb, var(--color-teal) 12%, transparent)",
										borderColor: "var(--color-teal-border)",
										color: "var(--color-teal)",
									}
								: {
										color: "var(--text-muted)",
										borderColor: "transparent",
										background: "transparent",
									}
						}
					>
						<tab.icon className="w-3.5 h-3.5" />
						{tab.label}
					</button>
				))}
			</div>

			{activeTab === "rules" && <AlertRulesPanel />}

			{activeTab === "alerts" && (
				<>
					{/* Severity Summary Cards */}
					<motion.div
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.4, delay: 0.05 }}
						className="grid grid-cols-3 gap-3"
					>
						{[
							{
								key: "crit" as const,
								label: "Kritik",
								icon: XOctagon,
								colorVar: "var(--status-down-text)",
								bgVar: "var(--status-down-subtle)",
								borderVar: "var(--status-down-border)",
								barVar: "var(--status-down)",
							},
							{
								key: "warn" as const,
								label: "Uyarı",
								icon: AlertTriangle,
								colorVar: "var(--status-warn-text)",
								bgVar: "var(--status-warn-subtle)",
								borderVar: "var(--status-warn-border)",
								barVar: "var(--status-warn)",
							},
							{
								key: "info" as const,
								label: "Bilgi",
								icon: Info,
								colorVar: "var(--color-blue-text)",
								bgVar: "var(--color-blue-subtle)",
								borderVar: "var(--color-blue-border)",
								barVar: "var(--color-blue)",
							},
						].map((s, i) => (
							<motion.div
								key={s.key}
								initial={{ opacity: 0, y: 12 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.3, delay: 0.1 + i * 0.06 }}
							>
								<button
									onClick={() =>
										setSeverityFilter(severityFilter === s.key ? "all" : s.key)
									}
									className={`w-full text-left p-3 rounded border-2 transition-all duration-200`}
									style={{ background: s.bgVar, borderColor: s.borderVar }}
								>
									<div className="flex items-center justify-between mb-1.5">
										<s.icon className="w-4 h-4" style={{ color: s.colorVar }} />
										<span
											className="text-xl font-bold"
											style={{ color: s.colorVar }}
										>
											{severityCounts[s.key]}
										</span>
									</div>
									<p
										className="text-[10px] font-medium"
										style={{ color: s.colorVar }}
									>
										{s.label}
									</p>
									<div
										className="mt-2 h-1 rounded-full overflow-hidden"
										style={{ backgroundColor: "var(--border-track)" }}
									>
										<motion.div
											className="h-full rounded-full"
											style={{ backgroundColor: s.barVar }}
											initial={{ width: 0 }}
											animate={{
												width:
													severityCounts.all > 0
														? `${(severityCounts[s.key] / severityCounts.all) * 100}%`
														: "0%",
											}}
											transition={{ duration: 0.6, delay: 0.2 + i * 0.06 }}
										/>
									</div>
								</button>
							</motion.div>
						))}
					</motion.div>

					{/* Filters */}
					<motion.div
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.4, delay: 0.15 }}
					>
						<div className="flex flex-wrap items-center gap-2">
							<Filter
								className="w-3 h-3"
								style={{ color: "var(--text-faint)" }}
							/>
							{(["all", "crit", "warn", "info"] as const).map((s) => (
								<button
									key={s}
									onClick={() => setSeverityFilter(s)}
									className="px-2.5 py-1 rounded text-[10px] font-medium transition-all border-2"
									style={
										severityFilter === s
											? {
													background:
														s === "all"
															? "var(--color-teal-subtle)"
															: s === "crit"
																? "var(--status-down-subtle)"
																: s === "warn"
																	? "var(--status-warn-subtle)"
																	: "var(--color-blue-subtle)",
													color:
														s === "all"
															? "var(--color-teal)"
															: s === "crit"
																? "var(--status-down-text)"
																: s === "warn"
																	? "var(--status-warn-text)"
																	: "var(--color-blue-text)",
													borderColor:
														s === "all"
															? "var(--color-teal-border)"
															: s === "crit"
																? "var(--status-down-border)"
																: s === "warn"
																	? "var(--status-warn-border)"
																	: "var(--color-blue-border)",
												}
											: {
													color: "var(--text-muted)",
													borderColor: "transparent",
												}
									}
								>
									{s === "all"
										? `Tümü (${severityCounts.all})`
										: s === "crit"
											? `Kritik (${severityCounts.crit})`
											: s === "warn"
												? `Uyarı (${severityCounts.warn})`
												: `Bilgi (${severityCounts.info})`}
								</button>
							))}
							<button
								onClick={() => setShowResolved(!showResolved)}
								className="ml-auto px-2.5 py-1 rounded text-[10px] font-medium transition-all border-2"
								style={
									showResolved
										? {
												background: "var(--status-up-subtle)",
												color: "var(--status-up-text)",
												borderColor: "var(--status-up-border)",
											}
										: { color: "var(--text-muted)", borderColor: "transparent" }
								}
							>
								{showResolved ? "✓ Çözülmüşleri Göster" : "Çözülmüşleri Göster"}
							</button>
						</div>
					</motion.div>

					{/* Timeline / Alerts List */}
					{isLoading ? (
						<div className="space-y-3">
							{[1, 2, 3].map((i) => (
								<Card
									key={i}
									className="p-4 rounded animate-pulse"
									style={{
										background: "var(--surface-card)",
										border: "2px solid var(--border-default)",
									}}
								>
									<div className="flex items-start gap-3">
										<div
											className="w-8 h-8 rounded-lg shrink-0"
											style={{ backgroundColor: "var(--color-teal-subtle)" }}
										/>
										<div className="flex-1">
											<div
												className="h-3.5 w-48 rounded mb-2"
												style={{ backgroundColor: "var(--color-teal-subtle)" }}
											/>
											<div
												className="h-2.5 w-32 rounded"
												style={{ backgroundColor: "var(--color-teal-subtle)" }}
											/>
										</div>
									</div>
								</Card>
							))}
						</div>
					) : filtered.length === 0 ? (
						<motion.div
							initial={{ opacity: 0, scale: 0.97 }}
							animate={{ opacity: 1, scale: 1 }}
							transition={{ duration: 0.3 }}
						>
							<Card
								className="p-14 rounded text-center"
								style={{
									background: "var(--surface-card)",
									border: "2px solid var(--status-up-border)",
									boxShadow: "var(--card-shadow)",
								}}
							>
								<div
									className="w-16 h-16 rounded flex items-center justify-center mx-auto mb-4"
									style={{
										backgroundColor: "var(--status-up-subtle)",
										border: "2px solid var(--status-up-border)",
									}}
								>
									<Shield
										className="w-8 h-8 opacity-50"
										style={{ color: "var(--status-up)" }}
									/>
								</div>
								<h3
									className="text-sm font-semibold mb-1"
									style={{ color: "var(--text-secondary)" }}
								>
									Tüm Sistemler Aktif
								</h3>
								<p className="text-xs" style={{ color: "var(--text-muted)" }}>
									{severityFilter !== "all"
										? "Bu filtreye uygun uyarı bulunamadı"
										: "Şu anda aktif uyarı yok"}
								</p>
							</Card>
						</motion.div>
					) : (
						<div className="relative">
							{/* Timeline line */}
							<div
								className="absolute left-4.75 top-4 bottom-4 w-px"
								style={{
									background:
										"linear-gradient(to bottom, var(--color-teal-border), var(--color-lavender-border), transparent)",
								}}
							/>
							<div className="space-y-3 pl-1">
								<AnimatePresence mode="popLayout">
									{filtered.map((alert, index) => {
										const config = severityConfig(alert.severity);
										return (
											<motion.div
												key={alert.id}
												initial={{ opacity: 0, x: -16 }}
												animate={{ opacity: 1, x: 0 }}
												exit={{ opacity: 0, x: 16, height: 0 }}
												transition={{ duration: 0.25, delay: index * 0.04 }}
												layout
											>
												<div className="flex items-start gap-3">
													{/* Timeline icon */}
													<div
														className="relative z-10 w-9 h-9 rounded flex items-center justify-center border-2 shrink-0 mt-0.5"
														style={{
															background: config.badgeBg,
															borderColor: config.badgeBorder,
														}}
													>
														<SeverityIcon
															severity={alert.severity}
															className={`w-4 h-4 ${alert.severity === "crit" && !alert.resolved_at ? "animate-pulse" : ""}`}
															style={{ color: config.colorVar }}
														/>
													</div>

													{/* Card */}
													<Card
														className={`flex-1 rounded p-4 transition-all duration-200 ${alert.resolved_at ? "opacity-60" : ""}`}
														style={{
															background: "var(--surface-card)",
															border: `2px solid ${config.borderVar}`,
															boxShadow: "var(--card-shadow)",
														}}
													>
														<div className="flex items-start justify-between gap-3">
															<div className="min-w-0 flex-1">
																<div className="flex items-center gap-2 mb-1.5 flex-wrap">
																	<Badge
																		className="text-[9px] px-1.5 py-0 rounded border-2 uppercase font-(--font-mono)"
																		style={{
																			background: config.badgeBg,
																			color: config.badgeText,
																			borderColor: config.badgeBorder,
																		}}
																	>
																		{config.label}
																	</Badge>
																	<span
																		className="text-[10px] font-(--font-mono) px-1.5 py-0.5 rounded"
																		style={{
																			color: "var(--text-faint)",
																			background: "var(--surface-sunken)",
																		}}
																	>
																		{alert.type}
																	</span>
																	{alert.resolved_at && (
																		<Badge
																			className="text-[9px] px-1.5 py-0 rounded border-2"
																			style={{
																				background: "var(--status-up-subtle)",
																				color: "var(--status-up-text)",
																				borderColor: "var(--status-up-border)",
																			}}
																		>
																			<CheckCircle2 className="w-2.5 h-2.5 mr-0.5 inline" />{" "}
																			Resolved
																		</Badge>
																	)}
																</div>
																<p
																	className="text-xs leading-relaxed"
																	style={{ color: "var(--text-secondary)" }}
																>
																	{alert.message}
																</p>
																<div
																	className="flex items-center gap-3 mt-2 text-[10px]"
																	style={{ color: "var(--text-faint)" }}
																>
																	<span className="flex items-center gap-1">
																		<Clock className="w-2.5 h-2.5" />
																		{new Date(
																			alert.triggered_at,
																		).toLocaleString("tr-TR")}
																	</span>
																	{alert.resolved_at && (
																		<span
																			className="flex items-center gap-1"
																			style={{ color: "var(--status-up-text)" }}
																		>
																			<ArrowRight className="w-2.5 h-2.5" />
																			{new Date(
																				alert.resolved_at,
																			).toLocaleTimeString("tr-TR")}
																		</span>
																	)}
																</div>
															</div>
															{!alert.resolved_at && (
																<Button
																	variant="outline"
																	size="sm"
																	onClick={() => handleResolve(alert.id)}
																	className="text-[10px] rounded h-7 px-2.5 shrink-0"
																	style={{
																		borderColor: "var(--status-up-border)",
																		color: "var(--status-up-text)",
																	}}
																>
																	<CheckCircle2 className="w-3 h-3 mr-1" /> Çöz
																</Button>
															)}
														</div>
													</Card>
												</div>
											</motion.div>
										);
									})}
								</AnimatePresence>
							</div>
						</div>
					)}
				</>
			)}
		</div>
	);
}

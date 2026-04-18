import { useQuery } from "@tanstack/react-query";
import {
	AlertTriangle,
	ArrowRight,
	Bell,
	CheckCircle2,
	Clock,
	Info,
	RefreshCw,
	Shield,
	Timer,
	XOctagon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { metricsApi } from "@/api/metrics";
import { servicesApi } from "@/api/services";
import { AlertRulesPanel } from "@/components/alerts/AlertRulesPanel";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import {
	EmptyState as SharedEmptyState,
	Panel,
	SkeletonList,
} from "@/components/ui/primitives";
import { type Severity, SeverityBadge } from "@/components/ui/status-atoms";
import type { Alert } from "@/types/alerts";

// ─────────────────────────────────────────────────────────────────────────────

type SeverityFilter = "all" | Severity;

const SEVERITY_ICON = {
	crit: XOctagon,
	warn: AlertTriangle,
	info: Info,
};

const SEVERITY_ACCENT: Record<Severity, string> = {
	crit: "var(--status-down)",
	warn: "var(--status-warn)",
	info: "var(--color-teal)",
};

const SNOOZE_OPTIONS = [
	{ label: "5 dk", minutes: 5 },
	{ label: "15 dk", minutes: 15 },
	{ label: "30 dk", minutes: 30 },
	{ label: "1 saat", minutes: 60 },
	{ label: "4 saat", minutes: 240 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Severity summary tiles

function SeverityTile({
	severity,
	count,
	active,
	onClick,
}: {
	severity: SeverityFilter;
	count: number;
	active: boolean;
	onClick: () => void;
}) {
	const isCount = severity !== "all";
	const accent = isCount
		? SEVERITY_ACCENT[severity as Severity]
		: "var(--color-teal)";
	const bg = isCount
		? severity === "crit"
			? "var(--status-down-subtle)"
			: severity === "warn"
				? "var(--status-warn-subtle)"
				: "var(--color-teal-subtle)"
		: "var(--surface-card)";
	const Icon = isCount ? SEVERITY_ICON[severity as Severity] : Bell;
	const label =
		severity === "all"
			? "Tüm uyarılar"
			: severity === "crit"
				? "Kritik"
				: severity === "warn"
					? "Uyarı"
					: "Bilgi";

	return (
		<button
			type="button"
			onClick={onClick}
			className="relative overflow-hidden p-4 text-left transition-all"
			style={{
				background: active ? bg : "var(--surface-card)",
				border: `1px solid ${active ? accent : "var(--border-default)"}`,
				borderRadius: "var(--radius)",
				boxShadow: active ? "var(--btn-shadow)" : undefined,
			}}
		>
			{active && (
				<span
					className="absolute left-0 top-3 bottom-3 w-0.5 rounded-r-full"
					style={{ background: accent }}
				/>
			)}
			<div className="flex items-center justify-between gap-2">
				<div className="min-w-0">
					<p
						className="text-[11px] font-medium mb-1"
						style={{ color: "var(--text-faint)" }}
					>
						{label}
					</p>
					<p
						className="text-2xl font-semibold tabular-nums font-mono leading-none"
						style={{ color: active ? accent : "var(--text-primary)" }}
					>
						{count}
					</p>
				</div>
				<div
					className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
					style={{ background: "var(--surface-sunken)" }}
				>
					<Icon className="w-4 h-4" style={{ color: accent }} />
				</div>
			</div>
		</button>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Alert row

function AlertRow({
	alert,
	services,
	onResolve,
	onSnooze,
	snoozeOpen,
	onToggleSnooze,
}: {
	alert: Alert;
	services: { id: string; name: string }[];
	onResolve: () => void;
	onSnooze: (minutes: number) => void;
	snoozeOpen: boolean;
	onToggleSnooze: () => void;
}) {
	const accent = SEVERITY_ACCENT[alert.severity];
	const Icon = SEVERITY_ICON[alert.severity];
	const svcName =
		services.find((s) => s.id === alert.service_id)?.name ??
		"Bilinmeyen servis";
	const resolved = !!alert.resolved_at;

	return (
		<div
			className={`relative overflow-hidden transition-opacity ${
				resolved ? "opacity-60" : ""
			}`}
			style={{
				background: "var(--surface-card)",
				border: "1px solid var(--border-default)",
				borderLeft: `3px solid ${accent}`,
				borderRadius: "var(--radius)",
			}}
		>
			<div className="px-4 py-3.5 flex items-start gap-3">
				{/* Severity icon */}
				<div
					className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
					style={{
						background:
							alert.severity === "crit"
								? "var(--status-down-subtle)"
								: alert.severity === "warn"
									? "var(--status-warn-subtle)"
									: "var(--color-teal-subtle)",
					}}
				>
					<Icon
						className={`w-4 h-4 ${
							alert.severity === "crit" && !resolved ? "animate-pulse" : ""
						}`}
						style={{ color: accent }}
					/>
				</div>

				{/* Content */}
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 mb-1.5 flex-wrap">
						<SeverityBadge severity={alert.severity} />
						<span
							className="text-[10px] font-mono px-1.5 py-0.5 rounded"
							style={{
								background: "var(--surface-sunken)",
								color: "var(--text-faint)",
							}}
						>
							{alert.type}
						</span>
						<span
							className="text-xs font-semibold"
							style={{ color: "var(--text-primary)" }}
						>
							{svcName}
						</span>
						{resolved && (
							<span
								className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded"
								style={{
									background: "var(--status-up-subtle)",
									color: "var(--status-up-text)",
								}}
							>
								<CheckCircle2 className="w-2.5 h-2.5" />
								Çözüldü
							</span>
						)}
					</div>
					<p
						className="text-xs leading-relaxed"
						style={{ color: "var(--text-secondary)" }}
					>
						{alert.message}
					</p>
					<div
						className="flex items-center gap-3 mt-2 text-[10px] font-mono"
						style={{ color: "var(--text-faint)" }}
					>
						<span className="inline-flex items-center gap-1">
							<Clock className="w-2.5 h-2.5" />
							{new Date(alert.triggered_at).toLocaleString("tr-TR", {
								dateStyle: "short",
								timeStyle: "short",
							})}
						</span>
						{resolved && alert.resolved_at && (
							<span
								className="inline-flex items-center gap-1"
								style={{ color: "var(--status-up-text)" }}
							>
								<ArrowRight className="w-2.5 h-2.5" />
								{new Date(alert.resolved_at).toLocaleTimeString("tr-TR")}
							</span>
						)}
					</div>
				</div>

				{/* Actions */}
				{!resolved && (
					<div className="flex items-center gap-1.5 shrink-0 relative">
						<Button
							variant="outline"
							size="sm"
							onClick={onToggleSnooze}
							className="h-7 w-7 p-0"
							title="Ertele"
						>
							<Timer className="w-3.5 h-3.5" />
						</Button>

						<Button
							variant="outline"
							size="sm"
							onClick={onResolve}
							className="h-7 px-2.5 text-xs"
							style={{
								borderColor: "var(--status-up-border)",
								color: "var(--status-up-text)",
							}}
						>
							<CheckCircle2 className="w-3 h-3 mr-1" />
							Çöz
						</Button>

						<AnimatePresence>
							{snoozeOpen && (
								<motion.div
									initial={{ opacity: 0, y: -4 }}
									animate={{ opacity: 1, y: 0 }}
									exit={{ opacity: 0, y: -4 }}
									transition={{ duration: 0.12 }}
									className="absolute right-0 top-8 z-10 w-36 rounded-lg overflow-hidden"
									style={{
										background: "var(--surface-overlay)",
										border: "1px solid var(--border-default)",
										boxShadow: "var(--panel-shadow)",
									}}
								>
									{SNOOZE_OPTIONS.map((opt) => (
										<button
											type="button"
											key={opt.minutes}
											onClick={() => onSnooze(opt.minutes)}
											className="w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors hover:bg-[var(--surface-sunken)]"
											style={{ color: "var(--text-secondary)" }}
										>
											<Clock
												className="w-3 h-3"
												style={{ color: "var(--text-muted)" }}
											/>
											{opt.label}
										</button>
									))}
								</motion.div>
							)}
						</AnimatePresence>
					</div>
				)}
			</div>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Page

export function AlertsPage() {
	const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
	const [showResolved, setShowResolved] = useState(false);
	const [snoozeOpenId, setSnoozeOpenId] = useState<string | null>(null);
	const panelRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const handler = (e: MouseEvent) => {
			if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
				setSnoozeOpenId(null);
			}
		};
		if (snoozeOpenId) {
			document.addEventListener("click", handler);
			return () => document.removeEventListener("click", handler);
		}
	}, [snoozeOpenId]);

	const {
		data: alerts = [],
		isLoading,
		refetch,
	} = useQuery({
		queryKey: ["activeAlerts"],
		queryFn: () => metricsApi.getActiveAlerts(),
		refetchInterval: 15_000,
	});

	const { data: services = [] } = useQuery({
		queryKey: ["services"],
		queryFn: servicesApi.list,
		staleTime: 60_000,
	});

	const filtered = useMemo(
		() =>
			alerts
				.filter((a) => {
					if (severityFilter !== "all" && a.severity !== severityFilter)
						return false;
					if (!showResolved && a.resolved_at) return false;
					return true;
				})
				.sort(
					(a, b) =>
						new Date(b.triggered_at).getTime() -
						new Date(a.triggered_at).getTime(),
				),
		[alerts, severityFilter, showResolved],
	);

	const severityCounts = useMemo(() => {
		const c: Record<SeverityFilter, number> = {
			all: alerts.length,
			crit: 0,
			warn: 0,
			info: 0,
		};
		for (const a of alerts) {
			c[a.severity]++;
		}
		return c;
	}, [alerts]);

	const activeCount = alerts.filter((a) => !a.resolved_at).length;

	const handleResolve = async (alertId: string) => {
		try {
			await metricsApi.resolveAlert(alertId);
			toast.success("Uyarı çözüldü");
			refetch();
		} catch {
			toast.error("Uyarı çözülemedi");
		}
	};

	const handleSnooze = async (alertId: string, minutes: number) => {
		setSnoozeOpenId(null);
		try {
			await metricsApi.snoozeAlert(alertId, minutes);
			toast.success(
				`${minutes < 60 ? `${minutes} dk` : `${minutes / 60} saat`} ertelendi`,
			);
			refetch();
		} catch {
			toast.error("Ertelenemedi");
		}
	};

	return (
		<PageShell width="wide" fill>
			<PageHeader
				eyebrow="Uyarılar"
				title="Uyarı merkezi"
				description={
					activeCount > 0
						? `${activeCount} aktif uyarı`
						: "Tüm sistemler normal"
				}
				actions={
					<Button
						variant="ghost"
						size="sm"
						onClick={() => refetch()}
						className="h-8 text-xs"
					>
						<RefreshCw className="w-3.5 h-3.5 mr-1.5" />
						Yenile
					</Button>
				}
			/>

			{/* Severity tiles — compact */}
			<div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 shrink-0">
				{(["all", "crit", "warn", "info"] as const).map((sev) => (
					<SeverityTile
						key={sev}
						severity={sev}
						count={severityCounts[sev]}
						active={severityFilter === sev}
						onClick={() =>
							setSeverityFilter(severityFilter === sev ? "all" : sev)
						}
					/>
				))}
			</div>

			{/* 2-column layout — fills viewport */}
			<div
				className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4"
				ref={panelRef}
			>
				{/* Feed */}
				<Panel
					padding="none"
					className="lg:col-span-8 flex flex-col min-h-0 overflow-hidden"
				>
					{/* Feed header */}
					<div
						className="flex items-center justify-between gap-3 px-4 py-3 shrink-0"
						style={{ borderBottom: "1px solid var(--border-subtle)" }}
					>
						<div className="flex items-center gap-2.5 min-w-0">
							<div
								className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
								style={{
									background:
										activeCount > 0
											? "var(--status-down-subtle)"
											: "var(--status-up-subtle)",
									border: `1px solid ${
										activeCount > 0
											? "var(--status-down-border)"
											: "var(--status-up-border)"
									}`,
								}}
							>
								<Bell
									className="w-3.5 h-3.5"
									style={{
										color:
											activeCount > 0
												? "var(--status-down)"
												: "var(--status-up)",
									}}
								/>
							</div>
							<div className="min-w-0">
								<h3
									className="text-sm font-semibold leading-none"
									style={{ color: "var(--text-primary)" }}
								>
									Akış
								</h3>
								<p
									className="text-[11px] mt-1"
									style={{ color: "var(--text-faint)" }}
								>
									{filtered.length} uyarı gösteriliyor
								</p>
							</div>
						</div>
						<button
							type="button"
							onClick={() => setShowResolved(!showResolved)}
							className="text-xs font-medium transition-colors shrink-0"
							style={{
								color: showResolved
									? "var(--status-up-text)"
									: "var(--text-muted)",
							}}
						>
							{showResolved ? "✓ Çözülmüş dahil" : "Çözülmüşleri göster"}
						</button>
					</div>

					{/* Scrollable feed body */}
					<div className="flex-1 min-h-0 overflow-y-auto p-3">
						{isLoading ? (
							<SkeletonList rows={3} rowHeight={80} />
						) : filtered.length === 0 ? (
							<SharedEmptyState
								icon={Shield}
								title="Tüm sistemler normal"
								description={
									severityFilter !== "all"
										? "Bu filtreye uygun uyarı yok"
										: "Aktif uyarı yok"
								}
								tone="success"
								className="h-full"
							/>
						) : (
							<ul className="flex flex-col gap-2">
								<AnimatePresence mode="popLayout">
									{filtered.map((alert, i) => (
										<motion.li
											key={alert.id}
											layout
											initial={{ opacity: 0, y: 6 }}
											animate={{ opacity: 1, y: 0 }}
											exit={{ opacity: 0, height: 0 }}
											transition={{
												duration: 0.2,
												delay: Math.min(i, 5) * 0.02,
											}}
										>
											<AlertRow
												alert={alert}
												services={services}
												onResolve={() => handleResolve(alert.id)}
												onSnooze={(m) => handleSnooze(alert.id, m)}
												snoozeOpen={snoozeOpenId === alert.id}
												onToggleSnooze={() =>
													setSnoozeOpenId(
														snoozeOpenId === alert.id ? null : alert.id,
													)
												}
											/>
										</motion.li>
									))}
								</AnimatePresence>
							</ul>
						)}
					</div>
				</Panel>

				{/* Rules panel */}
				<Panel
					padding="none"
					className="lg:col-span-4 flex flex-col min-h-0 overflow-hidden"
				>
					<div className="flex-1 min-h-0 overflow-y-auto p-4">
						<AlertRulesPanel />
					</div>
				</Panel>
			</div>
		</PageShell>
	);
}

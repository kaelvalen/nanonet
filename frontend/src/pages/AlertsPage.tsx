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
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { metricsApi } from "@/api/metrics";
import { servicesApi } from "@/api/services";
import { AlertRulesPanel } from "@/components/alerts/AlertRulesPanel";
import { Button } from "@/components/ui/button";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { type Severity, SeverityBadge } from "@/components/ui/status-atoms";
import type { Alert } from "@/types/alerts";

/* AlertsPage — alert center.

   Layout, top to bottom:
   1. Header — page title + refresh.
   2. Severity strip — four flat tiles (All · Crit · Warn · Info). Acts as a
      single-select filter. Toggling the active tile clears the filter.
   3. Two-column body:
      - Feed (8/12): dense list of alerts. Each row uses a thin left accent
        bar to signal severity, plus inline resolve / snooze actions.
      - Rules (4/12): existing AlertRulesPanel mounted as-is. */

// ─────────────────────────────────────────────────────────────────────────────

type SeverityFilter = "all" | Severity;

const SEVERITY_ICON: Record<Severity, React.ElementType> = {
	crit: XOctagon,
	warn: AlertTriangle,
	info: Info,
};

const SEVERITY_TOKENS: Record<
	Severity,
	{ accent: string; text: string; subtle: string; label: string }
> = {
	crit: {
		accent: "var(--status-down)",
		text: "var(--status-down-text)",
		subtle: "var(--status-down-subtle)",
		label: "Kritik",
	},
	warn: {
		accent: "var(--status-degraded)",
		text: "var(--status-degraded-text)",
		subtle: "var(--status-degraded-subtle)",
		label: "Uyarı",
	},
	info: {
		accent: "var(--brand-primary)",
		text: "var(--brand-primary)",
		subtle: "var(--brand-primary-subtle)",
		label: "Bilgi",
	},
};

const SNOOZE_OPTIONS = [
	{ label: "5 dk", minutes: 5 },
	{ label: "15 dk", minutes: 15 },
	{ label: "30 dk", minutes: 30 },
	{ label: "1 saat", minutes: 60 },
	{ label: "4 saat", minutes: 240 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Severity tile

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
	const isAll = severity === "all";
	const tokens = isAll
		? {
				accent: "var(--brand-primary)",
				text: "var(--text-primary)",
				subtle: "var(--brand-primary-subtle)",
				label: "Tüm uyarılar",
			}
		: SEVERITY_TOKENS[severity as Severity];
	const Icon = isAll ? Bell : SEVERITY_ICON[severity as Severity];

	return (
		<button
			type="button"
			onClick={onClick}
			aria-pressed={active}
			className="group relative overflow-hidden p-3.5 text-left transition-colors rounded-[6px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
			style={{
				background: "var(--surface-base)",
				border: `1px solid ${active ? tokens.accent : "var(--border-subtle)"}`,
			}}
		>
			{active && (
				<span
					aria-hidden
					className="absolute left-0 top-3 bottom-3 w-[2px] rounded-r-full"
					style={{ background: tokens.accent }}
				/>
			)}
			<div className="relative flex items-center justify-between gap-2 pl-1">
				<div className="min-w-0">
					<p
						className="text-[10px] uppercase tracking-wider font-semibold mb-1.5"
						style={{ color: "var(--text-faint)" }}
					>
						{tokens.label}
					</p>
					<p
						className="text-[24px] font-semibold tnum leading-none"
						style={{
							color: active ? tokens.accent : "var(--text-primary)",
						}}
					>
						{count}
					</p>
				</div>
				<div
					className="w-9 h-9 rounded-[6px] flex items-center justify-center shrink-0"
					style={{
						background: "var(--surface-sunken)",
						border: "1px solid var(--border-subtle)",
					}}
				>
					<Icon className="w-4 h-4" style={{ color: tokens.accent }} />
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
}: {
	alert: Alert;
	services: { id: string; name: string }[];
	onResolve: () => void;
	onSnooze: (minutes: number) => void;
}) {
	const tokens = SEVERITY_TOKENS[alert.severity];
	const Icon = SEVERITY_ICON[alert.severity];
	const svcName =
		services.find((s) => s.id === alert.service_id)?.name ??
		"Bilinmeyen servis";
	const resolved = !!alert.resolved_at;

	return (
		<div
			className={`relative rounded-[6px] transition-opacity ${
				resolved ? "opacity-60" : ""
			}`}
			style={{
				background: "var(--surface-base)",
				border: "1px solid var(--border-subtle)",
			}}
		>
			<span
				aria-hidden
				className="absolute left-0 top-2 bottom-2 w-[2px] rounded-r-full"
				style={{ background: tokens.accent }}
			/>
			<div className="px-4 py-3 flex items-start gap-3">
				<div
					className="w-8 h-8 rounded-[6px] flex items-center justify-center shrink-0 mt-0.5"
					style={{
						background: "var(--surface-sunken)",
						border: "1px solid var(--border-subtle)",
					}}
				>
					<Icon className="w-4 h-4" style={{ color: tokens.accent }} />
				</div>

				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 mb-1.5 flex-wrap">
						<SeverityBadge severity={alert.severity} />
						<span
							className="text-[10px] font-mono px-1.5 py-0.5 rounded-[4px]"
							style={{
								background: "var(--surface-sunken)",
								border: "1px solid var(--border-subtle)",
								color: "var(--text-tertiary)",
							}}
						>
							{alert.type}
						</span>
						<span
							className="text-[13px] font-medium"
							style={{ color: "var(--text-primary)" }}
						>
							{svcName}
						</span>
						{resolved && (
							<span
								className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-[4px]"
								style={{
									background: "var(--status-up-subtle)",
									color: "var(--status-up-text)",
								}}
							>
								<CheckCircle2 className="w-3 h-3" />
								Çözüldü
							</span>
						)}
					</div>
					<p
						className="text-[13px] leading-relaxed"
						style={{ color: "var(--text-secondary)" }}
					>
						{alert.message}
					</p>
					<div
						className="flex items-center gap-3 mt-2 text-[11px] tnum"
						style={{ color: "var(--text-faint)" }}
					>
						<span className="inline-flex items-center gap-1">
							<Clock className="w-3 h-3" />
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
								<ArrowRight className="w-3 h-3" />
								{new Date(alert.resolved_at).toLocaleTimeString("tr-TR")}
							</span>
						)}
					</div>
				</div>

				{!resolved && (
					<div className="flex items-center gap-1.5 shrink-0">
						<Popover>
							<PopoverTrigger asChild>
								<Button
									variant="ghost"
									size="icon"
									className="h-8 w-8"
									title="Ertele"
								>
									<Timer className="w-3.5 h-3.5" />
									<span className="sr-only">Ertele</span>
								</Button>
							</PopoverTrigger>
							<PopoverContent align="end" className="w-44 p-1">
								<p
									className="text-[10px] uppercase tracking-wider font-semibold px-2 pt-1.5 pb-1"
									style={{ color: "var(--text-faint)" }}
								>
									Ertele
								</p>
								{SNOOZE_OPTIONS.map((opt) => (
									<button
										type="button"
										key={opt.minutes}
										onClick={() => onSnooze(opt.minutes)}
										className="w-full flex items-center gap-2 px-2 py-1.5 rounded-[4px] text-[12px] transition-colors hover:bg-[var(--surface-sunken)] outline-none focus-visible:bg-[var(--surface-sunken)]"
										style={{ color: "var(--text-secondary)" }}
									>
										<Clock
											className="w-3.5 h-3.5"
											style={{ color: "var(--text-tertiary)" }}
										/>
										{opt.label}
									</button>
								))}
							</PopoverContent>
						</Popover>

						<Button
							variant="outline"
							size="sm"
							onClick={onResolve}
							className="h-8"
						>
							<CheckCircle2 className="w-3.5 h-3.5 mr-1" />
							Çöz
						</Button>
					</div>
				)}
			</div>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton + empty

function FeedSkeleton() {
	return (
		<ul className="flex flex-col gap-2">
			{[0, 1, 2].map((i) => (
				<li
					key={i}
					className="rounded-[6px] p-4 animate-pulse"
					style={{
						background: "var(--surface-base)",
						border: "1px solid var(--border-subtle)",
					}}
				>
					<div className="flex items-start gap-3">
						<div
							className="w-8 h-8 rounded-[6px] shrink-0"
							style={{ background: "var(--surface-sunken)" }}
						/>
						<div className="flex-1 space-y-2">
							<div
								className="h-3 w-1/3 rounded"
								style={{ background: "var(--surface-sunken)" }}
							/>
							<div
								className="h-3 w-3/4 rounded"
								style={{ background: "var(--surface-sunken)" }}
							/>
							<div
								className="h-3 w-1/4 rounded"
								style={{ background: "var(--surface-sunken)" }}
							/>
						</div>
					</div>
				</li>
			))}
		</ul>
	);
}

function FeedEmpty({
	tone,
	title,
	description,
}: {
	tone: "success" | "neutral";
	title: string;
	description: string;
}) {
	const color =
		tone === "success" ? "var(--status-up)" : "var(--text-tertiary)";
	return (
		<div className="flex flex-col items-center gap-3 h-full justify-center text-center py-12 px-6">
			<div
				className="w-12 h-12 rounded-[6px] flex items-center justify-center"
				style={{
					background: "var(--surface-sunken)",
					border: "1px solid var(--border-subtle)",
				}}
			>
				<Shield className="w-5 h-5" style={{ color }} />
			</div>
			<p
				className="text-[14px] font-semibold"
				style={{ color: "var(--text-primary)" }}
			>
				{title}
			</p>
			<p
				className="text-[12px] max-w-[280px] leading-relaxed"
				style={{ color: "var(--text-tertiary)" }}
			>
				{description}
			</p>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
// Page

export function AlertsPage() {
	const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
	const [showResolved, setShowResolved] = useState(false);

	const {
		data: alerts = [],
		isLoading,
		refetch,
		isFetching,
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
						: "Tüm sistemler normal."
				}
				actions={
					<Button
						variant="ghost"
						size="sm"
						onClick={() => refetch()}
						disabled={isFetching}
					>
						<RefreshCw
							className={`w-3.5 h-3.5 mr-1.5 ${isFetching ? "animate-spin" : ""}`}
						/>
						Yenile
					</Button>
				}
			/>

			{/* Severity strip */}
			<div
				role="radiogroup"
				aria-label="Önem seviyesi filtresi"
				className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 shrink-0"
			>
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

			{/* Two-column body */}
			<div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3">
				{/* Feed */}
				<section
					aria-label="Uyarı akışı"
					className="lg:col-span-8 flex flex-col min-h-0 overflow-hidden rounded-[6px]"
					style={{
						background: "var(--surface-base)",
						border: "1px solid var(--border-subtle)",
					}}
				>
					<header
						className="flex items-center justify-between gap-3 px-4 py-3 shrink-0"
						style={{ borderBottom: "1px solid var(--border-subtle)" }}
					>
						<div className="flex items-center gap-2 min-w-0">
							<h3
								className="text-[13px] font-semibold"
								style={{ color: "var(--text-primary)" }}
							>
								Akış
							</h3>
							<span
								className="text-[11px] tnum"
								style={{ color: "var(--text-tertiary)" }}
							>
								· {filtered.length} / {alerts.length}
							</span>
						</div>
						<button
							type="button"
							onClick={() => setShowResolved(!showResolved)}
							aria-pressed={showResolved}
							className="text-[11px] font-medium transition-colors shrink-0 px-2.5 h-7 rounded-[4px] inline-flex items-center gap-1.5 outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
							style={{
								background: showResolved
									? "var(--status-up-subtle)"
									: "var(--surface-sunken)",
								color: showResolved
									? "var(--status-up-text)"
									: "var(--text-tertiary)",
								border: `1px solid ${showResolved ? "var(--status-up-border)" : "var(--border-subtle)"}`,
							}}
						>
							{showResolved ? (
								<>
									<CheckCircle2 className="w-3 h-3" />
									Çözülmüşler dahil
								</>
							) : (
								"Çözülmüşleri göster"
							)}
						</button>
					</header>

					<div className="flex-1 min-h-0 overflow-y-auto p-3">
						{isLoading ? (
							<FeedSkeleton />
						) : filtered.length === 0 ? (
							<FeedEmpty
								tone={severityFilter === "all" ? "success" : "neutral"}
								title={
									severityFilter === "all" && !showResolved
										? "Tüm sistemler normal"
										: "Eşleşen uyarı yok"
								}
								description={
									severityFilter !== "all"
										? "Bu filtreye uygun uyarı bulunmuyor."
										: "Aktif uyarı yok."
								}
							/>
						) : (
							<ul className="flex flex-col gap-2">
								<AnimatePresence mode="popLayout">
									{filtered.map((alert, i) => (
										<motion.li
											key={alert.id}
											layout
											initial={{ opacity: 0, y: 4 }}
											animate={{ opacity: 1, y: 0 }}
											exit={{ opacity: 0, height: 0 }}
											transition={{
												duration: 0.18,
												delay: Math.min(i, 5) * 0.02,
											}}
										>
											<AlertRow
												alert={alert}
												services={services}
												onResolve={() => handleResolve(alert.id)}
												onSnooze={(m) => handleSnooze(alert.id, m)}
											/>
										</motion.li>
									))}
								</AnimatePresence>
							</ul>
						)}
					</div>
				</section>

				{/* Rules */}
				<section
					aria-label="Uyarı kuralları"
					className="lg:col-span-4 flex flex-col min-h-0 overflow-hidden rounded-[6px]"
					style={{
						background: "var(--surface-base)",
						border: "1px solid var(--border-subtle)",
					}}
				>
					<div className="flex-1 min-h-0 overflow-y-auto p-4">
						<AlertRulesPanel />
					</div>
				</section>
			</div>
		</PageShell>
	);
}

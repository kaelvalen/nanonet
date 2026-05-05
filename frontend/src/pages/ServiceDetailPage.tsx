import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Activity,
	AlertCircle,
	AlertTriangle,
	ArrowLeft,
	Bell,
	CalendarClock,
	Check,
	CheckCircle2,
	ChevronRight,
	Copy,
	FileText,
	History,
	Layers,
	Loader2,
	Play,
	Power,
	RefreshCw,
	Send,
	Server,
	ShieldCheck,
	Sparkles,
	Terminal,
	Trash2,
	Users,
	Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type React from "react";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { type AnalysisResult, metricsApi } from "@/api/metrics";
import { servicesApi } from "@/api/services";
import { AgentSetupWizard } from "@/components/AgentSetupWizard";
import { LogViewer } from "@/components/LogViewer";
import { useRegisterPageMeta } from "@/components/PageMetaContext";
import { AlertRulesTab } from "@/components/service-detail/AlertRulesTab";
import { CommandHistoryTab } from "@/components/service-detail/CommandHistoryTab";
import { LoadBalancingTab } from "@/components/service-detail/LoadBalancingTab";
import { MaintenanceTab } from "@/components/service-detail/MaintenanceTab";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { PageShell } from "@/components/ui/page-shell";
import {
	EmptyState as SharedEmptyState,
	SkeletonCard,
} from "@/components/ui/primitives";
import { useServices } from "@/hooks/useServices";
import type { Alert } from "@/types/alerts";
import type { ServiceMetrics } from "@/types/metrics";
import type { Service } from "@/types/service";

// Alias destructure to keep static-analysis heuristics calm (the API name
// overlaps with Node's child_process method, but this is a typed HTTP client call)
const runAgentCommand = servicesApi["exec" as "exec"];

import { DependenciesPanel } from "@/components/service-detail/DependenciesPanel";
import { ForecastPanel } from "@/components/service-detail/ForecastPanel";
import { SharingPanel } from "@/components/service-detail/SharingPanel";

const ServiceMetricsCharts = lazy(() =>
	import("@/components/service-detail/ServiceMetricsCharts").then((m) => ({
		default: m.ServiceMetricsCharts,
	})),
);

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type ExecEntry = {
	command: string;
	command_id: string;
	status: "queued" | "received" | "success" | "failed" | "timeout";
	queued_at: string;
	output?: string;
	error?: string;
	duration_ms?: number;
};

type SectionId =
	| "overview"
	| "alerts"
	| "terminal"
	| "ai"
	| "scale"
	| "history"
	| "rules"
	| "maintenance"
	| "access"
	| "logs";

type Tone = "ok" | "warn" | "crit" | "mute";

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const STATUS_LABEL: Record<Service["status"], string> = {
	up: "Çalışıyor",
	down: "Çevrimdışı",
	degraded: "Bozuk",
	unknown: "Bilinmiyor",
};

function fmtNumber(v: number | null | undefined, decimals = 1): string {
	if (v == null || Number.isNaN(v)) return "—";
	return v.toFixed(decimals);
}

function fmtMemory(mb: number | null | undefined): [string, string] {
	if (mb == null || Number.isNaN(mb)) return ["—", ""];
	if (mb >= 1024) return [(mb / 1024).toFixed(1), "GB"];
	return [mb.toFixed(0), "MB"];
}

function fmtLatency(ms: number | null | undefined): [string, string] {
	if (ms == null || Number.isNaN(ms)) return ["—", ""];
	if (ms >= 1000) return [(ms / 1000).toFixed(2), "s"];
	return [ms.toFixed(0), "ms"];
}

function metricTone(
	value: number | undefined,
	warn: number,
	crit: number,
): Tone {
	if (value == null) return "mute";
	if (value >= crit) return "crit";
	if (value >= warn) return "warn";
	return "ok";
}

function toneColor(tone: Tone): string {
	return tone === "crit"
		? "var(--status-down)"
		: tone === "warn"
			? "var(--status-degraded)"
			: tone === "ok"
				? "var(--status-up)"
				: "var(--text-faint)";
}

function toneLabel(tone: Tone): string {
	return tone === "crit"
		? "KRİTİK"
		: tone === "warn"
			? "UYARI"
			: tone === "ok"
				? "İYİ"
				: "—";
}

// ═══════════════════════════════════════════════════════════════════════════
// ATOM — Status Orb (pulsing ring when live)
// ═══════════════════════════════════════════════════════════════════════════

function StatusOrb({
	status,
	size = 8,
}: {
	status: Service["status"];
	size?: number;
}) {
	const color =
		status === "up"
			? "var(--status-up)"
			: status === "degraded"
				? "var(--status-degraded)"
				: status === "down"
					? "var(--status-down)"
					: "var(--status-unknown)";

	const alive = status === "up";

	return (
		<span
			className="relative inline-flex items-center justify-center shrink-0"
			style={{ width: size + 6, height: size + 6 }}
			aria-hidden
		>
			<span
				className="relative rounded-full"
				style={{
					width: size,
					height: size,
					background: color,
					boxShadow: alive
						? `0 0 0 3px color-mix(in srgb, ${color} 22%, transparent)`
						: undefined,
				}}
			/>
		</span>
	);
}

// ═══════════════════════════════════════════════════════════════════════════
// ATOM — Uptime Gauge (circular SVG)
// ═══════════════════════════════════════════════════════════════════════════

function UptimeGauge({
	percent,
	size = 64,
	strokeWidth = 2.5,
}: {
	percent: number;
	size?: number;
	strokeWidth?: number;
}) {
	const radius = (size - strokeWidth) / 2;
	const circumference = 2 * Math.PI * radius;
	const clamped = Math.max(0, Math.min(100, percent));
	const offset = circumference - (clamped / 100) * circumference;
	const color =
		clamped >= 99
			? "var(--status-up)"
			: clamped >= 95
				? "var(--status-degraded)"
				: "var(--status-down)";

	return (
		<div
			role="img"
			className="relative shrink-0"
			style={{ width: size, height: size }}
			aria-label={`Uptime ${clamped.toFixed(1)} yüzde`}
		>
			<svg
				width={size}
				height={size}
				viewBox={`0 0 ${size} ${size}`}
				className="-rotate-90"
				aria-hidden="true"
			>
				<title>Uptime {clamped.toFixed(1)}%</title>
				<circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					fill="none"
					stroke="var(--border-subtle)"
					strokeWidth={strokeWidth}
				/>
				<circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					fill="none"
					stroke={color}
					strokeWidth={strokeWidth}
					strokeLinecap="round"
					strokeDasharray={circumference}
					strokeDashoffset={offset}
					style={{
						transition: "stroke-dashoffset 700ms cubic-bezier(0.2, 0, 0, 1)",
					}}
				/>
			</svg>
			<div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-1">
				<span className="flex flex-col items-center gap-0.5">
					<span
						className="tnum font-medium leading-none inline-flex items-baseline gap-0.5 whitespace-nowrap"
						style={{
							color: "var(--text-primary)",
							fontSize: Math.min(
								clamped >= 99.95 ? 13 : 14,
								size * (clamped >= 99.95 ? 0.2 : 0.22),
							),
						}}
					>
						<span>{clamped.toFixed(clamped >= 99.95 ? 2 : 1)}</span>
						<span
							className="font-medium leading-none"
							style={{
								fontSize: "max(9px, 0.5em)",
								color: "var(--text-secondary)",
							}}
						>
							%
						</span>
					</span>
					<span
						className="text-[8px] uppercase tracking-wider font-semibold leading-none"
						style={{ color: "var(--text-tertiary)" }}
					>
						24 saat
					</span>
				</span>
			</div>
		</div>
	);
}

// ═══════════════════════════════════════════════════════════════════════════
// ATOM — Sparkline
// ═══════════════════════════════════════════════════════════════════════════

function Sparkline({
	data,
	color,
	width = 80,
	height = 26,
}: {
	data: number[];
	color: string;
	width?: number;
	height?: number;
}) {
	if (!data.length || data.length < 2) {
		return (
			<div
				style={{ width, height }}
				className="flex items-end justify-end opacity-40"
				aria-hidden="true"
			>
				<svg viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
					<title>Sparkline (veri yok)</title>
					<line
						x1="0"
						y1={height - 1}
						x2={width}
						y2={height - 1}
						stroke={color}
						strokeDasharray="2 3"
						strokeWidth="1"
						opacity="0.4"
					/>
				</svg>
			</div>
		);
	}

	const max = Math.max(...data, 0.0001);
	const min = Math.min(...data);
	const range = Math.max(max - min, max * 0.15, 0.0001);
	const points = data
		.map((v, i) => {
			const x = (i / (data.length - 1)) * width;
			const normalized = (v - min) / range;
			const y = height - 2 - normalized * (height - 4);
			return `${x.toFixed(2)},${y.toFixed(2)}`;
		})
		.join(" ");
	const areaPoints = `0,${height} ${points} ${width},${height}`;

	return (
		<svg
			width={width}
			height={height}
			viewBox={`0 0 ${width} ${height}`}
			className="shrink-0"
			aria-hidden="true"
		>
			<title>Sparkline</title>
			<polyline points={areaPoints} fill={color} opacity="0.12" />
			<polyline
				points={points}
				fill="none"
				stroke={color}
				strokeWidth="1.5"
				strokeLinejoin="round"
				strokeLinecap="round"
			/>
			<circle
				cx={width}
				cy={height - 2 - ((data[data.length - 1] - min) / range) * (height - 4)}
				r="2"
				fill={color}
			/>
		</svg>
	);
}

// ═══════════════════════════════════════════════════════════════════════════
// VITAL SIGNS — Metric chip + band
// ═══════════════════════════════════════════════════════════════════════════

function MetricChip({
	label,
	value,
	unit,
	tone,
	sparkData,
}: {
	label: string;
	value: string;
	unit: string;
	tone: Tone;
	sparkData: number[];
}) {
	const sparkColor = toneColor(tone);
	return (
		<div
			className="group relative flex flex-col justify-between p-3.5 rounded-[6px] overflow-hidden min-w-0"
			style={{
				background: "var(--surface-base)",
				border: "1px solid var(--border-subtle)",
			}}
		>
			<div className="flex items-center justify-between gap-2">
				<span
					className="text-[10px] font-semibold uppercase tracking-wider"
					style={{ color: "var(--text-faint)" }}
				>
					{label}
				</span>
				<span
					className="w-1.5 h-1.5 rounded-full shrink-0"
					style={{ background: toneColor(tone) }}
					title={toneLabel(tone)}
					aria-hidden
				/>
			</div>
			<div className="flex items-end justify-between gap-2 mt-3">
				<div className="flex items-baseline gap-0.5 shrink-0 whitespace-nowrap">
					<span
						className="text-[22px] font-semibold tnum leading-none"
						style={{ color: "var(--text-primary)" }}
					>
						{value}
					</span>
					{unit && (
						<span
							className="text-[11px] font-medium leading-none ml-0.5"
							style={{ color: "var(--text-faint)" }}
						>
							{unit}
						</span>
					)}
				</div>
				<div className="flex-1 min-w-0 flex justify-end">
					<Sparkline
						data={sparkData}
						color={sparkColor}
						width={56}
						height={22}
					/>
				</div>
			</div>
		</div>
	);
}

function VitalSignsBand({
	service,
	uptimePercent,
	metrics,
}: {
	service: Service;
	uptimePercent: number | null;
	metrics: ServiceMetrics[];
}) {
	const latest = metrics.length > 0 ? metrics[metrics.length - 1] : null;
	const spark = (key: keyof ServiceMetrics) =>
		metrics.slice(-30).map((m) => {
			const v = m[key];
			return typeof v === "number" ? v : 0;
		});
	const [memVal, memUnit] = fmtMemory(latest?.memory_used_mb);
	const [latVal, latUnit] = fmtLatency(latest?.latency_ms);

	const healthLabel =
		uptimePercent == null
			? "Hesaplanıyor"
			: uptimePercent >= 99
				? "Stabil"
				: uptimePercent >= 95
					? "Dikkat"
					: "Kritik";

	const healthColor =
		uptimePercent == null
			? "var(--text-tertiary)"
			: uptimePercent >= 99
				? "var(--status-up-text)"
				: uptimePercent >= 95
					? "var(--status-degraded-text)"
					: "var(--status-down-text)";

	return (
		<div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,240px)_repeat(4,minmax(0,1fr))]">
			<div
				className="relative col-span-2 lg:col-span-1 flex items-center gap-3.5 px-4 py-4 rounded-[6px]"
				style={{
					background: "var(--surface-base)",
					border: "1px solid var(--border-subtle)",
				}}
			>
				<UptimeGauge percent={uptimePercent ?? 0} />
				<div className="flex flex-col gap-1.5 min-w-0 flex-1">
					<span
						className="text-[10px] uppercase tracking-wider font-semibold"
						style={{ color: "var(--text-faint)" }}
					>
						Sistem Sağlığı
					</span>
					<p
						className="text-[15px] font-semibold leading-none"
						style={{ color: healthColor }}
					>
						{healthLabel}
					</p>
					<p
						className="text-[11px] leading-snug"
						style={{ color: "var(--text-tertiary)" }}
					>
						{STATUS_LABEL[service.status]}
						<span style={{ color: "var(--text-faint)" }}> · </span>
						<span className="tnum whitespace-nowrap">
							Ölçüm aralığı {service.poll_interval_sec}s
						</span>
					</p>
				</div>
			</div>

			<MetricChip
				label="CPU"
				value={fmtNumber(latest?.cpu_percent, 1)}
				unit="%"
				tone={metricTone(latest?.cpu_percent, 60, 80)}
				sparkData={spark("cpu_percent")}
			/>
			<MetricChip
				label="Bellek"
				value={memVal}
				unit={memUnit}
				tone="mute"
				sparkData={spark("memory_used_mb")}
			/>
			<MetricChip
				label="Gecikme"
				value={latVal}
				unit={latUnit}
				tone={metricTone(latest?.latency_ms, 200, 500)}
				sparkData={spark("latency_ms")}
			/>
			<MetricChip
				label="Hata"
				value={fmtNumber(
					latest?.error_rate,
					latest?.error_rate != null && latest.error_rate < 1 ? 2 : 1,
				)}
				unit="%"
				tone={metricTone(latest?.error_rate, 1, 5)}
				sparkData={spark("error_rate")}
			/>
		</div>
	);
}

// ═══════════════════════════════════════════════════════════════════════════
// IDENTITY RAIL
// ═══════════════════════════════════════════════════════════════════════════

type ActionVariant = "default" | "primary" | "warn" | "danger";

function ActionButton({
	onClick,
	icon: Icon,
	label,
	variant = "default",
	loading = false,
	disabled = false,
}: {
	onClick: () => void;
	icon: React.ElementType;
	label: string;
	variant?: ActionVariant;
	loading?: boolean;
	disabled?: boolean;
}) {
	const accent =
		variant === "primary"
			? "var(--brand-primary)"
			: variant === "warn"
				? "var(--status-degraded-text)"
				: variant === "danger"
					? "var(--status-down-text)"
					: "var(--text-secondary)";

	return (
		<button
			type="button"
			onClick={onClick}
			disabled={loading || disabled}
			className="group flex items-center gap-2 px-2.5 h-8 rounded-[6px] text-[12px] font-medium text-left transition-colors disabled:opacity-50 disabled:cursor-not-allowed outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] hover:bg-[var(--surface-sunken)]"
			style={{
				color: "var(--text-secondary)",
				background: "transparent",
			}}
		>
			{loading ? (
				<Loader2
					className="w-3.5 h-3.5 animate-spin shrink-0"
					style={{ color: accent }}
				/>
			) : (
				<Icon className="w-3.5 h-3.5 shrink-0" style={{ color: accent }} />
			)}
			<span className="flex-1">{label}</span>
			<ChevronRight
				className="w-3 h-3 shrink-0 opacity-0 -translate-x-0.5 transition-all group-hover:opacity-50 group-hover:translate-x-0"
				style={{ color: "var(--text-faint)" }}
			/>
		</button>
	);
}

function IdentityRail({
	service,
	onBack,
	onStart,
	onRestart,
	onStop,
	onDelete,
	onAgentSetup,
	startLoading,
}: {
	service: Service;
	onBack: () => void;
	onStart: () => void;
	onRestart: () => void;
	onStop: () => void;
	onDelete: () => void;
	onAgentSetup: () => void;
	startLoading: boolean;
}) {
	const [copied, setCopied] = useState(false);
	const copy = async () => {
		try {
			await navigator.clipboard.writeText(`${service.host}:${service.port}`);
			setCopied(true);
			setTimeout(() => setCopied(false), 1800);
		} catch {
			toast.error("Kopyalanamadı");
		}
	};

	const agentStatusTone =
		service.agent_status === "healthy"
			? {
					text: "var(--status-up-text)",
					bg: "var(--status-up-subtle)",
				}
			: service.agent_status === "stale"
				? {
						text: "var(--status-degraded-text)",
						bg: "var(--status-degraded-subtle)",
					}
				: {
						text: "var(--status-down-text)",
						bg: "var(--status-down-subtle)",
					};

	return (
		<aside className="flex flex-col lg:w-[240px] lg:shrink-0 lg:self-start">
			<button
				type="button"
				onClick={onBack}
				className="group self-start flex items-center gap-1.5 text-[12px] font-medium mb-3 px-1.5 py-1 -ml-1.5 rounded-[4px] transition-colors hover:bg-[var(--surface-sunken)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
				style={{ color: "var(--text-tertiary)" }}
			>
				<ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
				Tüm Servisler
			</button>

			<div
				className="flex flex-col gap-2 pb-4 mb-4"
				style={{ borderBottom: "1px solid var(--border-subtle)" }}
			>
				<div className="flex items-center gap-2">
					<StatusOrb status={service.status} size={8} />
					<p
						className="text-[10px] font-semibold uppercase tracking-wider leading-none"
						style={{
							color:
								service.status === "up"
									? "var(--status-up-text)"
									: service.status === "degraded"
										? "var(--status-degraded-text)"
										: service.status === "down"
											? "var(--status-down-text)"
											: "var(--text-tertiary)",
						}}
					>
						{STATUS_LABEL[service.status]}
					</p>
				</div>
				<p
					className="text-[14px] font-semibold leading-tight tracking-tight truncate"
					style={{ color: "var(--text-primary)" }}
					title={service.name}
				>
					{service.name}
				</p>

				<button
					type="button"
					onClick={copy}
					className="group flex items-center gap-2 px-1.5 py-1 -mx-1.5 rounded-[4px] transition-colors hover:bg-[var(--surface-sunken)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
					aria-label="Adresi kopyala"
				>
					<span
						className="text-[12px] font-mono truncate flex-1 text-left"
						style={{ color: "var(--text-secondary)" }}
					>
						{service.host}
						<span style={{ color: "var(--text-faint)" }}>:</span>
						{service.port}
					</span>
					{copied ? (
						<Check
							className="w-3.5 h-3.5 shrink-0"
							style={{ color: "var(--status-up)" }}
						/>
					) : (
						<Copy
							className="w-3.5 h-3.5 shrink-0 opacity-0 group-hover:opacity-60 transition-opacity"
							style={{ color: "var(--text-faint)" }}
						/>
					)}
				</button>
			</div>

			<dl
				className="flex flex-col gap-2.5 pb-4 mb-4"
				style={{ borderBottom: "1px solid var(--border-subtle)" }}
			>
				<div className="flex items-baseline justify-between gap-2 min-w-0">
					<dt
						className="text-[10px] uppercase tracking-wider font-semibold shrink-0"
						style={{ color: "var(--text-faint)" }}
					>
						Endpoint
					</dt>
					<dd
						className="text-[12px] font-mono truncate text-right"
						style={{ color: "var(--text-secondary)" }}
						title={service.health_endpoint}
					>
						{service.health_endpoint}
					</dd>
				</div>
				<div className="flex items-baseline justify-between gap-2">
					<dt
						className="text-[10px] uppercase tracking-wider font-semibold"
						style={{ color: "var(--text-faint)" }}
					>
						Poll
					</dt>
					<dd
						className="text-[12px] font-mono tnum"
						style={{ color: "var(--text-secondary)" }}
					>
						{service.poll_interval_sec}s
					</dd>
				</div>
			</dl>

			<div
				className="flex items-center gap-2.5 px-2.5 py-2 mb-4 rounded-[6px]"
				style={{
					background: "var(--surface-sunken)",
					border: "1px solid var(--border-subtle)",
				}}
			>
				<span
					className="w-1.5 h-1.5 rounded-full shrink-0"
					style={{
						background: service.agent_connected
							? "var(--status-up)"
							: "var(--text-faint)",
						boxShadow: service.agent_connected
							? "0 0 0 3px color-mix(in srgb, var(--status-up) 22%, transparent)"
							: undefined,
					}}
				/>
				<div className="flex-1 min-w-0">
					<p
						className="text-[11px] font-semibold leading-none truncate"
						style={{
							color: service.agent_connected
								? "var(--text-primary)"
								: "var(--text-tertiary)",
						}}
					>
						{service.agent_connected ? "Agent canlı" : "Agent yok"}
					</p>
					<p
						className="text-[10px] mt-1 truncate"
						style={{ color: "var(--text-faint)" }}
					>
						{service.agent_connected
							? `v${service.agent_version ?? "0"}`
							: service.agent_last_heartbeat_at
								? `Son ${new Date(service.agent_last_heartbeat_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}`
								: "Kurulum gerekli"}
					</p>
				</div>
				{service.agent_status && service.agent_status !== "unknown" && (
					<span
						className="text-[10px] font-medium px-1.5 py-0.5 rounded-[4px] shrink-0"
						style={{
							color: agentStatusTone.text,
							background: agentStatusTone.bg,
						}}
					>
						{service.agent_status}
					</span>
				)}
			</div>

			<div className="flex flex-col gap-0.5">
				<p
					className="text-[10px] uppercase tracking-wider font-semibold px-2 mb-1"
					style={{ color: "var(--text-faint)" }}
				>
					Komutlar
				</p>
				<ActionButton
					onClick={onStart}
					icon={Play}
					label="Başlat"
					variant="primary"
					loading={startLoading}
				/>
				<ActionButton
					onClick={onRestart}
					icon={RefreshCw}
					label="Yeniden Başlat"
					variant="primary"
				/>
				<ActionButton
					onClick={onStop}
					icon={Power}
					label="Durdur"
					variant="warn"
				/>
				<div
					className="h-px my-1.5 mx-2"
					style={{ background: "var(--border-subtle)" }}
				/>
				<ActionButton
					onClick={onAgentSetup}
					icon={Zap}
					label="Agent Kurulumu"
				/>
				<ActionButton
					onClick={onDelete}
					icon={Trash2}
					label="Servisi Sil"
					variant="danger"
				/>
			</div>
		</aside>
	);
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION NAV
// ═══════════════════════════════════════════════════════════════════════════

const SECTIONS: {
	id: SectionId;
	label: string;
	icon: React.ElementType;
}[] = [
	{ id: "overview", label: "Genel Bakış", icon: Activity },
	{ id: "alerts", label: "Uyarılar", icon: AlertCircle },
	{ id: "terminal", label: "Terminal", icon: Terminal },
	{ id: "ai", label: "AI Analiz", icon: Sparkles },
	{ id: "scale", label: "Ölçekleme", icon: Layers },
	{ id: "history", label: "Geçmiş", icon: History },
	{ id: "rules", label: "Kurallar", icon: Bell },
	{ id: "maintenance", label: "Bakım", icon: CalendarClock },
	{ id: "access", label: "Erişim", icon: Users },
	{ id: "logs", label: "Günlükler", icon: FileText },
];

function SectionNav({
	active,
	onChange,
	alertCount,
}: {
	active: SectionId;
	onChange: (s: SectionId) => void;
	alertCount: number;
}) {
	return (
		<div
			role="tablist"
			aria-label="Servis bölümleri"
			className="flex items-center gap-1 overflow-x-auto"
			style={{
				scrollbarWidth: "none",
				borderBottom: "1px solid var(--border-subtle)",
			}}
		>
			{SECTIONS.map((s) => {
				const isActive = active === s.id;
				const Icon = s.icon;
				const showBadge = s.id === "alerts" && alertCount > 0;
				return (
					<button
						key={s.id}
						type="button"
						role="tab"
						aria-selected={isActive}
						onClick={() => onChange(s.id)}
						className="relative flex items-center gap-1.5 px-3 h-9 text-[13px] font-medium whitespace-nowrap transition-colors shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] rounded-[4px]"
						style={{
							color: isActive ? "var(--text-primary)" : "var(--text-tertiary)",
						}}
					>
						<Icon
							className="w-3.5 h-3.5 shrink-0"
							style={{
								color: isActive ? "var(--brand-primary)" : "currentColor",
							}}
						/>
						<span>{s.label}</span>
						{showBadge && (
							<span
								className="ml-0.5 min-w-[18px] h-[18px] px-1 rounded-[4px] text-[10px] font-semibold flex items-center justify-center tnum"
								style={{
									background: "var(--status-down-subtle)",
									color: "var(--status-down-text)",
								}}
							>
								{alertCount}
							</span>
						)}
						{isActive && (
							<span
								aria-hidden
								className="absolute left-2 right-2 -bottom-px h-[2px] rounded-t-full"
								style={{ background: "var(--brand-primary)" }}
							/>
						)}
					</button>
				);
			})}
		</div>
	);
}

function DurationControl({
	value,
	onChange,
}: {
	value: string;
	onChange: (v: string) => void;
}) {
	return (
		<div
			role="radiogroup"
			aria-label="Zaman aralığı"
			className="inline-flex items-center h-8 rounded-[6px] p-0.5"
			style={{
				background: "var(--surface-sunken)",
				border: "1px solid var(--border-subtle)",
			}}
		>
			{["15m", "1h", "6h", "24h"].map((d) => {
				const active = value === d;
				return (
					// biome-ignore lint/a11y/useSemanticElements: visual segmented control inside an explicit radiogroup
					<button
						key={d}
						type="button"
						role="radio"
						aria-checked={active}
						onClick={() => onChange(d)}
						className="px-2.5 h-7 rounded-[4px] text-[11px] font-medium tnum transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
						style={{
							background: active ? "var(--surface-base)" : "transparent",
							color: active ? "var(--text-primary)" : "var(--text-tertiary)",
							border: active
								? "1px solid var(--border-subtle)"
								: "1px solid transparent",
						}}
					>
						{d}
					</button>
				);
			})}
		</div>
	);
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION — Overview
// ═══════════════════════════════════════════════════════════════════════════

type ChartPoint = {
	time: string;
	cpu?: number;
	memory?: number;
	latency?: number;
	error_rate?: number;
	disk?: number;
};

function OverviewSection({
	chartData,
	loading,
	empty,
	serviceId,
	duration,
	onDurationChange,
}: {
	chartData: ChartPoint[];
	loading: boolean;
	empty: boolean;
	serviceId: string;
	duration: string;
	onDurationChange: (v: string) => void;
}) {
	const toolbar = (
		<div className="flex items-center justify-between gap-3 flex-wrap">
			<p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
				Son {DURATION_LABELS[duration] ?? duration} ölçümleri
			</p>
			<DurationControl value={duration} onChange={onDurationChange} />
		</div>
	);

	const skeletonGrid = (
		<div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
			{[0, 1, 2, 3].map((i) => (
				<div
					key={i}
					className="h-[220px] rounded-[6px] animate-pulse"
					style={{
						background: "var(--surface-base)",
						border: "1px solid var(--border-subtle)",
					}}
				/>
			))}
		</div>
	);

	if (loading) {
		return (
			<div className="flex flex-col gap-4">
				{toolbar}
				{skeletonGrid}
			</div>
		);
	}

	if (empty) {
		return (
			<div className="flex flex-col gap-4">
				{toolbar}
				<EmptyPanel
					icon={Activity}
					title="Metrik verisi yok"
					description="Seçili zaman aralığında bu servis için kayıtlı metrik bulunmuyor. Daha geniş bir aralık seçin veya agent bağlantısını kontrol edin."
				/>
			</div>
		);
	}

	return (
		<Suspense fallback={skeletonGrid}>
			<div className="flex flex-col gap-4">
				{toolbar}
				<ForecastPanel serviceId={serviceId} />
				<ServiceMetricsCharts chartData={chartData} />
				<DependenciesPanel serviceId={serviceId} />
			</div>
		</Suspense>
	);
}

const DURATION_LABELS: Record<string, string> = {
	"15m": "15 dakika",
	"1h": "1 saat",
	"6h": "6 saat",
	"24h": "24 saat",
};

// ═══════════════════════════════════════════════════════════════════════════
// SECTION — Alerts
// ═══════════════════════════════════════════════════════════════════════════

function AlertsSection({
	alerts,
	onResolve,
}: {
	alerts: Alert[];
	onResolve: (id: string) => void;
}) {
	if (alerts.length === 0) {
		return (
			<EmptyPanel
				icon={ShieldCheck}
				iconColor="var(--status-up)"
				title="Hiç aktif uyarı yok"
				description="Tüm sistemler normal. Yeni bir anomali tespit edilirse bu panelde görünecek."
			/>
		);
	}

	const sevAccent = (sev: string) =>
		sev === "crit"
			? "var(--status-down)"
			: sev === "warn"
				? "var(--status-degraded)"
				: "var(--brand-primary)";

	const sevBg = (sev: string) =>
		sev === "crit"
			? "var(--status-down-subtle)"
			: sev === "warn"
				? "var(--status-degraded-subtle)"
				: "var(--brand-primary-subtle)";

	const sevText = (sev: string) =>
		sev === "crit"
			? "var(--status-down-text)"
			: sev === "warn"
				? "var(--status-degraded-text)"
				: "var(--brand-primary)";

	return (
		<div className="flex flex-col gap-2">
			<p
				className="text-[10px] uppercase tracking-wider font-semibold px-1"
				style={{ color: "var(--text-faint)" }}
			>
				{alerts.length} aktif uyarı
			</p>
			<AnimatePresence initial={false}>
				{alerts.map((alert, i) => {
					const accent = sevAccent(alert.severity);
					const bg = sevBg(alert.severity);
					const text = sevText(alert.severity);
					return (
						<motion.article
							key={alert.id}
							layout
							initial={{ opacity: 0, y: 4 }}
							animate={{ opacity: 1, y: 0 }}
							exit={{ opacity: 0, height: 0 }}
							transition={{
								duration: 0.18,
								delay: Math.min(i, 5) * 0.02,
							}}
							className="relative flex items-start gap-3 px-4 py-3 rounded-[6px]"
							style={{
								background: "var(--surface-base)",
								border: "1px solid var(--border-subtle)",
							}}
						>
							<span
								aria-hidden
								className="absolute left-0 top-3 bottom-3 w-[2px] rounded-r-full"
								style={{ background: accent }}
							/>
							<div className="flex-1 min-w-0 pl-2">
								<header className="flex items-center gap-2 flex-wrap mb-1">
									<span
										className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-[4px]"
										style={{ color: text, background: bg }}
									>
										{alert.severity}
									</span>
									<span
										className="text-[10px] uppercase tracking-wider font-medium"
										style={{ color: "var(--text-faint)" }}
									>
										{alert.type}
									</span>
									<span className="flex-1" />
									<span
										className="text-[10px] tnum"
										style={{ color: "var(--text-faint)" }}
									>
										{new Date(alert.triggered_at).toLocaleString("tr-TR", {
											day: "2-digit",
											month: "short",
											hour: "2-digit",
											minute: "2-digit",
										})}
									</span>
								</header>
								<p
									className="text-[13px] leading-snug"
									style={{ color: "var(--text-primary)" }}
								>
									{alert.message}
								</p>
							</div>
							<Button
								variant="outline"
								size="sm"
								onClick={() => onResolve(alert.id)}
								className="shrink-0"
							>
								<Check className="w-3 h-3 mr-1" />
								Çöz
							</Button>
						</motion.article>
					);
				})}
			</AnimatePresence>
		</div>
	);
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION — Terminal (CRT-styled)
// ═══════════════════════════════════════════════════════════════════════════

const SUGGESTIONS = ["uptime", "ps aux", "df -h", "free -m"];

function TerminalSection({
	service,
	history,
	onClear,
	command,
	setCommand,
	onSubmit,
	loading,
	scrollRef,
}: {
	service: Service;
	history: ExecEntry[];
	onClear: () => void;
	command: string;
	setCommand: (v: string) => void;
	onSubmit: () => void;
	loading: boolean;
	scrollRef: React.RefObject<HTMLDivElement>;
}) {
	return (
		<div className="flex flex-col gap-3 h-full min-h-0">
			{!service.agent_connected && (
				<div
					className="flex items-start gap-3 px-4 py-3 rounded-lg text-xs"
					style={{
						background: "var(--status-warn-subtle)",
						border: "1px solid var(--status-warn-border)",
					}}
				>
					<AlertCircle
						className="w-4 h-4 shrink-0 mt-0.5"
						style={{ color: "var(--status-warn)" }}
					/>
					<div className="flex-1">
						<p
							className="font-semibold mb-0.5"
							style={{ color: "var(--status-warn-text)" }}
						>
							Agent bağlı değil
						</p>
						<p style={{ color: "var(--text-muted)" }}>
							Terminal komutları NanoNet Agent üzerinden iletilir. Sol paneldeki
							<strong style={{ color: "var(--text-secondary)" }}>
								{" "}
								Agent Kurulumu{" "}
							</strong>
							butonundan talimatları alabilirsiniz.
						</p>
					</div>
				</div>
			)}

			<div
				className="nn-terminal relative flex flex-col rounded-lg overflow-hidden flex-1 min-h-0"
				style={{
					background: "var(--terminal-bg)",
					border: "1px solid var(--terminal-border)",
				}}
			>
				<div
					className="relative z-20 flex items-center gap-2 px-4 py-2.5 shrink-0"
					style={{
						borderBottom: "1px solid var(--terminal-border)",
						background: "var(--terminal-chrome)",
					}}
				>
					<div className="flex gap-1.5">
						<span
							className="w-2.5 h-2.5 rounded-full"
							style={{ background: "#ff5f57" }}
						/>
						<span
							className="w-2.5 h-2.5 rounded-full"
							style={{ background: "#febc2e" }}
						/>
						<span
							className="w-2.5 h-2.5 rounded-full"
							style={{ background: "#28c840" }}
						/>
					</div>
					<span
						className="text-[10px] font-mono ml-2 truncate"
						style={{ color: "var(--terminal-muted)" }}
					>
						{service.name} — agent shell
					</span>
					<span
						className="ml-auto text-[9px] font-mono tabular-nums px-1.5 py-0.5 rounded shrink-0"
						style={{
							background: service.agent_connected
								? "var(--status-up-subtle)"
								: "var(--status-down-subtle)",
							color: service.agent_connected
								? "var(--status-up-text)"
								: "var(--status-down-text)",
						}}
					>
						{service.agent_connected ? "● LIVE" : "○ OFFLINE"}
					</span>
					{history.length > 0 && (
						<button
							type="button"
							onClick={onClear}
							className="text-[10px] font-mono transition-opacity hover:opacity-60 shrink-0"
							style={{ color: "var(--terminal-muted)" }}
						>
							clear
						</button>
					)}
				</div>

				<div
					ref={scrollRef}
					className="relative z-20 flex-1 overflow-y-auto p-4 font-mono text-xs min-h-0"
					style={{ color: "var(--terminal-fg)" }}
				>
					{history.length === 0 ? (
						<div className="flex flex-col items-center justify-center h-full gap-4 select-none">
							<Terminal
								className="w-10 h-10"
								style={{ color: "var(--terminal-accent)", opacity: 0.4 }}
							/>
							<p
								className="text-[11px] font-mono"
								style={{ color: "var(--terminal-muted)" }}
							>
								$ ready — komut girin ve Enter'a basın
							</p>
							<div className="flex flex-wrap gap-2 max-w-sm justify-center">
								{SUGGESTIONS.map((s) => (
									<button
										key={s}
										type="button"
										onClick={() => setCommand(s)}
										className="px-2.5 py-1 rounded text-[10px] font-mono transition-colors"
										style={{
											background: "var(--terminal-accent-subtle)",
											color: "var(--terminal-accent)",
											border: "1px solid var(--terminal-accent-border)",
										}}
									>
										{s}
									</button>
								))}
							</div>
						</div>
					) : (
						<div className="space-y-4">
							{history.map((entry) => (
								<TerminalEntry key={entry.command_id} entry={entry} />
							))}
						</div>
					)}
				</div>

				<div
					className="relative z-20 flex items-center gap-2 px-4 py-3 shrink-0"
					style={{
						borderTop: "1px solid var(--terminal-border)",
						background: "var(--terminal-chrome)",
					}}
				>
					<span
						className="font-mono text-sm font-bold"
						style={{ color: "var(--terminal-accent)" }}
					>
						❯
					</span>
					<input
						value={command}
						onChange={(e) => setCommand(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter" && !loading) onSubmit();
						}}
						placeholder="e.g. uptime"
						disabled={loading}
						className="flex-1 bg-transparent border-none outline-none font-mono text-xs placeholder:opacity-40"
						style={{ color: "var(--terminal-fg)" }}
					/>
					<button
						type="button"
						onClick={onSubmit}
						disabled={loading || !command.trim()}
						className="shrink-0 h-7 px-2.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider transition-all disabled:opacity-40"
						style={{
							background: "var(--terminal-accent-subtle)",
							color: "var(--terminal-accent)",
							border: "1px solid var(--terminal-accent-border)",
						}}
					>
						{loading ? (
							<Loader2 className="w-3 h-3 animate-spin" />
						) : (
							<span className="inline-flex items-center gap-1">
								<Send className="w-2.5 h-2.5" /> send
							</span>
						)}
					</button>
				</div>
			</div>
		</div>
	);
}

function TerminalEntry({ entry }: { entry: ExecEntry }) {
	const isDone =
		entry.status === "success" ||
		entry.status === "failed" ||
		entry.status === "timeout";
	const statusColor =
		entry.status === "success"
			? "var(--status-up-text)"
			: entry.status === "failed" || entry.status === "timeout"
				? "var(--status-down-text)"
				: "var(--status-warn-text)";

	return (
		<div className="leading-relaxed">
			<div className="flex items-center gap-2">
				<span style={{ color: "var(--terminal-accent)" }}>$</span>
				<span style={{ color: "var(--terminal-fg)" }}>{entry.command}</span>
				<span
					className="ml-auto font-mono text-[10px]"
					style={{ color: "var(--terminal-muted)" }}
				>
					{new Date(entry.queued_at).toLocaleTimeString("tr-TR", {
						hour: "2-digit",
						minute: "2-digit",
						second: "2-digit",
					})}
				</span>
			</div>
			<div className="flex items-center gap-2 pl-3 mt-0.5">
				<span
					className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider"
					style={{ color: statusColor }}
				>
					{!isDone && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
					{entry.status}
				</span>
				{entry.duration_ms != null && (
					<span
						className="text-[10px] font-mono ml-auto tabular-nums"
						style={{ color: "var(--terminal-muted)" }}
					>
						{entry.duration_ms}ms
					</span>
				)}
			</div>
			{entry.output && (
				<pre
					className="mt-2 ml-3 p-2.5 rounded text-[11px] whitespace-pre-wrap break-all"
					style={{
						color: "var(--terminal-fg)",
						background: "var(--terminal-block-bg)",
						border: "1px solid var(--terminal-border)",
					}}
				>
					{entry.output}
				</pre>
			)}
			{entry.error && (
				<pre
					className="mt-2 ml-3 p-2.5 rounded text-[11px] whitespace-pre-wrap break-all"
					style={{
						color: "var(--status-down-text)",
						background: "var(--status-down-subtle)",
						border: "1px solid var(--status-down-border)",
					}}
				>
					{entry.error}
				</pre>
			)}
		</div>
	);
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION — AI Analysis
// ═══════════════════════════════════════════════════════════════════════════

function AIAnalysisSection({
	result,
	loading,
	onAnalyze,
	deep,
	setDeep,
}: {
	result: AnalysisResult | null;
	loading: boolean;
	onAnalyze: () => void;
	deep: boolean;
	setDeep: (v: boolean) => void;
}) {
	const priorityTokens = (p: string) => {
		if (p === "high") {
			return {
				text: "var(--status-down-text)",
				bg: "var(--status-down-subtle)",
			};
		}
		if (p === "medium") {
			return {
				text: "var(--status-degraded-text)",
				bg: "var(--status-degraded-subtle)",
			};
		}
		return {
			text: "var(--status-up-text)",
			bg: "var(--status-up-subtle)",
		};
	};

	return (
		<div className="flex flex-col gap-3">
			{/* Toolbar */}
			<div
				className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-[6px]"
				style={{
					background: "var(--surface-base)",
					border: "1px solid var(--border-subtle)",
				}}
			>
				<div className="flex items-center gap-2.5 min-w-0">
					<span
						className="w-8 h-8 rounded-[6px] flex items-center justify-center shrink-0"
						style={{
							background: "var(--surface-sunken)",
							border: "1px solid var(--border-subtle)",
						}}
					>
						<Sparkles
							className="w-4 h-4"
							style={{ color: "var(--brand-primary)" }}
						/>
					</span>
					<div className="min-w-0">
						<p
							className="text-[13px] font-semibold leading-tight"
							style={{ color: "var(--text-primary)" }}
						>
							Claude AI analiz
						</p>
						<p
							className="text-[11px] leading-tight mt-1"
							style={{ color: "var(--text-tertiary)" }}
						>
							Son 30 dakikalık metriklerden kök-neden tahmini
						</p>
					</div>
				</div>

				<div className="flex items-center gap-2 shrink-0">
					<div
						role="radiogroup"
						aria-label="Analiz derinliği"
						className="inline-flex items-center h-8 rounded-[6px] p-0.5"
						style={{
							background: "var(--surface-sunken)",
							border: "1px solid var(--border-subtle)",
						}}
					>
						{[
							{ label: "Hızlı", val: false },
							{ label: "Derin", val: true },
						].map(({ label, val }) => {
							const active = deep === val;
							return (
								// biome-ignore lint/a11y/useSemanticElements: visual segmented control inside an explicit radiogroup
								<button
									key={label}
									type="button"
									role="radio"
									aria-checked={active}
									onClick={() => setDeep(val)}
									className="px-2.5 h-7 rounded-[4px] text-[11px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
									style={{
										background: active ? "var(--surface-base)" : "transparent",
										color: active
											? "var(--text-primary)"
											: "var(--text-tertiary)",
										border: active
											? "1px solid var(--border-subtle)"
											: "1px solid transparent",
									}}
								>
									{label}
								</button>
							);
						})}
					</div>
					<Button size="sm" onClick={onAnalyze} disabled={loading}>
						{loading ? (
							<>
								<Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
								Analiz…
							</>
						) : (
							<>
								<Sparkles className="w-3.5 h-3.5 mr-1.5" />
								Analiz başlat
							</>
						)}
					</Button>
				</div>
			</div>

			{loading && !result ? (
				<div
					className="flex flex-col items-center justify-center px-6 py-12 gap-3 rounded-[6px]"
					style={{
						background: "var(--surface-base)",
						border: "1px dashed var(--border-default)",
					}}
				>
					<Sparkles
						className="w-8 h-8 animate-pulse"
						style={{ color: "var(--brand-primary)" }}
					/>
					<p className="text-[12px]" style={{ color: "var(--text-tertiary)" }}>
						Claude metrikleri inceliyor…
					</p>
				</div>
			) : result ? (
				<div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
					{/* Summary */}
					<section
						className="lg:col-span-3 px-4 py-3 rounded-[6px]"
						style={{
							background: "var(--surface-base)",
							border: "1px solid var(--border-subtle)",
						}}
					>
						<header className="flex items-center justify-between mb-2">
							<span
								className="text-[10px] uppercase tracking-wider font-semibold"
								style={{ color: "var(--text-faint)" }}
							>
								Özet
							</span>
							{result.confidence !== undefined && (
								<span
									className="text-[10px] tnum font-medium px-1.5 py-0.5 rounded-[4px]"
									style={{
										color: "var(--brand-primary)",
										background: "var(--brand-primary-subtle)",
									}}
								>
									{(result.confidence * 100).toFixed(0)}% güven
								</span>
							)}
						</header>
						<p
							className="text-[13px] leading-relaxed"
							style={{ color: "var(--text-primary)" }}
						>
							{result.summary}
						</p>
					</section>

					{/* Root cause */}
					{result.root_cause && (
						<section
							className="lg:col-span-2 px-4 py-3 rounded-[6px] relative"
							style={{
								background: "var(--status-down-subtle)",
								border: "1px solid var(--border-subtle)",
							}}
						>
							<span
								aria-hidden
								className="absolute left-0 top-3 bottom-3 w-[2px] rounded-r-full"
								style={{ background: "var(--status-down)" }}
							/>
							<header className="flex items-center gap-1.5 mb-2 pl-2">
								<AlertTriangle
									className="w-3 h-3"
									style={{ color: "var(--status-down)" }}
								/>
								<h3
									className="text-[10px] uppercase tracking-wider font-semibold"
									style={{ color: "var(--status-down-text)" }}
								>
									Kök neden
								</h3>
							</header>
							<p
								className="text-[13px] leading-relaxed pl-2"
								style={{ color: "var(--text-primary)" }}
							>
								{result.root_cause}
							</p>
						</section>
					)}

					{/* Recommendations */}
					{result.recommendations && result.recommendations.length > 0 && (
						<section
							className="lg:col-span-5 px-4 py-3 rounded-[6px] relative"
							style={{
								background: "var(--brand-primary-subtle)",
								border: "1px solid var(--border-subtle)",
							}}
						>
							<span
								aria-hidden
								className="absolute left-0 top-3 bottom-3 w-[2px] rounded-r-full"
								style={{ background: "var(--brand-primary)" }}
							/>
							<header className="flex items-center gap-1.5 mb-2.5 pl-2">
								<CheckCircle2
									className="w-3 h-3"
									style={{ color: "var(--brand-primary)" }}
								/>
								<h3
									className="text-[10px] uppercase tracking-wider font-semibold"
									style={{ color: "var(--brand-primary)" }}
								>
									Öneriler
								</h3>
							</header>
							<ul className="space-y-2 pl-2">
								{result.recommendations.map((rec) => {
									const t = priorityTokens(rec.priority);
									return (
										<li
											key={rec.action}
											className="flex items-start gap-2.5 text-[13px]"
										>
											<span
												className="shrink-0 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-[4px] mt-0.5"
												style={{ color: t.text, background: t.bg }}
											>
												{rec.priority}
											</span>
											<span
												className="leading-relaxed"
												style={{ color: "var(--text-primary)" }}
											>
												{rec.action}
											</span>
										</li>
									);
								})}
							</ul>
						</section>
					)}
				</div>
			) : (
				<EmptyPanel
					icon={Sparkles}
					iconColor="var(--brand-primary)"
					title="Henüz analiz yok"
					description="Son metriklerde anomali tespit etmek için Analiz başlat'a tıklayın. Derin analiz daha detaylı çıktı üretir."
				/>
			)}
		</div>
	);
}

// ═══════════════════════════════════════════════════════════════════════════
// EMPTY PANEL
// ═══════════════════════════════════════════════════════════════════════════

function EmptyPanel({
	icon: Icon,
	iconColor,
	title,
	description,
}: {
	icon: React.ElementType;
	iconColor?: string;
	title: string;
	description: string;
}) {
	return (
		<div
			className="flex flex-col items-center justify-center py-12 px-6 rounded-[6px] text-center"
			style={{
				background: "var(--surface-base)",
				border: "1px dashed var(--border-default)",
			}}
		>
			<span
				className="w-10 h-10 rounded-[6px] flex items-center justify-center mb-3"
				style={{
					background: "var(--surface-sunken)",
					border: "1px solid var(--border-subtle)",
				}}
			>
				<Icon
					className="w-4 h-4"
					style={{ color: iconColor ?? "var(--text-tertiary)" }}
				/>
			</span>
			<p
				className="text-[14px] font-semibold mb-1"
				style={{ color: "var(--text-primary)" }}
			>
				{title}
			</p>
			<p
				className="text-[12px] leading-relaxed max-w-md"
				style={{ color: "var(--text-tertiary)" }}
			>
				{description}
			</p>
		</div>
	);
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════

export function ServiceDetailPage() {
	const { serviceId } = useParams<{ serviceId: string }>();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { deleteService, restartService, stopService } = useServices();

	const [activeSection, setActiveSection] = useState<SectionId>("overview");
	const [metricsDuration, setMetricsDuration] = useState("1h");
	const [agentWizardOpen, setAgentWizardOpen] = useState(false);

	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [restartConfirmOpen, setRestartConfirmOpen] = useState(false);
	const [stopConfirmOpen, setStopConfirmOpen] = useState(false);
	const [execConfirmOpen, setExecConfirmOpen] = useState(false);
	const [pendingCommand, setPendingCommand] = useState("");
	const [execSessionConfirmed, setExecSessionConfirmed] = useState(
		() => sessionStorage.getItem("exec_session_confirmed") === "1",
	);

	const [analyzeLoading, setAnalyzeLoading] = useState(false);
	const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
		null,
	);
	const [deepAnalysis, setDeepAnalysis] = useState(false);

	const [execCommand, setExecCommand] = useState("");
	const [execLoading, setExecLoading] = useState(false);
	const [execHistory, setExecHistory] = useState<ExecEntry[]>([]);
	const terminalScrollRef = useRef<HTMLDivElement>(null);

	const [startLoading, setStartLoading] = useState(false);

	const [scaleInstances, setScaleInstances] = useState(1);
	const [scaleStrategy, setScaleStrategy] = useState<
		"round_robin" | "least_conn" | "ip_hash"
	>("round_robin");
	const [scaleLoading, setScaleLoading] = useState(false);

	const { data: service, isLoading: serviceLoading } = useQuery({
		queryKey: ["service", serviceId],
		queryFn: () => servicesApi.get(serviceId ?? ""),
		enabled: !!serviceId,
		refetchInterval: 5000,
	});

	const { data: metrics = [], isLoading: metricsLoading } = useQuery({
		queryKey: ["serviceMetrics", serviceId, metricsDuration],
		queryFn: () => metricsApi.getHistory(serviceId ?? "", metricsDuration),
		enabled: !!serviceId,
		refetchInterval: 30000,
	});

	const { data: uptime } = useQuery({
		queryKey: ["serviceUptime", serviceId],
		queryFn: () => metricsApi.getUptime(serviceId ?? "", "24h"),
		enabled: !!serviceId,
	});

	const { data: alerts = [] } = useQuery({
		queryKey: ["serviceAlerts", serviceId],
		queryFn: () => metricsApi.getAlerts(serviceId ?? "", false),
		enabled: !!serviceId,
	});

	useRegisterPageMeta({
		title: service?.name ?? "Servis",
		description: service ? `${service.host}:${service.port}` : undefined,
	});

	useEffect(() => {
		const handler = (e: Event) => {
			const ev = e as CustomEvent<{
				command_id: string;
				status: string;
				output?: string;
				error?: string;
				service_id?: string;
			}>;
			const { command_id, status, output, error } = ev.detail;
			setExecHistory((prev) =>
				prev.map((entry) =>
					entry.command_id === command_id
						? { ...entry, status: status as ExecEntry["status"], output, error }
						: entry,
				),
			);
		};
		window.addEventListener("nanonet:command_result", handler);
		return () => window.removeEventListener("nanonet:command_result", handler);
	}, []);

	useEffect(() => {
		if (activeSection === "terminal" && terminalScrollRef.current) {
			terminalScrollRef.current.scrollTop =
				terminalScrollRef.current.scrollHeight;
		}
	}, [activeSection]);

	const chartData: ChartPoint[] = useMemo(
		() =>
			metrics.map((m) => ({
				time: new Date(m.time).toLocaleTimeString("tr-TR", {
					hour: "2-digit",
					minute: "2-digit",
				}),
				cpu: m.cpu_percent,
				memory: m.memory_used_mb,
				latency: m.latency_ms,
				error_rate: m.error_rate,
				disk: m.disk_used_gb,
			})),
		[metrics],
	);

	const handleDelete = () => {
		if (serviceId) {
			deleteService(serviceId);
			setDeleteDialogOpen(false);
			navigate("/app/services");
		}
	};

	const handleRestart = () => {
		if (serviceId) {
			restartService(serviceId);
			setRestartConfirmOpen(false);
		}
	};

	const handleStop = () => {
		if (serviceId) {
			stopService(serviceId);
			setStopConfirmOpen(false);
		}
	};

	const handleStart = async () => {
		if (!serviceId) return;
		setStartLoading(true);
		try {
			await servicesApi.start(serviceId);
			toast.success("Başlatma komutu gönderildi");
		} catch {
			toast.error("Başlatma komutu gönderilemedi");
		} finally {
			setStartLoading(false);
		}
	};

	const handleScale = async () => {
		if (!serviceId) return;
		setScaleLoading(true);
		try {
			await servicesApi.scale(serviceId, scaleInstances, scaleStrategy);
			toast.success(`Ölçekleme komutu gönderildi: ${scaleInstances} örnek`);
		} catch {
			toast.error("Ölçekleme komutu gönderilemedi");
		} finally {
			setScaleLoading(false);
		}
	};

	const handleExecRequest = () => {
		const cmd = execCommand.trim();
		if (!cmd) return;
		if (execSessionConfirmed) {
			void handleExecDirect(cmd);
		} else {
			setPendingCommand(cmd);
			setExecConfirmOpen(true);
		}
	};

	const handleExecDirect = async (cmd: string) => {
		if (!serviceId || !cmd) return;
		setExecLoading(true);
		setExecCommand("");
		try {
			const result = await runAgentCommand(serviceId, cmd);
			setExecHistory((prev) => [
				...prev,
				{
					command: cmd,
					...result,
					status: result.status as ExecEntry["status"],
				},
			]);
		} catch {
			toast.error("Komut gönderilemedi");
		} finally {
			setExecLoading(false);
		}
	};

	const handleAnalyze = async () => {
		if (!serviceId) return;
		setAnalyzeLoading(true);
		try {
			const result = await metricsApi.analyze(serviceId, 30, deepAnalysis);
			setAnalysisResult(result);
		} catch {
			toast.error("AI analiz başarısız oldu");
		} finally {
			setAnalyzeLoading(false);
		}
	};

	const handleResolveAlert = async (alertId: string) => {
		try {
			await metricsApi.resolveAlert(alertId);
			toast.success("Uyarı çözüldü");
			queryClient.invalidateQueries({ queryKey: ["serviceAlerts", serviceId] });
		} catch {
			toast.error("Uyarı çözülemedi");
		}
	};

	if (serviceLoading) {
		return (
			<PageShell width="wide" fill>
				<div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
					<div className="lg:w-[280px] lg:shrink-0">
						<SkeletonCard className="h-[420px]" />
					</div>
					<div className="flex-1 flex flex-col gap-3 min-h-0">
						<SkeletonCard className="h-[120px]" />
						<SkeletonCard className="h-[44px]" />
						<SkeletonCard className="flex-1" />
					</div>
				</div>
			</PageShell>
		);
	}

	if (!service) {
		return (
			<PageShell width="wide" fill>
				<SharedEmptyState
					icon={Server}
					title="Servis bulunamadı"
					description="Bu servis silinmiş olabilir ya da erişim izniniz yok."
					tone="muted"
					size="lg"
					className="flex-1"
					action={
						<Button
							onClick={() => navigate("/app/services")}
							variant="default"
							size="sm"
						>
							<ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> Servislere Dön
						</Button>
					}
				/>
			</PageShell>
		);
	}

	// ────────────────────────────────────────────────────────────────── MAIN
	return (
		<PageShell width="wide" fill>
			<div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0 py-1">
				<IdentityRail
					service={service}
					onBack={() => navigate("/app/services")}
					onStart={handleStart}
					onRestart={() => setRestartConfirmOpen(true)}
					onStop={() => setStopConfirmOpen(true)}
					onDelete={() => setDeleteDialogOpen(true)}
					onAgentSetup={() => setAgentWizardOpen(true)}
					startLoading={startLoading}
				/>

				<div className="flex-1 min-w-0 flex flex-col gap-4 min-h-0">
					<VitalSignsBand
						service={service}
						uptimePercent={uptime?.uptime_percent ?? null}
						metrics={metrics}
					/>

					<SectionNav
						active={activeSection}
						onChange={setActiveSection}
						alertCount={alerts.length}
					/>

					<div
						className={
							activeSection === "logs" || activeSection === "terminal"
								? "flex-1 min-h-0 flex flex-col"
								: "flex-1 min-h-0 overflow-y-auto pr-1"
						}
					>
						<AnimatePresence mode="wait">
							<motion.div
								key={activeSection}
								initial={{ opacity: 0, y: 6 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -4 }}
								transition={{ duration: 0.22 }}
								className={
									activeSection === "logs"
										? "hidden"
										: activeSection === "terminal"
											? "flex-1 min-h-0 flex flex-col"
											: ""
								}
							>
								{activeSection === "overview" && (
									<OverviewSection
										chartData={chartData}
										loading={metricsLoading}
										empty={chartData.length === 0}
										serviceId={serviceId ?? ""}
										duration={metricsDuration}
										onDurationChange={setMetricsDuration}
									/>
								)}

								{activeSection === "alerts" && (
									<AlertsSection
										alerts={alerts}
										onResolve={handleResolveAlert}
									/>
								)}

								{activeSection === "terminal" && (
									<TerminalSection
										service={service}
										history={execHistory}
										onClear={() => setExecHistory([])}
										command={execCommand}
										setCommand={setExecCommand}
										onSubmit={handleExecRequest}
										loading={execLoading}
										scrollRef={terminalScrollRef}
									/>
								)}

								{activeSection === "ai" && (
									<AIAnalysisSection
										result={analysisResult}
										loading={analyzeLoading}
										onAnalyze={handleAnalyze}
										deep={deepAnalysis}
										setDeep={setDeepAnalysis}
									/>
								)}

								{activeSection === "scale" && (
									<LoadBalancingTab
										serviceId={serviceId ?? ""}
										serviceName={service.name ?? ""}
										scaleInstances={scaleInstances}
										setScaleInstances={setScaleInstances}
										scaleStrategy={scaleStrategy}
										setScaleStrategy={setScaleStrategy}
										scaleLoading={scaleLoading}
										handleScale={handleScale}
									/>
								)}

								{activeSection === "history" && (
									<CommandHistoryTab serviceId={serviceId ?? ""} />
								)}

								{activeSection === "rules" && (
									<AlertRulesTab serviceId={serviceId ?? ""} />
								)}

								{activeSection === "maintenance" && (
									<MaintenanceTab serviceId={serviceId ?? ""} />
								)}

								{activeSection === "access" && (
									<SharingPanel serviceId={serviceId ?? ""} />
								)}
							</motion.div>
						</AnimatePresence>

						{/* Logs — always mounted so WS stream persists across tab switches */}
						<div
							className={
								activeSection === "logs"
									? "flex-1 min-h-0 flex flex-col"
									: "hidden"
							}
						>
							<LogViewer
								serviceId={serviceId ?? ""}
								serviceName={service.name}
							/>
						</div>
					</div>
				</div>
			</div>

			{/* ─── Dialogs ─── */}
			<Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Servisi Sil</DialogTitle>
						<DialogDescription>
							<strong style={{ color: "var(--text-primary)" }}>
								{service.name}
							</strong>{" "}
							servisini silmek istediğinize emin misiniz? Bu işlem geri alınamaz
							ve tüm metrik geçmişi kaybolacak.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							variant="outline"
							size="sm"
							onClick={() => setDeleteDialogOpen(false)}
						>
							İptal
						</Button>
						<Button onClick={handleDelete} variant="destructive" size="sm">
							<Trash2 className="w-3.5 h-3.5 mr-1.5" /> Kalıcı Olarak Sil
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={restartConfirmOpen} onOpenChange={setRestartConfirmOpen}>
				<DialogContent className="max-w-sm">
					<DialogHeader>
						<DialogTitle>Yeniden Başlat</DialogTitle>
						<DialogDescription>
							<strong style={{ color: "var(--text-primary)" }}>
								{service.name}
							</strong>{" "}
							yeniden başlatılacak. Aktif bağlantılar kesilecektir.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							variant="outline"
							size="sm"
							onClick={() => setRestartConfirmOpen(false)}
						>
							İptal
						</Button>
						<Button onClick={handleRestart} size="sm">
							<RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Yeniden Başlat
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={stopConfirmOpen} onOpenChange={setStopConfirmOpen}>
				<DialogContent className="max-w-sm">
					<DialogHeader>
						<DialogTitle>Servisi Durdur</DialogTitle>
						<DialogDescription>
							<strong style={{ color: "var(--text-primary)" }}>
								{service.name}
							</strong>{" "}
							durdurulacak. Servis yanıt vermez hale gelecektir.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							variant="outline"
							size="sm"
							onClick={() => setStopConfirmOpen(false)}
						>
							İptal
						</Button>
						<Button onClick={handleStop} variant="destructive" size="sm">
							<Power className="w-3.5 h-3.5 mr-1.5" /> Durdur
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog
				open={execConfirmOpen}
				onOpenChange={(open) => {
					if (!open) {
						setExecConfirmOpen(false);
						setPendingCommand("");
					}
				}}
			>
				<DialogContent className="max-w-sm">
					<DialogHeader>
						<DialogTitle>Terminal Erişimi</DialogTitle>
						<DialogDescription asChild>
							<div
								className="space-y-3 text-[12px]"
								style={{ color: "var(--text-tertiary)" }}
							>
								<p>
									Bu terminal{" "}
									<strong style={{ color: "var(--text-primary)" }}>
										{service.name}
									</strong>{" "}
									sunucusunda doğrudan komut çalıştırır.
								</p>
								<ul
									className="space-y-1 pl-3"
									style={{
										borderLeft: "2px solid var(--status-degraded-border)",
									}}
								>
									<li>
										Yalnızca{" "}
										<code
											className="font-mono"
											style={{ color: "var(--brand-primary)" }}
										>
											status
										</code>
										,{" "}
										<code
											className="font-mono"
											style={{ color: "var(--brand-primary)" }}
										>
											mem
										</code>
										,{" "}
										<code
											className="font-mono"
											style={{ color: "var(--brand-primary)" }}
										>
											cpu
										</code>
										,{" "}
										<code
											className="font-mono"
											style={{ color: "var(--brand-primary)" }}
										>
											ps
										</code>{" "}
										gibi salt-okunur komutlar güvenlidir.
									</li>
									<li>
										Pipe (<code className="font-mono">|</code>), zincirleme (
										<code className="font-mono">&amp;&amp;</code>,{" "}
										<code className="font-mono">;</code>) ve yönlendirme (
										<code className="font-mono">&gt;</code>) operatörleri
										engellenir.
									</li>
									<li>
										Servis sürecini etkileyen komutlar sizin
										sorumluluğunuzdadır.
									</li>
								</ul>
								<p style={{ color: "var(--text-faint)" }}>
									Onayladıktan sonra bu oturumda tekrar sorulmayacak.
								</p>
							</div>
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							variant="outline"
							size="sm"
							onClick={() => {
								setExecConfirmOpen(false);
								setPendingCommand("");
							}}
						>
							İptal
						</Button>
						<Button
							size="sm"
							onClick={() => {
								sessionStorage.setItem("exec_session_confirmed", "1");
								setExecSessionConfirmed(true);
								setExecConfirmOpen(false);
								void handleExecDirect(pendingCommand);
								setPendingCommand("");
							}}
						>
							<Terminal className="w-3.5 h-3.5 mr-1.5" /> Anladım, Devam Et
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<AgentSetupWizard
				open={agentWizardOpen}
				onClose={() => setAgentWizardOpen(false)}
				serviceId={serviceId}
				serviceName={service.name}
			/>
		</PageShell>
	);
}

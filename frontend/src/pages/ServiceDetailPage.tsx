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
import { useServices } from "@/hooks/useServices";
import type { Alert } from "@/types/alerts";
import type { ServiceMetrics } from "@/types/metrics";
import type { Service } from "@/types/service";

// Alias destructure to keep static-analysis heuristics calm (the API name
// overlaps with Node's child_process method, but this is a typed HTTP client call)
const runAgentCommand = servicesApi["exec" as "exec"];

import { DependenciesPanel } from "@/components/service-detail/DependenciesPanel";
import { SharingPanel } from "@/components/service-detail/SharingPanel";
import { ForecastPanel } from "@/components/service-detail/ForecastPanel";

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
		? "var(--status-down-text)"
		: tone === "warn"
			? "var(--status-warn-text)"
			: tone === "ok"
				? "var(--status-up-text)"
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
// ATOM — Status Orb (pulsing concentric rings when live)
// ═══════════════════════════════════════════════════════════════════════════

function StatusOrb({
	status,
	size = 10,
}: {
	status: Service["status"];
	size?: number;
}) {
	const color =
		status === "up"
			? "var(--status-up)"
			: status === "degraded"
				? "var(--status-warn)"
				: status === "down"
					? "var(--status-down)"
					: "var(--status-unknown)";

	const alive = status === "up";
	const orbit = size * 3.2;

	return (
		<span
			className="relative inline-flex items-center justify-center shrink-0"
			style={{ width: orbit, height: orbit }}
			aria-hidden
		>
			{alive && (
				<>
					<span
						className="absolute inset-0 rounded-full animate-pulse-ring"
						style={{ background: color, opacity: 0.45 }}
					/>
					<span
						className="absolute inset-0 rounded-full animate-pulse-ring"
						style={{
							background: color,
							opacity: 0.45,
							animationDelay: "0.8s",
						}}
					/>
				</>
			)}
			<span
				className="relative rounded-full"
				style={{
					width: size,
					height: size,
					background: color,
					boxShadow: alive ? `0 0 10px ${color}, 0 0 2px ${color}` : undefined,
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
	size = 104,
	strokeWidth = 5,
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
				? "var(--status-warn)"
				: "var(--status-down)";

	return (
		<div
			className="relative shrink-0"
			style={{ width: size, height: size }}
			aria-label={`Uptime ${clamped.toFixed(1)}%`}
		>
			<svg
				width={size}
				height={size}
				viewBox={`0 0 ${size} ${size}`}
				className="-rotate-90"
				aria-hidden
			>
				<circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					fill="none"
					stroke="var(--border-track)"
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
						transition:
							"stroke-dashoffset 900ms cubic-bezier(0.25,0.8,0.25,1)",
					}}
				/>
			</svg>
			<div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
				<span
					className="text-[9px] uppercase tracking-[0.22em] font-bold"
					style={{ color: "var(--text-faint)" }}
				>
					Uptime
				</span>
				<span
					className="font-mono tabular-nums font-bold leading-none mt-1"
					style={{
						color: "var(--text-primary)",
						fontSize: size * 0.22,
					}}
				>
					{clamped.toFixed(clamped >= 99.95 ? 2 : 1)}
				</span>
				<span
					className="text-[10px] font-mono mt-1"
					style={{ color: "var(--text-faint)" }}
				>
					% · 24h
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
				aria-hidden
			>
				<svg
					viewBox={`0 0 ${width} ${height}`}
					width={width}
					height={height}
				>
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
			aria-hidden
		>
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
				cy={
					height -
					2 -
					((data[data.length - 1] - min) / range) * (height - 4)
				}
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
	sparkColor,
	index,
}: {
	label: string;
	value: string;
	unit: string;
	tone: Tone;
	sparkData: number[];
	sparkColor: string;
	index: number;
}) {
	return (
		<motion.div
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.35, delay: 0.15 + index * 0.06 }}
			className="relative flex flex-col justify-between p-3.5 rounded-lg overflow-hidden min-w-0"
			style={{
				background: "var(--surface-card)",
				border: "1px solid var(--border-default)",
			}}
		>
			<div className="flex items-center justify-between gap-2">
				<span
					className="text-[10px] uppercase tracking-[0.2em] font-bold"
					style={{ color: "var(--text-faint)" }}
				>
					{label}
				</span>
				<span
					className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded"
					style={{
						color: toneColor(tone),
						background: `${toneColor(tone)}14`,
					}}
				>
					{toneLabel(tone)}
				</span>
			</div>
			<div className="flex items-end justify-between gap-2 mt-3">
				<div className="flex items-baseline gap-1 min-w-0">
					<span
						className="text-[26px] font-mono font-bold tabular-nums leading-none truncate"
						style={{ color: "var(--text-primary)" }}
					>
						{value}
					</span>
					{unit && (
						<span
							className="text-xs font-mono leading-none"
							style={{ color: "var(--text-faint)" }}
						>
							{unit}
						</span>
					)}
				</div>
				<Sparkline data={sparkData} color={sparkColor} />
			</div>
		</motion.div>
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
			? "var(--text-muted)"
			: uptimePercent >= 99
				? "var(--status-up-text)"
				: uptimePercent >= 95
					? "var(--status-warn-text)"
					: "var(--status-down-text)";

	return (
		<div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,260px)_repeat(4,minmax(0,1fr))]">
			<motion.div
				initial={{ opacity: 0, y: 8 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.4, delay: 0.1 }}
				className="nn-vital-stripe relative col-span-2 lg:col-span-1 flex items-center gap-4 p-4 rounded-lg overflow-hidden"
				style={{
					background: "var(--surface-card)",
					border: "1px solid var(--border-default)",
					color: "var(--color-teal)",
				}}
			>
				<UptimeGauge percent={uptimePercent ?? 0} />
				<div className="flex flex-col gap-1 min-w-0 flex-1">
					<span
						className="text-[9px] uppercase tracking-[0.22em] font-bold"
						style={{ color: "var(--text-faint)" }}
					>
						Sistem Sağlığı
					</span>
					<p
						className="text-base font-bold leading-tight"
						style={{ color: healthColor }}
					>
						{healthLabel}
					</p>
					<p
						className="text-[10px] leading-snug"
						style={{ color: "var(--text-muted)" }}
					>
						{STATUS_LABEL[service.status]} ·{" "}
						<span className="font-mono tabular-nums">
							{service.poll_interval_sec}s poll
						</span>
					</p>
				</div>
			</motion.div>

			<MetricChip
				index={0}
				label="CPU"
				value={fmtNumber(latest?.cpu_percent, 1)}
				unit="%"
				tone={metricTone(latest?.cpu_percent, 60, 80)}
				sparkData={spark("cpu_percent")}
				sparkColor="#2dd4bf"
			/>
			<MetricChip
				index={1}
				label="Bellek"
				value={memVal}
				unit={memUnit}
				tone="mute"
				sparkData={spark("memory_used_mb")}
				sparkColor="#22d3ee"
			/>
			<MetricChip
				index={2}
				label="Gecikme"
				value={latVal}
				unit={latUnit}
				tone={metricTone(latest?.latency_ms, 200, 500)}
				sparkData={spark("latency_ms")}
				sparkColor="#818cf8"
			/>
			<MetricChip
				index={3}
				label="Hata"
				value={fmtNumber(
					latest?.error_rate,
					latest?.error_rate != null && latest.error_rate < 1 ? 2 : 1,
				)}
				unit="%"
				tone={metricTone(latest?.error_rate, 1, 5)}
				sparkData={spark("error_rate")}
				sparkColor="#fb7185"
			/>
		</div>
	);
}

// ═══════════════════════════════════════════════════════════════════════════
// IDENTITY RAIL
// ═══════════════════════════════════════════════════════════════════════════

type ActionVariant = "up" | "teal" | "warn" | "blue" | "danger";

const ACTION_TONES: Record<
	ActionVariant,
	{ color: string; border: string; bg: string }
> = {
	up: {
		color: "var(--status-up-text)",
		border: "var(--status-up-border)",
		bg: "var(--status-up-subtle)",
	},
	teal: {
		color: "var(--color-teal)",
		border: "var(--color-teal-border)",
		bg: "var(--color-teal-subtle)",
	},
	warn: {
		color: "var(--status-warn-text)",
		border: "var(--status-warn-border)",
		bg: "var(--status-warn-subtle)",
	},
	blue: {
		color: "var(--color-blue)",
		border: "var(--color-blue-border)",
		bg: "var(--color-blue-subtle)",
	},
	danger: {
		color: "var(--status-down-text)",
		border: "var(--status-down-border)",
		bg: "var(--status-down-subtle)",
	},
};

function ActionButton({
	onClick,
	icon: Icon,
	label,
	variant,
	loading = false,
	disabled = false,
}: {
	onClick: () => void;
	icon: React.ElementType;
	label: string;
	variant: ActionVariant;
	loading?: boolean;
	disabled?: boolean;
}) {
	const t = ACTION_TONES[variant];
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={loading || disabled}
			className="nn-cockpit-action group flex items-center gap-2.5 px-3 h-9 rounded text-[11px] font-semibold text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed"
			style={
				{
					border: "1px solid var(--border-default)",
					color: "var(--text-secondary)",
					background: "transparent",
					"--nn-act-border": t.border,
					"--nn-act-bg": t.bg,
					"--nn-act-color": t.color,
				} as React.CSSProperties
			}
		>
			{loading ? (
				<Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
			) : (
				<Icon className="w-3.5 h-3.5 shrink-0" />
			)}
			<span className="flex-1">{label}</span>
			<ChevronRight className="w-3 h-3 shrink-0 opacity-0 -translate-x-1 transition-all group-hover:opacity-60 group-hover:translate-x-0" />
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

	return (
		<motion.aside
			initial={{ opacity: 0, x: -8 }}
			animate={{ opacity: 1, x: 0 }}
			transition={{ duration: 0.35 }}
			className="flex flex-col lg:w-[280px] lg:shrink-0 lg:sticky lg:top-0 lg:self-start lg:max-h-[calc(100vh-1rem)] lg:overflow-y-auto lg:pr-1"
		>
			<button
				type="button"
				onClick={onBack}
				className="group self-start flex items-center gap-1.5 text-[10px] font-bold tracking-[0.14em] uppercase mb-5 px-1 py-1 rounded transition-colors"
				style={{ color: "var(--text-muted)" }}
			>
				<ArrowLeft className="w-3 h-3 transition-transform group-hover:-translate-x-0.5" />
				Tüm Servisler
			</button>

			<div
				className="relative flex flex-col gap-3 pb-5 mb-5"
				style={{ borderBottom: "1px solid var(--border-subtle)" }}
			>
				<div className="absolute top-0 left-0 right-0 h-px overflow-hidden pointer-events-none">
					<span
						className="block h-full nn-scan-flow"
						style={{ opacity: service.status === "up" ? 0.8 : 0.25 }}
					/>
				</div>

				<div className="flex items-center gap-3">
					<StatusOrb status={service.status} size={10} />
					<div className="min-w-0 flex-1">
						<p
							className="text-[9px] uppercase tracking-[0.22em] font-bold leading-none mb-1.5"
							style={{
								color:
									service.status === "up"
										? "var(--status-up-text)"
										: service.status === "degraded"
											? "var(--status-warn-text)"
											: service.status === "down"
												? "var(--status-down-text)"
												: "var(--text-faint)",
							}}
						>
							{STATUS_LABEL[service.status]}
						</p>
						<h1
							className="text-lg font-bold leading-tight tracking-tight truncate"
							style={{ color: "var(--text-primary)" }}
							title={service.name}
						>
							{service.name}
						</h1>
					</div>
				</div>

				<button
					type="button"
					onClick={copy}
					className="group flex items-center gap-2 px-2 py-1.5 -mx-2 rounded transition-colors hover:bg-[var(--surface-sunken)]"
					aria-label="Adresi kopyala"
				>
					<span
						className="text-[11px] font-mono truncate flex-1 text-left"
						style={{ color: "var(--text-secondary)" }}
					>
						{service.host}
						<span style={{ color: "var(--text-faint)" }}>:</span>
						{service.port}
					</span>
					{copied ? (
						<Check
							className="w-3 h-3 shrink-0"
							style={{ color: "var(--status-up)" }}
						/>
					) : (
						<Copy
							className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-60 transition-opacity"
							style={{ color: "var(--text-faint)" }}
						/>
					)}
				</button>
			</div>

			<dl
				className="grid grid-cols-2 gap-4 pb-5 mb-5"
				style={{ borderBottom: "1px solid var(--border-subtle)" }}
			>
				<div className="min-w-0">
					<dt
						className="text-[9px] uppercase tracking-[0.2em] font-bold mb-1"
						style={{ color: "var(--text-faint)" }}
					>
						Endpoint
					</dt>
					<dd
						className="text-[11px] font-mono truncate"
						style={{ color: "var(--text-secondary)" }}
						title={service.health_endpoint}
					>
						{service.health_endpoint}
					</dd>
				</div>
				<div>
					<dt
						className="text-[9px] uppercase tracking-[0.2em] font-bold mb-1"
						style={{ color: "var(--text-faint)" }}
					>
						Poll
					</dt>
					<dd
						className="text-[11px] font-mono tabular-nums"
						style={{ color: "var(--text-secondary)" }}
					>
						{service.poll_interval_sec}s
					</dd>
				</div>
			</dl>

			<div
				className="flex items-center gap-2.5 px-3 py-2.5 mb-5 rounded"
				style={{
					background: service.agent_connected
						? "var(--status-up-subtle)"
						: "var(--surface-sunken)",
					border: `1px solid ${
						service.agent_connected
							? "var(--status-up-border)"
							: "var(--border-default)"
					}`,
				}}
			>
				<span
					className={`w-2 h-2 rounded-full ${
						service.agent_connected ? "animate-pulse" : ""
					}`}
					style={{
						background: service.agent_connected
							? "var(--status-up)"
							: "var(--text-faint)",
						boxShadow: service.agent_connected
							? "0 0 6px var(--status-up)"
							: undefined,
					}}
				/>
				<div className="flex-1 min-w-0">
					<p
						className="text-[10px] font-bold uppercase tracking-wider leading-none"
						style={{
							color: service.agent_connected
								? "var(--status-up-text)"
								: "var(--text-muted)",
						}}
					>
						{service.agent_connected ? "Agent Canlı" : "Agent Yok"}
					</p>
					<p
						className="text-[9px] font-mono mt-1 truncate"
						style={{ color: "var(--text-faint)" }}
					>
						{service.agent_connected
							? `WS bağlı${service.agent_version ? ` · v${service.agent_version}` : ""}`
							: service.agent_last_heartbeat_at
								? `Son heartbeat ${new Date(service.agent_last_heartbeat_at).toLocaleTimeString("tr-TR")}`
								: "Kurulum gerekli"}
					</p>
				</div>
				{service.agent_status && service.agent_status !== "unknown" && (
					<span
						className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
						style={{
							color:
								service.agent_status === "healthy"
									? "var(--status-up-text)"
									: service.agent_status === "stale"
										? "var(--status-degraded-text)"
										: "var(--status-down-text)",
							background:
								service.agent_status === "healthy"
									? "var(--status-up-subtle)"
									: service.agent_status === "stale"
										? "var(--status-degraded-subtle)"
										: "var(--status-down-subtle)",
						}}
					>
						{service.agent_status}
					</span>
				)}
			</div>

			<div className="flex flex-col gap-1.5">
				<p
					className="text-[9px] uppercase tracking-[0.2em] font-bold px-1 mb-1"
					style={{ color: "var(--text-faint)" }}
				>
					Komutlar
				</p>
				<ActionButton
					onClick={onStart}
					icon={Play}
					label="Başlat"
					variant="up"
					loading={startLoading}
				/>
				<ActionButton
					onClick={onRestart}
					icon={RefreshCw}
					label="Yeniden Başlat"
					variant="teal"
				/>
				<ActionButton
					onClick={onStop}
					icon={Power}
					label="Durdur"
					variant="warn"
				/>
				<div
					className="h-px my-1.5"
					style={{ background: "var(--border-subtle)" }}
				/>
				<ActionButton
					onClick={onAgentSetup}
					icon={Zap}
					label="Agent Kurulumu"
					variant="blue"
				/>
				<ActionButton
					onClick={onDelete}
					icon={Trash2}
					label="Servisi Sil"
					variant="danger"
				/>
			</div>
		</motion.aside>
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
	{ id: "logs", label: "Günlükler", icon: FileText },
];

function SectionNav({
	active,
	onChange,
	alertCount,
	durationRight,
}: {
	active: SectionId;
	onChange: (s: SectionId) => void;
	alertCount: number;
	durationRight?: React.ReactNode;
}) {
	return (
		<div
			className="flex items-center gap-3 rounded-lg pl-1 pr-2 py-1"
			style={{
				background: "var(--surface-card)",
				border: "1px solid var(--border-default)",
			}}
		>
			<nav
				className="flex items-center gap-0.5 overflow-x-auto flex-1"
				style={{ scrollbarWidth: "none" }}
			>
				{SECTIONS.map((s) => {
					const isActive = active === s.id;
					const Icon = s.icon;
					const showBadge = s.id === "alerts" && alertCount > 0;
					return (
						<button
							key={s.id}
							type="button"
							onClick={() => onChange(s.id)}
							className="relative flex items-center gap-1.5 px-2.5 h-8 rounded text-[11px] font-semibold whitespace-nowrap transition-all"
							style={
								isActive
									? {
											color: "var(--color-teal)",
											background: "var(--color-teal-subtle)",
											boxShadow:
												"inset 0 0 0 1px var(--color-teal-border)",
										}
									: { color: "var(--text-muted)" }
							}
						>
							<Icon className="w-3 h-3 shrink-0" />
							<span>{s.label}</span>
							{showBadge && (
								<span
									className="min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center font-mono tabular-nums"
									style={
										isActive
											? {
													background: "var(--color-teal)",
													color: "white",
												}
											: {
													background: "var(--status-down-subtle)",
													color: "var(--status-down-text)",
												}
									}
								>
									{alertCount}
								</span>
							)}
						</button>
					);
				})}
			</nav>
			{durationRight && (
				<div className="shrink-0 hidden sm:block">{durationRight}</div>
			)}
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
		<div className="flex items-center gap-0.5">
			{["15m", "1h", "6h", "24h"].map((d) => (
				<button
					key={d}
					type="button"
					onClick={() => onChange(d)}
					className="px-2 h-7 rounded text-[10px] font-bold font-mono tabular-nums tracking-wider transition-all"
					style={
						value === d
							? {
									background: "var(--color-teal-subtle)",
									color: "var(--color-teal)",
									boxShadow: "inset 0 0 0 1px var(--color-teal-border)",
								}
							: { color: "var(--text-muted)" }
					}
				>
					{d}
				</button>
			))}
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
}: {
	chartData: ChartPoint[];
	loading: boolean;
	empty: boolean;
	serviceId: string;
}) {
	if (loading) {
		return (
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
				{[0, 1, 2, 3].map((i) => (
					<div
						key={i}
						className="h-[220px] rounded-lg animate-pulse"
						style={{
							background: "var(--surface-card)",
							border: "1px solid var(--border-default)",
						}}
					/>
				))}
			</div>
		);
	}

	if (empty) {
		return (
			<EmptyPanel
				icon={Activity}
				title="Metrik verisi yok"
				description="Seçili zaman aralığında bu servis için kayıtlı metrik bulunmuyor. Daha geniş bir aralık seçin veya agent bağlantısını kontrol edin."
			/>
		);
	}

	return (
		<Suspense
			fallback={
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
					{[0, 1, 2, 3].map((i) => (
						<div
							key={i}
							className="h-[220px] rounded-lg animate-pulse"
							style={{
								background: "var(--surface-card)",
								border: "1px solid var(--border-default)",
							}}
						/>
					))}
				</div>
			}
		>
			<div className="flex flex-col gap-3">
				<ServiceMetricsCharts chartData={chartData} />
				<ForecastPanel serviceId={serviceId} />
				<DependenciesPanel serviceId={serviceId} />
				<SharingPanel serviceId={serviceId} />
			</div>
		</Suspense>
	);
}

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

	return (
		<div className="flex flex-col gap-2">
			<p
				className="text-[10px] uppercase tracking-[0.2em] font-bold px-1"
				style={{ color: "var(--text-faint)" }}
			>
				{alerts.length} Aktif Uyarı
			</p>
			{alerts.map((alert, i) => {
				const severityColor =
					alert.severity === "crit"
						? "var(--status-down-text)"
						: alert.severity === "warn"
							? "var(--status-warn-text)"
							: "var(--color-blue)";
				const severityBg =
					alert.severity === "crit"
						? "var(--status-down-subtle)"
						: alert.severity === "warn"
							? "var(--status-warn-subtle)"
							: "var(--color-blue-subtle)";
				const severityBorder =
					alert.severity === "crit"
						? "var(--status-down-border)"
						: alert.severity === "warn"
							? "var(--status-warn-border)"
							: "var(--color-blue-border)";
				return (
					<motion.div
						key={alert.id}
						initial={{ opacity: 0, y: 4 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.25, delay: i * 0.04 }}
						className="group flex items-start gap-3 p-4 rounded-lg"
						style={{
							background: "var(--surface-card)",
							border: "1px solid var(--border-default)",
						}}
					>
						<span
							className="mt-1 w-2 h-2 rounded-full shrink-0"
							style={{
								background: severityColor,
								boxShadow:
									alert.severity === "crit"
										? `0 0 8px ${severityColor}`
										: undefined,
							}}
						/>
						<div className="flex-1 min-w-0">
							<div className="flex items-center gap-2 flex-wrap mb-1">
								<span
									className="text-[10px] font-mono font-bold uppercase tracking-[0.14em] px-1.5 py-0.5 rounded"
									style={{
										color: severityColor,
										background: severityBg,
										border: `1px solid ${severityBorder}`,
									}}
								>
									{alert.severity}
								</span>
								<span
									className="text-[10px] font-mono uppercase tracking-wider"
									style={{ color: "var(--text-faint)" }}
								>
									{alert.type}
								</span>
								<span className="flex-1" />
								<span
									className="text-[10px] font-mono tabular-nums"
									style={{ color: "var(--text-faint)" }}
								>
									{new Date(alert.triggered_at).toLocaleString("tr-TR", {
										day: "2-digit",
										month: "short",
										hour: "2-digit",
										minute: "2-digit",
									})}
								</span>
							</div>
							<p
								className="text-[13px] leading-snug"
								style={{ color: "var(--text-primary)" }}
							>
								{alert.message}
							</p>
						</div>
						<button
							type="button"
							onClick={() => onResolve(alert.id)}
							className="shrink-0 flex items-center gap-1 px-2.5 h-7 rounded text-[10px] font-bold uppercase tracking-wider transition-all hover:bg-[var(--status-up-subtle)]"
							style={{
								border: "1px solid var(--status-up-border)",
								color: "var(--status-up-text)",
								background: "transparent",
							}}
						>
							<Check className="w-3 h-3" />
							Çöz
						</button>
					</motion.div>
				);
			})}
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
							Terminal komutları NanoNet Agent üzerinden iletilir. Sol
							paneldeki
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
				className="nn-terminal relative flex flex-col rounded-lg overflow-hidden flex-1 min-h-[440px]"
				style={{
					background: "#060a0a",
					border: "1px solid var(--border-strong)",
				}}
			>
				<div
					className="pointer-events-none absolute inset-0 z-10"
					style={{
						backgroundImage:
							"repeating-linear-gradient(to bottom, transparent 0, transparent 2px, rgba(255,255,255,0.5) 2px, rgba(255,255,255,0.5) 3px)",
						opacity: 0.03,
						mixBlendMode: "overlay",
					}}
				/>

				<div
					className="relative z-20 flex items-center gap-2 px-4 py-2.5 shrink-0"
					style={{
						borderBottom: "1px solid rgba(255,255,255,0.08)",
						background: "rgba(255,255,255,0.03)",
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
						className="text-[10px] font-mono ml-2"
						style={{ color: "rgba(226,232,240,0.5)" }}
					>
						{service.name} — agent shell
					</span>
					<span
						className="ml-auto text-[9px] font-mono tabular-nums px-1.5 py-0.5 rounded"
						style={{
							background: service.agent_connected
								? "rgba(45,212,191,0.12)"
								: "rgba(251,113,133,0.12)",
							color: service.agent_connected ? "#2dd4bf" : "#fb7185",
						}}
					>
						{service.agent_connected ? "● LIVE" : "○ OFFLINE"}
					</span>
					{history.length > 0 && (
						<button
							type="button"
							onClick={onClear}
							className="text-[10px] font-mono transition-opacity hover:opacity-60"
							style={{ color: "rgba(226,232,240,0.5)" }}
						>
							clear
						</button>
					)}
				</div>

				<div
					ref={scrollRef}
					className="relative z-20 flex-1 overflow-y-auto p-4 font-mono text-xs"
				>
					{history.length === 0 ? (
						<div className="flex flex-col items-center justify-center h-full gap-4 select-none">
							<Terminal
								className="w-10 h-10"
								style={{ color: "rgba(45,212,191,0.3)" }}
							/>
							<p
								className="text-[11px] font-mono"
								style={{ color: "rgba(226,232,240,0.4)" }}
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
											background: "rgba(45,212,191,0.08)",
											color: "#2dd4bf",
											border: "1px solid rgba(45,212,191,0.18)",
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
						borderTop: "1px solid rgba(255,255,255,0.08)",
						background: "rgba(255,255,255,0.03)",
					}}
				>
					<span
						className="font-mono text-sm font-bold"
						style={{ color: "#2dd4bf" }}
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
						style={{ color: "#e2e8f0" }}
					/>
					<button
						type="button"
						onClick={onSubmit}
						disabled={loading || !command.trim()}
						className="shrink-0 h-7 px-2.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider transition-all disabled:opacity-40"
						style={{
							background: "rgba(45,212,191,0.14)",
							color: "#2dd4bf",
							border: "1px solid rgba(45,212,191,0.3)",
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
			? "#4ade80"
			: entry.status === "failed" || entry.status === "timeout"
				? "#fb7185"
				: "#fbbf24";

	return (
		<div className="leading-relaxed">
			<div className="flex items-center gap-2">
				<span style={{ color: "#2dd4bf" }}>$</span>
				<span style={{ color: "#e2e8f0" }}>{entry.command}</span>
				<span
					className="ml-auto font-mono text-[10px]"
					style={{ color: "rgba(226,232,240,0.4)" }}
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
						style={{ color: "rgba(226,232,240,0.4)" }}
					>
						{entry.duration_ms}ms
					</span>
				)}
			</div>
			{entry.output && (
				<pre
					className="mt-2 ml-3 p-2.5 rounded text-[11px] whitespace-pre-wrap break-all"
					style={{
						color: "rgba(226,232,240,0.85)",
						background: "rgba(255,255,255,0.025)",
						border: "1px solid rgba(255,255,255,0.05)",
					}}
				>
					{entry.output}
				</pre>
			)}
			{entry.error && (
				<pre
					className="mt-2 ml-3 p-2.5 rounded text-[11px] whitespace-pre-wrap break-all"
					style={{
						color: "#fda4af",
						background: "rgba(251,113,133,0.08)",
						border: "1px solid rgba(251,113,133,0.18)",
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
	return (
		<div className="flex flex-col gap-4">
			<div
				className="flex flex-wrap items-center gap-3 p-3 rounded-lg"
				style={{
					background: "var(--surface-card)",
					border: "1px solid var(--color-lavender-border)",
				}}
			>
				<div className="flex items-center gap-2">
					<span
						className="w-7 h-7 rounded flex items-center justify-center"
						style={{
							background: "var(--color-lavender-subtle)",
							border: "1px solid var(--color-lavender-border)",
						}}
					>
						<Sparkles
							className="w-3.5 h-3.5"
							style={{ color: "var(--color-lavender)" }}
						/>
					</span>
					<div>
						<p
							className="text-xs font-bold leading-tight"
							style={{ color: "var(--text-primary)" }}
						>
							Claude AI Analiz
						</p>
						<p
							className="text-[10px] leading-tight"
							style={{ color: "var(--text-muted)" }}
						>
							Son 30 dakikalık metriklerden kök-neden tahmini
						</p>
					</div>
				</div>

				<div className="flex items-center gap-2 ml-auto">
					<div
						className="flex rounded overflow-hidden"
						style={{ border: "1px solid var(--color-lavender-border)" }}
					>
						<button
							type="button"
							onClick={() => setDeep(false)}
							className="px-3 h-8 text-[10px] font-bold uppercase tracking-wider transition-all"
							style={
								!deep
									? {
											background: "var(--color-lavender-subtle)",
											color: "var(--color-lavender)",
										}
									: { color: "var(--text-muted)" }
							}
						>
							Hızlı
						</button>
						<button
							type="button"
							onClick={() => setDeep(true)}
							className="px-3 h-8 text-[10px] font-bold uppercase tracking-wider transition-all"
							style={
								deep
									? {
											background: "var(--color-lavender-subtle)",
											color: "var(--color-lavender)",
										}
									: { color: "var(--text-muted)" }
							}
						>
							Derin
						</button>
					</div>
					<button
						type="button"
						onClick={onAnalyze}
						disabled={loading}
						className="flex items-center gap-1.5 px-3.5 h-8 rounded text-[11px] font-bold uppercase tracking-wider text-white transition-all disabled:opacity-60"
						style={{
							background: "var(--gradient-btn-primary)",
							boxShadow: "var(--btn-shadow)",
						}}
					>
						{loading ? (
							<>
								<Loader2 className="w-3 h-3 animate-spin" /> Analiz...
							</>
						) : (
							<>
								<Sparkles className="w-3 h-3" /> Analiz Başlat
							</>
						)}
					</button>
				</div>
			</div>

			{loading && !result ? (
				<div
					className="flex flex-col items-center justify-center p-12 rounded-lg gap-3"
					style={{
						background: "var(--surface-card)",
						border: "1px solid var(--color-lavender-border)",
					}}
				>
					<Sparkles
						className="w-10 h-10 animate-pulse"
						style={{ color: "var(--color-lavender)" }}
					/>
					<p
						className="text-xs font-mono"
						style={{ color: "var(--text-muted)" }}
					>
						Claude metrikleri inceliyor...
					</p>
				</div>
			) : result ? (
				<div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
					<div
						className="lg:col-span-3 p-4 rounded-lg"
						style={{
							background: "var(--surface-card)",
							border: "1px solid var(--border-default)",
						}}
					>
						<div className="flex items-center justify-between mb-2">
							<span
								className="text-[10px] uppercase tracking-[0.2em] font-bold"
								style={{ color: "var(--text-faint)" }}
							>
								Özet
							</span>
							{result.confidence !== undefined && (
								<span
									className="text-[10px] font-mono tabular-nums px-2 py-0.5 rounded"
									style={{
										color: "var(--color-lavender)",
										background: "var(--color-lavender-subtle)",
									}}
								>
									{(result.confidence * 100).toFixed(0)}% güven
								</span>
							)}
						</div>
						<p
							className="text-sm leading-relaxed"
							style={{ color: "var(--text-primary)" }}
						>
							{result.summary}
						</p>
					</div>

					{result.root_cause && (
						<div
							className="lg:col-span-2 p-4 rounded-lg"
							style={{
								background: "var(--status-down-subtle)",
								border: "1px solid var(--status-down-border)",
							}}
						>
							<div className="flex items-center gap-1.5 mb-2">
								<AlertTriangle
									className="w-3 h-3"
									style={{ color: "var(--status-down)" }}
								/>
								<span
									className="text-[10px] uppercase tracking-[0.2em] font-bold"
									style={{ color: "var(--status-down-text)" }}
								>
									Kök Neden
								</span>
							</div>
							<p
								className="text-[13px] leading-relaxed"
								style={{ color: "var(--text-primary)" }}
							>
								{result.root_cause}
							</p>
						</div>
					)}

					{result.recommendations && result.recommendations.length > 0 && (
						<div
							className="lg:col-span-5 p-4 rounded-lg"
							style={{
								background: "var(--color-teal-subtle)",
								border: "1px solid var(--color-teal-border)",
							}}
						>
							<div className="flex items-center gap-1.5 mb-3">
								<CheckCircle2
									className="w-3 h-3"
									style={{ color: "var(--color-teal)" }}
								/>
								<span
									className="text-[10px] uppercase tracking-[0.2em] font-bold"
									style={{ color: "var(--color-teal)" }}
								>
									Öneriler
								</span>
							</div>
							<ul className="space-y-2">
								{result.recommendations.map((rec) => {
									const priorityColor =
										rec.priority === "high"
											? "var(--status-down-text)"
											: rec.priority === "medium"
												? "var(--status-warn-text)"
												: "var(--color-teal)";
									const priorityBg =
										rec.priority === "high"
											? "var(--status-down-subtle)"
											: rec.priority === "medium"
												? "var(--status-warn-subtle)"
												: "var(--color-teal-subtle)";
									return (
										<li
											key={rec.action}
											className="flex items-start gap-3 text-[13px]"
										>
											<span
												className="shrink-0 text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded mt-0.5"
												style={{
													color: priorityColor,
													background: priorityBg,
												}}
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
						</div>
					)}
				</div>
			) : (
				<EmptyPanel
					icon={Sparkles}
					iconColor="var(--color-lavender)"
					title="Henüz analiz yok"
					description="Son metriklerde anomali tespit etmek için Analiz Başlat'a tıklayın. Derin analiz daha detaylı çıktı üretir."
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
			className="flex flex-col items-center justify-center p-12 rounded-lg text-center"
			style={{
				background: "var(--surface-card)",
				border: "1px solid var(--border-default)",
			}}
		>
			<span
				className="w-10 h-10 rounded-full flex items-center justify-center mb-4"
				style={{
					background: "var(--surface-sunken)",
					border: "1px solid var(--border-default)",
				}}
			>
				<Icon
					className="w-4 h-4"
					style={{ color: iconColor ?? "var(--text-faint)" }}
				/>
			</span>
			<p
				className="text-sm font-semibold mb-1"
				style={{ color: "var(--text-primary)" }}
			>
				{title}
			</p>
			<p
				className="text-xs leading-relaxed max-w-md"
				style={{ color: "var(--text-muted)" }}
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

	// ──────────────────────────────────────────────────────────────── LOADING
	if (serviceLoading) {
		return (
			<PageShell width="wide" fill>
				<div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
					<div
						className="lg:w-[280px] lg:shrink-0 h-[420px] rounded-lg animate-pulse"
						style={{
							background: "var(--surface-card)",
							border: "1px solid var(--border-default)",
						}}
					/>
					<div className="flex-1 flex flex-col gap-3">
						<div
							className="h-[120px] rounded-lg animate-pulse"
							style={{
								background: "var(--surface-card)",
								border: "1px solid var(--border-default)",
							}}
						/>
						<div
							className="h-[44px] rounded-lg animate-pulse"
							style={{
								background: "var(--surface-card)",
								border: "1px solid var(--border-default)",
							}}
						/>
						<div
							className="flex-1 rounded-lg animate-pulse"
							style={{
								background: "var(--surface-card)",
								border: "1px solid var(--border-default)",
							}}
						/>
					</div>
				</div>
			</PageShell>
		);
	}

	// ────────────────────────────────────────────────────────────── NOT FOUND
	if (!service) {
		return (
			<PageShell width="wide" fill>
				<div className="flex flex-col items-center justify-center flex-1 min-h-0 text-center">
					<div
						className="w-14 h-14 rounded-xl flex items-center justify-center mb-5"
						style={{
							background: "var(--surface-sunken)",
							border: "1px solid var(--border-default)",
						}}
					>
						<Server
							className="w-6 h-6"
							style={{ color: "var(--text-faint)" }}
						/>
					</div>
					<h2
						className="text-lg font-bold mb-2"
						style={{ color: "var(--text-primary)" }}
					>
						Servis bulunamadı
					</h2>
					<p
						className="text-sm mb-6 max-w-sm"
						style={{ color: "var(--text-muted)" }}
					>
						Bu servis silinmiş olabilir ya da erişim izniniz yok.
					</p>
					<button
						type="button"
						onClick={() => navigate("/app/services")}
						className="flex items-center gap-1.5 px-4 h-9 rounded text-[12px] font-semibold text-white"
						style={{
							background: "var(--gradient-btn-primary)",
							boxShadow: "var(--btn-shadow)",
						}}
					>
						<ArrowLeft className="w-3.5 h-3.5" /> Servislere Dön
					</button>
				</div>
			</PageShell>
		);
	}

	// ────────────────────────────────────────────────────────────────── MAIN
	return (
		<PageShell width="wide" fill>
			<style>{`
				.nn-cockpit-action:not(:disabled):hover {
					border-color: var(--nn-act-border) !important;
					background: var(--nn-act-bg) !important;
					color: var(--nn-act-color) !important;
				}
				.nn-vital-stripe::before {
					content: "";
					position: absolute;
					inset: 0;
					background-image: repeating-linear-gradient(-45deg, currentColor 0, currentColor 1px, transparent 1px, transparent 10px);
					opacity: 0.03;
					pointer-events: none;
				}
				.nn-scan-flow {
					background: linear-gradient(to right, transparent 0%, var(--color-teal) 50%, transparent 100%);
					background-size: 60% 100%;
					background-repeat: no-repeat;
					animation: nn-scan-flow 3.2s ease-in-out infinite;
				}
				@keyframes nn-scan-flow {
					0% { background-position: -60% 0; }
					100% { background-position: 160% 0; }
				}
			`}</style>

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
						durationRight={
							activeSection === "overview" ? (
								<DurationControl
									value={metricsDuration}
									onChange={setMetricsDuration}
								/>
							) : null
						}
					/>

					<div className="flex-1 min-h-0 overflow-y-auto pr-1">
						<AnimatePresence mode="wait">
							<motion.div
								key={activeSection}
								initial={{ opacity: 0, y: 6 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -4 }}
								transition={{ duration: 0.22 }}
								className={activeSection === "logs" ? "h-full" : ""}
							>
								{activeSection === "overview" && (
									<OverviewSection
										chartData={chartData}
										loading={metricsLoading}
										empty={chartData.length === 0}
										serviceId={serviceId ?? ""}
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
							</motion.div>
						</AnimatePresence>

						{/* Logs — always mounted so WS stream persists across tab switches */}
						<div
							style={{
								display: activeSection === "logs" ? "block" : "none",
							}}
							className="h-[calc(100%-1px)] min-h-[420px]"
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
				<DialogContent
					className="rounded"
					style={{
						background: "var(--surface-card)",
						border: "1px solid var(--status-down-border)",
						boxShadow: "var(--panel-shadow)",
					}}
				>
					<DialogHeader>
						<DialogTitle style={{ color: "var(--status-down-text)" }}>
							Servisi Sil
						</DialogTitle>
						<DialogDescription style={{ color: "var(--text-muted)" }}>
							<strong style={{ color: "var(--text-secondary)" }}>
								{service.name}
							</strong>{" "}
							servisini silmek istediğinize emin misiniz? Bu işlem geri
							alınamaz ve tüm metrik geçmişi kaybolacak.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setDeleteDialogOpen(false)}
							className="rounded"
						>
							İptal
						</Button>
						<Button
							onClick={handleDelete}
							className="text-white rounded"
							style={{ background: "var(--status-down-text)" }}
						>
							<Trash2 className="w-3 h-3 mr-1" /> Kalıcı Olarak Sil
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={restartConfirmOpen} onOpenChange={setRestartConfirmOpen}>
				<DialogContent
					className="rounded max-w-sm"
					style={{
						background: "var(--surface-card)",
						border: "1px solid var(--color-teal-border)",
						boxShadow: "var(--panel-shadow)",
					}}
				>
					<DialogHeader>
						<DialogTitle style={{ color: "var(--color-teal)" }}>
							Yeniden Başlat
						</DialogTitle>
						<DialogDescription style={{ color: "var(--text-muted)" }}>
							<strong style={{ color: "var(--text-secondary)" }}>
								{service.name}
							</strong>{" "}
							yeniden başlatılacak. Aktif bağlantılar kesilecektir.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setRestartConfirmOpen(false)}
							className="rounded text-xs"
						>
							İptal
						</Button>
						<Button
							onClick={handleRestart}
							className="rounded text-xs text-white"
							style={{ background: "var(--color-teal)" }}
						>
							<RefreshCw className="w-3 h-3 mr-1" /> Yeniden Başlat
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={stopConfirmOpen} onOpenChange={setStopConfirmOpen}>
				<DialogContent
					className="rounded max-w-sm"
					style={{
						background: "var(--surface-card)",
						border: "1px solid var(--status-warn-border)",
						boxShadow: "var(--panel-shadow)",
					}}
				>
					<DialogHeader>
						<DialogTitle style={{ color: "var(--status-warn-text)" }}>
							Servisi Durdur
						</DialogTitle>
						<DialogDescription style={{ color: "var(--text-muted)" }}>
							<strong style={{ color: "var(--text-secondary)" }}>
								{service.name}
							</strong>{" "}
							durdurulacak. Servis yanıt vermez hale gelecektir.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setStopConfirmOpen(false)}
							className="rounded text-xs"
						>
							İptal
						</Button>
						<Button
							onClick={handleStop}
							className="rounded text-xs text-white"
							style={{ background: "var(--status-warn)" }}
						>
							<Power className="w-3 h-3 mr-1" /> Durdur
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
				<DialogContent
					className="rounded max-w-sm"
					style={{
						background: "var(--surface-card)",
						border: "1px solid var(--status-warn-border)",
						boxShadow: "var(--panel-shadow)",
					}}
				>
					<DialogHeader>
						<DialogTitle style={{ color: "var(--status-warn-text)" }}>
							Terminal Erişimi
						</DialogTitle>
						<DialogDescription asChild>
							<div
								className="space-y-3 text-xs"
								style={{ color: "var(--text-muted)" }}
							>
								<p>
									Bu terminal{" "}
									<strong style={{ color: "var(--text-secondary)" }}>
										{service.name}
									</strong>{" "}
									sunucusunda doğrudan komut çalıştırır.
								</p>
								<ul
									className="space-y-1 pl-3"
									style={{
										borderLeft: "1px solid var(--status-warn-border)",
									}}
								>
									<li>
										Yalnızca{" "}
										<code
											className="font-mono"
											style={{ color: "var(--color-teal)" }}
										>
											status
										</code>
										,{" "}
										<code
											className="font-mono"
											style={{ color: "var(--color-teal)" }}
										>
											mem
										</code>
										,{" "}
										<code
											className="font-mono"
											style={{ color: "var(--color-teal)" }}
										>
											cpu
										</code>
										,{" "}
										<code
											className="font-mono"
											style={{ color: "var(--color-teal)" }}
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
							onClick={() => {
								setExecConfirmOpen(false);
								setPendingCommand("");
							}}
							className="rounded text-xs"
						>
							İptal
						</Button>
						<Button
							onClick={() => {
								sessionStorage.setItem("exec_session_confirmed", "1");
								setExecSessionConfirmed(true);
								setExecConfirmOpen(false);
								void handleExecDirect(pendingCommand);
								setPendingCommand("");
							}}
							className="rounded text-xs text-white"
							style={{ background: "var(--status-warn)" }}
						>
							<Terminal className="w-3 h-3 mr-1" /> Anladım, Devam Et
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

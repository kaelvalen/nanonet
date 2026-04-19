import type { ReactNode } from "react";
import { cn } from "./utils";

export type Status = "up" | "down" | "degraded" | "unknown";
export type Severity = "crit" | "warn" | "info";

/* Status grammar — every up/down/degraded surface in the app should ultimately
   resolve through these tokens (instead of importing colors directly). The
   four statuses are hue-disjoint from the brand and are the ONLY palette
   allowed for representing service health. */
const STATUS_TOKENS: Record<
	Status,
	{ dot: string; bg: string; text: string; border: string; label: string }
> = {
	up: {
		dot: "var(--status-up)",
		bg: "var(--status-up-subtle)",
		text: "var(--status-up-text)",
		border: "var(--status-up-border)",
		label: "Aktif",
	},
	degraded: {
		dot: "var(--status-degraded)",
		bg: "var(--status-degraded-subtle)",
		text: "var(--status-degraded-text)",
		border: "var(--status-degraded-border)",
		label: "Bozulmuş",
	},
	down: {
		dot: "var(--status-down)",
		bg: "var(--status-down-subtle)",
		text: "var(--status-down-text)",
		border: "var(--status-down-border)",
		label: "Çevrimdışı",
	},
	unknown: {
		dot: "var(--status-unknown)",
		bg: "var(--surface-sunken)",
		text: "var(--text-tertiary)",
		border: "var(--border-default)",
		label: "Bilinmiyor",
	},
};

const SEVERITY_TOKENS: Record<
	Severity,
	{ dot: string; bg: string; text: string; border: string; label: string }
> = {
	crit: {
		dot: "var(--status-down)",
		bg: "var(--status-down-subtle)",
		text: "var(--status-down-text)",
		border: "var(--status-down-border)",
		label: "Kritik",
	},
	warn: {
		dot: "var(--status-degraded)",
		bg: "var(--status-degraded-subtle)",
		text: "var(--status-degraded-text)",
		border: "var(--status-degraded-border)",
		label: "Uyarı",
	},
	info: {
		dot: "var(--brand-primary)",
		bg: "var(--brand-primary-subtle)",
		text: "var(--brand-primary)",
		border: "var(--color-teal-border)",
		label: "Bilgi",
	},
};

/** Small colored dot. Optional pulse for live/active. */
export function StatusDot({
	status,
	pulse = false,
	size = 8,
	className,
}: {
	status: Status;
	pulse?: boolean;
	size?: number;
	className?: string;
}) {
	const s = STATUS_TOKENS[status];
	return (
		<span
			className={cn(
				"inline-block rounded-full shrink-0",
				pulse && "animate-pulse",
				className,
			)}
			style={{
				background: s.dot,
				width: size,
				height: size,
				boxShadow:
					status === "up" && pulse
						? `0 0 0 3px color-mix(in srgb, ${s.dot} 22%, transparent)`
						: undefined,
			}}
		/>
	);
}

/** Pill-shaped colored badge. */
export function StatusBadge({
	status,
	children,
}: {
	status: Status;
	children?: ReactNode;
}) {
	const s = STATUS_TOKENS[status];
	return (
		<span
			className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold rounded-full whitespace-nowrap tnum"
			style={{ background: s.bg, color: s.text }}
		>
			<span
				className="w-1.5 h-1.5 rounded-full"
				style={{ background: s.dot }}
			/>
			{children ?? s.label}
		</span>
	);
}

/** Alert severity pill. */
export function SeverityBadge({
	severity,
	children,
}: {
	severity: Severity;
	children?: ReactNode;
}) {
	const s = SEVERITY_TOKENS[severity];
	return (
		<span
			className="inline-flex items-center gap-1.5 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded whitespace-nowrap"
			style={{
				background: s.bg,
				color: s.text,
				border: `1px solid ${s.border}`,
			}}
		>
			{children ?? s.label}
		</span>
	);
}

/** Keyboard shortcut chip (⌘K style). */
export function KbdHint({ children }: { children: ReactNode }) {
	return (
		<kbd
			className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 text-[10px] font-mono font-semibold rounded"
			style={{
				background: "var(--surface-sunken)",
				border: "1px solid var(--border-subtle)",
				color: "var(--text-tertiary)",
				boxShadow: "none",
			}}
		>
			{children}
		</kbd>
	);
}

import type { ReactNode } from "react";
import { cn } from "./utils";

export type Status = "up" | "down" | "degraded" | "unknown";
export type Severity = "crit" | "warn" | "info";

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
		dot: "var(--status-warn)",
		bg: "var(--status-warn-subtle)",
		text: "var(--status-warn-text)",
		border: "var(--status-warn-border)",
		label: "Bozuk",
	},
	down: {
		dot: "var(--status-down)",
		bg: "var(--status-down-subtle)",
		text: "var(--status-down-text)",
		border: "var(--status-down-border)",
		label: "Offline",
	},
	unknown: {
		dot: "var(--status-unknown)",
		bg: "var(--surface-sunken)",
		text: "var(--text-muted)",
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
		dot: "var(--status-warn)",
		bg: "var(--status-warn-subtle)",
		text: "var(--status-warn-text)",
		border: "var(--status-warn-border)",
		label: "Uyarı",
	},
	info: {
		dot: "var(--color-teal)",
		bg: "var(--color-teal-subtle)",
		text: "var(--color-teal)",
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
					status === "up" && pulse ? `0 0 6px ${s.dot}` : undefined,
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
			className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold rounded-full whitespace-nowrap"
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
				border: "1px solid var(--border-default)",
				color: "var(--text-faint)",
				boxShadow: "none",
			}}
		>
			{children}
		</kbd>
	);
}

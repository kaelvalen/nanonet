import type { CSSProperties, ReactNode } from "react";
import { cn } from "./utils";

/**
 * Panel — the canonical surface used throughout the app.
 *
 * Replaces the dozens of one-off
 *   <div style={{ background: "var(--surface-card)", border: "1px solid var(--border-default)", borderRadius: "var(--radius)" }}>
 * blocks. Use `<Panel>` as the outer container, `<PanelHeader>` for a
 * title/actions row, `<PanelBody>` for the scrollable content, and
 * `<PanelFooter>` for trailing actions.
 *
 * Tone variants tint the panel for emphasis (success/warn/danger/info).
 */

export type PanelTone =
	| "default"
	| "raised"
	| "sunken"
	| "muted"
	| "success"
	| "warn"
	| "danger"
	| "info"
	| "accent";

const TONES: Record<PanelTone, { bg: string; border: string }> = {
	default: { bg: "var(--surface-card)", border: "var(--border-default)" },
	raised: { bg: "var(--surface-raised)", border: "var(--border-default)" },
	sunken: { bg: "var(--surface-sunken)", border: "var(--border-subtle)" },
	muted: { bg: "var(--surface-sunken)", border: "var(--border-default)" },
	success: { bg: "var(--status-up-subtle)", border: "var(--status-up-border)" },
	warn: { bg: "var(--status-warn-subtle)", border: "var(--status-warn-border)" },
	danger: {
		bg: "var(--status-down-subtle)",
		border: "var(--status-down-border)",
	},
	info: { bg: "var(--color-blue-subtle)", border: "var(--color-blue-border)" },
	accent: {
		bg: "var(--color-teal-subtle)",
		border: "var(--color-teal-border)",
	},
};

interface PanelProps {
	children: ReactNode;
	tone?: PanelTone;
	/** Drop the default 1px border (rare — use only when nesting) */
	flush?: boolean;
	/** Internal flex column with min-h-0 — use when content needs to scroll */
	fill?: boolean;
	/** Additional padding preset; default = none (use PanelHeader/Body) */
	padding?: "none" | "sm" | "md" | "lg";
	className?: string;
	style?: CSSProperties;
	onClick?: () => void;
	role?: string;
}

export function Panel({
	children,
	tone = "default",
	flush = false,
	fill = false,
	padding = "none",
	className,
	style,
	onClick,
	role,
}: PanelProps) {
	const t = TONES[tone];
	const pad =
		padding === "lg"
			? "p-5"
			: padding === "md"
				? "p-4"
				: padding === "sm"
					? "p-3"
					: "";
	return (
		<div
			role={role}
			onClick={onClick}
			className={cn(
				"rounded-xl",
				fill && "flex flex-col min-h-0 overflow-hidden",
				pad,
				className,
			)}
			style={{
				background: t.bg,
				border: flush ? undefined : `1px solid ${t.border}`,
				...style,
			}}
		>
			{children}
		</div>
	);
}

interface PanelHeaderProps {
	children: ReactNode;
	actions?: ReactNode;
	icon?: ReactNode;
	subtitle?: ReactNode;
	className?: string;
	tone?: "default" | "sunken";
	dense?: boolean;
}

/** Header row inside a Panel — title left, actions right. */
export function PanelHeader({
	children,
	actions,
	icon,
	subtitle,
	className,
	tone = "default",
	dense = false,
}: PanelHeaderProps) {
	return (
		<div
			className={cn(
				"flex items-center justify-between gap-2 shrink-0",
				dense ? "px-3.5 py-2.5" : "px-4 py-3.5",
				className,
			)}
			style={{
				borderBottom: "1px solid var(--border-subtle)",
				background:
					tone === "sunken" ? "var(--surface-sunken)" : "transparent",
			}}
		>
			<div className="flex items-center gap-2.5 min-w-0">
				{icon && <div className="shrink-0">{icon}</div>}
				<div className="min-w-0">
					<h3
						className={cn(
							"font-semibold leading-tight truncate tracking-tight",
							dense ? "text-[13px]" : "text-[14px]",
						)}
						style={{ color: "var(--text-primary)" }}
					>
						{children}
					</h3>
					{subtitle && (
						<p
							className="text-[11px] mt-0.5 truncate"
							style={{ color: "var(--text-muted)" }}
						>
							{subtitle}
						</p>
					)}
				</div>
			</div>
			{actions && (
				<div className="flex items-center gap-1.5 shrink-0">{actions}</div>
			)}
		</div>
	);
}

/** Scrollable body of a panel. Use inside a `fill` panel for auto-scroll. */
export function PanelBody({
	children,
	className,
	scroll = true,
	padding = "md",
}: {
	children: ReactNode;
	className?: string;
	scroll?: boolean;
	padding?: "none" | "sm" | "md" | "lg";
}) {
	const pad =
		padding === "lg"
			? "p-5"
			: padding === "md"
				? "p-4"
				: padding === "sm"
					? "p-3"
					: "";
	return (
		<div
			className={cn(
				scroll && "flex-1 min-h-0 overflow-y-auto",
				pad,
				className,
			)}
		>
			{children}
		</div>
	);
}

/** Footer row inside a Panel — typically used for primary CTA. */
export function PanelFooter({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"flex items-center justify-end gap-2 px-4 py-3 shrink-0",
				className,
			)}
			style={{ borderTop: "1px solid var(--border-subtle)" }}
		>
			{children}
		</div>
	);
}

/** Icon disc — small colored background with an icon, used in PanelHeader. */
export function PanelIcon({
	children,
	tone = "accent",
}: {
	children: ReactNode;
	tone?: "accent" | "info" | "success" | "warn" | "danger" | "violet";
}) {
	const colors = {
		accent: { bg: "var(--color-teal-subtle)", border: "var(--color-teal-border)", color: "var(--color-teal)" },
		info: { bg: "var(--color-blue-subtle)", border: "var(--color-blue-border)", color: "var(--color-blue)" },
		success: { bg: "var(--status-up-subtle)", border: "var(--status-up-border)", color: "var(--status-up)" },
		warn: { bg: "var(--status-warn-subtle)", border: "var(--status-warn-border)", color: "var(--status-warn)" },
		danger: { bg: "var(--status-down-subtle)", border: "var(--status-down-border)", color: "var(--status-down)" },
		violet: { bg: "var(--color-violet-subtle)", border: "var(--color-violet-border)", color: "var(--color-violet)" },
	} as const;
	const c = colors[tone];
	return (
		<div
			className="w-8 h-8 rounded-xl flex items-center justify-center"
			style={{ background: c.bg, color: c.color }}
		>
			{children}
		</div>
	);
}

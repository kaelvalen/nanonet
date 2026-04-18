import type { ReactNode } from "react";
import { cn } from "./utils";

/**
 * Toolbar — the canonical horizontal strip used between the page title
 * (in TopBar) and the page content. Holds search inputs, filter chips,
 * sort selectors, view toggles, etc.
 *
 * Mobile behavior:
 * - On <sm: stacks vertically, full-width children
 * - On sm+: row, left-aligned, with an optional right slot
 * - Children that opt into `data-toolbar-grow` will fill remaining space
 *
 * Use `<Toolbar>` once per page, immediately after `<PageHeader>`.
 */

interface ToolbarProps {
	children: ReactNode;
	right?: ReactNode;
	className?: string;
	/** Top-and-bottom border, sticky-friendly */
	bordered?: boolean;
	/** Compact (h-8 controls) vs default (h-9 controls) */
	dense?: boolean;
}

export function Toolbar({
	children,
	right,
	className,
	bordered = false,
	dense = false,
}: ToolbarProps) {
	return (
		<div
			className={cn(
				"flex flex-col sm:flex-row sm:items-center gap-2 shrink-0 mb-3",
				dense ? "py-1" : "py-1.5",
				bordered && "border-b pb-3",
				className,
			)}
			style={
				bordered ? { borderColor: "var(--border-subtle)" } : undefined
			}
		>
			<div className="flex flex-1 flex-wrap items-center gap-2 min-w-0">
				{children}
			</div>
			{right && (
				<div className="flex items-center gap-2 shrink-0">{right}</div>
			)}
		</div>
	);
}

/** A horizontally scrolling group of filter chips for tight mobile space. */
export function ToolbarChips({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"flex items-center gap-1.5 overflow-x-auto -mx-1 px-1 scroll-smooth",
				"[&::-webkit-scrollbar]:hidden [scrollbar-width:none]",
				className,
			)}
		>
			{children}
		</div>
	);
}

/** Single filter chip — selectable, semantic tone, mobile-friendly. */
export function FilterChip({
	active,
	onClick,
	icon,
	count,
	children,
	tone = "default",
}: {
	active?: boolean;
	onClick?: () => void;
	icon?: ReactNode;
	count?: number | string;
	children: ReactNode;
	tone?: "default" | "danger" | "warn" | "success" | "info" | "accent";
}) {
	const tones = {
		default: { bgActive: "var(--surface-card)", borderActive: "var(--border-strong)", color: "var(--text-primary)" },
		danger: { bgActive: "var(--status-down-subtle)", borderActive: "var(--status-down-border)", color: "var(--status-down-text)" },
		warn: { bgActive: "var(--status-warn-subtle)", borderActive: "var(--status-warn-border)", color: "var(--status-warn-text)" },
		success: { bgActive: "var(--status-up-subtle)", borderActive: "var(--status-up-border)", color: "var(--status-up-text)" },
		info: { bgActive: "var(--color-blue-subtle)", borderActive: "var(--color-blue-border)", color: "var(--color-blue-text)" },
		accent: { bgActive: "var(--color-teal-subtle)", borderActive: "var(--color-teal-border)", color: "var(--color-teal)" },
	} as const;
	const t = tones[tone];
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"shrink-0 inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs font-medium transition-colors",
				"hover:bg-[var(--surface-sunken)]",
			)}
			style={{
				background: active ? t.bgActive : "transparent",
				border: `1px solid ${active ? t.borderActive : "var(--border-default)"}`,
				color: active ? t.color : "var(--text-muted)",
			}}
		>
			{icon}
			<span>{children}</span>
			{count != null && (
				<span
					className="text-[10px] tabular-nums px-1 rounded font-bold"
					style={{
						background: active ? "transparent" : "var(--surface-sunken)",
						color: active ? t.color : "var(--text-faint)",
					}}
				>
					{count}
				</span>
			)}
		</button>
	);
}

/** Vertical separator between toolbar groups. */
export function ToolbarDivider() {
	return (
		<span
			className="hidden sm:block w-px h-5 mx-1"
			style={{ background: "var(--border-default)" }}
		/>
	);
}

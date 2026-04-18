import type { ElementType, ReactNode } from "react";
import { Link } from "react-router";
import { cn } from "./utils";

/**
 * StatCard — single metric tile used in dashboards, summary headers, and
 * detail pages. Mobile-friendly: text scales gracefully and the card
 * stays one row tall.
 *
 * Variants:
 *   - tone: default / accent / success / warn / danger / info / violet
 *   - size: sm (chip) / md (default) / lg (hero)
 */

export type StatTone =
	| "default"
	| "accent"
	| "success"
	| "warn"
	| "danger"
	| "info"
	| "violet";

const TONES: Record<StatTone, { color: string; bg: string; border: string }> = {
	default: {
		color: "var(--text-muted)",
		bg: "var(--surface-sunken)",
		border: "var(--border-default)",
	},
	accent: {
		color: "var(--color-teal)",
		bg: "var(--color-teal-subtle)",
		border: "var(--color-teal-border)",
	},
	success: {
		color: "var(--status-up)",
		bg: "var(--status-up-subtle)",
		border: "var(--status-up-border)",
	},
	warn: {
		color: "var(--status-warn)",
		bg: "var(--status-warn-subtle)",
		border: "var(--status-warn-border)",
	},
	danger: {
		color: "var(--status-down)",
		bg: "var(--status-down-subtle)",
		border: "var(--status-down-border)",
	},
	info: {
		color: "var(--color-blue)",
		bg: "var(--color-blue-subtle)",
		border: "var(--color-blue-border)",
	},
	violet: {
		color: "var(--color-violet)",
		bg: "var(--color-violet-subtle)",
		border: "var(--color-violet-border)",
	},
};

interface StatCardProps {
	label: string;
	value: ReactNode;
	hint?: ReactNode;
	icon?: ElementType;
	tone?: StatTone;
	size?: "sm" | "md" | "lg";
	to?: string;
	className?: string;
}

export function StatCard({
	label,
	value,
	hint,
	icon: Icon,
	tone = "default",
	size = "md",
	to,
	className,
}: StatCardProps) {
	const t = TONES[tone];

	const labelSize = size === "lg" ? "text-[11px]" : "text-[10px]";
	const valueSize =
		size === "lg"
			? "text-2xl"
			: size === "sm"
				? "text-base"
				: "text-lg sm:text-xl";
	const iconBox = size === "lg" ? "w-11 h-11" : size === "sm" ? "w-7 h-7" : "w-9 h-9";
	const iconSize = size === "lg" ? "w-5 h-5" : size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";
	const padding = size === "sm" ? "p-3" : "p-3.5";

	const inner = (
		<div
			className={cn(
				"flex items-center gap-3 rounded-[var(--radius)] transition-colors",
				to && "hover:bg-[var(--surface-sunken)] cursor-pointer",
				padding,
				className,
			)}
			style={{
				background: "var(--surface-card)",
				border: "1px solid var(--border-default)",
			}}
		>
			{Icon && (
				<div
					className={cn(
						"rounded-md flex items-center justify-center shrink-0",
						iconBox,
					)}
					style={{
						background: t.bg,
						border: `1px solid ${t.border}`,
						color: t.color,
					}}
				>
					<Icon className={iconSize} />
				</div>
			)}
			<div className="min-w-0 flex-1">
				<p
					className={cn(
						"font-bold uppercase tracking-[0.14em] leading-none",
						labelSize,
					)}
					style={{ color: "var(--text-faint)" }}
				>
					{label}
				</p>
				<div className="flex items-baseline gap-1.5 mt-1.5 min-w-0">
					<p
						className={cn(
							"font-bold tabular-nums font-mono leading-none truncate",
							valueSize,
						)}
						style={{ color: "var(--text-primary)" }}
					>
						{value}
					</p>
					{hint && (
						<p
							className="text-[10px] leading-none truncate"
							style={{ color: "var(--text-faint)" }}
						>
							{hint}
						</p>
					)}
				</div>
			</div>
		</div>
	);

	return to ? (
		<Link to={to} className="block">
			{inner}
		</Link>
	) : (
		inner
	);
}

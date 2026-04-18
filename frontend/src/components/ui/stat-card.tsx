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

	const labelSize = size === "lg" ? "text-[12px]" : "text-[11px]";
	const valueSize =
		size === "lg"
			? "text-[28px]"
			: size === "sm"
				? "text-[18px]"
				: "text-[22px]";
	const iconBox = size === "lg" ? "w-11 h-11" : size === "sm" ? "w-8 h-8" : "w-10 h-10";
	const iconSize = size === "lg" ? "w-5 h-5" : size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";
	const padding = size === "sm" ? "p-3" : "p-4";

	const inner = (
		<div
			className={cn(
				"flex items-center gap-3 rounded-xl transition-all",
				to && "hover:border-[color:var(--border-strong)] cursor-pointer",
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
						"rounded-xl flex items-center justify-center shrink-0",
						iconBox,
					)}
					style={{
						background: t.bg,
						color: t.color,
					}}
				>
					<Icon className={iconSize} />
				</div>
			)}
			<div className="min-w-0 flex-1">
				<p
					className={cn("font-medium leading-none", labelSize)}
					style={{ color: "var(--text-muted)" }}
				>
					{label}
				</p>
				<div className="flex items-baseline gap-1.5 mt-2 min-w-0">
					<p
						className={cn(
							"font-semibold tabular-nums leading-none truncate tracking-tight",
							valueSize,
						)}
						style={{ color: "var(--text-primary)" }}
					>
						{value}
					</p>
					{hint && (
						<p
							className="text-[11px] leading-none truncate font-medium"
							style={{ color: t.color }}
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

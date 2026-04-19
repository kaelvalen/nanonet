import type { ElementType, ReactNode } from "react";
import { Link } from "react-router";
import { cn } from "./utils";

/**
 * StatCard — single metric tile used in dashboards, summary headers, and
 * detail pages. Quiet Swiss: no gradient backgrounds, 2px left accent bar
 * for tone, tabular nums on the value.
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

const TONE_ACCENT: Record<StatTone, string> = {
	default: "var(--border-strong)",
	accent: "var(--brand-primary)",
	success: "var(--status-up)",
	warn: "var(--status-degraded)",
	danger: "var(--status-down)",
	info: "var(--brand-primary)",
	violet: "var(--text-secondary)",
};

const TONE_ICON: Record<StatTone, { bg: string; color: string }> = {
	default: { bg: "var(--surface-sunken)", color: "var(--text-tertiary)" },
	accent: { bg: "var(--brand-primary-subtle)", color: "var(--brand-primary)" },
	success: { bg: "var(--status-up-subtle)", color: "var(--status-up)" },
	warn: {
		bg: "var(--status-degraded-subtle)",
		color: "var(--status-degraded)",
	},
	danger: { bg: "var(--status-down-subtle)", color: "var(--status-down)" },
	info: { bg: "var(--brand-primary-subtle)", color: "var(--brand-primary)" },
	violet: { bg: "var(--surface-sunken)", color: "var(--text-secondary)" },
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
	const accent = TONE_ACCENT[tone];
	const iconStyle = TONE_ICON[tone];

	const labelSize = size === "lg" ? "text-[12px]" : "text-[11px]";
	const valueSize =
		size === "lg"
			? "text-[26px]"
			: size === "sm"
				? "text-[18px]"
				: "text-[22px]";
	const iconBox =
		size === "lg" ? "w-10 h-10" : size === "sm" ? "w-8 h-8" : "w-9 h-9";
	const iconSize =
		size === "lg" ? "w-5 h-5" : size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";
	const padding = size === "sm" ? "px-3 py-2.5" : "px-3.5 py-3";

	const inner = (
		<div
			className={cn(
				"relative flex items-center gap-3 rounded-[6px] transition-colors",
				to && "hover:border-[color:var(--border-strong)] cursor-pointer",
				padding,
				className,
			)}
			style={{
				background: "var(--surface-base)",
				border: "1px solid var(--border-subtle)",
			}}
		>
			<span
				aria-hidden
				className="absolute left-0 top-2 bottom-2 w-[2px] rounded-r-full"
				style={{ background: accent }}
			/>
			{Icon && (
				<div
					className={cn(
						"rounded-[6px] flex items-center justify-center shrink-0 ml-1",
						iconBox,
					)}
					style={{ background: iconStyle.bg, color: iconStyle.color }}
				>
					<Icon className={iconSize} />
				</div>
			)}
			<div className={cn("min-w-0 flex-1", !Icon && "ml-2")}>
				<p
					className={cn("font-medium leading-none", labelSize)}
					style={{ color: "var(--text-tertiary)" }}
				>
					{label}
				</p>
				<div className="flex items-baseline gap-1.5 mt-1.5 min-w-0">
					<p
						className={cn(
							"font-semibold tnum leading-none truncate",
							valueSize,
						)}
						style={{ color: "var(--text-primary)" }}
					>
						{value}
					</p>
					{hint && (
						<p
							className="text-[11px] leading-none truncate font-medium"
							style={{ color: accent }}
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

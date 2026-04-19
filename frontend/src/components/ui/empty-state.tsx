import type { ElementType, ReactNode } from "react";
import { cn } from "./utils";

/**
 * EmptyState — single shared empty/no-data placeholder used everywhere
 * (lists, tabs, search, filtered views). Replaces page-local
 * implementations.
 *
 * Variants:
 *   - tone: accent / success / warn / danger / muted
 *   - size: sm (inline) / md (default) / lg (centered, hero)
 */

type Tone =
	| "accent"
	| "success"
	| "warn"
	| "danger"
	| "muted"
	| "info"
	| "violet";

const TONES: Record<Tone, { bg: string; color: string }> = {
	accent: { bg: "var(--brand-primary-subtle)", color: "var(--brand-primary)" },
	success: { bg: "var(--status-up-subtle)", color: "var(--status-up)" },
	warn: {
		bg: "var(--status-degraded-subtle)",
		color: "var(--status-degraded)",
	},
	danger: { bg: "var(--status-down-subtle)", color: "var(--status-down)" },
	muted: { bg: "var(--surface-sunken)", color: "var(--text-tertiary)" },
	info: { bg: "var(--brand-primary-subtle)", color: "var(--brand-primary)" },
	violet: { bg: "var(--surface-sunken)", color: "var(--text-secondary)" },
};

interface EmptyStateProps {
	icon?: ElementType;
	title: string;
	description?: ReactNode;
	action?: ReactNode;
	tone?: Tone;
	size?: "sm" | "md" | "lg";
	className?: string;
}

export function EmptyState({
	icon: Icon,
	title,
	description,
	action,
	tone = "muted",
	size = "md",
	className,
}: EmptyStateProps) {
	const t = TONES[tone];
	const iconBoxSize =
		size === "lg" ? "w-12 h-12" : size === "sm" ? "w-8 h-8" : "w-10 h-10";
	const iconSize =
		size === "lg" ? "w-6 h-6" : size === "sm" ? "w-4 h-4" : "w-5 h-5";
	const titleSize =
		size === "lg"
			? "text-[16px]"
			: size === "sm"
				? "text-[13px]"
				: "text-[14px]";
	const py = size === "lg" ? "py-12" : size === "sm" ? "py-6" : "py-10";

	return (
		<div
			className={cn(
				"flex flex-col items-center justify-center text-center px-6",
				py,
				className,
			)}
		>
			{Icon && (
				<div
					className={cn(
						"mb-3 rounded-[6px] flex items-center justify-center",
						iconBoxSize,
					)}
					style={{ background: t.bg }}
				>
					<Icon className={iconSize} style={{ color: t.color }} />
				</div>
			)}
			<p
				className={cn("font-semibold", titleSize)}
				style={{ color: "var(--text-primary)" }}
			>
				{title}
			</p>
			{description && (
				<p
					className="text-[12px] mt-1.5 max-w-[360px] leading-relaxed"
					style={{ color: "var(--text-tertiary)" }}
				>
					{description}
				</p>
			)}
			{action && <div className="mt-5">{action}</div>}
		</div>
	);
}

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

type Tone = "accent" | "success" | "warn" | "danger" | "muted" | "info" | "violet";

const TONES: Record<Tone, { bg: string; border: string; color: string }> = {
	accent: { bg: "var(--color-teal-subtle)", border: "var(--color-teal-border)", color: "var(--color-teal)" },
	success: { bg: "var(--status-up-subtle)", border: "var(--status-up-border)", color: "var(--status-up)" },
	warn: { bg: "var(--status-warn-subtle)", border: "var(--status-warn-border)", color: "var(--status-warn)" },
	danger: { bg: "var(--status-down-subtle)", border: "var(--status-down-border)", color: "var(--status-down)" },
	muted: { bg: "var(--surface-sunken)", border: "var(--border-default)", color: "var(--text-muted)" },
	info: { bg: "var(--color-blue-subtle)", border: "var(--color-blue-border)", color: "var(--color-blue)" },
	violet: { bg: "var(--color-violet-subtle)", border: "var(--color-violet-border)", color: "var(--color-violet)" },
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
		size === "lg" ? "w-14 h-14" : size === "sm" ? "w-9 h-9" : "w-11 h-11";
	const iconSize =
		size === "lg" ? "w-7 h-7" : size === "sm" ? "w-4 h-4" : "w-5 h-5";
	const titleSize =
		size === "lg" ? "text-lg" : size === "sm" ? "text-sm" : "text-base";
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
				<div className="relative mb-4">
					<div
						className="absolute inset-0 rounded-2xl blur-xl opacity-50"
						style={{ background: t.color }}
					/>
					<div
						className={cn(
							"relative rounded-2xl flex items-center justify-center",
							iconBoxSize,
						)}
						style={{ background: t.bg, border: `1px solid ${t.border}` }}
					>
						<Icon className={iconSize} style={{ color: t.color }} />
					</div>
				</div>
			)}
			<p
				className={cn("font-semibold tracking-tight", titleSize)}
				style={{ color: "var(--text-primary)" }}
			>
				{title}
			</p>
			{description && (
				<p
					className="text-[13px] mt-1.5 max-w-[360px] leading-relaxed"
					style={{ color: "var(--text-muted)" }}
				>
					{description}
				</p>
			)}
			{action && <div className="mt-5">{action}</div>}
		</div>
	);
}

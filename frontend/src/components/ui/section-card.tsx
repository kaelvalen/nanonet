import type { ElementType, ReactNode } from "react";
import { cn } from "./utils";

interface SectionCardProps {
	title?: string;
	description?: string;
	icon?: ElementType;
	iconTone?: "default" | "accent" | "success" | "warn" | "danger";
	actions?: ReactNode;
	children: ReactNode;
	className?: string;
	bodyClassName?: string;
	padded?: boolean;
}

const ICON_TONES = {
	default: {
		bg: "var(--surface-sunken)",
		color: "var(--text-muted)",
		border: "var(--border-default)",
	},
	accent: {
		bg: "var(--color-teal-subtle)",
		color: "var(--color-teal)",
		border: "var(--color-teal-border)",
	},
	success: {
		bg: "var(--status-up-subtle)",
		color: "var(--status-up-text)",
		border: "var(--status-up-border)",
	},
	warn: {
		bg: "var(--status-warn-subtle)",
		color: "var(--status-warn-text)",
		border: "var(--status-warn-border)",
	},
	danger: {
		bg: "var(--status-down-subtle)",
		color: "var(--status-down-text)",
		border: "var(--status-down-border)",
	},
};

/**
 * Content section inside a card. Keeps header + body consistent across pages.
 */
export function SectionCard({
	title,
	description,
	icon: Icon,
	iconTone = "default",
	actions,
	children,
	className,
	bodyClassName,
	padded = true,
}: SectionCardProps) {
	const tones = ICON_TONES[iconTone];
	return (
		<div
			className={cn("overflow-hidden", className)}
			style={{
				background: "var(--surface-card)",
				border: "1px solid var(--border-default)",
				borderRadius: "var(--radius)",
			}}
		>
			{(title || actions) && (
				<div
					className="flex items-center justify-between gap-3 px-4 py-3"
					style={{ borderBottom: "1px solid var(--border-subtle)" }}
				>
					<div className="flex items-center gap-2.5 min-w-0">
						{Icon && (
							<div
								className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
								style={{
									background: tones.bg,
									border: `1px solid ${tones.border}`,
									color: tones.color,
								}}
							>
								<Icon className="w-3.5 h-3.5" />
							</div>
						)}
						<div className="min-w-0">
							{title && (
								<h3
									className="text-sm font-semibold leading-none"
									style={{ color: "var(--text-primary)" }}
								>
									{title}
								</h3>
							)}
							{description && (
								<p
									className="text-xs mt-1 truncate"
									style={{ color: "var(--text-faint)" }}
								>
									{description}
								</p>
							)}
						</div>
					</div>
					{actions && (
						<div className="flex items-center gap-2 shrink-0">{actions}</div>
					)}
				</div>
			)}
			<div className={cn(padded && "p-4", bodyClassName)}>{children}</div>
		</div>
	);
}

import type { ReactNode } from "react";
import { cn } from "./utils";

/**
 * Unified page wrapper.
 *
 * - `fill`: locks to parent height and becomes a flex column so children can
 *   use `flex-1 min-h-0 overflow-auto` to scroll internally instead of letting
 *   the whole page scroll. Use this for dashboard-style pages where we want
 *   everything to fit in the viewport.
 */
export function PageShell({
	children,
	className,
	width = "default",
	fill = false,
}: {
	children: ReactNode;
	className?: string;
	/** `default` = 1280px, `wide` = 1440px, `full` = no cap */
	width?: "default" | "wide" | "full";
	fill?: boolean;
}) {
	const maxW =
		width === "full"
			? ""
			: width === "wide"
				? "max-w-[1440px]"
				: "max-w-[1280px]";
	return (
		<div
			className={cn(
				"w-full mx-auto",
				maxW,
				fill && "h-full flex flex-col min-h-0",
				className,
			)}
		>
			{children}
		</div>
	);
}

interface PageHeaderProps {
	eyebrow?: string;
	title: string;
	description?: string;
	actions?: ReactNode;
	meta?: ReactNode;
	className?: string;
	/** Compact mode: smaller title, no border, tighter spacing. Use on pages where every vertical pixel counts. */
	compact?: boolean;
}

/**
 * Standard page header: eyebrow → title → description → actions row.
 * Compact mode trims vertical space for viewport-fit pages.
 */
export function PageHeader({
	eyebrow,
	title,
	description,
	actions,
	meta,
	className,
	compact = false,
}: PageHeaderProps) {
	return (
		<header
			className={cn(
				"flex flex-col md:flex-row md:items-end md:justify-between shrink-0",
				compact ? "gap-2 pb-3 mb-4" : "gap-4 pb-6 mb-6 border-b",
				className,
			)}
			style={compact ? undefined : { borderColor: "var(--border-subtle)" }}
		>
			<div className="min-w-0 flex-1">
				{eyebrow && (
					<p
						className={cn(
							"font-bold uppercase tracking-[0.18em]",
							compact ? "text-[10px] mb-1" : "text-[10px] mb-2",
						)}
						style={{ color: "var(--text-faint)" }}
					>
						{eyebrow}
					</p>
				)}
				<h1
					className={cn(
						"font-bold tracking-tight leading-none",
						compact ? "text-lg" : "text-2xl",
					)}
					style={{ color: "var(--text-primary)" }}
				>
					{title}
				</h1>
				{description && (
					<p
						className={cn(
							"leading-relaxed max-w-2xl",
							compact ? "text-xs mt-1.5" : "text-sm mt-2",
						)}
						style={{ color: "var(--text-muted)" }}
					>
						{description}
					</p>
				)}
				{meta && <div className={compact ? "mt-2" : "mt-3"}>{meta}</div>}
			</div>
			{actions && (
				<div className="flex items-center gap-2 flex-wrap shrink-0">
					{actions}
				</div>
			)}
		</header>
	);
}

export function PageSection({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return <section className={cn("mb-8", className)}>{children}</section>;
}

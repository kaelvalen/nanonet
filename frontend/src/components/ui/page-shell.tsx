import type { ReactNode } from "react";
import { cn } from "./utils";

/**
 * Unified page wrapper. Every app page should use this to get consistent
 * padding, max-width, and vertical rhythm.
 */
export function PageShell({
	children,
	className,
	width = "default",
}: {
	children: ReactNode;
	className?: string;
	/** `default` = 1280px, `wide` = 1440px, `full` = no cap */
	width?: "default" | "wide" | "full";
}) {
	const maxW =
		width === "full"
			? ""
			: width === "wide"
				? "max-w-[1440px]"
				: "max-w-[1280px]";
	return (
		<div className={cn("w-full mx-auto", maxW, className)}>{children}</div>
	);
}

interface PageHeaderProps {
	eyebrow?: string;
	title: string;
	description?: string;
	actions?: ReactNode;
	meta?: ReactNode;
	className?: string;
}

/**
 * Standard page header: eyebrow → title → description → actions row.
 * Keeps every app page visually consistent.
 */
export function PageHeader({
	eyebrow,
	title,
	description,
	actions,
	meta,
	className,
}: PageHeaderProps) {
	return (
		<header
			className={cn(
				"flex flex-col gap-4 md:flex-row md:items-end md:justify-between pb-6 mb-6 border-b",
				className,
			)}
			style={{ borderColor: "var(--border-subtle)" }}
		>
			<div className="min-w-0 flex-1">
				{eyebrow && (
					<p
						className="text-[10px] font-bold uppercase tracking-[0.18em] mb-2"
						style={{ color: "var(--text-faint)" }}
					>
						{eyebrow}
					</p>
				)}
				<h1
					className="text-2xl font-bold tracking-tight leading-none"
					style={{ color: "var(--text-primary)" }}
				>
					{title}
				</h1>
				{description && (
					<p
						className="text-sm mt-2 leading-relaxed max-w-2xl"
						style={{ color: "var(--text-muted)" }}
					>
						{description}
					</p>
				)}
				{meta && <div className="mt-3">{meta}</div>}
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

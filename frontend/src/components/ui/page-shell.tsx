import type { ReactNode } from "react";
import { useRegisterPageMeta } from "@/components/PageMetaContext";
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
	/**
	 * Compact mode is now the default behavior — title and actions are
	 * promoted to the global TopBar via PageMetaContext, so this header
	 * only renders an inline description / meta strip if those props are
	 * provided. Kept for API compatibility.
	 */
	compact?: boolean;
}

/**
 * Page header — pushes title / eyebrow / actions up into the TopBar via
 * PageMetaContext. The component itself renders a slim, optional
 * description + meta strip in-place. Pages don't need to change their
 * markup — just keep using `<PageHeader title=... actions=... />`.
 */
export function PageHeader({
	eyebrow,
	title,
	description,
	actions,
	meta,
	className,
}: PageHeaderProps) {
	useRegisterPageMeta({ eyebrow, title, description, actions, meta });

	// Render a slim subtitle row only when description or meta is present.
	// Title + actions are handled by the TopBar.
	if (!description && !meta) return null;

	return (
		<header
			className={cn(
				"flex flex-col gap-2 shrink-0 mb-4 md:mb-5",
				className,
			)}
		>
			{description && (
				<p
					className="text-xs leading-relaxed max-w-2xl"
					style={{ color: "var(--text-muted)" }}
				>
					{description}
				</p>
			)}
			{meta && <div>{meta}</div>}
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

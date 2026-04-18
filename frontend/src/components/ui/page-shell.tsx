import type { ReactNode } from "react";
import { useRegisterPageMeta } from "@/components/PageMetaContext";
import { cn } from "./utils";

/**
 * Unified page wrapper.
 *
 * The app convention is: every authenticated page renders inside a
 * `PageShell` so spacing, max-width, and viewport behavior stay uniform.
 *
 * - `width`: caps the content (`default` 1280px / `wide` 1440px / `full` no cap).
 *   Defaults to `wide` because most product pages need the breathing room.
 * - `fill`: locks to parent height and becomes a flex column so children can
 *   use `flex-1 min-h-0 overflow-auto` to scroll internally instead of letting
 *   the whole page scroll. Defaults to `true` — opt out only for pages that
 *   genuinely need document-level scroll (long marketing/auth pages).
 * - `gap`: vertical rhythm between top-level sections (default `md`).
 */
export function PageShell({
	children,
	className,
	width = "wide",
	fill = true,
	gap = "md",
}: {
	children: ReactNode;
	className?: string;
	width?: "default" | "wide" | "full";
	fill?: boolean;
	gap?: "none" | "sm" | "md" | "lg";
}) {
	const maxW =
		width === "full"
			? ""
			: width === "wide"
				? "max-w-[1440px]"
				: "max-w-[1280px]";

	const flexGap =
		gap === "lg"
			? "gap-6"
			: gap === "md"
				? "gap-4"
				: gap === "sm"
					? "gap-2"
					: "";

	const blockGap =
		gap === "lg"
			? "space-y-6"
			: gap === "md"
				? "space-y-4"
				: gap === "sm"
					? "space-y-2"
					: "";

	return (
		<div
			className={cn(
				"w-full mx-auto",
				maxW,
				fill
					? `h-full flex flex-col min-h-0 ${flexGap}`
					: `block ${blockGap} pb-6`,
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
	 * Compat prop — used to control margin in the legacy implementation.
	 * The current TopBar-driven layout always renders compactly, so this
	 * is kept only to avoid touching every consumer.
	 */
	compact?: boolean;
}

/**
 * PageHeader — pushes title / eyebrow / actions up into the TopBar via
 * PageMetaContext. Renders a slim, optional description + meta strip
 * inline. Pages keep their normal `<PageHeader>` markup; the TopBar
 * absorbs the title and actions automatically.
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

	if (!description && !meta) return null;

	return (
		<header
			className={cn(
				"flex flex-col gap-2 shrink-0",
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

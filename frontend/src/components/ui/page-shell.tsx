import type { ReactNode } from "react";
import { useRegisterPageMeta } from "@/components/PageMetaContext";
import { cn } from "./utils";

/**
 * PageShell — uniform wrapper for every authenticated page.
 *
 * - `width`: caps content (`default` 1280px / `wide` 1440px / `full` no cap).
 *   Defaults to `wide` because most NanoNet product pages need the breathing
 *   room a 1440px ceiling provides for two-column dense layouts.
 * - `fill`: locks to parent height + becomes a flex column so children can
 *   use `flex-1 min-h-0 overflow-auto` to scroll internally instead of
 *   leaking into document scroll. Defaults to `true` — opt out only for
 *   pages with genuine document-level scroll (long marketing/auth pages).
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
	 * Compat — legacy callers passed this to control margin. The TopBar-driven
	 * layout always renders compactly, so this is a no-op kept to avoid
	 * touching every page in Faz 2.
	 */
	compact?: boolean;
}

/**
 * PageHeader — the canonical Faz 1+ page header.
 *
 * It pushes the page title/eyebrow up into the global TopBar (via
 * PageMetaContext) and renders an inline strip directly above the page
 * content for description, actions, and meta rows.
 *
 * The TopBar owns identity (title, breadcrumb, account) and global utilities
 * (search, health, alerts). Pages keep ownership of their own primary
 * actions ("Yeni X", filters, save buttons) so they live next to the content
 * they affect — much easier to scan than a crowded topbar.
 *
 * If a page has neither description, actions, nor meta, this component
 * renders nothing (the TopBar already shows the title).
 */
export function PageHeader({
	eyebrow,
	title,
	description,
	actions,
	meta,
	className,
}: PageHeaderProps) {
	useRegisterPageMeta({ eyebrow, title });

	if (!description && !meta && !actions) return null;

	return (
		<header
			className={cn("flex flex-col gap-3 shrink-0 pb-3", className)}
			style={{
				borderBottom: meta ? "1px solid var(--border-subtle)" : undefined,
			}}
		>
			{(description || actions) && (
				<div className="flex items-start sm:items-center justify-between gap-3 flex-col sm:flex-row">
					{description ? (
						<p
							className="text-[13px] leading-relaxed max-w-2xl"
							style={{ color: "var(--text-tertiary)" }}
						>
							{description}
						</p>
					) : (
						<span className="hidden sm:block" />
					)}
					{actions && (
						<div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
							{actions}
						</div>
					)}
				</div>
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

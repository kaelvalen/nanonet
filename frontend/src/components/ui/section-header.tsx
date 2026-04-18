import type { ReactNode } from "react";
import { cn } from "./utils";

/**
 * SectionHeader — consistent in-page section title with eyebrow / title /
 * description / right-aligned actions. Use for sub-sections inside a page
 * (the page-level title is registered with TopBar via PageHeader).
 */
interface SectionHeaderProps {
	eyebrow?: string;
	title: string;
	description?: ReactNode;
	actions?: ReactNode;
	className?: string;
	dense?: boolean;
}

export function SectionHeader({
	eyebrow,
	title,
	description,
	actions,
	className,
	dense = false,
}: SectionHeaderProps) {
	return (
		<div
			className={cn(
				"flex items-end justify-between gap-3 shrink-0",
				dense ? "mb-2" : "mb-3",
				className,
			)}
		>
			<div className="min-w-0">
				{eyebrow && (
					<p
						className="text-[10px] font-bold uppercase tracking-[0.16em] mb-0.5"
						style={{ color: "var(--text-faint)" }}
					>
						{eyebrow}
					</p>
				)}
				<h2
					className={cn(
						"font-semibold tracking-tight leading-tight truncate",
						dense ? "text-sm" : "text-[15px]",
					)}
					style={{ color: "var(--text-primary)" }}
				>
					{title}
				</h2>
				{description && (
					<p
						className="text-xs mt-0.5 max-w-2xl"
						style={{ color: "var(--text-muted)" }}
					>
						{description}
					</p>
				)}
			</div>
			{actions && (
				<div className="flex items-center gap-1.5 shrink-0">{actions}</div>
			)}
		</div>
	);
}

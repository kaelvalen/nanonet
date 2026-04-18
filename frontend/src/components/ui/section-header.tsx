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
				"flex items-start sm:items-end justify-between gap-3 shrink-0 flex-col sm:flex-row",
				dense ? "mb-3" : "mb-4",
				className,
			)}
		>
			<div className="min-w-0">
				{eyebrow && (
					<p
						className="text-[11px] font-medium leading-none mb-1.5"
						style={{ color: "var(--text-faint)" }}
					>
						{eyebrow}
					</p>
				)}
				<h2
					className={cn(
						"font-semibold tracking-tight leading-tight truncate",
						dense ? "text-[14px]" : "text-[16px]",
					)}
					style={{ color: "var(--text-primary)" }}
				>
					{title}
				</h2>
				{description && (
					<p
						className="text-[13px] mt-1 max-w-2xl leading-relaxed"
						style={{ color: "var(--text-muted)" }}
					>
						{description}
					</p>
				)}
			</div>
			{actions && (
				<div className="flex items-center gap-2 shrink-0 flex-wrap">
					{actions}
				</div>
			)}
		</div>
	);
}

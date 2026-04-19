import type { ReactNode } from "react";

interface PageHeaderProps {
	title: string;
	subtitle?: string;
	icon?: React.ElementType;
	iconColor?: string;
	iconBg?: string;
	iconBorder?: string;
	actions?: ReactNode;
	badge?: ReactNode;
}

/* PageHeader (legacy compat) — preserved API for unrewritten Faz 2-6 pages.
   The new convention is `PageHeader` from `ui/page-shell.tsx`, which routes
   the title up into the global TopBar. This wrapper keeps existing imports
   working while flattening the visual to match the new design language:
   no neumorphic icon halo, no shadow, single-line type. */
export function PageHeader({
	title,
	subtitle,
	icon: Icon,
	iconColor = "var(--brand-primary)",
	iconBg = "var(--brand-primary-subtle)",
	iconBorder = "var(--border-subtle)",
	actions,
	badge,
}: PageHeaderProps) {
	return (
		<div className="flex items-start justify-between gap-3 mb-5 flex-col sm:flex-row sm:items-center">
			<div className="flex items-center gap-3 min-w-0 flex-1">
				{Icon && (
					<div
						className="shrink-0 w-9 h-9 rounded-[6px] flex items-center justify-center"
						style={{
							background: iconBg,
							border: `1px solid ${iconBorder}`,
						}}
					>
						<Icon className="w-4 h-4" style={{ color: iconColor }} />
					</div>
				)}
				<div className="min-w-0">
					<div className="flex items-center gap-2 flex-wrap">
						<h1
							className="text-[18px] font-semibold leading-tight tracking-tight"
							style={{ color: "var(--text-primary)" }}
						>
							{title}
						</h1>
						{badge}
					</div>
					{subtitle && (
						<p
							className="text-[13px] mt-1 leading-relaxed"
							style={{ color: "var(--text-tertiary)" }}
						>
							{subtitle}
						</p>
					)}
				</div>
			</div>
			{actions && (
				<div className="flex items-center gap-2 shrink-0 flex-wrap">
					{actions}
				</div>
			)}
		</div>
	);
}

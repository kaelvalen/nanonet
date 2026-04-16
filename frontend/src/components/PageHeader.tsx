import type { ReactNode } from "react";
import { motion } from "motion/react";

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

export function PageHeader({
	title,
	subtitle,
	icon: Icon,
	iconColor = "var(--color-teal)",
	iconBg = "var(--color-teal-subtle)",
	iconBorder = "var(--color-teal-border)",
	actions,
	badge,
}: PageHeaderProps) {
	return (
		<motion.div
			className="flex items-start justify-between gap-4 mb-5"
			initial={{ opacity: 0, y: -6 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.25 }}
		>
			<div className="flex items-center gap-3 min-w-0">
				{Icon && (
					<div
						className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
						style={{
							background: iconBg,
							border: `1px solid ${iconBorder}`,
						}}
					>
						<Icon className="w-4.5 h-4.5" style={{ color: iconColor }} />
					</div>
				)}
				<div className="min-w-0">
					<div className="flex items-center gap-2 flex-wrap">
						<h1
							className="text-lg font-bold leading-none"
							style={{ color: "var(--text-primary)" }}
						>
							{title}
						</h1>
						{badge}
					</div>
					{subtitle && (
						<p
							className="text-xs mt-1 leading-relaxed"
							style={{ color: "var(--text-muted)" }}
						>
							{subtitle}
						</p>
					)}
				</div>
			</div>
			{actions && (
				<div className="flex items-center gap-2 shrink-0">{actions}</div>
			)}
		</motion.div>
	);
}

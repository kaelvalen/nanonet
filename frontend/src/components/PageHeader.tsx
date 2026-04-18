import { motion } from "motion/react";
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
			className="flex items-start justify-between gap-4 mb-6 flex-col sm:flex-row sm:items-center"
			initial={{ opacity: 0, y: -6 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.25 }}
		>
			<div className="flex items-center gap-3 min-w-0 flex-1">
				{Icon && (
					<div className="relative shrink-0">
						<div
							className="absolute inset-0 rounded-2xl blur-md opacity-60"
							style={{ background: iconColor }}
						/>
						<div
							className="relative w-10 h-10 rounded-2xl flex items-center justify-center"
							style={{
								background: iconBg,
								border: `1px solid ${iconBorder}`,
							}}
						>
							<Icon className="w-4.5 h-4.5" style={{ color: iconColor }} />
						</div>
					</div>
				)}
				<div className="min-w-0">
					<div className="flex items-center gap-2 flex-wrap">
						<h1
							className="text-[20px] font-semibold leading-none tracking-tight"
							style={{ color: "var(--text-primary)" }}
						>
							{title}
						</h1>
						{badge}
					</div>
					{subtitle && (
						<p
							className="text-[13px] mt-1.5 leading-relaxed"
							style={{ color: "var(--text-muted)" }}
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
		</motion.div>
	);
}

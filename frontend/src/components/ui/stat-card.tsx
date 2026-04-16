import type { ElementType, ReactNode } from "react";
import { Link } from "react-router";
import { cn } from "./utils";

type Tone = "default" | "accent" | "success" | "warn" | "danger" | "muted";

const TONE_ICON: Record<Tone, { bg: string; color: string }> = {
	default: {
		bg: "var(--surface-sunken)",
		color: "var(--text-muted)",
	},
	accent: {
		bg: "var(--color-teal-subtle)",
		color: "var(--color-teal)",
	},
	success: {
		bg: "var(--status-up-subtle)",
		color: "var(--status-up-text)",
	},
	warn: {
		bg: "var(--status-warn-subtle)",
		color: "var(--status-warn-text)",
	},
	danger: {
		bg: "var(--status-down-subtle)",
		color: "var(--status-down-text)",
	},
	muted: {
		bg: "var(--surface-sunken)",
		color: "var(--text-faint)",
	},
};

const TONE_ACCENT: Record<Tone, string> = {
	default: "var(--text-muted)",
	accent: "var(--color-teal)",
	success: "var(--status-up)",
	warn: "var(--status-warn)",
	danger: "var(--status-down)",
	muted: "var(--text-faint)",
};

interface StatCardProps {
	label: string;
	value: ReactNode;
	/** Optional label beneath value (e.g., `P95: 120 ms`, `+4% last hour`). */
	sub?: ReactNode;
	icon?: ElementType;
	tone?: Tone;
	/** Wraps the card in a Link to the given path. */
	to?: string;
	/** Optional secondary action (right side) */
	trailing?: ReactNode;
	className?: string;
	/** Loading skeleton state */
	loading?: boolean;
}

/**
 * Unified metric/stat tile. Used on dashboard, service detail, overview pages.
 * Clean, information-dense, no fake sparklines or trend indicators unless
 * backed by real data.
 */
export function StatCard({
	label,
	value,
	sub,
	icon: Icon,
	tone = "default",
	to,
	trailing,
	className,
	loading = false,
}: StatCardProps) {
	const iconTones = TONE_ICON[tone];
	const accentColor = TONE_ACCENT[tone];

	const body = (
		<div
			className={cn(
				"relative overflow-hidden px-4 py-3.5 h-full transition-colors",
				to && "hover:bg-[var(--surface-sunken)] cursor-pointer",
				className,
			)}
			style={{
				background: "var(--surface-card)",
				border: "1px solid var(--border-default)",
				borderRadius: "var(--radius)",
			}}
		>
			{tone !== "default" && tone !== "muted" && (
				<span
					className="absolute left-0 top-3 bottom-3 w-0.5 rounded-r-full"
					style={{ background: accentColor }}
				/>
			)}
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0 flex-1">
					<p
						className="text-[11px] font-medium mb-1.5"
						style={{ color: "var(--text-faint)" }}
					>
						{label}
					</p>
					<div
						className="text-2xl font-semibold tabular-nums font-mono leading-none tracking-tight"
						style={{ color: "var(--text-primary)" }}
					>
						{loading ? (
							<span
								className="inline-block w-16 h-6 rounded animate-pulse"
								style={{ background: "var(--surface-sunken)" }}
							/>
						) : (
							value
						)}
					</div>
					{sub && (
						<p
							className="text-[11px] mt-1.5 leading-snug truncate"
							style={{ color: "var(--text-faint)" }}
						>
							{sub}
						</p>
					)}
				</div>
				<div className="flex flex-col items-end gap-2 shrink-0">
					{Icon && (
						<div
							className="w-8 h-8 rounded-lg flex items-center justify-center"
							style={{
								background: iconTones.bg,
								color: iconTones.color,
							}}
						>
							<Icon className="w-4 h-4" />
						</div>
					)}
					{trailing}
				</div>
			</div>
		</div>
	);

	if (to) {
		return <Link to={to}>{body}</Link>;
	}
	return body;
}

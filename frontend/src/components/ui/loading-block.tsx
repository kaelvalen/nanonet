import { cn } from "./utils";

/**
 * LoadingBlock — animated skeleton placeholders. Pick the variant
 * matching the content shape so loading states feel uniform across the
 * whole app.
 */

interface BaseProps {
	className?: string;
}

function Bone({
	className,
	style,
}: BaseProps & { style?: React.CSSProperties }) {
	return (
		<div
			className={cn("rounded animate-pulse", className)}
			style={{ background: "var(--surface-sunken)", ...style }}
		/>
	);
}

/** Single line of text (e.g. label, title placeholder). */
export function SkeletonLine({
	width = "100%",
	height = 12,
	className,
}: {
	width?: string | number;
	height?: number;
	className?: string;
}) {
	return (
		<Bone
			className={className}
			style={{ width, height }}
		/>
	);
}

/** Card-shaped block. */
export function SkeletonCard({ className }: BaseProps) {
	return (
		<div
			className={cn(
				"rounded-[var(--radius)] p-4 space-y-3 animate-pulse",
				className,
			)}
			style={{
				background: "var(--surface-card)",
				border: "1px solid var(--border-default)",
			}}
		>
			<div className="flex items-center gap-3">
				<div
					className="w-8 h-8 rounded-md"
					style={{ background: "var(--surface-sunken)" }}
				/>
				<SkeletonLine width="40%" />
			</div>
			<SkeletonLine width="80%" />
			<SkeletonLine width="60%" />
		</div>
	);
}

/** Stat card skeleton — matches StatCard dimensions. */
export function SkeletonStat({ className }: BaseProps) {
	return (
		<div
			className={cn(
				"rounded-[var(--radius)] p-4 animate-pulse",
				className,
			)}
			style={{
				background: "var(--surface-card)",
				border: "1px solid var(--border-default)",
			}}
		>
			<SkeletonLine width="50%" height={9} />
			<div className="mt-3 flex items-baseline gap-2">
				<SkeletonLine width="40%" height={20} />
			</div>
		</div>
	);
}

/** Repeats a row N times to simulate a list. */
export function SkeletonList({
	rows = 5,
	rowHeight = 48,
	className,
}: {
	rows?: number;
	rowHeight?: number;
	className?: string;
}) {
	return (
		<div className={cn("flex flex-col gap-1.5", className)}>
			{Array.from({ length: rows }).map((_, i) => (
				<div
					key={i}
					className="rounded-md flex items-center gap-3 px-3 animate-pulse"
					style={{
						height: rowHeight,
						background: "var(--surface-card)",
						border: "1px solid var(--border-subtle)",
					}}
				>
					<div
						className="w-2 h-2 rounded-full"
						style={{ background: "var(--surface-sunken)" }}
					/>
					<div className="flex-1 space-y-1.5">
						<SkeletonLine width="35%" height={10} />
						<SkeletonLine width="70%" height={6} />
					</div>
					<SkeletonLine width={48} height={12} />
				</div>
			))}
		</div>
	);
}

/** Chart shape skeleton. */
export function SkeletonChart({
	className,
	height = 200,
}: BaseProps & { height?: number }) {
	return (
		<div
			className={cn(
				"rounded-[var(--radius)] flex items-end gap-2 p-4 animate-pulse",
				className,
			)}
			style={{
				background: "var(--surface-card)",
				border: "1px solid var(--border-default)",
				height,
			}}
		>
			{[0.4, 0.7, 0.3, 0.9, 0.55, 0.8, 0.65, 0.5].map((h, i) => (
				<div
					key={i}
					className="flex-1 rounded-sm"
					style={{
						height: `${h * 100}%`,
						background: "var(--surface-sunken)",
					}}
				/>
			))}
		</div>
	);
}

/** Grid of skeleton cards — useful for dashboard metric loading. */
export function SkeletonGrid({
	cols = 4,
	cells = 4,
	className,
}: {
	cols?: 2 | 3 | 4;
	cells?: number;
	className?: string;
}) {
	const colsCls =
		cols === 4
			? "grid-cols-2 md:grid-cols-4"
			: cols === 3
				? "grid-cols-2 md:grid-cols-3"
				: "grid-cols-1 sm:grid-cols-2";
	return (
		<div className={cn("grid gap-3", colsCls, className)}>
			{Array.from({ length: cells }).map((_, i) => (
				<SkeletonStat key={i} />
			))}
		</div>
	);
}

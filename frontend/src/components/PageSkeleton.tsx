import { Card } from "@/components/ui/card";

export function PageSkeleton() {
	return (
		<div className="space-y-6 animate-pulse">
			{/* Header */}
			<div className="space-y-2">
				<div
					className="h-8 w-56 rounded"
					style={{ background: "var(--color-teal-subtle)" }}
				/>
				<div
					className="h-3 w-36 rounded"
					style={{ background: "var(--surface-sunken)" }}
				/>
			</div>

			{/* Stats row */}
			<div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
				{[1, 2, 3, 4].map((i) => (
					<Card
						key={i}
						className="p-4 rounded"
						style={{
							background: "var(--surface-card)",
							border: "1px solid var(--border-default)",
						}}
					>
						<div
							className="h-6 w-8 rounded mb-2"
							style={{ background: "var(--color-teal-subtle)" }}
						/>
						<div
							className="h-4 w-16 rounded"
							style={{ background: "var(--surface-sunken)" }}
						/>
					</Card>
				))}
			</div>

			{/* Content blocks */}
			<div className="space-y-3">
				{[80, 65, 90, 55].map((w) => (
					<Card
						key={w}
						className="p-4 rounded"
						style={{
							background: "var(--surface-card)",
							border: "1px solid var(--border-default)",
						}}
					>
						<div
							className="h-4 rounded mb-2"
							style={{ width: `${w}%`, background: "var(--color-teal-subtle)" }}
						/>
						<div
							className="h-3 rounded w-40"
							style={{ background: "var(--surface-sunken)" }}
						/>
					</Card>
				))}
			</div>
		</div>
	);
}

export function CardSkeleton({ rows = 3 }: { rows?: number }) {
	return (
		<Card
			className="p-4 rounded animate-pulse"
			style={{
				background: "var(--surface-card)",
				border: "1px solid var(--border-default)",
			}}
		>
			{Array.from({ length: rows }, (_, i) => i).map((i) => (
				<div
					key={i}
					className="h-3 rounded mb-2 last:mb-0"
					style={{
						width: i === 0 ? "60%" : i % 2 === 0 ? "80%" : "45%",
						background: "var(--color-teal-subtle)",
					}}
				/>
			))}
		</Card>
	);
}

export function ServiceCardSkeleton() {
	return (
		<Card
			className="p-4 rounded animate-pulse"
			style={{
				background: "var(--surface-card)",
				border: "1px solid var(--border-default)",
			}}
		>
			<div className="flex items-center gap-3 mb-3">
				<div
					className="w-10 h-10 rounded"
					style={{ background: "var(--color-teal-subtle)" }}
				/>
				<div className="flex-1 space-y-2">
					<div
						className="h-4 w-24 rounded"
						style={{ background: "var(--color-teal-subtle)" }}
					/>
					<div
						className="h-3 w-32 rounded"
						style={{ background: "var(--surface-sunken)" }}
					/>
				</div>
			</div>
			<div className="flex items-center gap-2">
				<div
					className="h-6 w-16 rounded"
					style={{ background: "var(--color-teal-subtle)" }}
				/>
				<div
					className="h-6 w-12 rounded"
					style={{ background: "var(--surface-sunken)" }}
				/>
			</div>
		</Card>
	);
}

export function MetricChartSkeleton() {
	return (
		<Card
			className="p-4 rounded animate-pulse"
			style={{
				background: "var(--surface-card)",
				border: "1px solid var(--border-default)",
			}}
		>
			<div
				className="h-4 w-20 rounded mb-4"
				style={{ background: "var(--color-teal-subtle)" }}
			/>
			<div
				className="h-40 rounded"
				style={{ background: "var(--surface-sunken)" }}
			/>
		</Card>
	);
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
	return (
		<div className="space-y-2 animate-pulse">
			{/* Header */}
			<div className="flex gap-2 mb-4">
				{[1, 2, 3, 4].map((i) => (
					<div
						key={i}
						className="h-4 rounded"
						style={{
							width: i === 1 ? "20%" : i === 2 ? "30%" : "15%",
							background: "var(--color-teal-subtle)",
						}}
					/>
				))}
			</div>
			{/* Rows */}
			{Array.from({ length: rows }).map((_, i) => (
				<Card
					key={`skeleton-row-${i}`}
					className="p-3 rounded"
					style={{
						background: "var(--surface-card)",
						border: "1px solid var(--border-default)",
					}}
				>
					<div className="flex gap-2">
						{[1, 2, 3, 4].map((j) => (
							<div
								key={`skeleton-cell-${i}-${j}`}
								className="h-3 rounded"
								style={{
									width: j === 1 ? "20%" : j === 2 ? "30%" : "15%",
									background: "var(--surface-sunken)",
								}}
							/>
						))}
					</div>
				</Card>
			))}
		</div>
	);
}

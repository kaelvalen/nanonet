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
							border: "2px solid var(--border-default)",
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
				{[80, 65, 90, 55].map((w, i) => (
					<Card
						key={i}
						className="p-4 rounded"
						style={{
							background: "var(--surface-card)",
							border: "2px solid var(--border-default)",
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
				border: "2px solid var(--border-default)",
			}}
		>
			{Array.from({ length: rows }).map((_, i) => (
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

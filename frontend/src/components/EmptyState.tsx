import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
	icon: LucideIcon;
	title: string;
	description: string;
	action?: {
		label: string;
		onClick: () => void;
	};
	secondaryAction?: {
		label: string;
		onClick: () => void;
	};
}

export function EmptyState({
	icon: Icon,
	title,
	description,
	action,
	secondaryAction,
}: EmptyStateProps) {
	return (
		<div
			className="flex flex-col items-center justify-center py-16 px-8 rounded text-center"
			style={{
				background: "var(--surface-card)",
				border: "2px dashed var(--border-default)",
				boxShadow: "var(--card-shadow)",
			}}
		>
			<div
				className="w-14 h-14 rounded flex items-center justify-center mb-4"
				style={{
					background: "var(--surface-sunken)",
					border: "2px solid var(--border-default)",
				}}
			>
				<Icon className="w-7 h-7" style={{ color: "var(--text-faint)" }} />
			</div>
			<h3
				className="text-base font-bold mb-1.5"
				style={{ color: "var(--text-primary)" }}
			>
				{title}
			</h3>
			<p
				className="text-sm max-w-sm mb-6"
				style={{ color: "var(--text-muted)" }}
			>
				{description}
			</p>
			{(action || secondaryAction) && (
				<div className="flex items-center gap-3">
					{action && (
						<Button
							onClick={action.onClick}
							className="rounded"
							style={{
								background: "var(--primary)",
								color: "var(--primary-foreground)",
								border: "2px solid var(--border-default)",
								boxShadow: "var(--btn-shadow)",
							}}
						>
							{action.label}
						</Button>
					)}
					{secondaryAction && (
						<Button
							variant="outline"
							onClick={secondaryAction.onClick}
							className="rounded"
							style={{
								background: "var(--surface-sunken)",
								color: "var(--text-secondary)",
								border: "2px solid var(--border-default)",
							}}
						>
							{secondaryAction.label}
						</Button>
					)}
				</div>
			)}
		</div>
	);
}

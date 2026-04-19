/* StatusAtom — single primitive that exposes every shape we use to express
   service health. Pages import this instead of building their own dots/pills,
   so a future palette change (e.g. colour-blind mode) is a one-file edit.

   Surfaces:
     <StatusAtom status="up" variant="dot" />        — bare colored circle
     <StatusAtom status="up" variant="pill" />       — pill with label
     <StatusAtom status="up" variant="bar" value={0.97} />  — uptime micro-bar
     <StatusAtom status="up" variant="ring" pulse />        — animated ring (live)
     <StatusAtom status="up" variant="row" label="checkout-api" />
*/

import type { ReactNode } from "react";
import { type Status, StatusBadge, StatusDot } from "./status-atoms";
import { cn } from "./utils";

// Available variants (kept for documentation purposes; selected via discriminated union below)
// "dot" | "pill" | "bar" | "ring" | "row"

interface BaseProps {
	status: Status;
	className?: string;
}

interface DotProps extends BaseProps {
	variant: "dot";
	size?: number;
	pulse?: boolean;
}

interface PillProps extends BaseProps {
	variant: "pill";
	label?: ReactNode;
}

interface BarProps extends BaseProps {
	variant: "bar";
	/** 0..1 — how full the bar reads (uptime ratio) */
	value: number;
	/** Optional label rendered to the right of the bar */
	label?: ReactNode;
	width?: number;
}

interface RingProps extends BaseProps {
	variant: "ring";
	pulse?: boolean;
	size?: number;
}

interface RowProps extends BaseProps {
	variant: "row";
	label: ReactNode;
	hint?: ReactNode;
}

export type StatusAtomProps =
	| DotProps
	| PillProps
	| BarProps
	| RingProps
	| RowProps;

const STATUS_DOT_VAR: Record<Status, string> = {
	up: "var(--status-up)",
	down: "var(--status-down)",
	degraded: "var(--status-degraded)",
	unknown: "var(--status-unknown)",
};

export function StatusAtom(props: StatusAtomProps) {
	switch (props.variant) {
		case "dot":
			return (
				<StatusDot
					status={props.status}
					size={props.size}
					pulse={props.pulse}
					className={props.className}
				/>
			);

		case "pill":
			return <StatusBadge status={props.status}>{props.label}</StatusBadge>;

		case "bar": {
			const pct = Math.max(0, Math.min(1, props.value)) * 100;
			const color = STATUS_DOT_VAR[props.status];
			return (
				<span className={cn("inline-flex items-center gap-2", props.className)}>
					<span
						className="relative inline-block overflow-hidden rounded-full"
						style={{
							width: props.width ?? 96,
							height: 4,
							background: "var(--surface-sunken)",
						}}
					>
						<span
							className="absolute inset-y-0 left-0 rounded-full"
							style={{ width: `${pct}%`, background: color }}
						/>
					</span>
					{props.label && (
						<span className="text-[12px] tnum text-[var(--text-secondary)]">
							{props.label}
						</span>
					)}
				</span>
			);
		}

		case "ring": {
			const size = props.size ?? 20;
			const color = STATUS_DOT_VAR[props.status];
			return (
				<span
					className={cn(
						"relative inline-flex items-center justify-center",
						props.className,
					)}
					style={{ width: size, height: size }}
				>
					{props.pulse && (
						<span
							className="absolute inset-0 rounded-full"
							style={{
								background: color,
								opacity: 0.18,
								animation: "nn-orb-breathe 2.4s var(--ease-standard) infinite",
							}}
						/>
					)}
					<StatusDot status={props.status} size={Math.max(4, size / 2.5)} />
				</span>
			);
		}

		case "row":
			return (
				<span
					className={cn(
						"inline-flex items-center gap-2 min-w-0",
						props.className,
					)}
				>
					<StatusDot status={props.status} size={8} />
					<span className="truncate text-[13px] text-[var(--text-primary)]">
						{props.label}
					</span>
					{props.hint && (
						<span className="text-[12px] tnum text-[var(--text-tertiary)] shrink-0">
							{props.hint}
						</span>
					)}
				</span>
			);
	}
}

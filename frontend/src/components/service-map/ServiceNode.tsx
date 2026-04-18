import { Handle, Position } from "@xyflow/react";
import { Activity, AlertTriangle, Server, Trash2 } from "lucide-react";
import { memo } from "react";
import { STATUS_COLOR, STATUS_LABEL } from "./constants";
import type { ServiceNodeData } from "./types";

export const ServiceNode = memo(function ServiceNode({
	data,
}: {
	data: ServiceNodeData;
}) {
	const { service, onDelete, onSelect, selected, extra } = data;
	const color = STATUS_COLOR[service.status] ?? STATUS_COLOR.unknown;
	const alive = service.status === "up";

	return (
		// biome-ignore lint/a11y/useSemanticElements: nested interactive Handle/button prevents using <button>
		<div
			role="button"
			tabIndex={0}
			className="group relative cursor-pointer"
			style={{
				width: 220,
				background: "var(--surface-card)",
				border: `1px solid ${selected ? color : "var(--border-default)"}`,
				borderRadius: 14,
				boxShadow: selected
					? `0 0 0 4px color-mix(in srgb, ${color} 18%, transparent), 0 8px 24px -8px rgba(0,0,0,0.18)`
					: "0 4px 12px -4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.02)",
				transition: "box-shadow 0.18s ease, border-color 0.18s ease",
			}}
			onClick={() => onSelect(service.id)}
			onKeyDown={(e) => e.key === "Enter" && onSelect(service.id)}
		>
			<Handle
				type="target"
				position={Position.Left}
				style={{
					background: color,
					width: 9,
					height: 9,
					border: "1.5px solid var(--surface-card)",
				}}
			/>
			<Handle
				type="source"
				position={Position.Right}
				style={{
					background: color,
					width: 9,
					height: 9,
					border: "1.5px solid var(--surface-card)",
				}}
			/>

			<button
				type="button"
				onClick={(e) => {
					e.stopPropagation();
					onDelete(service.id);
				}}
				className="absolute -top-2 -right-2 w-6 h-6 rounded-full items-center justify-center hidden group-hover:flex z-10 transition-transform hover:scale-110"
				style={{
					background: "var(--status-down)",
					color: "white",
					boxShadow: "0 4px 10px -2px rgba(0,0,0,0.2)",
				}}
				aria-label="Haritadan kaldır"
			>
				<Trash2 className="w-3 h-3" />
			</button>

			<div className="px-3.5 pt-3 pb-3">
				<div className="flex items-center gap-2.5 mb-2.5">
					<span
						className="relative flex items-center justify-center w-4 h-4 shrink-0"
						aria-hidden
					>
						{alive && (
							<span
								className="absolute inset-0 rounded-full"
								style={{
									background: color,
									opacity: 0.22,
									animation: "nn-orb-breathe 2.4s ease-in-out infinite",
								}}
							/>
						)}
						<span
							className="relative w-2 h-2 rounded-full"
							style={{
								background: color,
								boxShadow: alive
									? `0 0 0 2px color-mix(in srgb, ${color} 22%, transparent)`
									: undefined,
							}}
						/>
					</span>
					<div className="flex-1 min-w-0">
						<p
							className="text-[13px] font-semibold tracking-tight truncate leading-none"
							style={{ color: "var(--text-primary)" }}
						>
							{service.name}
						</p>
						<p
							className="text-[11px] truncate mt-1 font-mono"
							style={{ color: "var(--text-faint)" }}
						>
							{service.host}:{service.port}
						</p>
					</div>
					<Server
						className="w-3.5 h-3.5 shrink-0 opacity-50"
						style={{ color: "var(--text-faint)" }}
					/>
				</div>

				<div className="flex items-center gap-2 mt-2 flex-wrap">
					<span
						className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
						style={{
							background: `color-mix(in srgb, ${color} 12%, transparent)`,
							color,
						}}
					>
						{STATUS_LABEL[service.status] ?? service.status}
					</span>
					{extra?.latency !== undefined && (
						<span
							className="inline-flex items-center gap-1 text-[10px] font-medium tabular-nums"
							style={{ color: "var(--text-muted)" }}
						>
							<Activity className="w-2.5 h-2.5" />
							{extra.latency}ms
						</span>
					)}
					{(extra?.alertCount ?? 0) > 0 && (
						<span
							className="inline-flex items-center gap-1 text-[10px] font-semibold tabular-nums"
							style={{ color: "var(--status-down-text)" }}
						>
							<AlertTriangle className="w-2.5 h-2.5" />
							{extra?.alertCount}
						</span>
					)}
				</div>

				{extra?.uptime !== undefined && (
					<div className="mt-3">
						<div
							className="h-1 rounded-full overflow-hidden"
							style={{ background: "var(--border-track)" }}
						>
							<div
								className="h-full rounded-full transition-all"
								style={{ width: `${extra.uptime}%`, background: color }}
							/>
						</div>
						<div className="flex items-center justify-between mt-1.5">
							<span
								className="text-[10px] font-medium"
								style={{ color: "var(--text-faint)" }}
							>
								Uptime
							</span>
							<span
								className="text-[10px] font-semibold tabular-nums"
								style={{ color: "var(--text-secondary)" }}
							>
								{extra.uptime.toFixed(1)}%
							</span>
						</div>
					</div>
				)}
			</div>
		</div>
	);
});

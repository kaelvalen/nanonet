import { Handle, Position } from "@xyflow/react";
import { Activity, AlertTriangle, Server, Trash2 } from "lucide-react";
import { memo } from "react";
import {
	STATUS_BG,
	STATUS_BORDER,
	STATUS_COLOR,
	STATUS_LABEL,
} from "./constants";
import { StatusIcon } from "./StatusIcon";
import type { ServiceNodeData } from "./types";

export const ServiceNode = memo(function ServiceNode({
	data,
}: {
	data: ServiceNodeData;
}) {
	const { service, onDelete, onSelect, selected, extra } = data;
	const color = STATUS_COLOR[service.status] ?? STATUS_COLOR.unknown;
	const bg = STATUS_BG[service.status] ?? STATUS_BG.unknown;
	const border = STATUS_BORDER[service.status] ?? STATUS_BORDER.unknown;

	return (
		// biome-ignore lint/a11y/useSemanticElements: div contains nested interactive elements (Handle, delete button), cannot use <button>
		<div
			role="button"
			tabIndex={0}
			className="rounded group relative cursor-pointer"
			style={{
				width: 200,
				background: "var(--surface-card)",
				border: selected ? `1px solid ${color}` : `1px solid ${border}`,
				boxShadow: selected
					? `0 0 0 3px color-mix(in srgb, ${color} 25%, transparent), var(--card-shadow)`
					: "var(--card-shadow)",
				transition: "box-shadow 0.15s, border-color 0.15s",
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
					border: "1px solid var(--surface-card)",
				}}
			/>
			<Handle
				type="source"
				position={Position.Right}
				style={{
					background: color,
					width: 9,
					height: 9,
					border: "1px solid var(--surface-card)",
				}}
			/>

			<button
				type="button"
				onClick={(e) => {
					e.stopPropagation();
					onDelete(service.id);
				}}
				className="absolute -top-2 -right-2 w-5 h-5 rounded-full items-center justify-center hidden group-hover:flex z-10"
				style={{ background: "var(--status-down)", color: "white" }}
			>
				<Trash2 className="w-2.5 h-2.5" />
			</button>

			<div className="h-0.5 rounded-t" style={{ background: color }} />

			<div className="px-3 py-2.5">
				<div className="flex items-center gap-2 mb-2">
					<div
						className="w-6 h-6 rounded flex items-center justify-center shrink-0"
						style={{ background: bg, border: `1px solid ${border}` }}
					>
						<Server className="w-3 h-3" style={{ color }} />
					</div>
					<span
						className="text-xs font-semibold truncate"
						style={{ color: "var(--text-secondary)", maxWidth: 130 }}
					>
						{service.name}
					</span>
				</div>

				<p
					className="text-[10px] truncate mb-2"
					style={{ color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}
				>
					{service.host}:{service.port}
				</p>

				<div className="flex items-center gap-2">
					<span
						className="px-1.5 py-0.5 rounded text-[9px] font-semibold flex items-center gap-1"
						style={{ background: bg, color, border: `1px solid ${border}` }}
					>
						<StatusIcon status={service.status} size="w-2.5 h-2.5" />
						{STATUS_LABEL[service.status] ?? service.status}
					</span>
					{extra?.latency !== undefined && (
						<span
							className="text-[9px] flex items-center gap-0.5"
							style={{ color: "var(--text-faint)" }}
						>
							<Activity className="w-2.5 h-2.5" />
							{extra.latency}ms
						</span>
					)}
					{(extra?.alertCount ?? 0) > 0 && (
						<span
							className="text-[9px] flex items-center gap-0.5"
							style={{ color: "var(--status-down-text)" }}
						>
							<AlertTriangle className="w-2.5 h-2.5" />
							{extra?.alertCount}
						</span>
					)}
				</div>

				{extra?.uptime !== undefined && (
					<div className="mt-2">
						<div
							className="h-1 rounded-full overflow-hidden"
							style={{ background: "var(--border-track)" }}
						>
							<div
								className="h-full rounded-full transition-all"
								style={{ width: `${extra.uptime}%`, background: color }}
							/>
						</div>
						<p
							className="text-[9px] mt-0.5 text-right"
							style={{ color: "var(--text-faint)" }}
						>
							{extra.uptime.toFixed(1)}% uptime
						</p>
					</div>
				)}
			</div>
		</div>
	);
});

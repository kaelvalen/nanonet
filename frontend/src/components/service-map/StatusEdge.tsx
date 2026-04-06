import {
	EdgeLabelRenderer,
	type EdgeProps,
	getBezierPath,
	useReactFlow,
} from "@xyflow/react";
import { X } from "lucide-react";
import { edgeColorForSide } from "./utils";

interface StatusEdgeData {
	srcStatus?: string;
	tgtStatus?: string;
	latency?: number;
	srcAlerts?: number;
	tgtAlerts?: number;
}

export function StatusEdge({
	id,
	sourceX,
	sourceY,
	targetX,
	targetY,
	sourcePosition,
	targetPosition,
	data,
	markerEnd,
	selected,
}: EdgeProps & { data?: StatusEdgeData }) {
	const { setEdges } = useReactFlow();

	const [edgePath, labelX, labelY] = getBezierPath({
		sourceX,
		sourceY,
		sourcePosition,
		targetX,
		targetY,
		targetPosition,
	});

	const srcStatus = data?.srcStatus ?? "unknown";
	const tgtStatus = data?.tgtStatus ?? "unknown";
	const srcAlerts = data?.srcAlerts ?? 0;
	const tgtAlerts = data?.tgtAlerts ?? 0;
	const srcColor = edgeColorForSide(srcStatus, srcAlerts);
	const tgtColor = edgeColorForSide(tgtStatus, tgtAlerts);
	const isDown = srcStatus === "down" || tgtStatus === "down";
	const isDegraded =
		!isDown &&
		(srcStatus === "degraded" ||
			tgtStatus === "degraded" ||
			srcAlerts > 0 ||
			tgtAlerts > 0);
	const latency = data?.latency;
	const gradientId = `edge-grad-${id}`;
	const useGradient = srcColor !== tgtColor;
	const strokePaint = useGradient ? `url(#${gradientId})` : srcColor;

	const handleDelete = (e: React.MouseEvent) => {
		e.stopPropagation();
		setEdges((es) => es.filter((edge) => edge.id !== id));
	};

	return (
		<>
			<defs>
				<linearGradient
					id={gradientId}
					gradientUnits="userSpaceOnUse"
					x1={sourceX}
					y1={sourceY}
					x2={targetX}
					y2={targetY}
				>
					<stop offset="0%" stopColor={srcColor} />
					<stop offset="100%" stopColor={tgtColor} />
				</linearGradient>
			</defs>
			<path
				d={edgePath}
				stroke="transparent"
				strokeWidth={16}
				fill="none"
				className="react-flow__edge-interaction"
			/>
			<path
				id={id}
				className="react-flow__edge-path"
				d={edgePath}
				markerEnd={markerEnd as string}
				style={{
					stroke: strokePaint,
					strokeWidth: selected ? 3 : isDown ? 2.5 : isDegraded ? 2 : 1.5,
					strokeDasharray: isDown ? "6 3" : undefined,
					filter: selected
						? "drop-shadow(0 0 3px rgba(255,60,60,0.5))"
						: undefined,
				}}
			/>
			<EdgeLabelRenderer>
				<div
					style={{
						position: "absolute",
						transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
						pointerEvents: "all",
					}}
					className="nodrag nopan"
				>
					{selected && (
						<button
							type="button"
							onClick={handleDelete}
							className="w-5 h-5 rounded-full flex items-center justify-center transition-opacity hover:opacity-80"
							style={{
								background: "var(--status-down)",
								color: "white",
								boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
							}}
						>
							<X className="w-2.5 h-2.5" />
						</button>
					)}
					{latency !== undefined && !selected && (
						<span
							className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold"
							style={{
								background: "var(--surface-card)",
								border: `1px solid ${srcColor}`,
								color: srcColor,
								boxShadow: "var(--card-shadow)",
							}}
						>
							{latency}ms
						</span>
					)}
				</div>
			</EdgeLabelRenderer>
		</>
	);
}

import {
	type Edge,
	type EdgeProps,
	getBezierPath,
	Handle,
	type Node,
	type NodeProps,
	Position,
	ReactFlow,
	ReactFlowProvider,
	useEdgesState,
	useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
	BarChart3,
	Bell,
	Database,
	ScrollText,
	Server,
	Shield,
} from "lucide-react";
import { Logo } from "@/components/Logo";

type NodeStatus = "up" | "warn" | "down";
type ServiceNodeData = Record<string, unknown> & {
	label: string;
	status: NodeStatus;
	icon: React.ElementType;
};

const STATUS: Record<NodeStatus, { dot: string; label: string }> = {
	up: { dot: "var(--status-up)", label: "healthy" },
	warn: { dot: "var(--status-degraded)", label: "degraded" },
	down: { dot: "var(--status-down)", label: "down" },
};

function ServiceNode({ data }: NodeProps) {
	const d = data as ServiceNodeData;
	const s = STATUS[d.status];
	const Icon = d.icon;

	return (
		<div
			className="w-36 rounded-[6px] overflow-hidden"
			style={{
				background: "var(--surface-base)",
				border: "1px solid var(--border-subtle)",
			}}
		>
			<Handle
				type="target"
				position={Position.Left}
				style={{ opacity: 0, pointerEvents: "none" }}
			/>
			<Handle
				type="source"
				position={Position.Right}
				style={{ opacity: 0, pointerEvents: "none" }}
			/>

			<div className="flex items-center gap-2.5 px-3 py-2.5">
				<Icon
					className="w-3.5 h-3.5 shrink-0"
					style={{ color: "var(--text-tertiary)" }}
					aria-hidden
				/>
				<span
					className="text-[11px] font-mono truncate flex-1"
					style={{ color: "var(--text-secondary)" }}
				>
					{d.label}
				</span>
				<span
					role="img"
					aria-label={s.label}
					className="w-1.5 h-1.5 rounded-full shrink-0 nn-orb-breathe"
					style={{ backgroundColor: s.dot }}
				/>
			</div>
		</div>
	);
}

function AnimatedEdge({
	sourceX,
	sourceY,
	targetX,
	targetY,
	sourcePosition,
	targetPosition,
}: EdgeProps) {
	const [path] = getBezierPath({
		sourceX,
		sourceY,
		targetX,
		targetY,
		sourcePosition,
		targetPosition,
	});

	return (
		<g>
			<path
				d={path}
				fill="none"
				stroke="var(--border-default)"
				strokeWidth={1}
			/>
			<path
				d={path}
				fill="none"
				stroke="var(--brand-primary)"
				strokeOpacity={0.45}
				strokeWidth={1}
				strokeDasharray="4 10"
				strokeLinecap="round"
			>
				<animate
					attributeName="stroke-dashoffset"
					from="0"
					to="-56"
					dur="2.4s"
					repeatCount="indefinite"
				/>
			</path>
		</g>
	);
}

const NODES: Node[] = [
	{
		id: "gw",
		type: "service",
		position: { x: 0, y: 120 },
		data: { label: "api-gateway", status: "up", icon: Server },
		draggable: false,
	},
	{
		id: "au",
		type: "service",
		position: { x: 200, y: 20 },
		data: { label: "auth-service", status: "up", icon: Shield },
		draggable: false,
	},
	{
		id: "me",
		type: "service",
		position: { x: 200, y: 130 },
		data: { label: "metrics-engine", status: "up", icon: BarChart3 },
		draggable: false,
	},
	{
		id: "lo",
		type: "service",
		position: { x: 200, y: 240 },
		data: { label: "log-aggregator", status: "up", icon: ScrollText },
		draggable: false,
	},
	{
		id: "db",
		type: "service",
		position: { x: 400, y: 75 },
		data: { label: "timeseries-db", status: "warn", icon: Database },
		draggable: false,
	},
	{
		id: "al",
		type: "service",
		position: { x: 400, y: 195 },
		data: { label: "alert-manager", status: "down", icon: Bell },
		draggable: false,
	},
];

const EDGES: Edge[] = [
	{ id: "e1", source: "gw", target: "au", type: "animated" },
	{ id: "e2", source: "gw", target: "me", type: "animated" },
	{ id: "e3", source: "gw", target: "lo", type: "animated" },
	{ id: "e4", source: "au", target: "db", type: "animated" },
	{ id: "e5", source: "me", target: "db", type: "animated" },
	{ id: "e6", source: "lo", target: "al", type: "animated" },
];

const NODE_TYPES = { service: ServiceNode };
const EDGE_TYPES = { animated: AnimatedEdge };

function Inner() {
	const [nodes, , onNodesChange] = useNodesState(NODES);
	const [edges, , onEdgesChange] = useEdgesState(EDGES);

	const up = NODES.filter(
		(n) => (n.data as ServiceNodeData).status === "up",
	).length;
	const warn = NODES.filter(
		(n) => (n.data as ServiceNodeData).status === "warn",
	).length;
	const down = NODES.filter(
		(n) => (n.data as ServiceNodeData).status === "down",
	).length;

	return (
		<div
			className="h-full w-full flex flex-col"
			style={{ background: "var(--surface-sunken)" }}
		>
			<div
				className="shrink-0 flex items-center gap-2.5 px-8 pt-8 pb-6"
				style={{ color: "var(--text-primary)" }}
			>
				<Logo className="w-5 h-5" />
				<span
					className="font-semibold text-[14px] tracking-tight"
					style={{ color: "var(--text-primary)" }}
				>
					NanoNet
				</span>
				<div className="ml-auto flex items-center gap-1.5">
					<span
						className="w-1.5 h-1.5 rounded-full nn-orb-breathe"
						style={{ background: "var(--status-up)" }}
					/>
					<span
						className="text-[10px] font-mono tracking-wider"
						style={{ color: "var(--text-tertiary)" }}
					>
						LIVE
					</span>
				</div>
			</div>

			<div className="flex-1 min-h-0">
				<ReactFlow
					nodes={nodes}
					edges={edges}
					onNodesChange={onNodesChange}
					onEdgesChange={onEdgesChange}
					nodeTypes={NODE_TYPES}
					edgeTypes={EDGE_TYPES}
					fitView
					fitViewOptions={{ padding: 0.22 }}
					nodesDraggable={false}
					nodesConnectable={false}
					elementsSelectable={false}
					zoomOnScroll={false}
					panOnDrag={false}
					zoomOnPinch={false}
					zoomOnDoubleClick={false}
					preventScrolling={false}
					proOptions={{ hideAttribution: true }}
					style={{ background: "transparent" }}
				/>
			</div>

			<div
				className="shrink-0 px-8 py-5 flex items-center gap-5"
				style={{ borderTop: "1px solid var(--border-subtle)" }}
			>
				{[
					{ count: up, color: "var(--status-up)", label: "healthy" },
					{ count: warn, color: "var(--status-degraded)", label: "degraded" },
					{ count: down, color: "var(--status-down)", label: "down" },
				].map(({ count, color, label }) => (
					<div key={label} className="flex items-center gap-2">
						<span
							className="w-1.5 h-1.5 rounded-full"
							style={{ backgroundColor: color }}
						/>
						<span
							className="text-[10px] font-mono tnum"
							style={{ color: "var(--text-tertiary)" }}
						>
							{count} {label}
						</span>
					</div>
				))}
				<span
					className="ml-auto text-[10px] font-mono tnum"
					style={{ color: "var(--text-faint)" }}
				>
					{NODES.length} services
				</span>
			</div>
		</div>
	);
}

export function AuthNetworkPanel() {
	return (
		<ReactFlowProvider>
			<Inner />
		</ReactFlowProvider>
	);
}

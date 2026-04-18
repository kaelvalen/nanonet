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
import { motion } from "motion/react";
import logo from "@/assets/logo.webp";

// ─── Types ────────────────────────────────────────────────────────────────────

type NodeStatus = "up" | "warn" | "down";
type ServiceNodeData = Record<string, unknown> & {
	label: string;
	status: NodeStatus;
	icon: React.ElementType;
};

const STATUS: Record<NodeStatus, { dot: string; glow: string }> = {
	up: { dot: "#34d399", glow: "rgba(52,211,153,0.35)" },
	warn: { dot: "#f59e0b", glow: "rgba(245,158,11,0.35)" },
	down: { dot: "#f43f5e", glow: "rgba(244,63,94,0.35)" },
};

// ─── Node ─────────────────────────────────────────────────────────────────────

function ServiceNode({ data }: NodeProps) {
	const d = data as ServiceNodeData;
	const s = STATUS[d.status];
	const Icon = d.icon;

	return (
		<div
			className="w-36 rounded-xl overflow-hidden"
			style={{
				background: "rgba(17, 20, 35, 0.9)",
				border: "1px solid rgba(255,255,255,0.06)",
				backdropFilter: "blur(12px)",
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

			{/* Top accent */}
			<div
				className="h-px w-full"
				style={{
					background: `linear-gradient(90deg, transparent 10%, ${s.dot}66 50%, transparent 90%)`,
				}}
			/>

			<div className="flex items-center gap-2.5 px-3 py-2.5">
				<Icon className="w-3.5 h-3.5 shrink-0" style={{ color: s.dot }} />
				<span className="text-[11px] font-mono text-slate-300 truncate flex-1">
					{d.label}
				</span>
				<motion.div
					animate={{ opacity: [1, 0.3, 1] }}
					transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
					className="w-1.5 h-1.5 rounded-full shrink-0"
					style={{ backgroundColor: s.dot, boxShadow: `0 0 5px ${s.glow}` }}
				/>
			</div>
		</div>
	);
}

// ─── Edge ─────────────────────────────────────────────────────────────────────

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
				stroke="rgba(99,102,241,0.15)"
				strokeWidth={1.5}
			/>
			<path
				d={path}
				fill="none"
				stroke="rgba(99,102,241,0.45)"
				strokeWidth={1.5}
				strokeDasharray="5 12"
				strokeLinecap="round"
			>
				<animate
					attributeName="stroke-dashoffset"
					from="0"
					to="-68"
					dur="2.2s"
					repeatCount="indefinite"
				/>
			</path>
		</g>
	);
}

// ─── Graph data ───────────────────────────────────────────────────────────────

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

// ─── Panel ─────────────────────────────────────────────────────────────────────

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
			style={{ background: "#0a0c14" }}
		>
			{/* Header */}
			<div className="shrink-0 flex items-center gap-2.5 px-8 pt-8 pb-6">
				<img src={logo} alt="" aria-hidden="true" className="w-5 h-5" />
				<span className="text-white font-black text-sm tracking-tight">
					NanoNet
				</span>
				<div className="ml-auto flex items-center gap-1.5">
					<motion.div
						animate={{ opacity: [1, 0.4, 1] }}
						transition={{ duration: 1.8, repeat: Infinity }}
						className="w-1.5 h-1.5 rounded-full bg-emerald-400"
					/>
					<span className="text-[10px] font-mono text-emerald-400/70 tracking-widest">
						LIVE
					</span>
				</div>
			</div>

			{/* Flow */}
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

			{/* Footer */}
			<div
				className="shrink-0 border-t px-8 py-5 flex items-center gap-5"
				style={{ borderColor: "rgba(255,255,255,0.05)" }}
			>
				{[
					{ count: up, color: "#34d399", label: "healthy" },
					{ count: warn, color: "#f59e0b", label: "degraded" },
					{ count: down, color: "#f43f5e", label: "down" },
				].map(({ count, color, label }) => (
					<div key={label} className="flex items-center gap-2">
						<div
							className="w-1.5 h-1.5 rounded-full"
							style={{ backgroundColor: color }}
						/>
						<span className="text-[10px] font-mono text-slate-500">
							{count} {label}
						</span>
					</div>
				))}
				<span className="ml-auto text-[10px] font-mono text-slate-700">
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

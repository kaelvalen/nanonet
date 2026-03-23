import {
	Background,
	Controls,
	type Edge,
	type Node,
	ReactFlow,
	ReactFlowProvider,
	addEdge,
	useEdgesState,
	useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
	AlertTriangle,
	CheckCircle2,
	HelpCircle,
	Loader2,
	Plus,
	Save,
	Trash2,
	XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useServices } from "@/hooks/useServices";
import { useServiceStore } from "@/store/serviceStore";
import type { Service } from "@/types/service";

const STATUS_COLORS: Record<string, string> = {
	up: "var(--status-up)",
	degraded: "var(--status-warn)",
	down: "var(--status-down)",
	unknown: "var(--text-faint)",
};

const STATUS_BG: Record<string, string> = {
	up: "var(--status-up-bg)",
	degraded: "var(--status-warn-bg)",
	down: "var(--status-down-bg)",
	unknown: "var(--bg-elevated)",
};

function StatusIcon({ status }: { status: string }) {
	const color = STATUS_COLORS[status] ?? STATUS_COLORS.unknown;
	const size = "w-3.5 h-3.5";
	if (status === "up") return <CheckCircle2 className={size} style={{ color }} />;
	if (status === "degraded") return <AlertTriangle className={size} style={{ color }} />;
	if (status === "down") return <XCircle className={size} style={{ color }} />;
	return <HelpCircle className={size} style={{ color }} />;
}

function ServiceNode({ data }: { data: { service: Service; onDelete: (id: string) => void } }) {
	const { service, onDelete } = data;
	const color = STATUS_COLORS[service.status] ?? STATUS_COLORS.unknown;
	const bg = STATUS_BG[service.status] ?? STATUS_BG.unknown;

	return (
		<div
			className="px-3 py-2.5 rounded-xl border min-w-40 shadow-md group relative"
			style={{
				background: "var(--bg-card)",
				borderColor: color,
				borderWidth: "1.5px",
			}}
		>
			<button
				type="button"
				onClick={() => onDelete(service.id)}
				className="absolute -top-2 -right-2 w-5 h-5 rounded-full items-center justify-center hidden group-hover:flex"
				style={{ background: "var(--status-down)", color: "white" }}
			>
				<Trash2 className="w-2.5 h-2.5" />
			</button>

			<div className="flex items-center gap-2 mb-1">
				<div
					className="w-2 h-2 rounded-full animate-pulse"
					style={{ background: color }}
				/>
				<span
					className="text-sm font-semibold truncate max-w-30"
					style={{ color: "var(--text-primary)" }}
				>
					{service.name}
				</span>
			</div>
			<div className="flex items-center gap-1.5 mt-1">
				<StatusIcon status={service.status} />
				<span
					className="text-xs"
					style={{ color: "var(--text-secondary)" }}
				>
					{service.host}:{service.port}
				</span>
			</div>
			<div
				className="mt-1.5 text-xs px-1.5 py-0.5 rounded-md inline-block"
				style={{ background: bg, color: color }}
			>
				{service.status}
			</div>
		</div>
	);
}

const nodeTypes = { serviceNode: ServiceNode };

const STORAGE_KEY = "nanonet_service_map";

interface SavedMap {
	nodes: Node[];
	edges: Edge[];
}

function loadMap(): SavedMap | null {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) return JSON.parse(raw) as SavedMap;
	} catch {
	}
	return null;
}

function saveMap(nodes: Node[], edges: Edge[]) {
	localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes, edges }));
}

function buildDefaultLayout(services: Service[]): Node[] {
	const cols = Math.ceil(Math.sqrt(services.length));
	return services.map((svc, i) => ({
		id: svc.id,
		type: "serviceNode",
		position: {
			x: (i % cols) * 220 + 40,
			y: Math.floor(i / cols) * 140 + 40,
		},
		data: { service: svc, onDelete: () => {} },
	}));
}

function ServiceMapInner() {
	const { services: queryServices, isLoading } = useServices();
	const storeServices = useServiceStore((s) => s.services);
	// Store'da veri varsa anında kullan, yoksa query sonucunu bekle
	const services = storeServices.length > 0 ? storeServices : queryServices;
	const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
	const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
	const [addMode, setAddMode] = useState(false);
	const [initialized, setInitialized] = useState(false);

	const handleDelete = useCallback(
		(id: string) => {
			setNodes((ns) => ns.filter((n) => n.id !== id));
			setEdges((es) => es.filter((e) => e.source !== id && e.target !== id));
		},
		[setNodes, setEdges],
	);

	useEffect(() => {
		if (services.length === 0 || initialized) return;

		const saved = loadMap();
		const serviceIds = new Set(services.map((s) => s.id));

		if (saved) {
				const validNodes: Node[] = saved.nodes
				.filter((n: Node) => serviceIds.has(n.id))
				.map((n: Node) => {
					const svc = services.find((s) => s.id === n.id);
					return {
						...n,
						data: {
							service: svc!,
							onDelete: handleDelete,
						},
					};
				});

			const presentIds = new Set(validNodes.map((n: Node) => n.id));
			const newServices = services.filter((s) => !presentIds.has(s.id));

			const newNodes: Node[] = newServices.map((svc, i) => ({
				id: svc.id,
				type: "serviceNode" as const,
				position: {
					x: (validNodes.length + i) * 220 % 880 + 40,
					y: Math.floor((validNodes.length + i) / 4) * 140 + 40,
				},
				data: { service: svc, onDelete: handleDelete },
			}));

			setNodes([...validNodes, ...newNodes]);
			setEdges(saved.edges.filter((e: Edge) => serviceIds.has(e.source) && serviceIds.has(e.target)));
		} else {
			const defaultNodes = buildDefaultLayout(services).map((n) => ({
				...n,
				data: {
					...n.data,
					onDelete: handleDelete,
				},
			}));
			setNodes(defaultNodes);
		}
		setInitialized(true);
	}, [services, initialized, setNodes, setEdges, handleDelete]);

	useEffect(() => {
		if (!initialized) return;
		setNodes((ns: Node[]) =>
			ns.map((n: Node) => {
				const svc = services.find((s) => s.id === n.id);
				if (!svc) return n;
				return { ...n, data: { ...n.data, service: svc } };
			}),
		);
	}, [services, initialized, setNodes]);

	const onConnect = useCallback(
		(connection: Parameters<typeof addEdge>[0]) => {
			setEdges((eds: Edge[]) =>
				addEdge(
					{
						...connection,
						animated: true,
						style: { stroke: "var(--color-blue)", strokeWidth: 1.5 },
					},
					eds,
				),
			);
		},
		[setEdges],
	);

	const handleSave = () => {
		saveMap(nodes, edges);
		toast.success("Harita kaydedildi");
	};

	const handleReset = () => {
		localStorage.removeItem(STORAGE_KEY);
		const defaultNodes = buildDefaultLayout(services).map((n) => ({
			...n,
			data: { ...n.data, onDelete: handleDelete },
		}));
		setNodes(defaultNodes);
		setEdges([]);
		toast.info("Harita sıfırlandı");
	};

	const addableServices = useMemo(
		() => services.filter((s) => !nodes.find((n: Node) => n.id === s.id)),
		[services, nodes],
	);

	const addService = (svc: Service) => {
		const newNode: Node = {
			id: svc.id,
			type: "serviceNode",
			position: { x: Math.random() * 400 + 40, y: Math.random() * 200 + 40 },
			data: { service: svc, onDelete: handleDelete },
		};
		setNodes((ns: Node[]) => [...ns, newNode]);
		setAddMode(false);
	};

	return (
		<div className="flex flex-col h-full" style={{ background: "var(--bg-primary)" }}>
			{/* Toolbar */}
			<div
				className="flex items-center gap-2 px-4 py-2 border-b"
				style={{ borderColor: "var(--border-subtle)" }}
			>
				<span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
					Servisleri sürükle, bağlantı için bir node'dan diğerine çek
				</span>
				<div className="flex-1" />
				{addableServices.length > 0 && (
					<div className="relative">
						<Button
							size="sm"
							variant="outline"
							onClick={() => setAddMode((v) => !v)}
							className="gap-1.5 text-xs h-7"
						>
							<Plus className="w-3 h-3" />
							Servis Ekle
						</Button>
						{addMode && (
							<div
								className="absolute top-9 right-0 z-10 rounded-xl border shadow-lg p-2 min-w-45 space-y-1"
								style={{ background: "var(--bg-card)", borderColor: "var(--border-subtle)" }}
							>
								{addableServices.map((svc) => (
									<button
										type="button"
										key={svc.id}
										onClick={() => addService(svc)}
										className="w-full text-left px-3 py-1.5 text-xs rounded-lg hover:opacity-80 flex items-center gap-2"
										style={{ background: "var(--bg-surface)", color: "var(--text-primary)" }}
									>
										<div
											className="w-2 h-2 rounded-full"
											style={{ background: STATUS_COLORS[svc.status] ?? STATUS_COLORS.unknown }}
										/>
										{svc.name}
									</button>
								))}
							</div>
						)}
					</div>
				)}
				<Button size="sm" variant="outline" onClick={handleSave} className="gap-1.5 text-xs h-7">
					<Save className="w-3 h-3" />
					Kaydet
				</Button>
				<Button size="sm" variant="ghost" onClick={handleReset} className="gap-1.5 text-xs h-7">
					Sıfırla
				</Button>
			</div>

			{/* Legend */}
			<div
				className="flex items-center gap-4 px-4 py-1.5 border-b text-xs"
				style={{ borderColor: "var(--border-subtle)" }}
			>
				{[
					{ status: "up", label: "Çalışıyor" },
					{ status: "degraded", label: "Yavaşlamış" },
					{ status: "down", label: "Çökmüş" },
				].map(({ status, label }) => (
					<div key={status} className="flex items-center gap-1">
						<div
							className="w-2 h-2 rounded-full"
							style={{ background: STATUS_COLORS[status] }}
						/>
						<span style={{ color: "var(--text-faint)" }}>{label}</span>
					</div>
				))}
				<span style={{ color: "var(--text-faint)" }}>·</span>
				<span style={{ color: "var(--text-faint)" }}>
					{edges.length} bağlantı
				</span>
			</div>

			{/* React Flow Canvas */}
			<div className="flex-1">
				<ReactFlow
					nodes={nodes}
					edges={edges}
					onNodesChange={onNodesChange}
					onEdgesChange={onEdgesChange}
					onConnect={onConnect}
					nodeTypes={nodeTypes}
					fitView
					fitViewOptions={{ padding: 0.2 }}
					style={{ background: "var(--bg-primary)" }}
					deleteKeyCode="Delete"
				>
					<Background
						color="var(--border-subtle)"
						gap={20}
						size={1}
					/>
					<Controls
						style={{
							background: "var(--bg-card)",
							border: "1px solid var(--border-subtle)",
							borderRadius: "8px",
						}}
					/>
				</ReactFlow>
			</div>

			{isLoading && services.length === 0 && (
				<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
					<div className="flex items-center gap-2">
						<Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--text-faint)" }} />
						<p className="text-sm" style={{ color: "var(--text-faint)" }}>Servisler yükleniyor...</p>
					</div>
				</div>
			)}
			{!isLoading && services.length === 0 && (
				<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
					<p className="text-sm" style={{ color: "var(--text-faint)" }}>
						Henüz servis yok. Önce bir servis ekleyin.
					</p>
				</div>
			)}
		</div>
	);
}

export function ServiceMap() {
	return (
		<ReactFlowProvider>
			<ServiceMapInner />
		</ReactFlowProvider>
	);
}

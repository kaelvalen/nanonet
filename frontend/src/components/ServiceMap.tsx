import { useQuery, useMutation } from "@tanstack/react-query";
import {
	Background,
	Controls,
	type Edge,
	EdgeLabelRenderer,
	Handle,
	type Node,
	Position,
	ReactFlow,
	ReactFlowProvider,
	addEdge,
	useEdgesState,
	useNodesState,
	getBezierPath,
	type EdgeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
	Activity,
	AlertTriangle,
	Brain,
	CheckCircle2,
	Clock,
	HelpCircle,
	Loader2,
	Plus,
	RefreshCw,
	Save,
	Server,
	Sparkles,
	Trash2,
	TrendingUp,
	X,
	XCircle,
	Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { metricsApi, type AnalysisResult } from "@/api/metrics";
import { useServices } from "@/hooks/useServices";
import { useServiceStore } from "@/store/serviceStore";
import type { Service } from "@/types/service";

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
	up: "var(--status-up)",
	degraded: "var(--status-warn)",
	down: "var(--status-down)",
	unknown: "var(--text-faint)",
};

const STATUS_BG: Record<string, string> = {
	up: "var(--status-up-subtle)",
	degraded: "var(--status-warn-subtle)",
	down: "var(--status-down-subtle)",
	unknown: "var(--surface-sunken)",
};

const STATUS_BORDER: Record<string, string> = {
	up: "var(--status-up-border)",
	degraded: "var(--status-warn-border)",
	down: "var(--status-down-border)",
	unknown: "var(--border-subtle)",
};

const STATUS_LABEL: Record<string, string> = {
	up: "Çalışıyor",
	degraded: "Yavaşlamış",
	down: "Çökmüş",
	unknown: "Bilinmiyor",
};

const STORAGE_KEY = "nanonet_service_map_v2";

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface NodeExtra {
	latency?: number;
	uptime?: number;
	alertCount?: number;
	worstConnectedStatus?: string;
}

interface ServiceNodeData extends Record<string, unknown> {
	service: Service;
	onDelete: (id: string) => void;
	onSelect: (id: string) => void;
	selected?: boolean;
	extra?: NodeExtra;
}

interface SerializedMap {
	nodes: { id: string; type: string; position: { x: number; y: number } }[];
	edges: Edge[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function edgeColorForStatuses(srcStatus: string, tgtStatus: string): string {
	if (srcStatus === "down" || tgtStatus === "down") return "var(--status-down)";
	if (srcStatus === "degraded" || tgtStatus === "degraded") return "var(--status-warn)";
	return "var(--status-up)";
}

function loadMap(): SerializedMap | null {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as SerializedMap;
		if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
			localStorage.removeItem(STORAGE_KEY);
			return null;
		}
		return parsed;
	} catch {
		localStorage.removeItem(STORAGE_KEY);
	}
	return null;
}

function saveMap(nodes: Node[], edges: Edge[]) {
	const serialized = nodes.map((n) => ({
		id: n.id,
		type: n.type ?? "serviceNode",
		position: n.position,
	}));
	localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes: serialized, edges }));
}

function buildDefaultLayout(services: Service[]): Node[] {
	const cols = Math.max(2, Math.ceil(Math.sqrt(services.length)));
	return services.map((svc, i) => ({
		id: svc.id,
		type: "serviceNode",
		position: {
			x: (i % cols) * 260 + 60,
			y: Math.floor(i / cols) * 170 + 60,
		},
		data: { service: svc, onDelete: () => {}, onSelect: () => {} },
	}));
}

// ─── Status Icon ─────────────────────────────────────────────────────────────

function StatusIcon({ status, size = "w-3.5 h-3.5" }: { status: string; size?: string }) {
	const color = STATUS_COLOR[status] ?? STATUS_COLOR.unknown;
	if (status === "up") return <CheckCircle2 className={size} style={{ color }} />;
	if (status === "degraded") return <AlertTriangle className={size} style={{ color }} />;
	if (status === "down") return <XCircle className={size} style={{ color }} />;
	return <HelpCircle className={size} style={{ color }} />;
}

// ─── Custom Edge ─────────────────────────────────────────────────────────────

function StatusEdge({
	id,
	sourceX,
	sourceY,
	targetX,
	targetY,
	sourcePosition,
	targetPosition,
	data,
	markerEnd,
}: EdgeProps & { data?: { srcStatus?: string; tgtStatus?: string; latency?: number } }) {
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
	const strokeColor = edgeColorForStatuses(srcStatus, tgtStatus);
	const isDown = srcStatus === "down" || tgtStatus === "down";
	const isDegraded = !isDown && (srcStatus === "degraded" || tgtStatus === "degraded");
	const latency = data?.latency;

	return (
		<>
			<path
				id={id}
				className="react-flow__edge-path"
				d={edgePath}
				markerEnd={markerEnd as string}
				style={{
					stroke: strokeColor,
					strokeWidth: isDown ? 2.5 : isDegraded ? 2 : 1.5,
					strokeDasharray: isDown ? "6 3" : "none",
					animation: isDown
						? "dashdraw 1.2s linear infinite"
						: isDegraded
							? "dashdraw 2s linear infinite"
							: undefined,
					strokeDashoffset: isDown || isDegraded ? 1 : undefined,
				}}
			/>
			{latency !== undefined && (
				<EdgeLabelRenderer>
					<div
						style={{
							position: "absolute",
							transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
							pointerEvents: "all",
						}}
						className="nodrag nopan"
					>
						<span
							className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold"
							style={{
								background: "var(--surface-card)",
								border: `2px solid ${strokeColor}`,
								color: strokeColor,
								boxShadow: "var(--card-shadow)",
							}}
						>
							{latency}ms
						</span>
					</div>
				</EdgeLabelRenderer>
			)}
		</>
	);
}

// ─── Service Node ─────────────────────────────────────────────────────────────

const STATUS_SEVERITY: Record<string, number> = { up: 0, unknown: 1, degraded: 2, down: 3 };

function ServiceNode({ data }: { data: ServiceNodeData }) {
	const { service, onDelete, onSelect, selected, extra } = data;
	const color = STATUS_COLOR[service.status] ?? STATUS_COLOR.unknown;
	const bg = STATUS_BG[service.status] ?? STATUS_BG.unknown;
	const border = STATUS_BORDER[service.status] ?? STATUS_BORDER.unknown;

	// Gradient overlay when a connected neighbour is degraded/down
	const wcs = extra?.worstConnectedStatus;
	const showGradient = wcs && (STATUS_SEVERITY[wcs] ?? 0) >= 2;
	const gradientOverlay = showGradient
		? `linear-gradient(to right, var(--surface-card) 50%, color-mix(in srgb, var(--status-down) 22%, var(--surface-card)) 100%)`
		: "var(--surface-card)";

	return (
		<div
			className="rounded group relative cursor-pointer"
			style={{
				width: 200,
				background: gradientOverlay,
				border: selected ? `2px solid ${color}` : `2px solid ${border}`,
				boxShadow: selected ? `0 0 0 3px color-mix(in srgb, ${color} 25%, transparent), var(--card-shadow)` : "var(--card-shadow)",
				transition: "box-shadow 0.15s, border-color 0.15s",
			}}
			onClick={() => onSelect(service.id)}
			onKeyDown={(e) => e.key === "Enter" && onSelect(service.id)}
		>
			<Handle
				type="target"
				position={Position.Left}
				style={{ background: color, width: 9, height: 9, border: `2px solid var(--surface-card)` }}
			/>
			<Handle
				type="source"
				position={Position.Right}
				style={{ background: color, width: 9, height: 9, border: `2px solid var(--surface-card)` }}
			/>

			{/* Delete button */}
			<button
				type="button"
				onClick={(e) => { e.stopPropagation(); onDelete(service.id); }}
				className="absolute -top-2 -right-2 w-5 h-5 rounded-full items-center justify-center hidden group-hover:flex z-10"
				style={{ background: "var(--status-down)", color: "white" }}
			>
				<Trash2 className="w-2.5 h-2.5" />
			</button>

			{/* Status accent bar */}
			<div className="h-0.5 rounded-t" style={{ background: color }} />

			<div className="px-3 py-2.5">
				{/* Name row */}
				<div className="flex items-center gap-2 mb-2">
					<div
						className="w-6 h-6 rounded flex items-center justify-center shrink-0"
						style={{ background: bg, border: `2px solid ${border}` }}
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

				{/* Host */}
				<p
					className="text-[10px] truncate mb-2"
					style={{ color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}
				>
					{service.host}:{service.port}
				</p>

				{/* Metrics row */}
				<div className="flex items-center gap-2">
					<span
						className="px-1.5 py-0.5 rounded text-[9px] font-semibold flex items-center gap-1"
						style={{ background: bg, color, border: `2px solid ${border}` }}
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
					{extra?.alertCount !== undefined && extra.alertCount > 0 && (
						<span
							className="text-[9px] flex items-center gap-0.5"
							style={{ color: "var(--status-down-text)" }}
						>
							<AlertTriangle className="w-2.5 h-2.5" />
							{extra.alertCount}
						</span>
					)}
				</div>

				{/* Uptime bar */}
				{extra?.uptime !== undefined && (
					<div className="mt-2">
						<div
							className="h-1 rounded-full overflow-hidden"
							style={{ background: "var(--border-track)" }}
						>
							<div
								className="h-full rounded-full transition-all"
								style={{
									width: `${extra.uptime}%`,
									background: color,
								}}
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
}

const nodeTypes = { serviceNode: ServiceNode };
const edgeTypes = { statusEdge: StatusEdge };

// ─── Right Panel ─────────────────────────────────────────────────────────────

interface RightPanelProps {
	service: Service;
	onClose: () => void;
}

function RightPanel({ service, onClose }: RightPanelProps) {
	const color = STATUS_COLOR[service.status] ?? STATUS_COLOR.unknown;
	const [persistedAnalysis, setPersistedAnalysis] = useState<AnalysisResult | null>(null);

	const { data: alerts = [] } = useQuery({
		queryKey: ["mapAlerts", service.id],
		queryFn: () => metricsApi.getAlerts(service.id, false),
		staleTime: 30_000,
	});

	const { data: metricsRaw = [] } = useQuery({
		queryKey: ["mapMetrics", service.id],
		queryFn: () => metricsApi.getHistory(service.id, "1h", 5),
		staleTime: 20_000,
		refetchInterval: 30_000,
	});

	const latestMetric = metricsRaw[metricsRaw.length - 1];

	const analyzeMutation = useMutation({
		mutationFn: () => metricsApi.analyze(service.id, 30, false),
		onSuccess: (result: AnalysisResult) => {
			setPersistedAnalysis(result);
			toast.success("AI analizi tamamlandı");
		},
		onError: () => toast.error("AI analizi şu anda kullanılamıyor"),
	});

	const analysisResult = persistedAnalysis;

	return (
		<motion.div
			initial={{ x: 320, opacity: 0 }}
			animate={{ x: 0, opacity: 1 }}
			exit={{ x: 320, opacity: 0 }}
			transition={{ duration: 0.22, ease: "easeOut" }}
			className="flex flex-col h-full overflow-y-auto"
			style={{
				width: 300,
				minWidth: 300,
				background: "var(--surface-card)",
				borderLeft: "2px solid var(--border-default)",
			}}
		>
			{/* Header */}
			<div
				className="flex items-center gap-2 px-4 py-3 shrink-0"
				style={{ borderBottom: "2px solid var(--border-default)" }}
			>
				<div
					className="w-7 h-7 rounded flex items-center justify-center shrink-0"
					style={{
						background: STATUS_BG[service.status],
						border: `2px solid ${STATUS_BORDER[service.status]}`,
					}}
				>
					<Server className="w-3.5 h-3.5" style={{ color }} />
				</div>
				<div className="flex-1 min-w-0">
					<p className="text-xs font-semibold truncate" style={{ color: "var(--text-secondary)" }}>
						{service.name}
					</p>
					<p className="text-[10px] truncate" style={{ color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>
						{service.host}:{service.port}
					</p>
				</div>
				<button
					type="button"
					onClick={onClose}
					className="w-6 h-6 rounded flex items-center justify-center shrink-0 transition-opacity hover:opacity-70"
					style={{ color: "var(--text-faint)" }}
				>
					<X className="w-3.5 h-3.5" />
				</button>
			</div>

			<div className="p-4 space-y-4">
				{/* Status badge */}
				<div
					className="flex items-center gap-2 px-3 py-2 rounded"
					style={{
						background: STATUS_BG[service.status],
						border: `2px solid ${STATUS_BORDER[service.status]}`,
					}}
				>
					<StatusIcon status={service.status} />
					<span className="text-xs font-semibold" style={{ color }}>
						{STATUS_LABEL[service.status] ?? service.status}
					</span>
					<span className="text-[10px] ml-auto" style={{ color: "var(--text-faint)" }}>
						{service.poll_interval_sec}s polling
					</span>
				</div>

				{/* Live metrics */}
				{latestMetric && (
					<div>
						<p
							className="text-[10px] uppercase tracking-wider mb-2 flex items-center gap-1"
							style={{ color: "var(--text-muted)" }}
						>
							<Activity className="w-3 h-3" /> Anlık Metrikler
						</p>
						<div className="grid grid-cols-2 gap-2">
							{[
								{
									label: "CPU",
									value: latestMetric.cpu_percent != null ? `${latestMetric.cpu_percent.toFixed(1)}%` : "—",
									icon: Zap,
								},
								{
									label: "Bellek",
									value: latestMetric.memory_used_mb != null ? `${latestMetric.memory_used_mb.toFixed(0)} MB` : "—",
									icon: Server,
								},
								{
									label: "Gecikme",
									value: latestMetric.latency_ms != null ? `${latestMetric.latency_ms.toFixed(0)} ms` : "—",
									icon: Clock,
								},
								{
									label: "Hata Oranı",
									value: latestMetric.error_rate != null ? `${(latestMetric.error_rate * 100).toFixed(1)}%` : "—",
									icon: AlertTriangle,
								},
							].map(({ label, value, icon: Icon }) => (
								<div
									key={label}
									className="p-2 rounded"
									style={{
										background: "var(--surface-sunken)",
										border: "2px solid var(--border-default)",
									}}
								>
									<div className="flex items-center gap-1 mb-0.5">
										<Icon className="w-3 h-3" style={{ color: "var(--text-faint)" }} />
										<p className="text-[9px] uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
											{label}
										</p>
									</div>
									<p className="text-sm font-bold tabular-nums" style={{ color: "var(--text-secondary)" }}>
										{value}
									</p>
								</div>
							))}
						</div>
					</div>
				)}

				{/* Active alerts */}
				{alerts.length > 0 && (
					<div>
						<p
							className="text-[10px] uppercase tracking-wider mb-2 flex items-center gap-1"
							style={{ color: "var(--text-muted)" }}
						>
							<AlertTriangle className="w-3 h-3" style={{ color: "var(--status-down)" }} />
							Aktif Uyarılar ({alerts.length})
						</p>
						<div className="space-y-1.5">
							{alerts.slice(0, 4).map((alert) => (
								<div
									key={alert.id}
									className="px-2.5 py-2 rounded"
									style={{
										background: alert.severity === "crit" ? "var(--status-down-subtle)" : alert.severity === "warn" ? "var(--status-warn-subtle)" : "var(--color-blue-subtle)",
										border: `2px solid ${alert.severity === "crit" ? "var(--status-down-border)" : alert.severity === "warn" ? "var(--status-warn-border)" : "var(--color-blue-border)"}`,
									}}
								>
									<p className="text-[10px] font-medium line-clamp-2" style={{ color: "var(--text-secondary)" }}>
										{alert.message}
									</p>
								</div>
							))}
						</div>
					</div>
				)}

				{/* AI Analyze button */}
				<div
					className="p-3 rounded"
					style={{
						background: "var(--color-lavender-subtle)",
						border: "2px solid var(--color-lavender-border)",
					}}
				>
					<div className="flex items-center gap-2 mb-2">
						<Brain className="w-3.5 h-3.5" style={{ color: "var(--color-lavender)" }} />
						<p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--color-lavender)" }}>
							AI Analizi
						</p>
					</div>
					<button
						type="button"
						onClick={() => analyzeMutation.mutate()}
						disabled={analyzeMutation.isPending}
						className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
						style={{
							background: "var(--gradient-btn-primary)",
							color: "white",
							boxShadow: "var(--btn-shadow)",
						}}
					>
						{analyzeMutation.isPending ? (
							<><RefreshCw className="w-3 h-3 animate-spin" /> Analiz ediliyor...</>
						) : (
							<><Sparkles className="w-3 h-3" /> Bu servisi analiz et</>
						)}
					</button>

					{/* Analysis result */}
					<AnimatePresence>
						{analysisResult && (
							<motion.div
								initial={{ height: 0, opacity: 0 }}
								animate={{ height: "auto", opacity: 1 }}
								exit={{ height: 0, opacity: 0 }}
								transition={{ duration: 0.2 }}
								className="mt-3 space-y-2 overflow-hidden"
							>
								<div
									className="pt-2"
									style={{ borderTop: "2px solid var(--color-lavender-border)" }}
								>
									<p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--color-lavender)" }}>
										Özet
									</p>
									<p className="text-[10px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
										{analysisResult.summary}
									</p>
								</div>
								{analysisResult.recommendations?.slice(0, 3).map((rec, i) => (
									<div
										key={`rec-${i}`}
										className="flex items-start gap-1.5"
									>
										<TrendingUp
											className="w-3 h-3 mt-0.5 shrink-0"
											style={{ color: "var(--color-lavender)" }}
										/>
										<p className="text-[10px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
											{rec.action}
										</p>
									</div>
								))}
							</motion.div>
						)}
					</AnimatePresence>
				</div>
			</div>
		</motion.div>
	);
}

// ─── Main Inner Component ─────────────────────────────────────────────────────

function ServiceMapInner() {
	const { services: queryServices, isLoading } = useServices();
	const storeServices = useServiceStore((s) => s.services);
	const services = storeServices.length > 0 ? storeServices : queryServices;
	const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
	const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
	const [addMode, setAddMode] = useState(false);
	const [initialized, setInitialized] = useState(false);
	const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
	const addMenuRef = useRef<HTMLDivElement>(null);

	// ── Extra metrics (latency, uptime, alert counts) ──
	const { data: uptimeMap = {} } = useQuery({
		queryKey: ["mapUptime"],
		queryFn: () => metricsApi.getBulkUptime("24h"),
		staleTime: 5 * 60_000,
		enabled: services.length > 0,
	});

	const { data: activeAlerts = [] } = useQuery({
		queryKey: ["mapActiveAlerts"],
		queryFn: () => metricsApi.getActiveAlerts(),
		staleTime: 30_000,
		refetchInterval: 30_000,
	});

	// Alert count per service
	const alertCountMap = useMemo(() => {
		const m: Record<string, number> = {};
		for (const a of activeAlerts) {
			m[a.service_id] = (m[a.service_id] ?? 0) + 1;
		}
		return m;
	}, [activeAlerts]);

	const selectedService = useMemo(
		() => services.find((s) => s.id === selectedServiceId) ?? null,
		[services, selectedServiceId],
	);

	// ── Node handlers ──
	const handleDelete = useCallback(
		(id: string) => {
			setNodes((ns) => ns.filter((n) => n.id !== id));
			setEdges((es) => es.filter((e) => e.source !== id && e.target !== id));
			if (selectedServiceId === id) setSelectedServiceId(null);
		},
		[setNodes, setEdges, selectedServiceId],
	);

	const handleSelect = useCallback((id: string) => {
		setSelectedServiceId((prev) => (prev === id ? null : id));
	}, []);

	// Build node data helper
	const buildNodeData = useCallback(
		(svc: Service): ServiceNodeData => ({
			service: svc,
			onDelete: handleDelete,
			onSelect: handleSelect,
			selected: selectedServiceId === svc.id,
			extra: {
				latency: undefined,
				uptime: uptimeMap[svc.id],
				alertCount: alertCountMap[svc.id] ?? 0,
			},
		}),
		[handleDelete, handleSelect, selectedServiceId, uptimeMap, alertCountMap],
	);

	// ── Initialization ──
	useEffect(() => {
		if (services.length === 0 || initialized) return;
		const saved = loadMap();
		const serviceIds = new Set(services.map((s) => s.id));

		if (saved) {
			const validSaved = saved.nodes.filter((n) => serviceIds.has(n.id));
			const validNodes: Node[] = validSaved.map((n) => {
				const svc = services.find((s) => s.id === n.id)!;
				return { id: n.id, type: n.type, position: n.position, data: buildNodeData(svc) };
			});
			const presentIds = new Set(validNodes.map((n) => n.id));
			const newServices = services.filter((s) => !presentIds.has(s.id));
			const newNodes: Node[] = newServices.map((svc, i) => ({
				id: svc.id,
				type: "serviceNode" as const,
				position: {
					x: ((validNodes.length + i) * 260) % 1040 + 60,
					y: Math.floor((validNodes.length + i) / 4) * 170 + 60,
				},
				data: buildNodeData(svc),
			}));
			setNodes([...validNodes, ...newNodes]);
			setEdges(
				saved.edges
					.filter((e) => serviceIds.has(e.source) && serviceIds.has(e.target))
					.map((e) => enrichEdge(e, services)),
			);
		} else {
			setNodes(
				buildDefaultLayout(services).map((n) => ({
					...n,
					data: buildNodeData(services.find((s) => s.id === n.id)!),
				})),
			);
		}
		setInitialized(true);
	}, [services, initialized, setNodes, setEdges, buildNodeData]);

	// ── Update node data when services/selections/metrics change ──
	useEffect(() => {
		if (!initialized) return;
		setNodes((ns: Node[]) =>
			ns.map((n: Node) => {
				const svc = services.find((s) => s.id === n.id);
				if (!svc) return n;
				return { ...n, data: buildNodeData(svc) };
			}),
		);
	}, [services, initialized, setNodes, buildNodeData]);

	// ── Update edge colors when services change ──
	useEffect(() => {
		if (!initialized) return;
		setEdges((es: Edge[]) => es.map((e) => enrichEdge(e, services)));
	}, [services, initialized, setEdges]);

	// ── Connect ──
	const onConnect = useCallback(
		(connection: Parameters<typeof addEdge>[0]) => {
			const src = services.find((s) => s.id === connection.source);
			const tgt = services.find((s) => s.id === connection.target);
			const strokeColor = edgeColorForStatuses(src?.status ?? "unknown", tgt?.status ?? "unknown");
			setEdges((eds: Edge[]) =>
				addEdge(
					{
						...connection,
						type: "statusEdge",
						animated: src?.status === "up" && tgt?.status === "up",
						data: {
							srcStatus: src?.status ?? "unknown",
							tgtStatus: tgt?.status ?? "unknown",
							strokeColor,
						},
					},
					eds,
				),
			);
		},
		[setEdges, services],
	);

	const handleSave = () => {
		saveMap(nodes, edges);
		toast.success("Harita kaydedildi");
	};

	const handleReset = () => {
		localStorage.removeItem(STORAGE_KEY);
		setInitialized(false);
		setSelectedServiceId(null);
		setNodes([]);
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
			position: { x: Math.random() * 400 + 60, y: Math.random() * 200 + 60 },
			data: buildNodeData(svc),
		};
		setNodes((ns: Node[]) => [...ns, newNode]);
		setAddMode(false);
	};

	return (
		<div className="flex" style={{ background: "var(--bg-primary)", flex: 1, minHeight: 0 }}>
			{/* Canvas area */}
			<div className="flex flex-col" style={{ flex: 1, minWidth: 0 }}>
				{/* Toolbar */}
				<div
					className="flex items-center gap-2 px-4 py-2 shrink-0"
					style={{ borderBottom: "2px solid var(--border-default)" }}
				>
					{/* Legend */}
					<div className="flex items-center gap-3 mr-2">
						{[
							{ status: "up", label: "Çalışıyor" },
							{ status: "degraded", label: "Yavaş" },
							{ status: "down", label: "Çökmüş" },
						].map(({ status, label }) => (
							<div key={status} className="flex items-center gap-1">
								<div
									className="w-2.5 h-2.5 rounded-full"
									style={{ background: STATUS_COLOR[status] }}
								/>
								<span className="text-[10px]" style={{ color: "var(--text-faint)" }}>{label}</span>
							</div>
						))}
						<span className="text-[10px]" style={{ color: "var(--text-faint)" }}>·</span>
						<span className="text-[10px]" style={{ color: "var(--text-faint)" }}>{edges.length} bağlantı</span>
					</div>

					<div className="flex-1" />

					{addableServices.length > 0 && (
						<div className="relative" ref={addMenuRef}>
							<button
								type="button"
								onClick={() => setAddMode((v) => !v)}
								className="flex items-center gap-1.5 px-3 h-7 rounded text-xs border-2 transition-all"
								style={{
									background: addMode ? "var(--color-teal-subtle)" : "transparent",
									borderColor: addMode ? "var(--color-teal-border)" : "var(--border-default)",
									color: addMode ? "var(--color-teal)" : "var(--text-muted)",
								}}
							>
								<Plus className="w-3 h-3" />
								Servis Ekle
							</button>
							{addMode && (
								<div
									className="absolute top-9 right-0 z-20 rounded p-2 min-w-48 space-y-1"
									style={{
										background: "var(--surface-card)",
										border: "2px solid var(--border-default)",
										boxShadow: "var(--card-shadow)",
									}}
								>
									{addableServices.map((svc) => (
										<button
											type="button"
											key={svc.id}
											onClick={() => addService(svc)}
											className="w-full text-left px-3 py-1.5 rounded text-xs flex items-center gap-2 transition-opacity hover:opacity-70"
											style={{ color: "var(--text-secondary)" }}
										>
											<div
												className="w-2 h-2 rounded-full shrink-0"
												style={{ background: STATUS_COLOR[svc.status] ?? STATUS_COLOR.unknown }}
											/>
											<span className="truncate">{svc.name}</span>
											<span
												className="text-[9px] ml-auto shrink-0"
												style={{ color: STATUS_COLOR[svc.status] ?? STATUS_COLOR.unknown }}
											>
												{STATUS_LABEL[svc.status]}
											</span>
										</button>
									))}
								</div>
							)}
						</div>
					)}

					<button
						type="button"
						onClick={handleSave}
						className="flex items-center gap-1.5 px-3 h-7 rounded text-xs border-2 transition-all"
						style={{
							borderColor: "var(--color-teal-border)",
							color: "var(--color-teal)",
						}}
					>
						<Save className="w-3 h-3" />
						Kaydet
					</button>
					<button
						type="button"
						onClick={handleReset}
						className="flex items-center gap-1.5 px-3 h-7 rounded text-xs border-2 transition-all"
						style={{
							borderColor: "var(--border-default)",
							color: "var(--text-muted)",
						}}
					>
						Sıfırla
					</button>
				</div>

				{/* Canvas */}
				<div style={{ flex: 1, minHeight: 0, position: "relative" }}>
					<ReactFlow
						nodes={nodes}
						edges={edges}
						onNodesChange={onNodesChange}
						onEdgesChange={onEdgesChange}
						onConnect={onConnect}
						nodeTypes={nodeTypes}
						edgeTypes={edgeTypes}
						fitView
						fitViewOptions={{ padding: 0.25 }}
						style={{ width: "100%", height: "100%", background: "var(--bg-primary)" }}
						deleteKeyCode="Delete"
						onPaneClick={() => setSelectedServiceId(null)}
					>
						<Background color="var(--border-subtle)" gap={24} size={1} />
						<Controls
							style={{
								background: "var(--surface-card)",
								border: "2px solid var(--border-default)",
								boxShadow: "var(--card-shadow)",
								borderRadius: "6px",
							}}
						/>
					</ReactFlow>
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
			</div>

			{/* Right panel */}
			<AnimatePresence>
				{selectedService && (
					<RightPanel
						service={selectedService}
						onClose={() => setSelectedServiceId(null)}
					/>
				)}
			</AnimatePresence>
		</div>
	);
}

// ─── Edge enrichment helper ───────────────────────────────────────────────────

function enrichEdge(edge: Edge, services: Service[]): Edge {
	const src = services.find((s) => s.id === edge.source);
	const tgt = services.find((s) => s.id === edge.target);
	const isUp = src?.status === "up" && tgt?.status === "up";
	return {
		...edge,
		type: "statusEdge",
		animated: isUp,
		data: {
			...((edge.data as object) ?? {}),
			srcStatus: src?.status ?? "unknown",
			tgtStatus: tgt?.status ?? "unknown",
		},
	};
}

export function ServiceMap() {
	return (
		<ReactFlowProvider>
			<div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, height: "100%" }}>
				<ServiceMapInner />
			</div>
		</ReactFlowProvider>
	);
}

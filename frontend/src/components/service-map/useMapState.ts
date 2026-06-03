import { useQuery } from "@tanstack/react-query";
import {
	addEdge,
	type Edge,
	type Node,
	useEdgesState,
	useNodesState,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { metricsApi } from "@/api/metrics";
import { servicesApi } from "@/api/services";
import { useServices } from "@/hooks/useServices";
import { useServiceStore } from "@/store/serviceStore";
import type { Service } from "@/types/service";
import { STATUS_SEVERITY } from "./constants";
import type { SerializedMap, ServiceNodeData } from "./types";
import {
	buildDefaultLayout,
	enrichEdge,
	loadMapFromStorage,
	saveMapToStorage,
	serializeForBackend,
} from "./utils";

export function useMapState() {
	const { services: queryServices, isLoading } = useServices();
	const storeServices = useServiceStore((s) => s.services);
	const services: Service[] =
		storeServices.length > 0 ? storeServices : queryServices;

	const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
	const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
	const [initialized, setInitialized] = useState(false);
	const [selectedServiceId, setSelectedServiceId] = useState<string | null>(
		null,
	);
	const [addMode, setAddMode] = useState(false);
	const [resetAsking, setResetAsking] = useState(false);

	// ── Extra metrics queries ──────────────────────────────────────
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

	// ── Node data builder (no selectedServiceId dependency — selection
	//    is encoded in node.data.selected via the update effect below) ──
	const buildNodeData = useCallback(
		(svc: Service, selected: boolean): ServiceNodeData => ({
			service: svc,
			onDelete: () => {}, // patched after init
			onSelect: () => {}, // patched after init
			selected,
			extra: {
				uptime: uptimeMap[svc.id],
				alertCount: alertCountMap[svc.id] ?? 0,
			},
		}),
		[uptimeMap, alertCountMap],
	);

	// ── Stable callbacks (assigned into node data after init) ──────
	const handleDelete = useCallback(
		(id: string) => {
			setNodes((ns) => ns.filter((n) => n.id !== id));
			setEdges((es) => es.filter((e) => e.source !== id && e.target !== id));
			setSelectedServiceId((prev) => (prev === id ? null : prev));
		},
		[setNodes, setEdges],
	);

	const handleSelect = useCallback((id: string) => {
		setSelectedServiceId((prev) => (prev === id ? null : id));
	}, []);

	// ── Initialization: load from backend, fallback localStorage ───
	useEffect(() => {
		if (services.length === 0 || initialized) return;

		const applyMap = (saved: SerializedMap | null) => {
			const serviceIds = new Set(services.map((s) => s.id));
			const serviceMap = new Map(services.map((s) => [s.id, s]));

			let finalNodes: Node[];

			if (saved) {
				const validSaved = saved.nodes.filter((n) => serviceIds.has(n.id));
				const savedNodes: Node[] = validSaved.map((n) => ({
					id: n.id,
					type: n.type,
					position: n.position,
					data: buildNodeData(serviceMap.get(n.id) as Service, false),
				}));
				const presentIds = new Set(savedNodes.map((n) => n.id));
				const newNodes: Node[] = services
					.filter((s) => !presentIds.has(s.id))
					.map((svc, i) => ({
						id: svc.id,
						type: "serviceNode" as const,
						position: {
							x: (((savedNodes.length + i) * 260) % 1040) + 60,
							y: Math.floor((savedNodes.length + i) / 4) * 170 + 60,
						},
						data: buildNodeData(svc, false),
					}));
				finalNodes = [...savedNodes, ...newNodes];

				setEdges(
					saved.edges
						.filter((e) => serviceIds.has(e.source) && serviceIds.has(e.target))
						.map((e) => enrichEdge(e as Edge, services)),
				);
			} else {
				finalNodes = buildDefaultLayout(services).map((n) => ({
					...n,
					data: buildNodeData(serviceMap.get(n.id) as Service, false),
				}));
			}

			// Patch stable callbacks into node data
			setNodes(
				finalNodes.map((n) => ({
					...n,
					data: {
						...(n.data as ServiceNodeData),
						onDelete: handleDelete,
						onSelect: handleSelect,
					},
				})),
			);
			setInitialized(true);
		};

		servicesApi
			.loadMap()
			.then((backendMap) =>
				applyMap(
					backendMap ? (backendMap as SerializedMap) : loadMapFromStorage(),
				),
			)
			.catch(() => applyMap(loadMapFromStorage()));
	}, [
		services,
		initialized,
		setNodes,
		setEdges,
		buildNodeData,
		handleDelete,
		handleSelect,
	]);

	// ── Sync node data when services / metrics / selection change ──
	useEffect(() => {
		if (!initialized) return;
		setNodes((ns) =>
			ns.map((n) => {
				const svc = services.find((s) => s.id === n.id);
				if (!svc) return n;
				const prevData = n.data as ServiceNodeData;
				const nextData = buildNodeData(svc, selectedServiceId === n.id);
				return {
					...n,
					data: {
						...nextData,
						onDelete: prevData.onDelete,
						onSelect: prevData.onSelect,
					},
				};
			}),
		);
	}, [services, initialized, selectedServiceId, buildNodeData, setNodes]);

	// ── Sync edge colors when services / alerts change ──────────────
	useEffect(() => {
		if (!initialized) return;
		setEdges((es) => es.map((e) => enrichEdge(e, services, alertCountMap)));
	}, [services, alertCountMap, initialized, setEdges]);

	// ── Worst-connected-status propagation ──────────────────────────
	useEffect(() => {
		if (!initialized) return;
		const worstMap: Record<string, string> = {};
		for (const edge of edges) {
			const srcStatus =
				services.find((s) => s.id === edge.source)?.status ?? "unknown";
			const tgtStatus =
				services.find((s) => s.id === edge.target)?.status ?? "unknown";
			const prevTgt = worstMap[edge.target] ?? "up";
			const prevSrc = worstMap[edge.source] ?? "up";
			if ((STATUS_SEVERITY[srcStatus] ?? 0) > (STATUS_SEVERITY[prevTgt] ?? 0))
				worstMap[edge.target] = srcStatus;
			if ((STATUS_SEVERITY[tgtStatus] ?? 0) > (STATUS_SEVERITY[prevSrc] ?? 0))
				worstMap[edge.source] = tgtStatus;
		}
		setNodes((ns) =>
			ns.map((n) => {
				const prev = (n.data as ServiceNodeData).extra?.worstConnectedStatus;
				const next = worstMap[n.id];
				if (prev === next) return n;
				return {
					...n,
					data: {
						...(n.data as ServiceNodeData),
						extra: {
							...(n.data as ServiceNodeData).extra,
							worstConnectedStatus: next,
						},
					},
				};
			}),
		);
	}, [edges, services, initialized, setNodes]);

	// ── Connect handler ─────────────────────────────────────────────
	const onConnect = useCallback(
		(connection: Parameters<typeof addEdge>[0]) => {
			const src = services.find((s) => s.id === connection.source);
			const tgt = services.find((s) => s.id === connection.target);
			setEdges((eds) =>
				addEdge(
					{
						...connection,
						type: "statusEdge",
						animated: src?.status === "up" && tgt?.status === "up",
						data: {
							srcStatus: src?.status ?? "unknown",
							tgtStatus: tgt?.status ?? "unknown",
							srcAlerts: alertCountMap[connection.source ?? ""] ?? 0,
							tgtAlerts: alertCountMap[connection.target ?? ""] ?? 0,
						},
					},
					eds,
				),
			);
		},
		[setEdges, services, alertCountMap],
	);

	// ── Save ────────────────────────────────────────────────────────
	const handleSave = useCallback(() => {
		saveMapToStorage(nodes, edges);
		servicesApi
			.saveMap(serializeForBackend(nodes, edges))
			.then(() => toast.success("Harita kaydedildi"))
			.catch(() => toast.success("Harita kaydedildi (yerel)"));
	}, [nodes, edges]);

	// ── Reset ───────────────────────────────────────────────────────
	const handleReset = useCallback(() => {
		localStorage.removeItem("nanonet_service_map_v2");
		setInitialized(false);
		setSelectedServiceId(null);
		setNodes([]);
		setEdges([]);
		setResetAsking(false);
		toast.info("Harita sıfırlandı");
	}, [setNodes, setEdges]);

	// ── Add service to map ──────────────────────────────────────────
	const addServiceToMap = useCallback(
		(svc: Service, position?: { x: number; y: number }) => {
			const newNode: Node = {
				id: svc.id,
				type: "serviceNode",
				// Default: viewport-center position (passed by caller). Fallback to a
				// small jittered position if no viewport info is available.
				position: position ?? {
					x: Math.random() * 400 + 60,
					y: Math.random() * 200 + 60,
				},
				data: {
					...buildNodeData(svc, false),
					onDelete: handleDelete,
					onSelect: handleSelect,
				},
			};
			setNodes((ns) => [...ns, newNode]);
			setSelectedServiceId(svc.id);
			setAddMode(false);
		},
		[buildNodeData, handleDelete, handleSelect, setNodes, setSelectedServiceId],
	);

	// ── Derived ─────────────────────────────────────────────────────
	const statusCounts = useMemo(() => {
		const counts = { up: 0, degraded: 0, down: 0, unknown: 0 };
		for (const svc of services) {
			const s = svc.status as keyof typeof counts;
			counts[s] = (counts[s] ?? 0) + 1;
		}
		return counts;
	}, [services]);

	const addableServices = useMemo(
		() => services.filter((s) => !nodes.find((n) => n.id === s.id)),
		[services, nodes],
	);

	return {
		nodes,
		edges,
		onNodesChange,
		onEdgesChange,
		onConnect,
		isLoading,
		services,
		selectedService,
		setSelectedServiceId,
		addMode,
		setAddMode,
		resetAsking,
		setResetAsking,
		handleSave,
		handleReset,
		addServiceToMap,
		addableServices,
		statusCounts,
		edgeCount: edges.length,
	};
}

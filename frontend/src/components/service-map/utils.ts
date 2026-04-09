import type { Edge, Node } from "@xyflow/react";
import type { Service } from "@/types/service";
import { MAP_STORAGE_KEY } from "./constants";
import type { SerializedMap } from "./types";

export function edgeColorForSide(status: string, alertCount: number): string {
	if (status === "down") return "var(--status-down)";
	if (alertCount > 0) return "var(--status-down)";
	if (status === "degraded") return "var(--status-warn)";
	return "var(--status-up)";
}

export function enrichEdge(
	edge: Edge,
	services: Service[],
	alertCountMap: Record<string, number> = {},
): Edge {
	const src = services.find((s) => s.id === edge.source);
	const tgt = services.find((s) => s.id === edge.target);
	const srcStatus = src?.status ?? "unknown";
	const tgtStatus = tgt?.status ?? "unknown";
	return {
		...edge,
		type: "statusEdge",
		animated: srcStatus === "up" && tgtStatus === "up",
		data: {
			...((edge.data as object) ?? {}),
			srcStatus,
			tgtStatus,
			srcAlerts: alertCountMap[edge.source] ?? 0,
			tgtAlerts: alertCountMap[edge.target] ?? 0,
		},
	};
}

export function buildDefaultLayout(services: Service[]): Node[] {
	const cols = Math.max(2, Math.ceil(Math.sqrt(services.length)));
	return services.map((svc, i) => ({
		id: svc.id,
		type: "serviceNode",
		position: {
			x: (i % cols) * 260 + 60,
			y: Math.floor(i / cols) * 170 + 60,
		},
		data: {},
	}));
}

export function loadMapFromStorage(): SerializedMap | null {
	try {
		const raw = localStorage.getItem(MAP_STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as SerializedMap;
		if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
			localStorage.removeItem(MAP_STORAGE_KEY);
			return null;
		}
		return parsed;
	} catch {
		localStorage.removeItem(MAP_STORAGE_KEY);
		return null;
	}
}

export function serializeMap(nodes: Node[], edges: Edge[]): SerializedMap {
	return {
		nodes: nodes.map((n) => ({
			id: n.id,
			type: n.type ?? "serviceNode",
			position: n.position,
		})),
		edges: edges.map((e) => ({
			id: e.id,
			source: e.source,
			target: e.target,
			label: typeof e.label === "string" ? e.label : undefined,
		})),
	};
}

export function saveMapToStorage(nodes: Node[], edges: Edge[]) {
	localStorage.setItem(
		MAP_STORAGE_KEY,
		JSON.stringify(serializeMap(nodes, edges)),
	);
}

export function serializeForBackend(nodes: Node[], edges: Edge[]) {
	return serializeMap(nodes, edges);
}

import type { Service } from "@/types/service";

export interface NodeExtra {
	latency?: number;
	uptime?: number;
	alertCount?: number;
	worstConnectedStatus?: string;
}

export interface ServiceNodeData extends Record<string, unknown> {
	service: Service;
	onDelete: (id: string) => void;
	onSelect: (id: string) => void;
	selected?: boolean;
	extra?: NodeExtra;
}

export interface SerializedMap {
	nodes: { id: string; type: string; position: { x: number; y: number } }[];
	// Backend'e sadece string label gönderiyoruz (ReactNode/null değil).
	edges: { id: string; source: string; target: string; label?: string }[];
}

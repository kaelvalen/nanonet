import { create } from "zustand";

export interface LogEntry {
	id: string;
	timestamp: string;
	level: "info" | "warn" | "error" | "debug";
	source: string;
	message: string;
	raw?: string;
}

interface ServiceLogStore {
	logsByService: Record<string, LogEntry[]>;
	appendLog: (serviceId: string, entry: LogEntry, maxLines?: number) => void;
	setLogs: (serviceId: string, entries: LogEntry[], maxLines?: number) => void;
	clearLogs: (serviceId: string) => void;
}

export const useServiceLogStore = create<ServiceLogStore>((set) => ({
	logsByService: {},

	appendLog: (serviceId, entry, maxLines = 500) =>
		set((state) => {
			const current = state.logsByService[serviceId] ?? [];
			const next = [...current, entry];
			return {
				logsByService: {
					...state.logsByService,
					[serviceId]: next.length > maxLines ? next.slice(-maxLines) : next,
				},
			};
		}),

	setLogs: (serviceId, entries, maxLines = 500) =>
		set((state) => ({
			logsByService: {
				...state.logsByService,
				[serviceId]:
					entries.length > maxLines ? entries.slice(-maxLines) : entries,
			},
		})),

	clearLogs: (serviceId) =>
		set((state) => ({
			logsByService: {
				...state.logsByService,
				[serviceId]: [],
			},
		})),
}));

import { useCallback, useSyncExternalStore } from "react";

export type DashboardWidget =
	| "health"
	| "alerts"
	| "performance"
	| "cpu"
	| "memory"
	| "errors"
	| "status"
	| "services"
	| "activity";

export interface DashboardWidgetSpec {
	id: DashboardWidget;
	label: string;
	group: "Özet" | "Metrikler" | "Detay";
	defaultOn: boolean;
}

export const DASHBOARD_WIDGETS: DashboardWidgetSpec[] = [
	{ id: "health", label: "Sistem Sağlığı", group: "Özet", defaultOn: true },
	{ id: "alerts", label: "Aktif Uyarı", group: "Özet", defaultOn: true },
	{ id: "performance", label: "Performans", group: "Özet", defaultOn: true },
	{ id: "cpu", label: "CPU", group: "Metrikler", defaultOn: true },
	{ id: "memory", label: "Bellek", group: "Metrikler", defaultOn: true },
	{ id: "errors", label: "Hata Oranı", group: "Metrikler", defaultOn: true },
	{ id: "status", label: "Durum", group: "Metrikler", defaultOn: true },
	{ id: "services", label: "Servis Listesi", group: "Detay", defaultOn: true },
	{ id: "activity", label: "Aktivite Paneli", group: "Detay", defaultOn: true },
];

export type DashboardDensity = "compact" | "comfortable";

export interface DashboardLayoutConfig {
	visible: Record<DashboardWidget, boolean>;
	density: DashboardDensity;
}

const STORAGE_KEY = "nn:dashboard:layout:v1";

function defaults(): DashboardLayoutConfig {
	const visible = {} as Record<DashboardWidget, boolean>;
	for (const w of DASHBOARD_WIDGETS) visible[w.id] = w.defaultOn;
	return { visible, density: "comfortable" };
}

function load(): DashboardLayoutConfig {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return defaults();
		const parsed = JSON.parse(raw) as Partial<DashboardLayoutConfig>;
		const base = defaults();
		return {
			visible: { ...base.visible, ...(parsed.visible ?? {}) },
			density: parsed.density === "compact" ? "compact" : "comfortable",
		};
	} catch {
		return defaults();
	}
}

// ── Singleton store so every consumer shares the same reference ────────────
let snapshot: DashboardLayoutConfig =
	typeof window === "undefined" ? defaults() : load();
const listeners = new Set<() => void>();

function emit() {
	for (const l of listeners) l();
}

function subscribe(cb: () => void) {
	listeners.add(cb);
	return () => {
		listeners.delete(cb);
	};
}

function getSnapshot() {
	return snapshot;
}

function setStore(next: DashboardLayoutConfig) {
	snapshot = next;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
	} catch {
		// ignore quota / Safari private mode errors
	}
	emit();
}

if (typeof window !== "undefined") {
	window.addEventListener("storage", (e) => {
		if (e.key === STORAGE_KEY) {
			snapshot = load();
			emit();
		}
	});
}

export function useDashboardLayout() {
	const config = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

	const toggle = useCallback((id: DashboardWidget) => {
		setStore({
			...snapshot,
			visible: { ...snapshot.visible, [id]: !snapshot.visible[id] },
		});
	}, []);

	const setDensity = useCallback((density: DashboardDensity) => {
		setStore({ ...snapshot, density });
	}, []);

	const reset = useCallback(() => {
		setStore(defaults());
	}, []);

	const isVisible = useCallback(
		(id: DashboardWidget) => config.visible[id] !== false,
		[config],
	);

	return { config, toggle, setDensity, reset, isVisible };
}

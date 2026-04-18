import { useCallback, useEffect, useState } from "react";

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

/**
 * Dashboard layout config persisted to localStorage. Hides/shows individual
 * widgets and switches density. Subscribes to `storage` events so multiple
 * tabs stay in sync.
 */
export function useDashboardLayout() {
	const [config, setConfig] = useState<DashboardLayoutConfig>(() => {
		if (typeof window === "undefined") return defaults();
		return load();
	});

	useEffect(() => {
		const onStorage = (e: StorageEvent) => {
			if (e.key === STORAGE_KEY) setConfig(load());
		};
		window.addEventListener("storage", onStorage);
		return () => window.removeEventListener("storage", onStorage);
	}, []);

	const persist = useCallback((next: DashboardLayoutConfig) => {
		setConfig(next);
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
		} catch {
			// ignore quota/Safari private mode errors
		}
	}, []);

	const toggle = useCallback(
		(id: DashboardWidget) => {
			persist({
				...config,
				visible: { ...config.visible, [id]: !config.visible[id] },
			});
		},
		[config, persist],
	);

	const setDensity = useCallback(
		(density: DashboardDensity) => {
			persist({ ...config, density });
		},
		[config, persist],
	);

	const reset = useCallback(() => {
		persist(defaults());
	}, [persist]);

	const isVisible = useCallback(
		(id: DashboardWidget) => config.visible[id] !== false,
		[config],
	);

	return {
		config,
		toggle,
		setDensity,
		reset,
		isVisible,
	};
}

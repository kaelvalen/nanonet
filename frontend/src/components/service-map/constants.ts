export const STATUS_COLOR: Record<string, string> = {
	up: "var(--status-up)",
	degraded: "var(--status-warn)",
	down: "var(--status-down)",
	unknown: "var(--text-faint)",
};

export const STATUS_BG: Record<string, string> = {
	up: "var(--status-up-subtle)",
	degraded: "var(--status-warn-subtle)",
	down: "var(--status-down-subtle)",
	unknown: "var(--surface-sunken)",
};

export const STATUS_BORDER: Record<string, string> = {
	up: "var(--status-up-border)",
	degraded: "var(--status-warn-border)",
	down: "var(--status-down-border)",
	unknown: "var(--border-subtle)",
};

export const STATUS_LABEL: Record<string, string> = {
	up: "Çalışıyor",
	degraded: "Yavaşlamış",
	down: "Çökmüş",
	unknown: "Bilinmiyor",
};

export const STATUS_SEVERITY: Record<string, number> = {
	up: 0,
	unknown: 1,
	degraded: 2,
	down: 3,
};

export const MAP_STORAGE_KEY = "nanonet_service_map_v2";

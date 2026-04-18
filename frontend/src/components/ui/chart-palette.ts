/**
 * Chart palette — single source of truth for series colors used in
 * recharts, sparklines, heatmaps, and any other multi-series visual.
 *
 * The values resolve at render time to the matching CSS variables (which
 * adapt to light/dark theme). Use the `cssVar` form when passing to
 * recharts (which reads colors at render time).
 */

export const SERIES_COLORS = [
	"var(--series-1)",
	"var(--series-2)",
	"var(--series-3)",
	"var(--series-4)",
	"var(--series-5)",
	"var(--series-6)",
	"var(--series-7)",
	"var(--series-8)",
] as const;

/** Picks a series color by index, wrapping around. */
export function seriesColor(index: number): string {
	const i = ((index % SERIES_COLORS.length) + SERIES_COLORS.length) % SERIES_COLORS.length;
	return SERIES_COLORS[i];
}

/**
 * Resolves a CSS variable expression to its actual current color string.
 * Useful when an API expects a literal color value (e.g. some chart
 * libraries that compute gradients off the value).
 */
export function resolveCssColor(expr: string): string {
	if (typeof window === "undefined") return expr;
	const m = expr.match(/var\((--[a-z0-9-]+)\)/i);
	if (!m) return expr;
	const name = m[1];
	const root = document.documentElement;
	return getComputedStyle(root).getPropertyValue(name).trim() || expr;
}

/** Status color helper — maps a service status to the right variable. */
export function statusColor(status: string): string {
	switch (status) {
		case "up":
			return "var(--status-up)";
		case "degraded":
		case "warn":
			return "var(--status-warn)";
		case "down":
		case "crit":
			return "var(--status-down)";
		default:
			return "var(--status-unknown)";
	}
}

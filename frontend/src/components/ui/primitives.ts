/**
 * Re-exports for the unified design primitives. Pages should import from
 * here so a future move/rename only touches one file.
 *
 * Convention:
 *   import { Panel, PanelHeader, EmptyState, Toolbar, StatCard } from "@/components/ui/primitives";
 */

export {
	resolveCssColor,
	SERIES_COLORS,
	seriesColor,
	statusColor,
} from "./chart-palette";
export { EmptyState } from "./empty-state";
export {
	SkeletonCard,
	SkeletonChart,
	SkeletonGrid,
	SkeletonLine,
	SkeletonList,
	SkeletonStat,
} from "./loading-block";
export { PageHeader, PageSection, PageShell } from "./page-shell";
export type { PanelTone } from "./panel";
export { Panel, PanelBody, PanelFooter, PanelHeader, PanelIcon } from "./panel";
export { SectionHeader } from "./section-header";
export type { StatTone } from "./stat-card";
export { StatCard } from "./stat-card";
export { FilterChip, Toolbar, ToolbarChips, ToolbarDivider } from "./toolbar";

/**
 * Re-exports for the unified design primitives. Pages should import from
 * here so a future move/rename only touches one file.
 *
 * Convention:
 *   import { Panel, PanelHeader, EmptyState, Toolbar, StatCard } from "@/components/ui/primitives";
 */
export { Panel, PanelHeader, PanelBody, PanelFooter, PanelIcon } from "./panel";
export type { PanelTone } from "./panel";

export { Toolbar, ToolbarChips, FilterChip, ToolbarDivider } from "./toolbar";

export { EmptyState } from "./empty-state";

export {
	SkeletonLine,
	SkeletonCard,
	SkeletonStat,
	SkeletonList,
	SkeletonChart,
	SkeletonGrid,
} from "./loading-block";

export { SectionHeader } from "./section-header";

export { StatCard } from "./stat-card";
export type { StatTone } from "./stat-card";

export {
	SERIES_COLORS,
	seriesColor,
	resolveCssColor,
	statusColor,
} from "./chart-palette";

export { PageShell, PageHeader, PageSection } from "./page-shell";

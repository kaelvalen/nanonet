import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

export interface PageMeta {
	/** ALL CAPS section label, shown as eyebrow above title */
	eyebrow?: string;
	/** Page title — rendered in the TopBar */
	title?: string;
	/** Optional description rendered in a slim subtitle row below the TopBar */
	description?: string;
	/** Right-aligned action slot in the TopBar (buttons / toggles / etc.) */
	actions?: ReactNode;
	/** Inline meta row (counts, tabs, etc.) rendered below TopBar */
	meta?: ReactNode;
}

interface PageMetaContextValue {
	meta: PageMeta;
	setMeta: (next: PageMeta) => void;
}

const PageMetaContext = createContext<PageMetaContextValue | null>(null);

export function PageMetaProvider({ children }: { children: ReactNode }) {
	const [meta, setMeta] = useState<PageMeta>({});
	const value = useMemo(() => ({ meta, setMeta }), [meta]);
	return (
		<PageMetaContext.Provider value={value}>
			{children}
		</PageMetaContext.Provider>
	);
}

/**
 * Read the currently active page meta. TopBar uses this to render the
 * inline title + actions strip without each page needing to drill props
 * through the layout.
 */
export function usePageMetaValue(): PageMeta {
	const ctx = useContext(PageMetaContext);
	return ctx?.meta ?? {};
}

/**
 * Register the current page's meta with the layout. Pass `null` for any
 * field you don't want to override. The previous page's meta is restored
 * on unmount so route transitions stay clean.
 *
 * Pages typically don't call this directly — `<PageHeader>` does it on
 * their behalf. Use `useRegisterPageMeta` only when you need a custom
 * top-bar configuration that doesn't fit the standard PageHeader API.
 */
export function useRegisterPageMeta(meta: PageMeta) {
	const ctx = useContext(PageMetaContext);
	// Use a ref + JSON snapshot so we don't re-fire the effect on every
	// parent re-render with structurally identical actions JSX. Object
	// identity churn is the common pitfall here.
	const lastSnapshotRef = useRef<string>("");

	const snapshot = useMemo(() => {
		// We can't stringify ReactNode reliably, so snapshot only primitives
		// and rely on a render counter for actions/meta which are usually
		// stable per page.
		return JSON.stringify({
			eyebrow: meta.eyebrow ?? null,
			title: meta.title ?? null,
			description: meta.description ?? null,
			hasActions: meta.actions != null,
			hasMeta: meta.meta != null,
		});
	}, [meta.eyebrow, meta.title, meta.description, meta.actions, meta.meta]);

	useEffect(() => {
		if (!ctx) return;
		if (lastSnapshotRef.current === snapshot && ctx.meta.actions === meta.actions && ctx.meta.meta === meta.meta) {
			return;
		}
		lastSnapshotRef.current = snapshot;
		ctx.setMeta(meta);
	}, [ctx, snapshot, meta]);

	useEffect(() => {
		return () => {
			if (!ctx) return;
			ctx.setMeta({});
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);
}

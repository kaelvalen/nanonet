import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from "react";

/* PageMetaContext — lets a page push its own header info (eyebrow, title,
   description) into the global TopBar without prop-drilling through the
   layout. Consumers register on mount via `useRegisterPageMeta`; the previous
   page's values are cleared on unmount.

   Earlier revisions also tracked `actions` and `meta` ReactNodes here, but
   the TopBar never read them — only `title` and `eyebrow` are surfaced.
   Storing fresh JSX in context every render also caused identity churn that
   ping-ponged with the cleanup effect and produced a Maximum update depth
   exceeded loop. We now keep this surface minimal and primitive-only so it
   can never feedback-loop. */
export interface PageMeta {
	eyebrow?: string;
	title?: string;
	description?: string;
}

interface PageMetaContextValue {
	meta: PageMeta;
	setMeta: (next: PageMeta) => void;
}

const PageMetaContext = createContext<PageMetaContextValue | null>(null);

export function PageMetaProvider({ children }: { children: ReactNode }) {
	const [meta, setMetaRaw] = useState<PageMeta>({});

	/* Stable setter — useState's setter is already referentially stable, but
	   wrapping in useCallback documents the contract that consumers can put
	   `setMeta` in dependency arrays without triggering re-runs. */
	const setMeta = useCallback((next: PageMeta) => {
		setMetaRaw(next);
	}, []);

	const value = useMemo(() => ({ meta, setMeta }), [meta, setMeta]);
	return (
		<PageMetaContext.Provider value={value}>
			{children}
		</PageMetaContext.Provider>
	);
}

/** Read the currently active page meta. TopBar uses this to render the
 *  inline title row above the page content. */
export function usePageMetaValue(): PageMeta {
	const ctx = useContext(PageMetaContext);
	return ctx?.meta ?? {};
}

/** Register the current page's meta with the layout. Pages typically call
 *  this via `<PageHeader>` rather than directly. The previous page's meta
 *  is restored to empty on unmount.
 *
 *  Implementation note — only primitive fields participate in the dependency
 *  array. The cleanup effect deliberately runs ONLY on unmount (no `ctx` in
 *  deps) so it can't ping-pong with the setter effect via context churn. */
export function useRegisterPageMeta(meta: PageMeta) {
	const ctx = useContext(PageMetaContext);
	const setMeta = ctx?.setMeta;

	const { eyebrow, title, description } = meta;

	useEffect(() => {
		if (!setMeta) return;
		setMeta({ eyebrow, title, description });
	}, [setMeta, eyebrow, title, description]);

	useEffect(() => {
		// Cleanup runs on unmount (or if the provider's stable setter ever
		// rotates — practically never, since it's wrapped in useCallback with
		// an empty dep list). What it must NOT depend on is the context value
		// itself; an earlier revision did, which created a feedback loop where
		// each setMeta call rotated the context, fired this cleanup, and re-set
		// the meta to {} — a Maximum update depth exceeded crash.
		return () => {
			setMeta?.({});
		};
	}, [setMeta]);
}

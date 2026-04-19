import { type ComponentType, type LazyExoticComponent, lazy } from "react";

/* lazyWithPreload — React.lazy that also exposes a preload() method.
 *
 * Why we need this: `React.lazy` only starts loading a chunk when the
 * component is rendered. For route-level lazy components, that means the
 * download doesn't begin until AFTER the user clicks a link, so they see
 * the Suspense fallback while the chunk arrives.
 *
 * With preload(), we can start the fetch the moment the user *intends*
 * to navigate — on link hover, focus, or touchstart — so by the time the
 * actual click fires the chunk is in cache (or already executing) and the
 * new page mounts instantly. We can also batch-warm all dashboard chunks
 * during browser idle time so subsequent navigation is always free.
 *
 * Calling preload() multiple times is safe: dynamic import() returns the
 * same Promise on repeated calls, and the underlying request is shared.
 */
export type PreloadableComponent<T extends ComponentType<unknown>> =
	LazyExoticComponent<T> & { preload: () => Promise<unknown> };

export function lazyWithPreload<T extends ComponentType<unknown>>(
	loader: () => Promise<{ default: T }>,
): PreloadableComponent<T> {
	const Component = lazy(loader) as PreloadableComponent<T>;
	Component.preload = loader;
	return Component;
}

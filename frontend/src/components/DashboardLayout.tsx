import { Suspense, useCallback } from "react";
import { Outlet, useLocation } from "react-router";
import { useWebSocket } from "@/hooks/useWebSocket";
import { AIAssistantHost } from "./AIAssistantHost";
import { CommandPalette } from "./CommandPalette";
import { ErrorBoundary } from "./ErrorBoundary";
import { RouteFallback } from "./FullScreenSpinner";
import { MobileNav } from "./MobileNav";
import { PageMetaProvider } from "./PageMetaContext";
import { SideRail } from "./SideRail";
import { TopBar } from "./TopBar";

/**
 * Pages that own the entire content area (no main padding, no scroll).
 * They still get the global TopBar and dock — only the inner <main>
 * gives up its padding so the page can paint edge-to-edge.
 */
const FULL_BLEED_PATHS = new Set(["/app/service-map"]);

export function DashboardLayout() {
	useWebSocket();
	const { pathname } = useLocation();

	const handleOpenCommandPalette = useCallback(() => {
		const event = new KeyboardEvent("keydown", {
			key: "k",
			metaKey: true,
			bubbles: true,
		});
		document.dispatchEvent(event);
	}, []);

	const fullBleed = FULL_BLEED_PATHS.has(pathname);

	return (
		<PageMetaProvider>
			<div
				className="h-screen overflow-hidden flex flex-col"
				style={{
					background: "var(--background)",
					color: "var(--text-primary)",
				}}
			>
				{/* Side rail — desktop only */}
				<SideRail />

				<div className="flex flex-col flex-1 min-h-0 md:pl-[var(--dock-w)]">
					<TopBar onOpenCommandPalette={handleOpenCommandPalette} />

					<main
						className={
							fullBleed
								? "flex-1 flex flex-col min-h-0 overflow-hidden pb-[calc(var(--mobilenav-h)+env(safe-area-inset-bottom,0px))] md:pb-0"
								: "flex-1 flex flex-col min-h-0 pt-3 sm:pt-4 pb-[calc(var(--mobilenav-h)+env(safe-area-inset-bottom,0px)+8px)] md:pb-4 px-3 sm:px-6 lg:px-8 overflow-y-auto lg:overflow-hidden"
						}
					>
						{/* Inner Suspense — without this, lazy() route transitions bubble
						    all the way up to App.tsx's Suspense, which suspends the entire
						    RouterProvider. React 18 transitions then keep showing the
						    PREVIOUS route's content while the URL updates, requiring a
						    hard refresh to recover. Scoping the boundary to <Outlet /> lets
						    the layout (rail, topbar, etc.) stay live while only the page
						    area falls back. */}
						<ErrorBoundary key={pathname}>
							<Suspense fallback={<RouteFallback />}>
								<Outlet />
							</Suspense>
						</ErrorBoundary>
					</main>
				</div>

				<CommandPalette />
				<MobileNav />
				<AIAssistantHost />
			</div>
		</PageMetaProvider>
	);
}

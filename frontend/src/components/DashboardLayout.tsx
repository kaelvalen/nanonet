import { useCallback } from "react";
import { Outlet, useLocation } from "react-router";
import { useWebSocket } from "@/hooks/useWebSocket";
import { AIAssistant } from "./AIAssistant";
import { CommandPalette } from "./CommandPalette";
import { ErrorBoundary } from "./ErrorBoundary";
import { HybridDock } from "./HybridDock";
import { MobileNav } from "./MobileNav";
import { PageMetaProvider } from "./PageMetaContext";
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
				{/* Floating dock — desktop only */}
				<HybridDock />

				<div className="flex flex-col flex-1 min-h-0 md:pl-20">
					<TopBar onOpenCommandPalette={handleOpenCommandPalette} />

					<main
						className={
							fullBleed
								? "flex-1 flex flex-col min-h-0 overflow-hidden pb-[calc(var(--mobilenav-h)+env(safe-area-inset-bottom,0px))] md:pb-0"
								: "flex-1 flex flex-col min-h-0 pt-3 sm:pt-4 pb-[calc(var(--mobilenav-h)+env(safe-area-inset-bottom,0px)+8px)] md:pb-4 px-3 sm:px-6 lg:px-8 overflow-y-auto"
						}
					>
						<ErrorBoundary key={pathname}>
							<Outlet />
						</ErrorBoundary>
					</main>
				</div>

				<CommandPalette />
				<MobileNav />
				<AIAssistant />
			</div>
		</PageMetaProvider>
	);
}

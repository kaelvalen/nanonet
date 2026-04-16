import { useCallback } from "react";
import { Outlet, useLocation } from "react-router";
import { useWebSocket } from "@/hooks/useWebSocket";
import { AIAssistant } from "./AIAssistant";
import { CommandPalette } from "./CommandPalette";
import { ErrorBoundary } from "./ErrorBoundary";
import { FloatingStatusBar } from "./FloatingStatusBar";
import { HybridDock } from "./HybridDock";
import { MobileNav } from "./MobileNav";

/**
 * Pages that render their own full-bleed background / layout (like the
 * service map). These skip the left dock padding.
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
		<div
			className="h-screen overflow-hidden flex flex-col"
			style={{ background: "var(--background)", color: "var(--text-primary)" }}
		>
			{/* Floating dock — desktop only */}
			<HybridDock />

			{/* Floating status bar — desktop only */}
			<FloatingStatusBar onOpenCommandPalette={handleOpenCommandPalette} />

			<div
				className={`flex flex-col flex-1 min-h-0 ${
					fullBleed ? "" : "md:pl-20"
				}`}
			>
				<main
					className={
						fullBleed
							? "flex-1 flex flex-col min-h-0"
							: "flex-1 flex flex-col min-h-0 pt-16 pb-20 md:pb-6 px-4 sm:px-6 lg:px-8 overflow-hidden"
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
	);
}

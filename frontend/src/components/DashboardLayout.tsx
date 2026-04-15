import { useCallback } from "react";
import { Outlet, useLocation } from "react-router";
import { useWebSocket } from "@/hooks/useWebSocket";
import { AIAssistant } from "./AIAssistant";
import { CommandPalette } from "./CommandPalette";
import { ErrorBoundary } from "./ErrorBoundary";
import { FloatingStatusBar } from "./FloatingStatusBar";
import { HybridDock } from "./HybridDock";
import { MobileNav } from "./MobileNav";

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

	return (
		<div className="min-h-screen text-foreground">
			{/* Floating dock — hidden on mobile */}
			<HybridDock />

			{/* Floating status bar — top right */}
			<FloatingStatusBar onOpenCommandPalette={handleOpenCommandPalette} />

			{/* Page wrapper — full width, small left padding for dock clearance (except full-bleed pages) */}
			<div
				className={`flex flex-col min-h-screen ${pathname === "/app/service-map" ? "" : "md:pl-16"}`}
			>
				{/* Main Content */}
				<main
					className={`flex-1 flex flex-col min-h-0 ${pathname === "/app/service-map" ? "" : "pb-20 md:pb-8 px-4 sm:px-6 lg:px-8 pt-14"}`}
				>
					<ErrorBoundary key={pathname}>
						<Outlet />
					</ErrorBoundary>
				</main>
			</div>

			{/* Command Palette */}
			<CommandPalette />

			{/* Mobile Bottom Nav */}
			<MobileNav />

			{/* AI Assistant */}
			<AIAssistant />
		</div>
	);
}

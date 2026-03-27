import { useCallback, useState } from "react";
import { Outlet, useLocation } from "react-router";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useNavStore } from "@/store/navStore";
import { AIAssistant } from "./AIAssistant";
import { CommandPalette } from "./CommandPalette";
import { ErrorBoundary } from "./ErrorBoundary";
import { FloatingStatusBar } from "./FloatingStatusBar";
import { MobileNav } from "./MobileNav";
import { Sidebar } from "./Sidebar";

export function DashboardLayout() {
	useWebSocket();
	const { pathname } = useLocation();
	const { navMode } = useNavStore();
	const isSidebar = navMode === "sidebar";
	const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

	const handleOpenCommandPalette = useCallback(() => {
		const event = new KeyboardEvent("keydown", {
			key: "k",
			metaKey: true,
			bubbles: true,
		});
		document.dispatchEvent(event);
	}, []);

	return (
		<div className="min-h-screen bg-background text-foreground relative">
			<div
				className="fixed inset-0 pointer-events-none z-0"
				style={{
					backgroundImage: `radial-gradient(var(--dot-pattern) 1px, transparent 1px)`,
					backgroundSize: "28px 28px",
				}}
			/>

			{/* Sidebar — only in sidebar mode, hidden on mobile */}
			{isSidebar && (
				<div className="hidden md:block">
					<Sidebar onCollapsedChange={setSidebarCollapsed} />
				</div>
			)}

			{/* Page wrapper — shifts right of sidebar only in sidebar mode on md+ */}
			<div
				className={`relative z-10 flex flex-col min-h-screen transition-[margin] duration-200 ${isSidebar ? (sidebarCollapsed ? "md:ml-14" : "md:ml-50") : ""}`}
			>
				{/* Floating Status Bar — sticky in sidebar mode, fixed in floating mode */}
				<FloatingStatusBar onOpenCommandPalette={handleOpenCommandPalette} />

				{/* Main Content */}
				<main
					className={`flex-1 flex flex-col min-h-0 pb-20 md:pb-8 ${isSidebar ? "px-3 sm:px-4 md:px-6 lg:px-8 pt-4" : "px-6 sm:px-10 md:px-14 lg:px-20 pt-18"}`}
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

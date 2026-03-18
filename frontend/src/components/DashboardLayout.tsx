import { useCallback, useState } from "react";
import { Outlet, useLocation } from "react-router";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useNavStore } from "@/store/navStore";
import { AIAssistant } from "./AIAssistant";
import { CommandPalette } from "./CommandPalette";
import { ErrorBoundary } from "./ErrorBoundary";
import { FloatingStatusBar } from "./FloatingStatusBar";
import { MatrixBackground } from "./MatrixBackground";
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
		<div className="min-h-screen bg-background text-foreground relative overflow-hidden">
			{/* Dot grid background */}
			<MatrixBackground />
			<div
				className="fixed inset-0 pointer-events-none z-0"
				style={{
					backgroundImage: `radial-gradient(var(--dot-pattern) 1px, transparent 1px)`,
					backgroundSize: "28px 28px",
				}}
			/>

			{/* Sidebar — only in sidebar mode */}
			{isSidebar && <Sidebar onCollapsedChange={setSidebarCollapsed} />}

			{/* Page wrapper — shifts right of sidebar only in sidebar mode */}
			<div
				className="relative z-10 flex flex-col min-h-screen transition-all duration-200"
				style={{
					marginLeft: isSidebar ? (sidebarCollapsed ? "56px" : "200px") : "0px",
				}}
			>
				{/* Floating Status Bar — sticky in sidebar mode, fixed in floating mode */}
				<FloatingStatusBar onOpenCommandPalette={handleOpenCommandPalette} />

				{/* Main Content — extra top padding in floating mode so content clears the fixed bar */}
				<main
					className={`flex-1 pb-8 px-4 sm:px-6 lg:px-8 max-w-6xl w-full mx-auto ${isSidebar ? "pt-6" : "pt-20"}`}
				>
					<ErrorBoundary key={pathname}>
						<Outlet />
					</ErrorBoundary>
				</main>
			</div>

			{/* Command Palette */}
			<CommandPalette />

			{/* AI Assistant */}
			<AIAssistant />
		</div>
	);
}

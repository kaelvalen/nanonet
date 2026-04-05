import { useCallback, useState } from "react";
import { Outlet, useLocation } from "react-router";
import { useWebSocket } from "@/hooks/useWebSocket";
import { AIAssistant } from "./AIAssistant";
import { CommandPalette } from "./CommandPalette";
import { ErrorBoundary } from "./ErrorBoundary";
import { FloatingStatusBar } from "./FloatingStatusBar";
import { MobileNav } from "./MobileNav";
import { Sidebar } from "./Sidebar";

export function DashboardLayout() {
	useWebSocket();
	const { pathname } = useLocation();
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
		<div className="min-h-screen bg-background text-foreground">
			{/* Sidebar — hidden on mobile */}
			<div className="hidden md:block">
				<Sidebar onCollapsedChange={setSidebarCollapsed} />
			</div>

			{/* Floating status bar */}
			<FloatingStatusBar
				onOpenCommandPalette={handleOpenCommandPalette}
				sidebarCollapsed={sidebarCollapsed}
			/>

			{/* Page wrapper */}
			<div
				className={`flex flex-col min-h-screen transition-[margin-left] duration-200 ${
					sidebarCollapsed ? "md:ml-[60px]" : "md:ml-[240px]"
				}`}
			>
				{/* Main Content */}
				<main className="flex-1 flex flex-col min-h-0 pb-20 md:pb-8 px-4 sm:px-6 lg:px-8 pt-16">
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

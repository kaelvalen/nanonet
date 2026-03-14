import { useCallback, useState } from "react";
import { Outlet, useLocation } from "react-router";
import { MatrixBackground } from "./MatrixBackground";
import { AIAssistant } from "./AIAssistant";
import { CommandPalette } from "./CommandPalette";
import { FloatingStatusBar } from "./FloatingStatusBar";
import { Sidebar } from "./Sidebar";
import { ErrorBoundary } from "./ErrorBoundary";
import { useWebSocket } from "@/hooks/useWebSocket";

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

      {/* Sidebar */}
      <Sidebar onCollapsedChange={setSidebarCollapsed} />

      {/* Page wrapper — shifts right of sidebar */}
      <div
        className="relative z-10 flex flex-col min-h-screen transition-all duration-200"
        style={{ marginLeft: sidebarCollapsed ? "56px" : "200px" }}
      >
        {/* Floating Status Bar */}
        <FloatingStatusBar onOpenCommandPalette={handleOpenCommandPalette} />

        {/* Main Content */}
        <main className="flex-1 pt-6 pb-8 px-4 sm:px-6 lg:px-8 max-w-6xl w-full mx-auto">
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

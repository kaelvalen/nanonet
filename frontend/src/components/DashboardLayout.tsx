import { useCallback } from "react";
import { Outlet } from "react-router";
import { MatrixBackground } from "./MatrixBackground";
import { AIAssistant } from "./AIAssistant";
import { CommandPalette } from "./CommandPalette";
import { FloatingStatusBar } from "./FloatingStatusBar";
import { useWebSocket } from "@/hooks/useWebSocket";

export function DashboardLayout() {
  // Activate WebSocket connection for the dashboard
  useWebSocket();

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

      {/* Floating Status Bar */}
      <FloatingStatusBar onOpenCommandPalette={handleOpenCommandPalette} />

      {/* Main Content */}
      <main className="relative z-10 pt-20 pb-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <Outlet />
      </main>


      {/* Command Palette */}
      <CommandPalette />

      {/* AI Assistant */}
      <AIAssistant />
    </div>
  );
}

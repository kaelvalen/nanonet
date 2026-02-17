import { useCallback } from "react";
import { Outlet } from "react-router";
import { MatrixBackground } from "./MatrixBackground";
import { AIAssistant } from "./AIAssistant";
import { RadialMenu } from "./RadialMenu";
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
    <div className="min-h-screen bg-gradient-to-br from-[#f0f7ff] via-[#f5f0ff] to-[#fdf2f8] text-[#3b4563] relative overflow-hidden">
      {/* Pastel floating shapes background */}
      <MatrixBackground />

      {/* Soft dot pattern overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: `radial-gradient(rgba(57, 197, 187, 0.06) 1px, transparent 1px)`,
          backgroundSize: "32px 32px",
        }}
      />

      {/* Soft gradient blobs for ambiance */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#39c5bb]/8 rounded-full blur-3xl animate-blob" />
        <div className="absolute top-1/3 -right-32 w-80 h-80 bg-[#c4b5fd]/10 rounded-full blur-3xl animate-blob animation-delay-2000" />
        <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-[#fda4af]/8 rounded-full blur-3xl animate-blob animation-delay-4000" />
      </div>

      {/* Floating Status Bar */}
      <FloatingStatusBar onOpenCommandPalette={handleOpenCommandPalette} />

      {/* Main Content */}
      <main className="relative z-10 pt-20 pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <Outlet />
      </main>

      {/* Radial Menu */}
      <RadialMenu />

      {/* Command Palette */}
      <CommandPalette />

      {/* AI Assistant */}
      <AIAssistant />
    </div>
  );
}

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
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      {/* Theme gradient overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{ background: "var(--gradient-light)", opacity: 0.45 }}
      />

      {/* Pastel floating shapes background */}
      <MatrixBackground />

      {/* Dot pattern overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: `radial-gradient(rgba(0, 180, 216, 0.07) 1px, transparent 1px)`,
          backgroundSize: "32px 32px",
        }}
      />

      {/* Ambient gradient blobs */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#D0FAFF]/30 rounded-full blur-3xl animate-blob" />
        <div className="absolute top-1/3 -right-32 w-80 h-80 bg-[#FED7FF]/25 rounded-full blur-3xl animate-blob animation-delay-2000" />
        <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-[#D0FAFF]/20 rounded-full blur-3xl animate-blob animation-delay-4000" />
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

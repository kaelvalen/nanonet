import { useNavigate, useLocation } from "react-router";
import { Sparkles, Heart, ChevronDown, ArrowLeft, Search } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

const pageNames: Record<string, string> = {
  "/": "",
  "/services": "Services",
  "/alerts": "Alerts",
  "/ai-insights": "AI Insights",
  "/settings": "Settings",
};

export function FloatingStatusBar({ onOpenCommandPalette }: { onOpenCommandPalette: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === "/";
  
  const currentPage = Object.entries(pageNames).find(([path]) => 
    path !== "/" && location.pathname.startsWith(path)
  )?.[1] || (location.pathname.includes("/services/") ? "Service Detail" : "");

  return (
    <header className="fixed top-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-5xl">
      <div className="relative">
        {/* Soft glow */}
        <div className="absolute -inset-1 bg-gradient-to-r from-[#39c5bb]/10 via-[#c4b5fd]/10 to-[#fda4af]/10 rounded-2xl blur-lg" />

        {/* Main bar */}
        <div className="relative bg-white/70 backdrop-blur-xl border border-[#39c5bb]/15 rounded-2xl px-4 py-2 flex items-center gap-3 shadow-sm shadow-[#39c5bb]/5">
          {/* Back button */}
          {!isHome && (
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-[#39c5bb]/10 transition-colors text-[#7c8db5] hover:text-[#39c5bb]"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-xs font-[var(--font-mono)] hidden sm:inline">Home</span>
            </button>
          )}

          {/* Separator */}
          {!isHome && <div className="w-px h-5 bg-[#39c5bb]/15" />}

          {/* Logo */}
          <button 
            onClick={() => navigate("/")}
            className="flex items-center gap-2 group cursor-pointer"
          >
            <div className="relative">
              <div className="w-7 h-7 bg-gradient-to-br from-[#39c5bb] to-[#93c5fd] rounded-lg flex items-center justify-center shadow-sm shadow-[#39c5bb]/20 group-hover:shadow-[#39c5bb]/40 transition-all">
                <span className="text-white text-xs">✦</span>
              </div>
            </div>
            <span className="font-[var(--font-quicksand)] font-bold text-sm bg-gradient-to-r from-[#39c5bb] via-[#93c5fd] to-[#c4b5fd] bg-clip-text text-transparent hidden sm:inline">
              NanoNet
            </span>
          </button>

          {/* Current page */}
          {currentPage && (
            <>
              <div className="text-[#c4b5fd] text-xs">/</div>
              <span className="text-xs font-[var(--font-mono)] text-[#39c5bb] tracking-wide">{currentPage}</span>
            </>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Search trigger */}
          <button
            onClick={onOpenCommandPalette}
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-[#f0f7ff] rounded-lg border border-[#39c5bb]/15 hover:border-[#39c5bb]/30 transition-all text-[#7c8db5] hover:text-[#3b4563]"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="text-xs">Search...</span>
            <kbd className="text-[10px] font-[var(--font-mono)] px-1.5 py-0.5 bg-white border border-[#39c5bb]/15 rounded text-[#7c8db5] ml-4">
              ⌘K
            </kbd>
          </button>

          {/* LIVE status */}
          <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 bg-[#a7f3d0]/20 rounded-lg border border-[#a7f3d0]/30">
            <div className="relative">
              <div className="w-1.5 h-1.5 bg-[#34d399] rounded-full animate-pulse" />
              <div className="absolute inset-0 w-1.5 h-1.5 bg-[#34d399] rounded-full animate-pulse-ring" />
            </div>
            <span className="text-[10px] font-[var(--font-mono)] text-[#059669]">LIVE</span>
          </div>

          {/* AI indicator */}
          <div className="hidden md:flex items-center gap-1.5 px-2 py-1 bg-[#c4b5fd]/15 rounded-lg border border-[#c4b5fd]/25">
            <Sparkles className="w-3 h-3 text-[#8b5cf6] animate-glow" />
            <div className="flex gap-0.5">
              <div className="w-0.5 h-2 bg-[#c4b5fd] rounded-sm animate-pulse" style={{ animationDelay: "0s" }} />
              <div className="w-0.5 h-3 bg-[#c4b5fd] rounded-sm animate-pulse" style={{ animationDelay: "0.2s" }} />
              <div className="w-0.5 h-1.5 bg-[#c4b5fd] rounded-sm animate-pulse" style={{ animationDelay: "0.4s" }} />
            </div>
          </div>

          {/* Credits */}
          <div className="hidden md:flex items-center gap-1.5 px-2 py-1 bg-[#fda4af]/10 rounded-lg border border-[#fda4af]/20">
            <Heart className="w-3 h-3 text-[#fb7185]" />
            <span className="text-xs font-[var(--font-mono)] text-[#f43f5e]">842</span>
          </div>

          {/* User Avatar */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="relative group">
                <div className="w-8 h-8 bg-gradient-to-br from-[#39c5bb] to-[#93c5fd] rounded-full flex items-center justify-center border-2 border-white shadow-sm group-hover:shadow-[#39c5bb]/30 transition-all">
                  <span className="text-white text-xs font-[var(--font-quicksand)] font-bold">KV</span>
                </div>
                <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-[#34d399] rounded-full border-2 border-white animate-pulse" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-white/95 backdrop-blur-xl border-[#39c5bb]/20 shadow-lg">
              <DropdownMenuLabel className="text-[#3b4563] text-xs">My Account</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-[#39c5bb]/10" />
              <DropdownMenuItem className="text-[#3b4563] text-xs">Profile</DropdownMenuItem>
              <DropdownMenuItem className="text-[#3b4563] text-xs" onClick={() => navigate("/settings")}>Settings</DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[#39c5bb]/10" />
              <DropdownMenuItem className="text-[#f43f5e] text-xs">Logout</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

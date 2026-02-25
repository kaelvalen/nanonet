import { useNavigate, useLocation, Link } from "react-router";
import { Sparkles, ChevronRight, Search, Server, AlertCircle, Settings } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { useAuthStore } from "@/store/authStore";
import { useWSStore } from "@/store/wsStore";
import { useAuth } from "@/hooks/useAuth";
import { useServices } from "@/hooks/useServices";

type Crumb = { label: string; path: string };

function buildBreadcrumbs(pathname: string): Crumb[] {
  const crumbs: Crumb[] = [{ label: "Home", path: "/" }];
  if (pathname.startsWith("/services/") && pathname.length > 10) {
    crumbs.push({ label: "Services", path: "/services" });
    crumbs.push({ label: "Detail", path: pathname });
  } else if (pathname === "/services") {
    crumbs.push({ label: "Services", path: "/services" });
  } else if (pathname === "/alerts") {
    crumbs.push({ label: "Alerts", path: "/alerts" });
  } else if (pathname === "/ai-insights") {
    crumbs.push({ label: "AI Insights", path: "/ai-insights" });
  } else if (pathname === "/settings") {
    crumbs.push({ label: "Settings", path: "/settings" });
  }
  return crumbs;
}

export function FloatingStatusBar({ onOpenCommandPalette }: { onOpenCommandPalette: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const { isConnected } = useWSStore();
  const { logout } = useAuth();
  const { services } = useServices();

  const crumbs = buildBreadcrumbs(location.pathname);
  const isHome = location.pathname === "/";

  const initials = user?.email
    ? user.email.substring(0, 2).toUpperCase()
    : "NN";

  const upCount = services.filter((s) => s.status === "up").length;
  const downCount = services.filter((s) => s.status === "down" || s.status === "degraded").length;

  return (
    <header className="fixed top-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-5xl">
      <div className="relative">
        <div className="absolute -inset-1 bg-linear-to-r from-[#39c5bb]/10 via-[#c4b5fd]/10 to-[#fda4af]/10 rounded-2xl blur-lg" />

        <div className="relative bg-white/75 backdrop-blur-xl border border-[#39c5bb]/15 rounded-2xl px-4 py-2 flex items-center gap-3 shadow-sm shadow-[#39c5bb]/5">

          {/* Logo */}
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 group cursor-pointer shrink-0"
          >
            <div className="w-7 h-7 bg-linear-to-br from-[#39c5bb] to-[#93c5fd] rounded-lg flex items-center justify-center shadow-sm shadow-[#39c5bb]/20 group-hover:shadow-[#39c5bb]/35 transition-all">
              <span className="text-white text-xs">✦</span>
            </div>
            <span className="font-(--font-quicksand) text-sm bg-linear-to-r from-[#39c5bb] via-[#93c5fd] to-[#c4b5fd] bg-clip-text text-transparent hidden sm:inline">
              NanoNet
            </span>
          </button>

          {/* Breadcrumbs */}
          {!isHome && (
            <nav className="hidden sm:flex items-center gap-1 min-w-0">
              {crumbs.map((crumb, i) => (
                <span key={crumb.path} className="flex items-center gap-1 min-w-0">
                  {i > 0 && <ChevronRight className="w-3 h-3 text-[#b0bdd5] shrink-0" />}
                  {i === crumbs.length - 1 ? (
                    <span className="text-xs font-(--font-mono) text-[#39c5bb] truncate max-w-28">{crumb.label}</span>
                  ) : (
                    <Link
                      to={crumb.path}
                      className="text-xs text-[#7c8db5] hover:text-[#39c5bb] transition-colors truncate max-w-20"
                    >
                      {crumb.label}
                    </Link>
                  )}
                </span>
              ))}
            </nav>
          )}

          {/* Service count badge (home only) */}
          {isHome && services.length > 0 && (
            <div className="hidden sm:flex items-center gap-2">
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#39c5bb]/8 border border-[#39c5bb]/15">
                <Server className="w-3 h-3 text-[#39c5bb]" />
                <span className="text-[10px] text-[#2da89e] font-(--font-mono)">{services.length}</span>
              </div>
              {downCount > 0 && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#fda4af]/10 border border-[#fda4af]/20">
                  <AlertCircle className="w-3 h-3 text-[#e11d48]" />
                  <span className="text-[10px] text-[#e11d48] font-(--font-mono)">{downCount}</span>
                </div>
              )}
              {upCount === services.length && services.length > 0 && (
                <span className="text-[10px] text-[#059669] hidden md:inline">All systems operational</span>
              )}
            </div>
          )}

          <div className="flex-1" />

          {/* Quick nav links (home only, desktop) */}
          {isHome && (
            <nav className="hidden lg:flex items-center gap-1">
              {[
                { path: "/services", label: "Services", icon: Server },
                { path: "/alerts", label: "Alerts", icon: AlertCircle },
                { path: "/settings", label: "Settings", icon: Settings },
              ].map(({ path, label, icon: Icon }) => (
                <Link
                  key={path}
                  to={path}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] text-[#7c8db5] hover:text-[#39c5bb] hover:bg-[#39c5bb]/8 transition-all"
                >
                  <Icon className="w-3 h-3" />
                  {label}
                </Link>
              ))}
            </nav>
          )}

          {/* Search trigger */}
          <button
            onClick={onOpenCommandPalette}
            className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-[#f0f7ff] rounded-lg border border-[#39c5bb]/15 hover:border-[#39c5bb]/30 transition-all text-[#7c8db5] hover:text-[#3b4563]"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="text-xs">Search...</span>
            <kbd className="text-[10px] font-(--font-mono) px-1.5 py-0.5 bg-white border border-[#39c5bb]/15 rounded text-[#7c8db5] ml-3">
              ⌘K
            </kbd>
          </button>

          {/* WS status */}
          <div className={`hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-lg border ${
            isConnected
              ? "bg-[#a7f3d0]/20 border-[#a7f3d0]/30"
              : "bg-[#fda4af]/20 border-[#fda4af]/30"
          }`}>
            <div className="relative">
              <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-[#34d399] animate-pulse" : "bg-[#fb7185]"}`} />
              {isConnected && <div className="absolute inset-0 w-1.5 h-1.5 bg-[#34d399] rounded-full animate-pulse-ring" />}
            </div>
            <span className={`text-[10px] font-(--font-mono) ${isConnected ? "text-[#059669]" : "text-[#e11d48]"}`}>
              {isConnected ? "LIVE" : "OFF"}
            </span>
          </div>

          {/* AI indicator */}
          <div className="hidden lg:flex items-center gap-1.5 px-2 py-1 bg-[#c4b5fd]/15 rounded-lg border border-[#c4b5fd]/25">
            <Sparkles className="w-3 h-3 text-[#8b5cf6] animate-glow" />
            <div className="flex gap-0.5">
              <div className="w-0.5 h-2 bg-[#c4b5fd] rounded-sm animate-pulse" style={{ animationDelay: "0s" }} />
              <div className="w-0.5 h-3 bg-[#c4b5fd] rounded-sm animate-pulse" style={{ animationDelay: "0.2s" }} />
              <div className="w-0.5 h-1.5 bg-[#c4b5fd] rounded-sm animate-pulse" style={{ animationDelay: "0.4s" }} />
            </div>
          </div>

          {/* User Avatar */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="relative group shrink-0">
                <div className="w-8 h-8 bg-linear-to-br from-[#39c5bb] to-[#93c5fd] rounded-full flex items-center justify-center border-2 border-white shadow-sm group-hover:shadow-[#39c5bb]/30 transition-all">
                  <span className="text-white text-xs font-(--font-quicksand)">{initials}</span>
                </div>
                {isConnected && (
                  <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-[#34d399] rounded-full border-2 border-white" />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-white/95 backdrop-blur-xl border-[#39c5bb]/20 shadow-lg rounded-xl">
              <DropdownMenuLabel className="text-[#3b4563] text-xs">{user?.email || "My Account"}</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-[#39c5bb]/10" />
              <DropdownMenuItem className="text-[#3b4563] text-xs cursor-pointer" onClick={() => navigate("/settings")}>
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[#39c5bb]/10" />
              <DropdownMenuItem className="text-[#f43f5e] text-xs cursor-pointer" onClick={() => logout()}>
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

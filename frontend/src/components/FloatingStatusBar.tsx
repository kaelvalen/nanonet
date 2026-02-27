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
        <div className="absolute -inset-1 rounded-2xl blur-lg" style={{ background: "linear-gradient(to right, var(--color-teal-subtle), var(--color-lavender-subtle), var(--color-pink-subtle))" }} />

        <div className="relative backdrop-blur-xl rounded-2xl px-4 py-2 flex items-center gap-3 shadow-sm" style={{ background: "var(--surface-glass)", border: "1px solid var(--color-teal-border)", boxShadow: "0 1px 4px var(--shadow-card)" }}>

          {/* Logo */}
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 group cursor-pointer shrink-0"
          >
            <div className="w-7 h-7 rounded-lg flex items-center justify-center transition-all" style={{ background: "var(--gradient-logo)" }}>
              <span className="text-white text-xs">✦</span>
            </div>
            <span className="font-(--font-quicksand) text-sm bg-clip-text text-transparent hidden sm:inline" style={{ backgroundImage: "var(--gradient-text)" }}>
              NanoNet
            </span>
          </button>

          {/* Breadcrumbs */}
          {!isHome && (
            <nav className="hidden sm:flex items-center gap-1 min-w-0">
              {crumbs.map((crumb, i) => (
                <span key={crumb.path} className="flex items-center gap-1 min-w-0">
                  {i > 0 && <ChevronRight className="w-3 h-3 shrink-0" style={{ color: "var(--text-faint)" }} />}
                  {i === crumbs.length - 1 ? (
                    <span className="text-xs font-(--font-mono) truncate max-w-28" style={{ color: "var(--text-link)" }}>{crumb.label}</span>
                  ) : (
                    <Link
                      to={crumb.path}
                      className="text-xs transition-colors truncate max-w-20"
                      style={{ color: "var(--text-muted)" }}
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
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg" style={{ background: "var(--color-teal-subtle)", border: "1px solid var(--color-teal-border)" }}>
                <Server className="w-3 h-3" style={{ color: "var(--color-teal)" }} />
                <span className="text-[10px] font-(--font-mono)" style={{ color: "var(--color-teal-hover)" }}>{services.length}</span>
              </div>
              {downCount > 0 && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg" style={{ background: "var(--status-down-subtle)", border: "1px solid var(--status-down-border)" }}>
                  <AlertCircle className="w-3 h-3" style={{ color: "var(--status-down-text)" }} />
                  <span className="text-[10px] font-(--font-mono)" style={{ color: "var(--status-down-text)" }}>{downCount}</span>
                </div>
              )}
              {upCount === services.length && services.length > 0 && (
                <span className="text-[10px] hidden md:inline" style={{ color: "var(--status-up-text)" }}>All systems operational</span>
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
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] transition-all"
                  style={{ color: "var(--text-muted)" }}
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
            className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all"
            style={{ background: "var(--surface-sunken)", border: "1px solid var(--color-teal-border)", color: "var(--text-muted)" }}
          >
            <Search className="w-3.5 h-3.5" />
            <span className="text-xs">Search...</span>
            <kbd className="text-[10px] font-(--font-mono) px-1.5 py-0.5 rounded ml-3" style={{ background: "var(--surface-raised)", border: "1px solid var(--color-teal-border)", color: "var(--text-muted)" }}>
              ⌘K
            </kbd>
          </button>

          {/* WS status */}
          <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-lg"
            style={isConnected
              ? { background: "var(--status-up-subtle)", border: "1px solid var(--status-up-border)" }
              : { background: "var(--status-down-subtle)", border: "1px solid var(--status-down-border)" }}>
            <div className="relative">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isConnected ? "var(--status-up)" : "var(--status-down)" }} />
              {isConnected && <div className="absolute inset-0 w-1.5 h-1.5 rounded-full animate-pulse-ring" style={{ backgroundColor: "var(--status-up)" }} />}
            </div>
            <span className="text-[10px] font-(--font-mono)" style={{ color: isConnected ? "var(--status-up-text)" : "var(--status-down-text)" }}>
              {isConnected ? "LIVE" : "OFF"}
            </span>
          </div>

          {/* AI indicator */}
          <div className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ background: "var(--color-ai-subtle)", border: "1px solid var(--color-ai-border)" }}>
            <Sparkles className="w-3 h-3 animate-glow" style={{ color: "var(--color-ai)" }} />
            <div className="flex gap-0.5">
              <div className="w-0.5 h-2 rounded-sm animate-pulse" style={{ backgroundColor: "var(--color-lavender)", animationDelay: "0s" }} />
              <div className="w-0.5 h-3 rounded-sm animate-pulse" style={{ backgroundColor: "var(--color-lavender)", animationDelay: "0.2s" }} />
              <div className="w-0.5 h-1.5 rounded-sm animate-pulse" style={{ backgroundColor: "var(--color-lavender)", animationDelay: "0.4s" }} />
            </div>
          </div>

          {/* User Avatar */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="relative group shrink-0">
                <div className="w-8 h-8 rounded-full flex items-center justify-center border-2 border-white shadow-sm transition-all" style={{ background: "var(--gradient-logo)" }}>
                  <span className="text-white text-xs font-(--font-quicksand)">{initials}</span>
                </div>
                {isConnected && (
                  <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white" style={{ backgroundColor: "var(--status-up)" }} />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="backdrop-blur-xl shadow-lg rounded-xl" style={{ background: "var(--surface-overlay)", border: "1px solid var(--color-teal-border)" }}>
              <DropdownMenuLabel className="text-xs" style={{ color: "var(--text-secondary)" }}>{user?.email || "My Account"}</DropdownMenuLabel>
              <DropdownMenuSeparator style={{ backgroundColor: "var(--border-subtle)" }} />
              <DropdownMenuItem className="text-xs cursor-pointer" style={{ color: "var(--text-secondary)" }} onClick={() => navigate("/settings")}>
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator style={{ backgroundColor: "var(--border-subtle)" }} />
              <DropdownMenuItem className="text-xs cursor-pointer" style={{ color: "var(--text-danger)" }} onClick={() => logout()}>
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

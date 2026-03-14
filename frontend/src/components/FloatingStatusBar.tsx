import { useNavigate, useLocation, Link } from "react-router";
import { Sparkles, ChevronRight, Search, AlertCircle } from "lucide-react";
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

const PAGE_LABELS: Record<string, string> = {
  "/services": "Servisler",
  "/alerts": "Uyarılar",
  "/ai-insights": "AI Analiz",
  "/settings": "Ayarlar",
  "/kubernetes": "Kubernetes",
};

function buildBreadcrumbs(pathname: string): Crumb[] {
  const crumbs: Crumb[] = [{ label: "Dashboard", path: "/" }];
  if (pathname.startsWith("/services/") && pathname.length > 10) {
    crumbs.push({ label: "Servisler", path: "/services" });
    crumbs.push({ label: "Detay", path: pathname });
  } else if (PAGE_LABELS[pathname]) {
    crumbs.push({ label: PAGE_LABELS[pathname], path: pathname });
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

  const downCount = services.filter((s) => s.status === "down" || s.status === "degraded").length;

  return (
    <header className="sticky top-0 z-40 w-full">
      <div
        className="px-4 py-2 flex items-center gap-3"
        style={{
          background: "var(--surface-card)",
          borderBottom: "2px solid var(--border-default)",
          boxShadow: "var(--card-shadow)",
        }}
      >
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-1 min-w-0 flex-1">
          {crumbs.map((crumb, i) => (
            <span key={crumb.path} className="flex items-center gap-1 min-w-0">
              {i > 0 && <ChevronRight className="w-3 h-3 shrink-0" style={{ color: "var(--text-faint)" }} />}
              {i === crumbs.length - 1 ? (
                <span className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                  {crumb.label}
                </span>
              ) : (
                <Link
                  to={crumb.path}
                  className="text-xs transition-colors truncate hover:underline"
                  style={{ color: "var(--text-muted)" }}
                >
                  {crumb.label}
                </Link>
              )}
            </span>
          ))}
        </nav>

        {/* Down services alert */}
        {downCount > 0 && (
          <button
            onClick={() => navigate("/alerts")}
            className="hidden sm:flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold animate-pulse"
            style={{
              background: "var(--status-down-subtle)",
              border: "1.5px solid var(--status-down-border)",
              color: "var(--status-down-text)",
            }}
          >
            <AlertCircle className="w-3 h-3" />
            {downCount} servis sorunlu
          </button>
        )}

        {/* Search trigger */}
        <button
          onClick={onOpenCommandPalette}
          className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded transition-all"
          style={{
            background: "var(--surface-sunken)",
            border: "2px solid var(--border-default)",
            color: "var(--text-muted)",
          }}
        >
          <Search className="w-3.5 h-3.5" />
          <span className="text-xs">Ara...</span>
          <kbd
            className="text-[10px] px-1.5 py-0.5 rounded ml-2"
            style={{
              background: "var(--surface-raised)",
              border: "1px solid var(--border-default)",
              color: "var(--text-faint)",
            }}
          >
            ⌘K
          </kbd>
        </button>

        {/* WS status */}
        <div
          className="flex items-center gap-1.5 px-2 py-1 rounded"
          style={
            isConnected
              ? { background: "var(--status-up-subtle)", border: "1.5px solid var(--status-up-border)" }
              : { background: "var(--status-down-subtle)", border: "1.5px solid var(--status-down-border)" }
          }
        >
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: isConnected ? "var(--status-up)" : "var(--status-down)" }}
          />
          <span
            className="text-[10px] font-bold hidden sm:inline"
            style={{ color: isConnected ? "var(--status-up-text)" : "var(--status-down-text)" }}
          >
            {isConnected ? "LIVE" : "OFF"}
          </span>
        </div>

        {/* AI indicator */}
        <div
          className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded"
          style={{ background: "var(--color-ai-subtle)", border: "1.5px solid var(--color-ai-border)" }}
        >
          <Sparkles className="w-3 h-3 animate-pulse" style={{ color: "var(--color-ai)" }} />
          <span className="text-[10px] font-bold" style={{ color: "var(--color-ai)" }}>AI</span>
        </div>

        {/* User Avatar */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="relative group shrink-0">
              <div
                className="w-7 h-7 rounded flex items-center justify-center"
                style={{
                  background: "var(--gradient-logo)",
                  border: "2px solid var(--border-default)",
                  boxShadow: "var(--btn-shadow)",
                }}
              >
                <span className="text-white text-xs font-bold">{initials}</span>
              </div>
              {isConnected && (
                <div
                  className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
                  style={{ backgroundColor: "var(--status-up)", border: "1.5px solid var(--surface-card)" }}
                />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="rounded"
            style={{
              background: "var(--surface-card)",
              border: "2px solid var(--border-default)",
              boxShadow: "var(--card-shadow)",
            }}
          >
            <DropdownMenuLabel className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {user?.email || "My Account"}
            </DropdownMenuLabel>
            <DropdownMenuSeparator style={{ backgroundColor: "var(--border-subtle)" }} />
            <DropdownMenuItem
              className="text-xs cursor-pointer"
              style={{ color: "var(--text-secondary)" }}
              onClick={() => navigate("/settings")}
            >
              Ayarlar
            </DropdownMenuItem>
            <DropdownMenuSeparator style={{ backgroundColor: "var(--border-subtle)" }} />
            <DropdownMenuItem
              className="text-xs cursor-pointer"
              style={{ color: "var(--text-danger)" }}
              onClick={() => logout()}
            >
              Çıkış Yap
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

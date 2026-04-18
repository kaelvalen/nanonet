import {
	AlertTriangle,
	Bell,
	ChevronRight,
	LogOut,
	Moon,
	Search,
	Settings,
	Sun,
	UserCircle2,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { useServices } from "@/hooks/useServices";
import { useAuthStore } from "@/store/authStore";
import { useThemeStore } from "@/store/themeStore";
import { useWSStore } from "@/store/wsStore";
import { usePageMetaValue } from "./PageMetaContext";

type Crumb = { label: string; path: string };

const ROUTE_LABELS: Record<string, string> = {
	"/app": "Genel Bakış",
	"/app/services": "Servisler",
	"/app/alerts": "Uyarılar",
	"/app/incidents": "Incidents",
	"/app/ai-insights": "AI İçgörüler",
	"/app/service-map": "Servis Haritası",
	"/app/compare": "Karşılaştır",
	"/app/logs": "Loglar",
	"/app/slo": "SLO",
	"/app/probes": "Probes",
	"/app/runbooks": "Runbooks",
	"/app/notifications": "Bildirimler",
	"/app/status-pages": "Durum Sayfaları",
	"/app/api-tokens": "API Tokenları",
	"/app/ai-usage": "AI Kullanımı",
	"/app/settings": "Ayarlar",
	"/app/kubernetes": "Kubernetes",
	"/app/security": "Güvenlik",
};

function buildBreadcrumbs(
	pathname: string,
	services: { id: string; name: string }[],
): Crumb[] {
	const crumbs: Crumb[] = [{ label: "Genel Bakış", path: "/app" }];

	const serviceDetailMatch = pathname.match(/^\/app\/services\/(.+)$/);
	if (serviceDetailMatch) {
		const serviceId = serviceDetailMatch[1];
		const svcName = services.find((s) => s.id === serviceId)?.name ?? "Detay";
		crumbs.push({ label: "Servisler", path: "/app/services" });
		crumbs.push({ label: svcName, path: pathname });
		return crumbs;
	}

	if (pathname !== "/app" && ROUTE_LABELS[pathname]) {
		crumbs.push({ label: ROUTE_LABELS[pathname], path: pathname });
	}
	return crumbs;
}

function getInitials(email?: string | null): string {
	if (!email) return "?";
	const local = email.split("@")[0] ?? "";
	const parts = local.split(/[._-]/).filter(Boolean);
	if (parts.length >= 2) {
		return (parts[0][0] + parts[1][0]).toUpperCase();
	}
	return local.slice(0, 2).toUpperCase();
}

function HealthPulse({
	upCount,
	total,
	downCount,
	onClick,
}: {
	upCount: number;
	total: number;
	downCount: number;
	onClick: () => void;
}) {
	if (total === 0) return null;
	const ratio = total === 0 ? 1 : upCount / total;
	const tone =
		downCount === 0
			? { fg: "var(--status-up-text)", bg: "var(--status-up)" }
			: ratio >= 0.9
				? { fg: "var(--status-warn-text)", bg: "var(--status-warn)" }
				: { fg: "var(--status-down-text)", bg: "var(--status-down)" };

	return (
		<button
			type="button"
			onClick={onClick}
			className="hidden md:inline-flex items-center gap-2 h-9 pl-2 pr-3 rounded-full transition-all hover:bg-[var(--surface-sunken)]"
			title={`${upCount} sağlıklı / ${total} servis`}
		>
			<span className="relative flex items-center justify-center w-5 h-5">
				<span
					className="absolute inset-0 rounded-full"
					style={{
						background: tone.bg,
						opacity: 0.18,
						animation: "nn-orb-breathe 2.4s ease-in-out infinite",
					}}
				/>
				<span
					className="relative w-2 h-2 rounded-full"
					style={{
						background: tone.bg,
						boxShadow: `0 0 0 2px color-mix(in srgb, ${tone.bg} 22%, transparent)`,
					}}
				/>
			</span>
			<span
				className="text-[12px] font-medium tabular-nums"
				style={{ color: tone.fg }}
			>
				{upCount}/{total}
			</span>
		</button>
	);
}

/**
 * Modern, minimal topbar.
 *
 * Layout (desktop):
 *
 *   [ Title block ]                 [ Search ⌘K ] · [ Health · Alerts · Live ] · [ Bell ] [ Avatar ]
 *
 * Mobile collapses to: title + search button + avatar.
 */
export function TopBar({
	onOpenCommandPalette,
}: {
	onOpenCommandPalette: () => void;
}) {
	const navigate = useNavigate();
	const location = useLocation();
	const { isConnected } = useWSStore();
	const { services } = useServices();
	const { title, eyebrow } = usePageMetaValue();
	const { user } = useAuthStore();
	const { themeMode, toggleMode } = useThemeStore();
	const { logout } = useAuth();

	const crumbs = buildBreadcrumbs(location.pathname, services);
	const downCount = services.filter(
		(s) => s.status === "down" || s.status === "degraded",
	).length;
	const upCount = services.filter((s) => s.status === "up").length;
	const total = services.length;
	const trail = crumbs.slice(0, -1);
	const inlineTitle = title ?? crumbs[crumbs.length - 1]?.label ?? "";
	const inlineEyebrow = eyebrow ?? null;
	const initials = getInitials(user?.email);

	return (
		<div
			className="sticky top-0 z-30 w-full"
			style={{
				background: "color-mix(in srgb, var(--background) 78%, transparent)",
				backdropFilter: "blur(14px) saturate(140%)",
				WebkitBackdropFilter: "blur(14px) saturate(140%)",
				borderBottom: "1px solid var(--border-subtle)",
			}}
		>
			<div className="flex items-center h-[var(--topbar-h)] gap-3 px-4 sm:px-6 lg:px-8">
				{/* ─────────── LEFT — title block ─────────── */}
				<div className="flex items-center min-w-0 flex-1 gap-2">
					{trail.length > 0 && (
						<nav className="hidden md:flex items-center min-w-0 shrink-0">
							{trail.map((crumb, i) => (
								<span
									key={crumb.path}
									className="flex items-center min-w-0"
								>
									<Link
										to={crumb.path}
										className="text-[12px] truncate transition-colors hover:text-[color:var(--text-primary)]"
										style={{ color: "var(--text-faint)" }}
									>
										{crumb.label}
									</Link>
									<ChevronRight
										className="w-3 h-3 shrink-0 mx-1"
										style={{ color: "var(--text-faint)" }}
									/>
									{i === trail.length - 1 && null}
								</span>
							))}
						</nav>
					)}

					<div className="flex flex-col min-w-0">
						{inlineEyebrow && (
							<span
								className="hidden sm:inline text-[10px] font-medium leading-none mb-1 truncate"
								style={{ color: "var(--text-faint)" }}
							>
								{inlineEyebrow}
							</span>
						)}
						<h1
							className="text-[15px] font-semibold tracking-tight leading-none truncate"
							style={{ color: "var(--text-primary)" }}
						>
							{inlineTitle}
						</h1>
					</div>
				</div>

				{/* ─────────── CENTER — universal search ─────────── */}
				<button
					type="button"
					onClick={onOpenCommandPalette}
					className="group hidden sm:flex items-center gap-2.5 h-9 pl-3 pr-1.5 rounded-full transition-all min-w-[220px] lg:min-w-[320px] max-w-[420px] flex-1 hover:border-[color:var(--border-strong)]"
					style={{
						background: "var(--surface-card)",
						border: "1px solid var(--border-default)",
					}}
					title="Komut paleti (⌘K)"
				>
					<Search
						className="w-3.5 h-3.5 shrink-0 transition-colors group-hover:text-[color:var(--text-secondary)]"
						style={{ color: "var(--text-faint)" }}
					/>
					<span
						className="text-[12px] flex-1 text-left truncate"
						style={{ color: "var(--text-muted)" }}
					>
						Komut, servis veya log ara…
					</span>
					<span
						className="hidden lg:inline-flex items-center gap-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded-md"
						style={{
							color: "var(--text-faint)",
							background: "var(--surface-sunken)",
							border: "1px solid var(--border-subtle)",
						}}
					>
						⌘K
					</span>
				</button>

				{/* ─────────── RIGHT — status cluster + actions ─────────── */}
				<div className="flex items-center gap-1 shrink-0">
					{/* Mobile-only search trigger */}
					<button
						type="button"
						onClick={onOpenCommandPalette}
						className="sm:hidden flex items-center justify-center w-9 h-9 rounded-full transition-colors hover:bg-[var(--surface-sunken)]"
						aria-label="Ara"
						style={{ color: "var(--text-muted)" }}
					>
						<Search className="w-4 h-4" />
					</button>

					<HealthPulse
						upCount={upCount}
						total={total}
						downCount={downCount}
						onClick={() => navigate("/app/services")}
					/>

					{downCount > 0 && (
						<button
							type="button"
							onClick={() => navigate("/app/incidents")}
							className="hidden md:inline-flex items-center gap-1.5 h-9 px-3 rounded-full transition-opacity hover:opacity-90"
							style={{
								background:
									"color-mix(in srgb, var(--status-down) 12%, transparent)",
								color: "var(--status-down-text)",
							}}
							title={`${downCount} aktif olay`}
						>
							<AlertTriangle className="w-3.5 h-3.5" />
							<span className="text-[12px] font-semibold tabular-nums">
								{downCount}
							</span>
						</button>
					)}

					{/* Live indicator */}
					<div
						className="hidden lg:flex items-center gap-1.5 h-9 px-3 rounded-full"
						title={isConnected ? "WebSocket bağlı" : "WebSocket kopuk"}
					>
						<span
							className="relative flex items-center justify-center w-2 h-2"
							aria-hidden
						>
							{isConnected && (
								<span
									className="absolute inset-0 rounded-full animate-ping"
									style={{
										background: "var(--status-up)",
										opacity: 0.5,
									}}
								/>
							)}
							<span
								className="relative w-2 h-2 rounded-full"
								style={{
									background: isConnected
										? "var(--status-up)"
										: "var(--text-faint)",
								}}
							/>
						</span>
						<span
							className="text-[11px] font-medium"
							style={{
								color: isConnected
									? "var(--status-up-text)"
									: "var(--text-faint)",
							}}
						>
							{isConnected ? "Canlı" : "Kesik"}
						</span>
					</div>

					<span
						className="hidden md:block w-px h-5 mx-1.5 shrink-0"
						style={{ background: "var(--border-default)" }}
					/>

					{/* Notification bell — placeholder until proper inbox lands */}
					<button
						type="button"
						onClick={() => navigate("/app/notifications")}
						className="hidden sm:flex items-center justify-center w-9 h-9 rounded-full transition-colors hover:bg-[var(--surface-sunken)]"
						aria-label="Bildirimler"
						style={{ color: "var(--text-muted)" }}
					>
						<Bell className="w-4 h-4" />
					</button>

					{/* User menu */}
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<button
								type="button"
								className="flex items-center justify-center w-9 h-9 rounded-full text-[12px] font-semibold transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
								style={{
									background: "var(--gradient-logo)",
									color: "white",
								}}
								aria-label="Hesap menüsü"
							>
								{initials}
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent
							align="end"
							sideOffset={8}
							className="w-64 rounded-xl"
						>
							<DropdownMenuLabel className="flex flex-col gap-0.5 py-2">
								<span
									className="text-[10px] font-medium"
									style={{ color: "var(--text-faint)" }}
								>
									Hesap
								</span>
								<span
									className="text-[13px] font-semibold truncate"
									style={{ color: "var(--text-primary)" }}
								>
									{user?.email ?? "Misafir"}
								</span>
							</DropdownMenuLabel>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onSelect={() => navigate("/app/settings")}
								className="gap-2 cursor-pointer"
							>
								<UserCircle2 className="w-4 h-4" />
								Profil
							</DropdownMenuItem>
							<DropdownMenuItem
								onSelect={() => navigate("/app/settings")}
								className="gap-2 cursor-pointer"
							>
								<Settings className="w-4 h-4" />
								Ayarlar
							</DropdownMenuItem>
							<DropdownMenuItem
								onSelect={(e) => {
									e.preventDefault();
									toggleMode();
								}}
								className="gap-2 cursor-pointer"
							>
								{themeMode === "dark" ? (
									<>
										<Sun className="w-4 h-4" />
										Aydınlık tema
									</>
								) : (
									<>
										<Moon className="w-4 h-4" />
										Karanlık tema
									</>
								)}
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onSelect={() => logout()}
								className="gap-2 cursor-pointer"
								style={{ color: "var(--status-down-text)" }}
							>
								<LogOut className="w-4 h-4" />
								Çıkış yap
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>
		</div>
	);
}

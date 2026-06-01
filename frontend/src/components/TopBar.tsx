import {
	AlertTriangle,
	Bell,
	ChevronRight,
	LogOut,
	Moon,
	Search,
	Settings,
	Sparkles,
	Sun,
	UserCircle2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
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
import { MOD_KEY } from "@/lib/platform";
import { preloadRoute } from "@/routes";
import { useAIAssistantStore } from "@/store/aiAssistantStore";
import { useAuthStore } from "@/store/authStore";
import { useThemeStore } from "@/store/themeStore";
import { useWSStore } from "@/store/wsStore";
import { usePageMetaValue } from "./PageMetaContext";

/* TopBar — 56px chrome that owns identity (breadcrumb + page title) and
   global utilities (universal search trigger, health overview, notifications,
   account menu). The MB rule applies: every element earns its slot.

   Shape, left → right:
     [breadcrumb] [page title]                    [⌘K search] · [pulse · alerts]
                                                  · [bell] [theme] [account]

   No floating AI button — the assistant is reachable from ⌘K with the `?`
   prefix or from the dedicated /app/ai-insights page. */

type Crumb = { label: string; path: string };
type TFn = (key: string, opts?: Record<string, unknown>) => string;

/* Komut paleti kısayolu hem Cmd+K (mac) hem Ctrl+K (Windows/Linux) ile açılır.
   Rozet metni platforma göre seçilir (bkz. lib/platform). */
const SHORTCUT_HINT = `${MOD_KEY}K`;

/* Route → i18n key map. Keep this aligned with shell.nav.* in the locale
   bundles. The key resolution happens at render-time so a language switch
   reflows breadcrumbs without remounting the bar. */
const ROUTE_LABEL_KEYS: Record<string, string> = {
	"/app": "shell.nav.overview",
	"/app/services": "shell.nav.services",
	"/app/alerts": "shell.nav.alerts",
	"/app/incidents": "shell.nav.incidents",
	"/app/ai-insights": "shell.nav.aiInsights",
	"/app/service-map": "shell.nav.serviceMap",
	"/app/compare": "shell.nav.compare",
	"/app/logs": "shell.nav.logs",
	"/app/slo": "shell.nav.slo",
	"/app/probes": "shell.nav.probes",
	"/app/runbooks": "shell.nav.runbooks",
	"/app/notifications": "shell.nav.notifications",
	"/app/status-pages": "shell.nav.statusPages",
	"/app/api-tokens": "shell.nav.apiTokens",
	"/app/ai-usage": "shell.nav.aiUsage",
	"/app/settings": "shell.nav.settings",
	"/app/kubernetes": "shell.nav.kubernetes",
	"/app/security": "shell.nav.security",
};

function buildBreadcrumbs(
	pathname: string,
	services: { id: string; name: string }[],
	t: TFn,
): Crumb[] {
	const crumbs: Crumb[] = [{ label: t("shell.nav.overview"), path: "/app" }];

	const serviceDetailMatch = pathname.match(/^\/app\/services\/(.+)$/);
	if (serviceDetailMatch) {
		const serviceId = serviceDetailMatch[1];
		const svcName =
			services.find((s) => s.id === serviceId)?.name ??
			t("shell.breadcrumb.detail");
		crumbs.push({ label: t("shell.nav.services"), path: "/app/services" });
		crumbs.push({ label: svcName, path: pathname });
		return crumbs;
	}

	if (pathname !== "/app" && ROUTE_LABEL_KEYS[pathname]) {
		crumbs.push({ label: t(ROUTE_LABEL_KEYS[pathname]), path: pathname });
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
	hoverLabel,
}: {
	upCount: number;
	total: number;
	downCount: number;
	onClick: () => void;
	hoverLabel: string;
}) {
	if (total === 0) return null;
	const ratio = upCount / total;
	const tone =
		downCount === 0
			? { fg: "var(--status-up-text)", bg: "var(--status-up)" }
			: ratio >= 0.9
				? { fg: "var(--status-degraded-text)", bg: "var(--status-degraded)" }
				: { fg: "var(--status-down-text)", bg: "var(--status-down)" };

	return (
		<button
			type="button"
			onClick={onClick}
			className="hidden md:inline-flex items-center gap-2 h-8 px-2.5 rounded-[6px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] hover:bg-[var(--surface-sunken)] transition-colors"
			title={hoverLabel}
		>
			<span className="relative flex items-center justify-center w-4 h-4">
				<span
					className="absolute inset-0 rounded-full"
					style={{
						background: tone.bg,
						opacity: 0.18,
						animation: "nn-orb-breathe 2.4s var(--ease-standard) infinite",
					}}
				/>
				<span
					className="relative w-1.5 h-1.5 rounded-full"
					style={{ background: tone.bg }}
				/>
			</span>
			<span
				className="text-[12px] font-semibold tnum"
				style={{ color: tone.fg }}
			>
				{upCount}/{total}
			</span>
		</button>
	);
}

export function TopBar({
	onOpenCommandPalette,
}: {
	onOpenCommandPalette: () => void;
}) {
	const navigate = useNavigate();
	const location = useLocation();
	const { t } = useTranslation();
	const { isConnected } = useWSStore();
	const { services } = useServices();
	const { title, eyebrow } = usePageMetaValue();
	const { user } = useAuthStore();
	const { themeMode, toggleMode } = useThemeStore();
	const { logout } = useAuth();
	const openAIAssistant = useAIAssistantStore((s) => s.open);

	const crumbs = buildBreadcrumbs(location.pathname, services, t);
	const downCount = services.filter(
		(s) => s.status === "down" || s.status === "degraded",
	).length;
	const upCount = services.filter((s) => s.status === "up").length;
	const total = services.length;
	const trail = crumbs.slice(0, -1);
	const inlineTitle = title ?? crumbs[crumbs.length - 1]?.label ?? "";
	const inlineEyebrow = eyebrow ?? null;
	const isServiceDetail = /^\/app\/services\/[^/]+$/.test(location.pathname);
	const initials = getInitials(user?.email);

	const crumbTextSizeClass = isServiceDetail ? "text-[11px]" : "text-[12px]";
	const crumbLinkClass = `${crumbTextSizeClass} truncate transition-colors hover:text-[var(--text-primary)] outline-none rounded focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]`;
	const crumbChevron = (
		<ChevronRight
			className="w-3 h-3 shrink-0 mx-1.5"
			style={{ color: "var(--text-faint)" }}
		/>
	);

	return (
		<div
			className="sticky top-0 z-30 w-full"
			style={{
				background: "var(--surface-base)",
				borderBottom: "1px solid var(--border-subtle)",
			}}
		>
			<div className="flex items-center h-[var(--topbar-h)] gap-3 px-4 sm:px-6">
				{/* ── LEFT: breadcrumb + page title ────────────────────────────── */}
				<div className="flex items-center min-w-0 flex-1 gap-2">
					{isServiceDetail ? (
						<nav
							aria-label="Breadcrumb"
							className="flex items-center min-w-0 flex-1"
						>
							{trail.map((crumb) => (
								<span
									key={crumb.path}
									className="flex items-center min-w-0 shrink-0"
								>
									<Link
										to={crumb.path}
										onMouseEnter={() => preloadRoute(crumb.path)}
										onFocus={() => preloadRoute(crumb.path)}
										className={`${crumbLinkClass} min-w-0`}
										style={{ color: "var(--text-tertiary)" }}
									>
										{crumb.label}
									</Link>
									{crumbChevron}
								</span>
							))}
							<h1
								className={`min-w-0 flex-1 truncate ${crumbTextSizeClass} font-normal font-mono leading-none tracking-tight`}
								style={{ color: "var(--text-primary)" }}
								title={inlineTitle}
							>
								{inlineTitle}
							</h1>
						</nav>
					) : (
						<>
							{trail.length > 0 && (
								<nav
									aria-label="Breadcrumb"
									className="hidden md:flex items-center min-w-0 shrink-0"
								>
									{trail.map((crumb) => (
										<span
											key={crumb.path}
											className="flex items-center min-w-0"
										>
											<Link
												to={crumb.path}
												onMouseEnter={() => preloadRoute(crumb.path)}
												onFocus={() => preloadRoute(crumb.path)}
												className={crumbLinkClass}
												style={{ color: "var(--text-tertiary)" }}
											>
												{crumb.label}
											</Link>
											{crumbChevron}
										</span>
									))}
								</nav>
							)}

							<div className="flex flex-col min-w-0">
								{inlineEyebrow && (
									<span
										className="hidden sm:inline text-[10px] font-semibold uppercase tracking-wider leading-none mb-1 truncate"
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
						</>
					)}
				</div>

				{/* ── CENTER: universal command palette trigger ────────────────── */}
				<button
					type="button"
					onClick={onOpenCommandPalette}
					className="group hidden sm:flex items-center gap-2 h-8 pl-2.5 pr-1.5 rounded-[6px] transition-colors min-w-[240px] lg:min-w-[320px] max-w-[420px] flex-1 outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
					style={{
						background: "var(--surface-sunken)",
						border: "1px solid var(--border-subtle)",
					}}
					title={t("shell.topbar.searchHint", { mod: MOD_KEY })}
				>
					<Search
						className="w-3.5 h-3.5 shrink-0"
						style={{ color: "var(--text-tertiary)" }}
					/>
					<span
						className="text-[12px] flex-1 text-left truncate"
						style={{ color: "var(--text-tertiary)" }}
					>
						{t("shell.topbar.searchPlaceholder")}
					</span>
					<span
						className="hidden lg:inline-flex items-center gap-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold"
						style={{
							color: "var(--text-tertiary)",
							background: "var(--surface-base)",
							border: "1px solid var(--border-subtle)",
						}}
					>
						{SHORTCUT_HINT}
					</span>
				</button>

				{/* ── RIGHT: status cluster + actions ──────────────────────────── */}
				<div className="flex items-center gap-1 shrink-0">
					{/* Mobile-only search trigger */}
					<button
						type="button"
						onClick={onOpenCommandPalette}
						className="sm:hidden flex items-center justify-center w-9 h-9 rounded-[6px] transition-colors hover:bg-[var(--surface-sunken)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
						aria-label={t("shell.topbar.searchAria")}
						style={{ color: "var(--text-secondary)" }}
					>
						<Search className="w-4 h-4" />
					</button>

					<HealthPulse
						upCount={upCount}
						total={total}
						downCount={downCount}
						onClick={() => navigate("/app/services")}
						hoverLabel={t("shell.topbar.healthHover", {
							up: upCount,
							total,
						})}
					/>

					{downCount > 0 && (
						<button
							type="button"
							onClick={() => navigate("/app/incidents")}
							className="hidden md:inline-flex items-center gap-1.5 h-8 px-2.5 rounded-[6px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
							style={{
								background: "var(--status-down-subtle)",
								color: "var(--status-down-text)",
							}}
							title={t("shell.topbar.openIncidents", { count: downCount })}
						>
							<AlertTriangle className="w-3.5 h-3.5" />
							<span className="text-[12px] font-semibold tnum">
								{downCount}
							</span>
						</button>
					)}

					{/* Live indicator */}
					<span
						className="hidden lg:flex items-center gap-1.5 h-8 px-2.5"
						title={
							isConnected
								? t("shell.topbar.liveTooltipOn")
								: t("shell.topbar.liveTooltipOff")
						}
					>
						<span
							className="relative flex items-center justify-center w-1.5 h-1.5"
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
								className="relative w-1.5 h-1.5 rounded-full"
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
									? "var(--text-tertiary)"
									: "var(--text-faint)",
							}}
						>
							{isConnected
								? t("shell.topbar.liveOn")
								: t("shell.topbar.liveOff")}
						</span>
					</span>

					<span
						className="hidden md:block w-px h-5 mx-1.5 shrink-0"
						style={{ background: "var(--border-subtle)" }}
					/>

					<button
						type="button"
						onClick={() => openAIAssistant({ mode: "chat" })}
						className="hidden sm:flex items-center justify-center w-9 h-9 rounded-[6px] transition-colors hover:bg-[var(--surface-sunken)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
						aria-label={t("shell.topbar.aiAssistant")}
						title={t("shell.topbar.aiAssistantHint", { mod: MOD_KEY })}
						style={{ color: "var(--brand-primary)" }}
					>
						<Sparkles className="w-4 h-4" />
					</button>

					<button
						type="button"
						onClick={() => navigate("/app/notifications")}
						className="hidden sm:flex items-center justify-center w-9 h-9 rounded-[6px] transition-colors hover:bg-[var(--surface-sunken)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
						aria-label={t("shell.topbar.notifications")}
						style={{ color: "var(--text-secondary)" }}
					>
						<Bell className="w-4 h-4" />
					</button>

					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<button
								type="button"
								className="flex items-center justify-center w-8 h-8 rounded-full text-[11px] font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
								style={{
									background: "var(--brand-primary)",
									color: "var(--brand-on-primary)",
								}}
								aria-label={t("shell.topbar.accountMenu")}
							>
								{initials}
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" sideOffset={8} className="w-60">
							<DropdownMenuLabel className="flex flex-col gap-0.5 py-2">
								<span
									className="text-[10px] font-semibold uppercase tracking-wider"
									style={{ color: "var(--text-faint)" }}
								>
									{t("shell.topbar.account")}
								</span>
								<span
									className="text-[13px] font-semibold truncate"
									style={{ color: "var(--text-primary)" }}
								>
									{user?.email ?? t("shell.topbar.guest")}
								</span>
							</DropdownMenuLabel>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onSelect={() => navigate("/app/settings")}
								className="gap-2 cursor-pointer"
							>
								<UserCircle2 className="w-4 h-4" />
								{t("shell.topbar.profile")}
							</DropdownMenuItem>
							<DropdownMenuItem
								onSelect={() => navigate("/app/settings")}
								className="gap-2 cursor-pointer"
							>
								<Settings className="w-4 h-4" />
								{t("shell.nav.settings")}
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
										{t("shell.topbar.themeLight")}
									</>
								) : (
									<>
										<Moon className="w-4 h-4" />
										{t("shell.topbar.themeDark")}
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
								{t("shell.topbar.logout")}
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>
		</div>
	);
}

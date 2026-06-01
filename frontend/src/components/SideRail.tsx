import {
	Activity,
	AlertCircle,
	Bell,
	BookOpen,
	ChevronsLeft,
	ChevronsRight,
	CircleDollarSign,
	Cloud,
	FileText,
	GitCompare,
	GitFork,
	Globe,
	Key,
	LayoutDashboard,
	LogOut,
	Scroll,
	Server,
	Settings,
	Shield,
	Sparkles,
	Target,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, useLocation } from "react-router";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/hooks/useAuth";
import { useServices } from "@/hooks/useServices";
import { MOD_KEY } from "@/lib/platform";
import { preloadRoute } from "@/routes";
import { useAuthStore } from "@/store/authStore";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "./ui/tooltip";

/* SideRail — replaces HybridDock. The MB rule: chrome stays out of the way.
   Desktop default is 64px collapsed; expand to 224px on click (or Cmd+\) so
   labels surface. NO hover-expand — that anti-pattern shifts content under
   the user's cursor. Sections are flat: Core nav at top, secondary nav below
   a hairline, Settings + sign-out anchored to the bottom.

   Mobile/Sub-md: hidden. MobileNav owns the bottom tab bar there. */

interface NavItem {
	to: string;
	labelKey: string;
	icon: React.ElementType;
	end?: boolean;
	badge?: "services" | "alerts";
}

interface NavSection {
	id: string;
	titleKey: string;
	items: NavItem[];
}

/* SECTIONS lives outside the component so it never re-creates per render.
   `labelKey` and `titleKey` are i18n keys resolved at render-time so language
   switches reflow the rail without a remount. */
const SECTIONS: NavSection[] = [
	{
		id: "monitor",
		titleKey: "shell.sections.monitor",
		items: [
			{
				to: "/app",
				labelKey: "shell.nav.overview",
				icon: LayoutDashboard,
				end: true,
			},
			{
				to: "/app/services",
				labelKey: "shell.nav.services",
				icon: Server,
				badge: "services",
			},
			{
				to: "/app/alerts",
				labelKey: "shell.nav.alerts",
				icon: AlertCircle,
				badge: "alerts",
			},
			{ to: "/app/incidents", labelKey: "shell.nav.incidents", icon: FileText },
			{ to: "/app/logs", labelKey: "shell.nav.logs", icon: Scroll },
		],
	},
	{
		id: "intelligence",
		titleKey: "shell.sections.intelligence",
		items: [
			{
				to: "/app/ai-insights",
				labelKey: "shell.nav.aiInsights",
				icon: Sparkles,
			},
			{
				to: "/app/service-map",
				labelKey: "shell.nav.serviceMap",
				icon: GitFork,
			},
			{ to: "/app/compare", labelKey: "shell.nav.compare", icon: GitCompare },
		],
	},
	{
		id: "reliability",
		titleKey: "shell.sections.reliability",
		items: [
			{ to: "/app/slo", labelKey: "shell.nav.slo", icon: Target },
			{ to: "/app/probes", labelKey: "shell.nav.probes", icon: Activity },
			{ to: "/app/runbooks", labelKey: "shell.nav.runbooks", icon: BookOpen },
			{
				to: "/app/notifications",
				labelKey: "shell.nav.notifications",
				icon: Bell,
			},
		],
	},
	{
		id: "infra",
		titleKey: "shell.sections.infra",
		items: [
			{ to: "/app/kubernetes", labelKey: "shell.nav.kubernetes", icon: Cloud },
			{
				to: "/app/status-pages",
				labelKey: "shell.nav.statusPages",
				icon: Globe,
			},
		],
	},
	{
		id: "platform",
		titleKey: "shell.sections.platform",
		items: [
			{ to: "/app/security", labelKey: "shell.nav.security", icon: Shield },
			{ to: "/app/api-tokens", labelKey: "shell.nav.apiTokens", icon: Key },
			{
				to: "/app/ai-usage",
				labelKey: "shell.nav.aiUsage",
				icon: CircleDollarSign,
			},
		],
	},
];

const RAIL_STORAGE_KEY = "nanonet-siderail-expanded";

function useRailExpanded() {
	const [expanded, setExpanded] = useState(() => {
		if (typeof window === "undefined") return false;
		return localStorage.getItem(RAIL_STORAGE_KEY) === "1";
	});

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "\\" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				setExpanded((v) => {
					const next = !v;
					try {
						localStorage.setItem(RAIL_STORAGE_KEY, next ? "1" : "0");
					} catch {
						/* storage might be denied — non-fatal */
					}
					return next;
				});
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	const toggle = () => {
		setExpanded((v) => {
			const next = !v;
			try {
				localStorage.setItem(RAIL_STORAGE_KEY, next ? "1" : "0");
			} catch {
				/* non-fatal */
			}
			return next;
		});
	};

	return { expanded, toggle };
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

function RailLink({
	item,
	expanded,
	badge,
	active,
	label,
}: {
	item: NavItem;
	expanded: boolean;
	badge: number | null;
	active: boolean;
	label: string;
}) {
	const Icon = item.icon;
	/* Warm the chunk on intent — by the time pointerup fires, the JS is
	   already in the browser cache so the route renders instantly. */
	const warm = () => preloadRoute(item.to);
	const content = (
		<NavLink
			to={item.to}
			end={item.end}
			onMouseEnter={warm}
			onFocus={warm}
			onTouchStart={warm}
			className="group relative flex items-center gap-3 rounded-[6px] mx-2 my-0.5 outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
			style={{
				height: 36,
				paddingLeft: expanded ? 10 : 0,
				paddingRight: expanded ? 10 : 0,
				justifyContent: expanded ? "flex-start" : "center",
				color: active ? "var(--text-primary)" : "var(--text-tertiary)",
				background: active ? "var(--surface-sunken)" : "transparent",
			}}
		>
			{active && (
				<span
					aria-hidden
					className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r-full"
					style={{ background: "var(--brand-primary)" }}
				/>
			)}
			<span
				className="relative flex items-center justify-center shrink-0"
				style={{ width: 20, height: 20 }}
			>
				<Icon className="size-4" />
				{badge != null && badge > 0 && (
					<span
						className="absolute -top-1 -right-1 inline-flex items-center justify-center rounded-full text-[9px] font-bold tnum text-white px-1"
						style={{
							minWidth: 14,
							height: 14,
							background:
								item.badge === "alerts"
									? "var(--status-down)"
									: "var(--status-degraded)",
						}}
					>
						{badge > 9 ? "9+" : badge}
					</span>
				)}
			</span>
			{expanded && (
				<span className="text-[13px] font-medium truncate flex-1">{label}</span>
			)}
		</NavLink>
	);

	if (expanded) return content;

	return (
		<Tooltip>
			<TooltipTrigger asChild>{content}</TooltipTrigger>
			<TooltipContent side="right" sideOffset={10}>
				{label}
			</TooltipContent>
		</Tooltip>
	);
}

export function SideRail() {
	const location = useLocation();
	const { t } = useTranslation();
	const { expanded, toggle } = useRailExpanded();
	const { services } = useServices();
	const { user } = useAuthStore();
	const { logout } = useAuth();

	const downCount = services.filter(
		(s) => s.status === "down" || s.status === "degraded",
	).length;
	const totalCount = services.length;
	const railLabels = useMemo(
		() => ({
			primary: t("shell.rail.primary"),
			expand: t("shell.rail.expand"),
			collapse: t("shell.rail.collapse"),
			expandHint: t("shell.rail.expandHint", { mod: MOD_KEY }),
			collapseHint: t("shell.rail.collapseHint", { mod: MOD_KEY }),
			logout: t("shell.rail.logout"),
			settings: t("shell.nav.settings"),
			guest: t("shell.topbar.guest"),
		}),
		[t],
	);

	const isActive = (to: string, end?: boolean) => {
		if (end) return location.pathname === to;
		return location.pathname === to || location.pathname.startsWith(`${to}/`);
	};

	const railWidth = expanded ? "var(--dock-w-expanded)" : "var(--dock-w)";
	const initials = getInitials(user?.email);

	return (
		<TooltipProvider delayDuration={400}>
			<aside
				aria-label={railLabels.primary}
				className="hidden md:flex fixed left-0 top-0 bottom-0 z-40 flex-col"
				style={{
					width: railWidth,
					background: "var(--surface-base)",
					borderRight: "1px solid var(--border-subtle)",
					transition: "width var(--duration-base) var(--ease-standard)",
				}}
			>
				{/* ── Logo ─────────────────────────────────────────────────────── */}
				<div
					className="flex items-center shrink-0"
					style={{
						height: "var(--topbar-h)",
						paddingLeft: expanded ? 16 : 0,
						justifyContent: expanded ? "flex-start" : "center",
						borderBottom: "1px solid var(--border-subtle)",
					}}
				>
					<NavLink
						to="/app"
						className="flex items-center gap-2.5 outline-none rounded-[6px] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
						style={{ color: "var(--text-primary)" }}
						aria-label="NanoNet"
					>
						<Logo className="shrink-0" style={{ width: 28, height: 28 }} />
						{expanded && (
							<span
								className="text-[14px] font-semibold tracking-tight"
								style={{ color: "var(--text-primary)" }}
							>
								NanoNet
							</span>
						)}
					</NavLink>
				</div>

				{/* ── Nav scroll area ──────────────────────────────────────────── */}
				{/* nn-scroll-hidden hides the painted scrollbar (a chunky 8px track
				    looks loud in a 60px rail) while keeping wheel/trackpad scroll.
				    nn-scroll-fade masks the top/bottom 12px so overflowing items
				    bleed into the surface — quiet affordance instead of a bar. */}
				<nav className="flex-1 overflow-y-auto py-3 nn-scroll-hidden nn-scroll-fade">
					{SECTIONS.map((section, idx) => (
						<div key={section.id} className="mb-3">
							{expanded && (
								<div
									className="px-4 mb-1 text-[10px] font-semibold uppercase tracking-wider"
									style={{ color: "var(--text-faint)" }}
								>
									{t(section.titleKey)}
								</div>
							)}
							{!expanded && idx > 0 && (
								<div
									className="mx-4 my-2 h-px"
									style={{ background: "var(--border-subtle)" }}
									aria-hidden
								/>
							)}
							{section.items.map((item) => {
								const badgeCount =
									item.badge === "alerts"
										? downCount
										: item.badge === "services"
											? totalCount
											: null;
								return (
									<RailLink
										key={item.to}
										item={item}
										expanded={expanded}
										badge={
											item.badge === "alerts"
												? downCount > 0
													? downCount
													: null
												: badgeCount
										}
										active={isActive(item.to, item.end)}
										label={t(item.labelKey)}
									/>
								);
							})}
						</div>
					))}
				</nav>

				{/* ── Footer: settings, account, expand toggle ─────────────────── */}
				<div
					className="shrink-0 py-2"
					style={{ borderTop: "1px solid var(--border-subtle)" }}
				>
					<RailLink
						item={{
							to: "/app/settings",
							labelKey: "shell.nav.settings",
							icon: Settings,
						}}
						expanded={expanded}
						badge={null}
						active={isActive("/app/settings")}
						label={railLabels.settings}
					/>

					{/* Account row */}
					<button
						type="button"
						onClick={() => logout()}
						className="group relative w-full flex items-center gap-3 rounded-[6px] mx-2 my-0.5 outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
						style={{
							height: 36,
							width: `calc(100% - 16px)`,
							paddingLeft: expanded ? 10 : 0,
							paddingRight: expanded ? 10 : 0,
							justifyContent: expanded ? "flex-start" : "center",
							color: "var(--text-tertiary)",
							background: "transparent",
						}}
						title={expanded ? undefined : railLabels.logout}
					>
						<span
							className="shrink-0 inline-flex items-center justify-center rounded-full text-[10px] font-semibold"
							style={{
								width: 22,
								height: 22,
								background: "var(--brand-primary-subtle)",
								color: "var(--brand-primary)",
							}}
						>
							{initials}
						</span>
						{expanded && (
							<span className="text-[13px] font-medium truncate flex-1 text-left">
								{user?.email ?? railLabels.guest}
							</span>
						)}
						{expanded && (
							<LogOut
								className="size-3.5 shrink-0 opacity-60 group-hover:opacity-100"
								style={{ color: "var(--text-tertiary)" }}
							/>
						)}
					</button>

					{/* Expand toggle */}
					<button
						type="button"
						onClick={toggle}
						aria-label={expanded ? railLabels.collapse : railLabels.expand}
						title={expanded ? railLabels.collapseHint : railLabels.expandHint}
						className="group flex items-center gap-2 mx-2 mt-1 rounded-[6px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] hover:bg-[var(--surface-sunken)]"
						style={{
							height: 28,
							width: `calc(100% - 16px)`,
							justifyContent: expanded ? "flex-start" : "center",
							paddingLeft: expanded ? 10 : 0,
							paddingRight: expanded ? 10 : 0,
							color: "var(--text-faint)",
						}}
					>
						{expanded ? (
							<>
								<ChevronsLeft className="size-3.5" />
								<span className="text-[11px] font-medium">
									{railLabels.collapse}
								</span>
								<span
									className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded"
									style={{
										background: "var(--surface-sunken)",
										border: "1px solid var(--border-subtle)",
									}}
								>
									{`${MOD_KEY}\\`}
								</span>
							</>
						) : (
							<ChevronsRight className="size-3.5" />
						)}
					</button>
				</div>
			</aside>
		</TooltipProvider>
	);
}

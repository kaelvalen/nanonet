import {
	Activity,
	AlertCircle,
	Bell,
	BookOpen,
	Bot,
	ChevronLeft,
	ChevronRight,
	CircleDollarSign,
	Cloud,
	CreditCard,
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

interface NavItem {
	to: string;
	labelKey: string;
	icon: React.ElementType;
	end?: boolean;
	badge?: "alerts";
}

interface NavSection {
	id: string;
	titleKey: string;
	items: NavItem[];
}

/* 3 sections — Monitor (daily drivers), Analyze (insights/tools),
   Manage (ops config). Admin items (Security, Keys, Billing) are
   pinned to the footer so they stay accessible without cluttering nav. */
const SECTIONS: NavSection[] = [
	{
		id: "monitor",
		titleKey: "shell.sections.monitor",
		items: [
			{ to: "/app",           labelKey: "shell.nav.overview",  icon: LayoutDashboard, end: true },
			{ to: "/app/services",  labelKey: "shell.nav.services",  icon: Server },
			{ to: "/app/agents",    labelKey: "shell.nav.agents",    icon: Bot },
			{ to: "/app/alerts",    labelKey: "shell.nav.alerts",    icon: AlertCircle, badge: "alerts" },
			{ to: "/app/incidents", labelKey: "shell.nav.incidents", icon: FileText },
			{ to: "/app/logs",      labelKey: "shell.nav.logs",      icon: Scroll },
		],
	},
	{
		id: "analyze",
		titleKey: "shell.sections.intelligence",
		items: [
			{ to: "/app/ai-insights",  labelKey: "shell.nav.aiInsights",  icon: Sparkles },
			{ to: "/app/service-map",  labelKey: "shell.nav.serviceMap",  icon: GitFork },
			{ to: "/app/compare",      labelKey: "shell.nav.compare",     icon: GitCompare },
			{ to: "/app/slo",          labelKey: "shell.nav.slo",         icon: Target },
			{ to: "/app/probes",       labelKey: "shell.nav.probes",      icon: Activity },
		],
	},
	{
		id: "manage",
		titleKey: "shell.sections.reliability",
		items: [
			{ to: "/app/runbooks",      labelKey: "shell.nav.runbooks",      icon: BookOpen },
			{ to: "/app/notifications", labelKey: "shell.nav.notifications", icon: Bell },
			{ to: "/app/kubernetes",    labelKey: "shell.nav.kubernetes",    icon: Cloud },
			{ to: "/app/status-pages",  labelKey: "shell.nav.statusPages",   icon: Globe },
		],
	},
];

/* Admin / billing items pinned to footer — always accessible, never cluttering main nav. */
const FOOTER_ITEMS: NavItem[] = [
	{ to: "/app/security",   labelKey: "shell.nav.security",   icon: Shield },
	{ to: "/app/api-tokens", labelKey: "shell.nav.apiTokens",  icon: Key },
	{ to: "/app/ai-usage",   labelKey: "shell.nav.aiUsage",    icon: CircleDollarSign },
	{ to: "/app/billing",    labelKey: "shell.nav.billing",    icon: CreditCard },
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
					try { localStorage.setItem(RAIL_STORAGE_KEY, next ? "1" : "0"); } catch { /* non-fatal */ }
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
			try { localStorage.setItem(RAIL_STORAGE_KEY, next ? "1" : "0"); } catch { /* non-fatal */ }
			return next;
		});
	};

	return { expanded, toggle };
}

function getInitials(email?: string | null): string {
	if (!email) return "?";
	const local = email.split("@")[0] ?? "";
	const parts = local.split(/[._-]/).filter(Boolean);
	if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
	return local.slice(0, 2).toUpperCase();
}

function RailLink({
	item, expanded, badge, active, label,
}: {
	item: NavItem;
	expanded: boolean;
	badge: number | null;
	active: boolean;
	label: string;
}) {
	const Icon = item.icon;
	const warm = () => preloadRoute(item.to);

	const content = (
		<NavLink
			to={item.to}
			end={item.end}
			onMouseEnter={warm}
			onFocus={warm}
			onTouchStart={warm}
			className="group relative flex items-center gap-3 rounded-[6px] mx-1.5 my-0.5 outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] transition-colors"
			style={{
				height: 34,
				paddingLeft:  expanded ? 10 : 0,
				paddingRight: expanded ? 10 : 0,
				justifyContent: expanded ? "flex-start" : "center",
				color:      active ? "var(--brand-primary)" : "var(--text-tertiary)",
				background: active ? "var(--brand-primary-subtle)" : "transparent",
			}}
		>
			{active && (
				<span
					aria-hidden
					className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r-full"
					style={{ background: "var(--brand-primary)" }}
				/>
			)}
			<span className="relative flex items-center justify-center shrink-0" style={{ width: 20, height: 20 }}>
				<Icon className="size-[15px]" />
				{badge != null && badge > 0 && (
					<span
						className="absolute -top-1 -right-1 inline-flex items-center justify-center rounded-full text-[9px] font-bold tnum text-white px-1"
						style={{ minWidth: 14, height: 14, background: "var(--status-down)" }}
					>
						{badge > 9 ? "9+" : badge}
					</span>
				)}
			</span>
			{expanded && (
				<span className="text-[13px] font-medium truncate flex-1 leading-none">{label}</span>
			)}
		</NavLink>
	);

	if (expanded) return content;
	return (
		<Tooltip>
			<TooltipTrigger asChild>{content}</TooltipTrigger>
			<TooltipContent side="right" sideOffset={8}>{label}</TooltipContent>
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

	const downCount = services.filter((s) => s.status === "down" || s.status === "degraded").length;

	const railLabels = useMemo(() => ({
		primary:       t("shell.rail.primary"),
		expand:        t("shell.rail.expand"),
		collapse:      t("shell.rail.collapse"),
		expandHint:    t("shell.rail.expandHint",   { mod: MOD_KEY }),
		collapseHint:  t("shell.rail.collapseHint", { mod: MOD_KEY }),
		logout:        t("shell.rail.logout"),
		settings:      t("shell.nav.settings"),
		guest:         t("shell.topbar.guest"),
	}), [t]);

	const isActive = (to: string, end?: boolean) => {
		if (end) return location.pathname === to;
		return location.pathname === to || location.pathname.startsWith(`${to}/`);
	};

	const initials = getInitials(user?.email);

	return (
		<TooltipProvider delayDuration={400}>
			<aside
				aria-label={railLabels.primary}
				className="hidden md:flex fixed left-0 top-0 bottom-0 z-40 flex-col"
				style={{
					width: expanded ? "var(--dock-w-expanded)" : "var(--dock-w)",
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
						paddingLeft:    expanded ? 16 : 0,
						justifyContent: expanded ? "flex-start" : "center",
						borderBottom: "1px solid var(--border-subtle)",
					}}
				>
					<NavLink
						to="/app"
						className="flex items-center gap-2.5 outline-none rounded-[6px] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
						aria-label="NanoNet"
					>
						<Logo className="shrink-0" style={{ width: 26, height: 26 }} />
						{expanded && (
							<span className="text-[14px] font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>
								NanoNet
							</span>
						)}
					</NavLink>
				</div>

				{/* ── Main nav ─────────────────────────────────────────────────── */}
				<nav className="flex-1 overflow-y-auto py-2 nn-scroll-hidden nn-scroll-fade">
					{SECTIONS.map((section, idx) => (
						<div key={section.id} className="mb-1">
							{/* Section label (expanded) or divider (collapsed, non-first) */}
							{expanded ? (
								<div
									className="px-3.5 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider"
									style={{ color: "var(--text-faint)" }}
								>
									{t(section.titleKey)}
								</div>
							) : idx > 0 ? (
								<div className="mx-3 my-2 h-px" style={{ background: "var(--border-subtle)" }} aria-hidden />
							) : null}
							{section.items.map((item) => (
								<RailLink
									key={item.to}
									item={item}
									expanded={expanded}
									badge={item.badge === "alerts" ? (downCount > 0 ? downCount : null) : null}
									active={isActive(item.to, item.end)}
									label={t(item.labelKey)}
								/>
							))}
						</div>
					))}
				</nav>

				{/* ── Footer ───────────────────────────────────────────────────── */}
				<div className="shrink-0" style={{ borderTop: "1px solid var(--border-subtle)" }}>

					{/* Settings — always visible, clearly separated */}
					<div className="pt-1.5 pb-1">
						<RailLink
							item={{ to: "/app/settings", labelKey: "shell.nav.settings", icon: Settings }}
							expanded={expanded}
							badge={null}
							active={isActive("/app/settings")}
							label={railLabels.settings}
						/>
					</div>

					{/* Admin / billing items — secondary footer section */}
					<div
						className="pt-1 pb-1"
						style={{ borderTop: "1px solid var(--border-subtle)" }}
					>
						{FOOTER_ITEMS.map((item) => (
							<RailLink
								key={item.to}
								item={item}
								expanded={expanded}
								badge={null}
								active={isActive(item.to)}
								label={t(item.labelKey)}
							/>
						))}
					</div>

					{/* Account row + logout */}
					<div
						className="px-1.5 py-2 flex items-center gap-2"
						style={{ borderTop: "1px solid var(--border-subtle)" }}
					>
						{/* Avatar / initials */}
						<span
							className="shrink-0 inline-flex items-center justify-center rounded-full text-[10px] font-semibold"
							style={{
								width: 28, height: 28,
								background: "var(--brand-primary-subtle)",
								color: "var(--brand-primary)",
							}}
						>
							{initials}
						</span>

						{/* Email label (expanded only) */}
						{expanded && (
							<span
								className="text-[12px] truncate flex-1 text-left leading-none"
								style={{ color: "var(--text-secondary)" }}
								title={user?.email ?? undefined}
							>
								{user?.email ?? railLabels.guest}
							</span>
						)}

						{/* Logout button — always visible, icon only when collapsed */}
						{expanded ? (
							<Tooltip>
								<TooltipTrigger asChild>
									<button
										type="button"
										onClick={() => logout()}
										className="p-1.5 rounded-[4px] transition-colors hover:bg-[var(--surface-sunken)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
										style={{ color: "var(--text-faint)" }}
										aria-label={railLabels.logout}
									>
										<LogOut className="size-3.5" />
									</button>
								</TooltipTrigger>
								<TooltipContent side="right" sideOffset={8}>{railLabels.logout}</TooltipContent>
							</Tooltip>
						) : (
							<Tooltip>
								<TooltipTrigger asChild>
									<button
										type="button"
										onClick={() => logout()}
										className="shrink-0 p-1 rounded-[4px] transition-colors hover:bg-[var(--surface-sunken)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
										style={{ color: "var(--text-faint)" }}
										aria-label={railLabels.logout}
									>
										<LogOut className="size-3" />
									</button>
								</TooltipTrigger>
								<TooltipContent side="right" sideOffset={8}>{railLabels.logout}</TooltipContent>
							</Tooltip>
						)}
					</div>

					{/* Expand / collapse toggle */}
					<button
						type="button"
						onClick={toggle}
						aria-label={expanded ? railLabels.collapse : railLabels.expand}
						title={expanded ? railLabels.collapseHint : railLabels.expandHint}
						className="w-full flex items-center gap-2 px-3.5 py-2 transition-colors hover:bg-[var(--surface-sunken)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
						style={{
							justifyContent: expanded ? "flex-start" : "center",
							color: "var(--text-faint)",
							borderTop: "1px solid var(--border-subtle)",
						}}
					>
						{expanded ? (
							<>
								<ChevronLeft className="size-3.5 shrink-0" />
								<span className="text-[11px] font-medium">{railLabels.collapse}</span>
								<kbd
									className="ml-auto text-[9px] font-mono px-1 py-0.5 rounded"
									style={{ background: "var(--surface-sunken)", border: "1px solid var(--border-subtle)" }}
								>
									{`${MOD_KEY}\\`}
								</kbd>
							</>
						) : (
							<ChevronRight className="size-3.5 shrink-0" />
						)}
					</button>
				</div>
			</aside>
		</TooltipProvider>
	);
}

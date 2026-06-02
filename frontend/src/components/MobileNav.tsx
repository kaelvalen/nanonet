import {
	Activity,
	AlertCircle,
	Bell,
	BookOpen,
	Bot,
	CircleDollarSign,
	Cloud,
	FileText,
	GitCompare,
	GitFork,
	Globe,
	Key,
	LayoutDashboard,
	Menu,
	MoreHorizontal,
	Scroll,
	Server,
	Settings,
	Shield,
	Sparkles,
	Target,
	X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, useLocation } from "react-router";
import { useServices } from "@/hooks/useServices";
import { preloadRoute } from "@/routes";

// ── Types ────────────────────────────────────────────────────────────────────

interface NavItem {
	to: string;
	labelKey: string;
	icon: React.ElementType;
	end?: boolean;
	badge?: boolean;
}

interface NavSection {
	titleKey: string;
	items: NavItem[];
}

// ── Bottom tab bar items (4 + More) ──────────────────────────────────────────

const TAB_ITEMS: NavItem[] = [
	{ to: "/app",          labelKey: "shell.mobile.home",     icon: LayoutDashboard, end: true },
	{ to: "/app/services", labelKey: "shell.mobile.services", icon: Server },
	{ to: "/app/alerts",   labelKey: "shell.mobile.alerts",   icon: AlertCircle, badge: true },
	{ to: "/app/agents",   labelKey: "shell.nav.agents",      icon: Bot },
];

// ── "More" drawer sections ───────────────────────────────────────────────────

const MORE_SECTIONS: NavSection[] = [
	{
		titleKey: "shell.sections.monitor",
		items: [
			{ to: "/app/incidents",    labelKey: "shell.nav.incidents",    icon: FileText },
			{ to: "/app/logs",         labelKey: "shell.nav.logs",         icon: Scroll },
		],
	},
	{
		titleKey: "shell.sections.intelligence",
		items: [
			{ to: "/app/ai-insights",  labelKey: "shell.nav.aiInsights",   icon: Sparkles },
			{ to: "/app/service-map",  labelKey: "shell.nav.serviceMap",   icon: GitFork },
			{ to: "/app/compare",      labelKey: "shell.nav.compare",      icon: GitCompare },
		],
	},
	{
		titleKey: "shell.sections.reliability",
		items: [
			{ to: "/app/slo",           labelKey: "shell.nav.slo",          icon: Target },
			{ to: "/app/probes",        labelKey: "shell.nav.probes",       icon: Activity },
			{ to: "/app/runbooks",      labelKey: "shell.nav.runbooks",     icon: BookOpen },
			{ to: "/app/notifications", labelKey: "shell.nav.notifications",icon: Bell },
		],
	},
	{
		titleKey: "shell.sections.infra",
		items: [
			{ to: "/app/kubernetes",    labelKey: "shell.nav.kubernetes",   icon: Cloud },
			{ to: "/app/status-pages",  labelKey: "shell.nav.statusPages",  icon: Globe },
		],
	},
	{
		titleKey: "shell.sections.platform",
		items: [
			{ to: "/app/security",      labelKey: "shell.nav.security",     icon: Shield },
			{ to: "/app/api-tokens",    labelKey: "shell.nav.apiTokens",    icon: Key },
			{ to: "/app/ai-usage",      labelKey: "shell.nav.aiUsage",      icon: CircleDollarSign },
			{ to: "/app/settings",      labelKey: "shell.nav.settings",     icon: Settings },
		],
	},
];

// ── Tab link ─────────────────────────────────────────────────────────────────

function TabLink({
	item,
	active,
	badge,
}: {
	item: NavItem;
	active: boolean;
	badge?: number | null;
}) {
	const { t } = useTranslation();
	const warm = () => preloadRoute(item.to);
	const Icon = item.icon;

	return (
		<NavLink
			to={item.to}
			end={item.end}
			onTouchStart={warm}
			onFocus={warm}
			onMouseEnter={warm}
			className="relative flex flex-col items-center justify-center flex-1 py-2.5 gap-0.5 transition-colors"
			style={{ color: active ? "var(--brand-primary)" : "var(--text-faint)" }}
		>
			{active && (
				<span
					className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-b-full"
					style={{ background: "var(--brand-primary)" }}
				/>
			)}
			<div className="relative">
				<Icon className="w-5 h-5" />
				{badge != null && badge > 0 && (
					<span
						className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center text-white"
						style={{ background: "var(--status-down)" }}
					>
						{badge > 9 ? "9+" : badge}
					</span>
				)}
			</div>
			<span className="text-[9px] font-medium tracking-tight">
				{t(item.labelKey)}
			</span>
		</NavLink>
	);
}

// ── More drawer ──────────────────────────────────────────────────────────────

function MoreDrawer({
	open,
	onClose,
}: {
	open: boolean;
	onClose: () => void;
}) {
	const { t } = useTranslation();
	const location = useLocation();

	// Close on navigation
	useEffect(() => {
		onClose();
	}, [location.pathname, onClose]);

	// Close on backdrop scroll-down / swipe (simple approach: close on any touch outside)
	useEffect(() => {
		if (!open) return;
		const handler = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [open, onClose]);

	if (!open) return null;

	return (
		<>
			{/* Backdrop */}
			<div
				className="fixed inset-0 z-40 md:hidden"
				style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(2px)" }}
				onClick={onClose}
			/>

			{/* Sheet */}
			<div
				className="fixed bottom-0 left-0 right-0 z-50 md:hidden rounded-t-[16px] overflow-y-auto"
				style={{
					background: "var(--surface-raised)",
					borderTop: "1px solid var(--border-default)",
					maxHeight: "80dvh",
					paddingBottom: "calc(env(safe-area-inset-bottom) + 80px)",
				}}
			>
				{/* Handle + header */}
				<div className="flex items-center justify-between px-4 pt-3 pb-2">
					<div
						className="absolute top-2.5 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full"
						style={{ background: "var(--border-default)" }}
					/>
					<span
						className="text-[11px] font-semibold uppercase tracking-wider mt-1"
						style={{ color: "var(--text-faint)" }}
					>
						Tüm sayfalar
					</span>
					<button
						type="button"
						onClick={onClose}
						className="p-1.5 rounded-full"
						style={{ color: "var(--text-tertiary)", background: "var(--surface-sunken)" }}
					>
						<X className="w-4 h-4" />
					</button>
				</div>

				{/* Sections */}
				<div className="px-3 pb-2 space-y-4">
					{MORE_SECTIONS.map((section) => (
						<div key={section.titleKey}>
							<p
								className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-wider"
								style={{ color: "var(--text-faint)" }}
							>
								{t(section.titleKey)}
							</p>
							<div className="grid grid-cols-2 gap-1.5">
								{section.items.map((item) => {
									const Icon = item.icon;
									const active = location.pathname === item.to ||
										(!item.end && location.pathname.startsWith(item.to + "/"));
									return (
										<NavLink
											key={item.to}
											to={item.to}
											end={item.end}
											onTouchStart={() => preloadRoute(item.to)}
											className="flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] transition-colors"
											style={{
												background: active ? "var(--brand-primary-subtle)" : "var(--surface-sunken)",
												color: active ? "var(--brand-primary)" : "var(--text-secondary)",
											}}
										>
											<Icon className="w-4 h-4 shrink-0" />
											<span className="text-[12px] font-medium truncate">
												{t(item.labelKey)}
											</span>
										</NavLink>
									);
								})}
							</div>
						</div>
					))}
				</div>
			</div>
		</>
	);
}

// ── MobileNav ────────────────────────────────────────────────────────────────

export function MobileNav() {
	const location = useLocation();
	const { services } = useServices();
	const [moreOpen, setMoreOpen] = useState(false);

	const downCount = services.filter(
		(s) => s.status === "down" || s.status === "degraded",
	).length;

	const isActive = (to: string, end?: boolean) => {
		if (end) return location.pathname === to;
		return location.pathname.startsWith(to);
	};

	// Check if current page is in "More" (not a tab item)
	const moreActive = !TAB_ITEMS.some((item) => isActive(item.to, item.end));

	return (
		<>
			<nav
				className="fixed bottom-0 left-0 right-0 z-50 flex items-center md:hidden"
				style={{
					background: "var(--surface-raised)",
					borderTop: "1px solid var(--border-default)",
					paddingBottom: "env(safe-area-inset-bottom)",
				}}
			>
				{/* Tab items */}
				{TAB_ITEMS.map((item) => (
					<TabLink
						key={item.to}
						item={item}
						active={isActive(item.to, item.end)}
						badge={item.badge ? (downCount > 0 ? downCount : null) : null}
					/>
				))}

				{/* More button */}
				<button
					type="button"
					onClick={() => setMoreOpen((v) => !v)}
					className="relative flex flex-col items-center justify-center flex-1 py-2.5 gap-0.5 transition-colors"
					style={{ color: moreActive || moreOpen ? "var(--brand-primary)" : "var(--text-faint)" }}
				>
					{(moreActive || moreOpen) && (
						<span
							className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-b-full"
							style={{ background: "var(--brand-primary)" }}
						/>
					)}
					<MoreHorizontal className="w-5 h-5" />
					<span className="text-[9px] font-medium tracking-tight">Daha Fazla</span>
				</button>
			</nav>

			<MoreDrawer open={moreOpen} onClose={() => setMoreOpen(false)} />
		</>
	);
}

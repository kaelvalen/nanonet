import {
	AlertCircle,
	LayoutDashboard,
	Server,
	Settings,
	Sparkles,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink, useLocation } from "react-router";
import { useServices } from "@/hooks/useServices";
import { preloadRoute } from "@/routes";

const navItems = [
	{
		to: "/app",
		labelKey: "shell.mobile.home",
		icon: LayoutDashboard,
		end: true,
	},
	{ to: "/app/services", labelKey: "shell.mobile.services", icon: Server },
	{
		to: "/app/alerts",
		labelKey: "shell.mobile.alerts",
		icon: AlertCircle,
		badge: true,
	},
	{ to: "/app/ai-insights", labelKey: "shell.mobile.ai", icon: Sparkles },
	{ to: "/app/settings", labelKey: "shell.mobile.settings", icon: Settings },
];

export function MobileNav() {
	const location = useLocation();
	const { t } = useTranslation();
	const { services } = useServices();
	const downCount = services.filter(
		(s) => s.status === "down" || s.status === "degraded",
	).length;

	const isActive = (to: string, end?: boolean) => {
		if (end) return location.pathname === to;
		return location.pathname.startsWith(to);
	};

	return (
		<nav
			className="fixed bottom-0 left-0 right-0 z-50 flex items-center md:hidden"
			style={{
				background: "var(--surface-raised)",
				borderTop: "1px solid var(--border-default)",
				paddingBottom: "env(safe-area-inset-bottom)",
			}}
		>
			{navItems.map((item) => {
				const active = isActive(item.to, item.end);
				const showBadge = item.badge && downCount > 0;
				const warm = () => preloadRoute(item.to);
				return (
					<NavLink
						key={item.to}
						to={item.to}
						end={item.end}
						onTouchStart={warm}
						onFocus={warm}
						onMouseEnter={warm}
						className="relative flex flex-col items-center justify-center flex-1 py-2.5 gap-0.5 transition-colors"
						style={{
							color: active ? "var(--sidebar-primary)" : "var(--text-faint)",
						}}
					>
						{/* Active top indicator */}
						{active && (
							<span
								className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-b-full"
								style={{ background: "var(--sidebar-primary)" }}
							/>
						)}

						<div className="relative">
							<item.icon className="w-5 h-5" />
							{showBadge && (
								<span
									className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center text-white"
									style={{ background: "var(--status-down)" }}
								>
									{downCount > 9 ? "9+" : downCount}
								</span>
							)}
						</div>
						<span
							className="text-[9px] font-medium tracking-tight"
							style={{
								color: active ? "var(--sidebar-primary)" : "var(--text-faint)",
							}}
						>
							{t(item.labelKey)}
						</span>
					</NavLink>
				);
			})}
		</nav>
	);
}

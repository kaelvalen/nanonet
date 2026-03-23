import {
	AlertCircle,
	Cloud,
	GitFork,
	LayoutDashboard,
	Server,
	Settings,
	Sparkles,
} from "lucide-react";
import { NavLink, useLocation } from "react-router";
import { useServices } from "@/hooks/useServices";

const navItems = [
	{ to: "/", label: "Ana Sayfa", icon: LayoutDashboard },
	{ to: "/services", label: "Servisler", icon: Server },
	{ to: "/alerts", label: "Uyarılar", icon: AlertCircle },
	{ to: "/ai-insights", label: "AI", icon: Sparkles },
	{ to: "/settings", label: "Ayarlar", icon: Settings },
];

export function MobileNav() {
	const location = useLocation();
	const { services } = useServices();
	const downCount = services.filter(
		(s) => s.status === "down" || s.status === "degraded",
	).length;

	const isActive = (to: string) => {
		if (to === "/") return location.pathname === "/";
		return location.pathname.startsWith(to);
	};

	return (
		<nav
			className="fixed bottom-0 left-0 right-0 z-50 flex items-center md:hidden"
			style={{
				background: "var(--sidebar)",
				borderTop: "2px solid var(--border-default)",
				boxShadow: "0 -4px 16px rgba(0,0,0,0.2)",
				paddingBottom: "env(safe-area-inset-bottom)",
			}}
		>
			{navItems.map((item) => {
				const active = isActive(item.to);
				const showBadge = item.to === "/alerts" && downCount > 0;
				return (
					<NavLink
						key={item.to}
						to={item.to}
						end={item.to === "/"}
						className="relative flex flex-col items-center justify-center flex-1 py-2 gap-0.5 transition-all"
						style={{
							color: active ? "var(--sidebar-primary)" : "var(--sidebar-foreground)",
							opacity: active ? 1 : 0.6,
						}}
					>
						<div className="relative">
							<item.icon className="w-5 h-5" />
							{showBadge && (
								<span
									className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full text-[8px] font-bold flex items-center justify-center"
									style={{
										background: "var(--status-down)",
										color: "white",
									}}
								>
									{downCount > 9 ? "9+" : downCount}
								</span>
							)}
						</div>
						<span className="text-[9px] font-medium truncate max-w-12 text-center">
							{item.label}
						</span>
						{active && (
							<span
								className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-b-full"
								style={{ background: "var(--sidebar-primary)" }}
							/>
						)}
					</NavLink>
				);
			})}
		</nav>
	);
}

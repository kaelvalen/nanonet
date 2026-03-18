import {
	Activity,
	AlertCircle,
	ChevronLeft,
	ChevronRight,
	Cloud,
	LayoutDashboard,
	Server,
	Settings,
	Sparkles,
} from "lucide-react";
import { useState } from "react";
import { NavLink, useLocation } from "react-router";
import { useServices } from "@/hooks/useServices";
import { useWSStore } from "@/store/wsStore";

interface NavItem {
	to: string;
	label: string;
	icon: React.ElementType;
	badge?: () => React.ReactNode;
}

interface SidebarProps {
	onCollapsedChange?: (collapsed: boolean) => void;
}

export function Sidebar({ onCollapsedChange }: SidebarProps) {
	const [collapsed, setCollapsed] = useState(false);

	const handleToggle = () => {
		const next = !collapsed;
		setCollapsed(next);
		onCollapsedChange?.(next);
	};
	const location = useLocation();
	const { services } = useServices();
	const { isConnected } = useWSStore();

	const downCount = services.filter(
		(s) => s.status === "down" || s.status === "degraded",
	).length;

	const navItems: NavItem[] = [
		{
			to: "/",
			label: "Dashboard",
			icon: LayoutDashboard,
		},
		{
			to: "/services",
			label: "Servisler",
			icon: Server,
			badge: () =>
				services.length > 0 ? (
					<span
						className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-sm tabular-nums"
						style={{
							background: "var(--surface-sunken)",
							color: "var(--text-muted)",
							border: "1px solid var(--border-subtle)",
						}}
					>
						{services.length}
					</span>
				) : null,
		},
		{
			to: "/alerts",
			label: "Uyarılar",
			icon: AlertCircle,
			badge: () =>
				downCount > 0 ? (
					<span
						className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-sm tabular-nums animate-pulse"
						style={{
							background: "var(--status-down-subtle)",
							color: "var(--status-down-text)",
							border: "1px solid var(--status-down-border)",
						}}
					>
						{downCount}
					</span>
				) : null,
		},
		{
			to: "/ai-insights",
			label: "AI Analiz",
			icon: Sparkles,
		},
		{
			to: "/kubernetes",
			label: "Kubernetes",
			icon: Cloud,
		},
		{
			to: "/settings",
			label: "Ayarlar",
			icon: Settings,
		},
	];

	const isActive = (to: string) => {
		if (to === "/") return location.pathname === "/";
		return location.pathname.startsWith(to);
	};

	return (
		<aside
			className="fixed left-0 top-0 bottom-0 z-30 flex flex-col transition-all duration-200"
			style={{
				width: collapsed ? "56px" : "200px",
				background: "var(--sidebar)",
				borderRight: "2px solid var(--border-default)",
				boxShadow: "var(--panel-shadow)",
			}}
		>
			{/* Logo area */}
			<div
				className="flex items-center gap-2.5 px-3 py-4 shrink-0"
				style={{ borderBottom: "2px solid var(--border-default)" }}
			>
				<div
					className="w-7 h-7 rounded flex items-center justify-center shrink-0"
					style={{
						background: "var(--primary)",
						border: "2px solid var(--border-default)",
						boxShadow: "var(--btn-shadow)",
					}}
				>
					<Activity
						className="w-3.5 h-3.5"
						style={{ color: "var(--primary-foreground)" }}
					/>
				</div>
				{!collapsed && (
					<span
						className="font-bold text-sm tracking-wide truncate"
						style={{ color: "var(--sidebar-foreground)" }}
					>
						NanoNet
					</span>
				)}
			</div>

			{/* Nav items */}
			<nav className="flex-1 overflow-y-auto py-2 px-1.5 space-y-0.5">
				{navItems.map((item) => {
					const active = isActive(item.to);
					return (
						<NavLink
							key={item.to}
							to={item.to}
							end={item.to === "/"}
							className="flex items-center gap-2.5 px-2 py-2 rounded text-xs font-medium transition-colors duration-100 group"
							style={{
								background: active ? "var(--sidebar-accent)" : "transparent",
								color: active
									? "var(--sidebar-primary)"
									: "var(--sidebar-foreground)",
								border: active
									? "1.5px solid var(--sidebar-border)"
									: "1.5px solid transparent",
								boxShadow: active ? "var(--btn-shadow)" : "none",
							}}
							title={collapsed ? item.label : undefined}
						>
							<item.icon
								className="w-4 h-4 shrink-0"
								style={{
									color: active
										? "var(--sidebar-primary)"
										: "var(--sidebar-foreground)",
									opacity: active ? 1 : 0.7,
								}}
							/>
							{!collapsed && (
								<>
									<span className="truncate flex-1">{item.label}</span>
									{item.badge?.()}
								</>
							)}
							{collapsed && item.badge && (
								<span className="absolute left-8 top-0.5">{item.badge()}</span>
							)}
						</NavLink>
					);
				})}
			</nav>

			{/* WS status + collapse toggle */}
			<div
				className="shrink-0 px-2 py-3 space-y-1"
				style={{ borderTop: "2px solid var(--border-default)" }}
			>
				{/* WS indicator */}
				{!collapsed && (
					<div
						className="flex items-center gap-2 px-2 py-1.5 rounded text-[10px]"
						style={{
							background: isConnected
								? "var(--status-up-subtle)"
								: "var(--status-down-subtle)",
							border: `1px solid ${isConnected ? "var(--status-up-border)" : "var(--status-down-border)"}`,
							color: isConnected
								? "var(--status-up-text)"
								: "var(--status-down-text)",
						}}
					>
						<span
							className="w-1.5 h-1.5 rounded-full shrink-0"
							style={{
								background: isConnected
									? "var(--status-up)"
									: "var(--status-down)",
							}}
						/>
						<span className="font-medium">
							{isConnected ? "Bağlı" : "Bağlantı yok"}
						</span>
					</div>
				)}

				{/* Collapse button */}
				<button
					type="button"
					onClick={handleToggle}
					className="w-full flex items-center justify-center py-1.5 rounded text-xs transition-colors"
					style={{
						color: "var(--text-muted)",
						border: "1.5px solid var(--border-subtle)",
					}}
					title={collapsed ? "Genişlet" : "Daralt"}
				>
					{collapsed ? (
						<ChevronRight className="w-3.5 h-3.5" />
					) : (
						<ChevronLeft className="w-3.5 h-3.5" />
					)}
				</button>
			</div>
		</aside>
	);
}

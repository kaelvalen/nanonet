import {
	AlertCircle,
	Cloud,
	GitFork,
	LayoutDashboard,
	LogOut,
	PanelLeft,
	PanelLeftClose,
	Server,
	Settings,
	Sparkles,
} from "lucide-react";
import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router";
import logo from "@/assets/logo.png";
import { useAuth } from "@/hooks/useAuth";
import { useServices } from "@/hooks/useServices";
import { useAuthStore } from "@/store/authStore";
import { useWSStore } from "@/store/wsStore";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "./ui/dropdown-menu";

interface NavItem {
	to: string;
	label: string;
	icon: React.ElementType;
	end?: boolean;
	badge?: "services" | "alerts";
}

interface NavSection {
	label: string | null;
	items: NavItem[];
}

const navSections: NavSection[] = [
	{
		label: null,
		items: [
			{
				to: "/app",
				label: "Genel Bakış",
				icon: LayoutDashboard,
				end: true,
			},
			{
				to: "/app/services",
				label: "Servisler",
				icon: Server,
				badge: "services",
			},
			{
				to: "/app/alerts",
				label: "Uyarılar",
				icon: AlertCircle,
				badge: "alerts",
			},
		],
	},
	{
		label: "Analiz",
		items: [
			{ to: "/app/ai-insights", label: "AI İçgörüler", icon: Sparkles },
			{ to: "/app/service-map", label: "Servis Haritası", icon: GitFork },
		],
	},
	{
		label: "Altyapı",
		items: [{ to: "/app/kubernetes", label: "Kubernetes", icon: Cloud }],
	},
	{
		label: "Sistem",
		items: [{ to: "/app/settings", label: "Ayarlar", icon: Settings }],
	},
];

interface SidebarProps {
	onCollapsedChange?: (collapsed: boolean) => void;
}

export function Sidebar({ onCollapsedChange }: SidebarProps) {
	const [collapsed, setCollapsed] = useState(false);
	const location = useLocation();
	const navigate = useNavigate();
	const { services } = useServices();
	const { isConnected } = useWSStore();
	const { user } = useAuthStore();
	const { logout } = useAuth();

	const downCount = services.filter(
		(s) => s.status === "down" || s.status === "degraded",
	).length;

	const handleToggle = () => {
		const next = !collapsed;
		setCollapsed(next);
		onCollapsedChange?.(next);
	};

	const isActive = (to: string, end?: boolean) => {
		if (end) return location.pathname === to;
		return location.pathname.startsWith(to);
	};

	const initials = user?.email
		? user.email.substring(0, 2).toUpperCase()
		: "NN";

	const getBadge = (badgeKey?: "services" | "alerts") => {
		if (badgeKey === "services" && services.length > 0) return services.length;
		if (badgeKey === "alerts" && downCount > 0) return downCount;
		return null;
	};

	return (
		<aside
			className="fixed left-0 top-0 bottom-0 z-30 flex flex-col transition-all duration-200"
			style={{
				width: collapsed ? "60px" : "240px",
				background: "var(--surface-raised)",
				borderRight: "1px solid var(--border-default)",
				boxShadow: "1px 0 0 0 var(--border-subtle)",
			}}
		>
			{/* Header: Logo + Collapse toggle */}
			<div
				className="flex items-center gap-2.5 px-3 h-14 shrink-0"
				style={{ borderBottom: "1px solid var(--border-default)" }}
			>
				<button
					type="button"
					onClick={() => navigate("/app")}
					className="flex items-center gap-2.5 min-w-0 flex-1"
				>
					<img
						src={logo}
						alt="NanoNet"
						className="w-8 h-8 rounded object-contain shrink-0"
					/>
					{!collapsed && (
						<span
							className="font-bold text-sm truncate"
							style={{ color: "var(--text-primary)" }}
						>
							NanoNet
						</span>
					)}
				</button>
				<button
					type="button"
					onClick={handleToggle}
					className="shrink-0 w-7 h-7 flex items-center justify-center rounded transition-colors"
					style={{ color: "var(--text-faint)" }}
					title={collapsed ? "Genişlet" : "Daralt"}
				>
					{collapsed ? (
						<PanelLeft className="w-4 h-4" />
					) : (
						<PanelLeftClose className="w-4 h-4" />
					)}
				</button>
			</div>

			{/* Navigation */}
			<nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
				{navSections.map((section, si) => (
					<div key={section.label ?? `section-${si}`} className="space-y-0.5">
						{/* Section label */}
						{section.label && !collapsed && (
							<p
								className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-widest"
								style={{ color: "var(--text-faint)" }}
							>
								{section.label}
							</p>
						)}
						{section.label && collapsed && si > 0 && (
							<div
								className="mx-2 my-1"
								style={{
									height: "1px",
									background: "var(--border-subtle)",
								}}
							/>
						)}

						{section.items.map((item) => {
							const active = isActive(item.to, item.end);
							const badge = getBadge(item.badge);
							const isAlert = item.badge === "alerts";

							return (
								<NavLink
									key={item.to}
									to={item.to}
									end={item.end}
									className="flex items-center gap-2.5 px-2 py-2 rounded-md text-sm font-medium transition-all duration-100 relative group"
									style={{
										background: active
											? "var(--sidebar-accent)"
											: "transparent",
										color: active
											? "var(--sidebar-primary)"
											: "var(--text-muted)",
									}}
									title={collapsed ? item.label : undefined}
								>
									{/* Active left border indicator */}
									{active && (
										<div
											className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
											style={{ background: "var(--sidebar-primary)" }}
										/>
									)}

									<item.icon
										className="w-4 h-4 shrink-0"
										style={{
											color: active
												? "var(--sidebar-primary)"
												: "var(--text-muted)",
										}}
									/>

									{!collapsed && (
										<>
											<span className="truncate flex-1">{item.label}</span>
											{badge != null && (
												<span
													className="text-[10px] font-bold px-1.5 py-0.5 rounded-md tabular-nums"
													style={
														isAlert
															? {
																	background: "var(--status-down-subtle)",
																	color: "var(--status-down-text)",
																	border: "1px solid var(--status-down-border)",
																}
															: {
																	background: "var(--surface-sunken)",
																	color: "var(--text-faint)",
																	border: "1px solid var(--border-subtle)",
																}
													}
												>
													{badge}
												</span>
											)}
										</>
									)}

									{/* Collapsed badge dot */}
									{collapsed && badge != null && (
										<span
											className="absolute top-1 right-1 w-2 h-2 rounded-full"
											style={{
												background: isAlert
													? "var(--status-down)"
													: "var(--color-teal)",
											}}
										/>
									)}
								</NavLink>
							);
						})}
					</div>
				))}
			</nav>

			{/* Bottom: WS status + User */}
			<div
				className="shrink-0 px-2 py-3 space-y-1"
				style={{ borderTop: "1px solid var(--border-default)" }}
			>
				{/* WS indicator */}
				{!collapsed && (
					<div
						className="flex items-center gap-2 px-2 py-1.5 rounded-md mb-1"
						style={{
							background: isConnected
								? "var(--status-up-subtle)"
								: "var(--surface-sunken)",
						}}
					>
						<div
							className="w-1.5 h-1.5 rounded-full shrink-0"
							style={{
								background: isConnected
									? "var(--status-up)"
									: "var(--text-faint)",
							}}
						/>
						<span
							className="text-[11px] font-medium"
							style={{
								color: isConnected
									? "var(--status-up-text)"
									: "var(--text-faint)",
							}}
						>
							{isConnected ? "Canlı bağlantı" : "Bağlantı yok"}
						</span>
					</div>
				)}

				{/* User menu */}
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							className="w-full flex items-center gap-2.5 px-2 py-2 rounded-md transition-colors text-left"
							style={{ color: "var(--text-secondary)" }}
						>
							<div
								className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold"
								style={{ background: "var(--gradient-logo)" }}
							>
								{initials}
							</div>
							{!collapsed && (
								<>
									<div className="flex-1 min-w-0">
										<p
											className="text-xs font-medium truncate"
											style={{ color: "var(--text-secondary)" }}
										>
											{user?.email ?? "Hesabım"}
										</p>
									</div>
									<LogOut
										className="w-3.5 h-3.5 shrink-0"
										style={{ color: "var(--text-faint)" }}
									/>
								</>
							)}
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						side="top"
						align="start"
						sideOffset={4}
						style={{
							background: "var(--surface-overlay)",
							border: "1px solid var(--border-default)",
							boxShadow: "var(--panel-shadow)",
						}}
					>
						<DropdownMenuLabel
							className="text-xs"
							style={{ color: "var(--text-muted)" }}
						>
							{user?.email ?? "Hesabım"}
						</DropdownMenuLabel>
						<DropdownMenuSeparator
							style={{ backgroundColor: "var(--border-subtle)" }}
						/>
						<DropdownMenuItem
							className="text-xs cursor-pointer"
							style={{ color: "var(--text-secondary)" }}
							onClick={() => navigate("/app/settings")}
						>
							<Settings className="w-3.5 h-3.5 mr-2" />
							Ayarlar
						</DropdownMenuItem>
						<DropdownMenuSeparator
							style={{ backgroundColor: "var(--border-subtle)" }}
						/>
						<DropdownMenuItem
							className="text-xs cursor-pointer"
							style={{ color: "var(--text-danger)" }}
							onClick={() => logout()}
						>
							<LogOut className="w-3.5 h-3.5 mr-2" />
							Çıkış Yap
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</aside>
	);
}

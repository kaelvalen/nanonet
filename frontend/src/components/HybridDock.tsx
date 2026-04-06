import {
	AlertCircle,
	Cloud,
	GitFork,
	LayoutDashboard,
	LogOut,
	Server,
	Settings,
	Sparkles,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
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

const navItems: NavItem[] = [
	{ to: "/app", label: "Genel Bakış", icon: LayoutDashboard, end: true },
	{ to: "/app/services", label: "Servisler", icon: Server, badge: "services" },
	{ to: "/app/alerts", label: "Uyarılar", icon: AlertCircle, badge: "alerts" },
	{ to: "/app/ai-insights", label: "AI İçgörüler", icon: Sparkles },
	{ to: "/app/service-map", label: "Servis Haritası", icon: GitFork },
	{ to: "/app/kubernetes", label: "Kubernetes", icon: Cloud },
];

function Tooltip({ label, visible }: { label: string; visible: boolean }) {
	return (
		<AnimatePresence>
			{visible && (
				<motion.div
					initial={{ opacity: 0, x: -6 }}
					animate={{ opacity: 1, x: 0 }}
					exit={{ opacity: 0, x: -4 }}
					transition={{ duration: 0.12 }}
					className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap pointer-events-none z-50"
					style={{
						background: "var(--surface-overlay)",
						border: "1px solid var(--border-default)",
						boxShadow: "var(--panel-shadow)",
						color: "var(--text-primary)",
					}}
				>
					{label}
					<span
						className="absolute right-full top-1/2 -translate-y-1/2 border-[5px] border-transparent"
						style={{ borderRightColor: "var(--surface-overlay)" }}
					/>
				</motion.div>
			)}
		</AnimatePresence>
	);
}

export function HybridDock() {
	const location = useLocation();
	const navigate = useNavigate();
	const { services } = useServices();
	const { isConnected } = useWSStore();
	const { user } = useAuthStore();
	const { logout } = useAuth();
	const [hoveredItem, setHoveredItem] = useState<string | null>(null);

	const downCount = services.filter(
		(s) => s.status === "down" || s.status === "degraded",
	).length;

	const isActive = (to: string, end?: boolean) => {
		if (end) return location.pathname === to;
		return location.pathname.startsWith(to);
	};

	const getBadge = (badgeKey?: "services" | "alerts") => {
		if (badgeKey === "services" && services.length > 0) return services.length;
		if (badgeKey === "alerts" && downCount > 0) return downCount;
		return null;
	};

	const initials = user?.email
		? user.email.substring(0, 2).toUpperCase()
		: "NN";

	return (
		<motion.aside
			className="fixed left-3 top-1/2 -translate-y-1/2 z-40 hidden md:flex flex-col items-center gap-1 py-2 px-1.5"
			style={{
				background:
					"color-mix(in srgb, var(--surface-raised) 85%, transparent)",
				border: "1px solid var(--border-default)",
				borderRadius: "20px",
				boxShadow:
					"0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.06)",
				backdropFilter: "blur(20px)",
				WebkitBackdropFilter: "blur(20px)",
			}}
			initial={{ opacity: 0, x: -20 }}
			animate={{ opacity: 1, x: 0 }}
			transition={{ duration: 0.3, ease: "easeOut" }}
		>
			{/* Logo */}
			<motion.button
				type="button"
				onClick={() => navigate("/app")}
				className="w-9 h-9 flex items-center justify-center rounded-xl mb-1 relative overflow-hidden"
				onMouseEnter={() => setHoveredItem("logo")}
				onMouseLeave={() => setHoveredItem(null)}
				whileHover={{ scale: 1.08 }}
				whileTap={{ scale: 0.94 }}
			>
				<img src={logo} alt="NanoNet" className="w-full h-full object-cover" />
				<Tooltip label="NanoNet" visible={hoveredItem === "logo"} />
			</motion.button>

			{/* Divider */}
			<div
				className="w-6 h-px my-0.5"
				style={{ background: "var(--border-subtle)" }}
			/>

			{/* Nav items */}
			{navItems.map((item) => {
				const active = isActive(item.to, item.end);
				const badge = getBadge(item.badge);
				const isAlert = item.badge === "alerts";

				return (
					<div
						key={item.to}
						className="relative"
						onMouseEnter={() => setHoveredItem(item.to)}
						onMouseLeave={() => setHoveredItem(null)}
					>
						<NavLink to={item.to} end={item.end}>
							<motion.div
								className="w-9 h-9 flex items-center justify-center rounded-xl relative"
								style={{
									background: active ? "var(--sidebar-accent)" : "transparent",
								}}
								whileHover={{
									scale: 1.1,
									background: active ? undefined : "var(--surface-sunken)",
								}}
								whileTap={{ scale: 0.92 }}
								transition={{ duration: 0.1 }}
							>
								<item.icon
									className="w-4.5 h-4.5"
									style={{
										color: active
											? "var(--sidebar-primary)"
											: "var(--text-muted)",
									}}
								/>

								{/* Badge dot */}
								{badge != null && (
									<span
										className="absolute -top-0.5 -right-0.5 min-w-3.5 h-3.5 px-0.5 rounded-full flex items-center justify-center text-[9px] font-bold"
										style={
											isAlert
												? {
														background: "var(--status-down)",
														color: "#fff",
													}
												: {
														background: "var(--color-teal)",
														color: "#fff",
													}
										}
									>
										{badge > 9 ? "9+" : badge}
									</span>
								)}

								{/* Active indicator */}
								{active && (
									<motion.div
										className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full"
										style={{ background: "var(--sidebar-primary)" }}
										layoutId="dock-active"
										transition={{
											duration: 0.2,
											type: "spring",
											stiffness: 400,
											damping: 30,
										}}
									/>
								)}
							</motion.div>
						</NavLink>

						<Tooltip label={item.label} visible={hoveredItem === item.to} />
					</div>
				);
			})}

			{/* Divider */}
			<div
				className="w-6 h-px my-0.5"
				style={{ background: "var(--border-subtle)" }}
			/>

			{/* Settings */}
			<div
				className="relative"
				onMouseEnter={() => setHoveredItem("settings")}
				onMouseLeave={() => setHoveredItem(null)}
			>
				<NavLink to="/app/settings">
					<motion.div
						className="w-9 h-9 flex items-center justify-center rounded-xl"
						style={{
							background: isActive("/app/settings")
								? "var(--sidebar-accent)"
								: "transparent",
						}}
						whileHover={{
							scale: 1.1,
							background: isActive("/app/settings")
								? undefined
								: "var(--surface-sunken)",
						}}
						whileTap={{ scale: 0.92 }}
					>
						<Settings
							className="w-4 h-4"
							style={{
								color: isActive("/app/settings")
									? "var(--sidebar-primary)"
									: "var(--text-muted)",
							}}
						/>
						{isActive("/app/settings") && (
							<motion.div
								className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full"
								style={{ background: "var(--sidebar-primary)" }}
								layoutId="dock-active"
								transition={{
									duration: 0.2,
									type: "spring",
									stiffness: 400,
									damping: 30,
								}}
							/>
						)}
					</motion.div>
				</NavLink>
				<Tooltip label="Ayarlar" visible={hoveredItem === "settings"} />
			</div>

			{/* User avatar + logout */}
			<div
				className="relative mt-1"
				onMouseEnter={() => setHoveredItem("user")}
				onMouseLeave={() => setHoveredItem(null)}
			>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<motion.button
							type="button"
							className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold relative"
							style={{ background: "var(--gradient-logo)" }}
							whileHover={{ scale: 1.1 }}
							whileTap={{ scale: 0.92 }}
						>
							{initials}
							{/* WS dot */}
							<span
								className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
								style={{
									background: isConnected
										? "var(--status-up)"
										: "var(--text-faint)",
									borderColor: "var(--surface-raised)",
									boxShadow: isConnected ? "0 0 6px var(--status-up)" : "none",
								}}
							/>
						</motion.button>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						side="right"
						align="end"
						sideOffset={12}
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
				<Tooltip
					label={user?.email ?? "Hesabım"}
					visible={hoveredItem === "user"}
				/>
			</div>
		</motion.aside>
	);
}

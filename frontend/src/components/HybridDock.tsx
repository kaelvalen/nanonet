import {
	AlertCircle,
	Cloud,
	GitFork,
	LayoutDashboard,
	LogOut,
	Scroll,
	Server,
	Settings,
	Shield,
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

const PRIMARY: NavItem[] = [
	{ to: "/app", label: "Genel Bakış", icon: LayoutDashboard, end: true },
	{ to: "/app/services", label: "Servisler", icon: Server, badge: "services" },
	{ to: "/app/alerts", label: "Uyarılar", icon: AlertCircle, badge: "alerts" },
	{ to: "/app/ai-insights", label: "AI İçgörüler", icon: Sparkles },
	{ to: "/app/service-map", label: "Servis Haritası", icon: GitFork },
];

const SECONDARY: NavItem[] = [
	{ to: "/app/kubernetes", label: "Kubernetes", icon: Cloud },
	{ to: "/app/logs", label: "Loglar", icon: Scroll },
	{ to: "/app/security", label: "Güvenlik", icon: Shield },
];

function DockItem({
	item,
	active,
	badge,
	hovered,
	onHover,
}: {
	item: NavItem;
	active: boolean;
	badge: number | null;
	hovered: boolean;
	onHover: (hovered: boolean) => void;
}) {
	const isAlert = item.badge === "alerts";
	return (
		<div
			className="relative"
			onMouseEnter={() => onHover(true)}
			onMouseLeave={() => onHover(false)}
		>
			<NavLink to={item.to} end={item.end}>
				<div
					className="w-9 h-9 flex items-center justify-center rounded-lg relative transition-colors"
					style={{
						background: active ? "var(--surface-sunken)" : "transparent",
						color: active ? "var(--color-teal)" : "var(--text-muted)",
					}}
				>
					<item.icon className="w-4 h-4" />

					{badge != null && (
						<span
							className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-full flex items-center justify-center text-[9px] font-bold tabular-nums"
							style={{
								background: isAlert
									? "var(--status-down)"
									: "var(--color-teal)",
								color: "#fff",
								border: "1.5px solid var(--surface-raised)",
							}}
						>
							{badge > 9 ? "9+" : badge}
						</span>
					)}

					{active && (
						<span
							className="absolute -left-2.5 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
							style={{ background: "var(--color-teal)" }}
						/>
					)}
				</div>
			</NavLink>

			{/* Tooltip */}
			<div
				className={`absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap pointer-events-none transition-all duration-150 ${
					hovered ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-1"
				}`}
				style={{
					background: "var(--surface-overlay)",
					border: "1px solid var(--border-default)",
					boxShadow: "var(--panel-shadow)",
					color: "var(--text-primary)",
					zIndex: 60,
				}}
			>
				{item.label}
			</div>
		</div>
	);
}

export function HybridDock() {
	const location = useLocation();
	const navigate = useNavigate();
	const { services } = useServices();
	const { isConnected } = useWSStore();
	const { user } = useAuthStore();
	const { logout } = useAuth();
	const [hovered, setHovered] = useState<string | null>(null);

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
		<aside
			className="fixed left-3 top-1/2 -translate-y-1/2 z-40 hidden md:flex flex-col items-center gap-1 py-2 px-1.5"
			style={{
				background: "var(--surface-raised)",
				border: "1px solid var(--border-default)",
				borderRadius: "14px",
				boxShadow: "var(--panel-shadow)",
			}}
		>
			{/* Logo */}
			<button
				type="button"
				onClick={() => navigate("/app")}
				className="w-9 h-9 flex items-center justify-center rounded-lg mb-1 transition-transform hover:scale-105 active:scale-95"
			>
				<img src={logo} alt="NanoNet" className="w-7 h-7 object-contain" />
			</button>

			<div
				className="w-6 h-px"
				style={{ background: "var(--border-subtle)" }}
			/>

			{/* Primary nav */}
			<div className="flex flex-col gap-0.5 py-1">
				{PRIMARY.map((item) => (
					<DockItem
						key={item.to}
						item={item}
						active={isActive(item.to, item.end)}
						badge={getBadge(item.badge)}
						hovered={hovered === item.to}
						onHover={(h) => setHovered(h ? item.to : null)}
					/>
				))}
			</div>

			<div
				className="w-6 h-px"
				style={{ background: "var(--border-subtle)" }}
			/>

			{/* Secondary nav */}
			<div className="flex flex-col gap-0.5 py-1">
				{SECONDARY.map((item) => (
					<DockItem
						key={item.to}
						item={item}
						active={isActive(item.to, item.end)}
						badge={getBadge(item.badge)}
						hovered={hovered === item.to}
						onHover={(h) => setHovered(h ? item.to : null)}
					/>
				))}
			</div>

			<div
				className="w-6 h-px"
				style={{ background: "var(--border-subtle)" }}
			/>

			{/* Settings */}
			<DockItem
				item={{ to: "/app/settings", label: "Ayarlar", icon: Settings }}
				active={isActive("/app/settings")}
				badge={null}
				hovered={hovered === "/app/settings"}
				onHover={(h) => setHovered(h ? "/app/settings" : null)}
			/>

			{/* User */}
			<div
				className="relative mt-1"
				onMouseEnter={() => setHovered("user")}
				onMouseLeave={() => setHovered(null)}
			>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-[11px] font-bold relative transition-transform hover:scale-105 active:scale-95"
							style={{ background: "var(--gradient-logo)" }}
						>
							{initials}
							<span
								className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full"
								style={{
									background: isConnected
										? "var(--status-up)"
										: "var(--text-faint)",
									border: "1.5px solid var(--surface-raised)",
								}}
							/>
						</button>
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
							Çıkış yap
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
				<div
					className={`absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap pointer-events-none transition-all duration-150 ${
						hovered === "user"
							? "opacity-100 translate-x-0"
							: "opacity-0 -translate-x-1"
					}`}
					style={{
						background: "var(--surface-overlay)",
						border: "1px solid var(--border-default)",
						boxShadow: "var(--panel-shadow)",
						color: "var(--text-primary)",
						zIndex: 60,
					}}
				>
					{user?.email ?? "Hesabım"}
				</div>
			</div>
		</aside>
	);
}

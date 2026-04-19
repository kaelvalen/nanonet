import {
	Activity,
	AlertCircle,
	Bell,
	BookOpen,
	CircleDollarSign,
	Cloud,
	Command,
	FileText,
	GitCompare,
	GitFork,
	Globe,
	Grid3x3,
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
import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router";
import { Logo } from "@/components/Logo";
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
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

interface NavItem {
	to: string;
	label: string;
	icon: React.ElementType;
	end?: boolean;
	badge?: "services" | "alerts";
}

interface NavGroup {
	title: string;
	items: NavItem[];
}

// ─── Visible core nav (always shown in dock) ────────────────────────────────
// These are the top-of-funnel pages most users hit every session. Any item
// added here must earn its slot — anything else lives in the "More" popover.
const CORE_NAV: NavItem[] = [
	{ to: "/app", label: "Genel Bakış", icon: LayoutDashboard, end: true },
	{ to: "/app/services", label: "Servisler", icon: Server, badge: "services" },
	{ to: "/app/alerts", label: "Uyarılar", icon: AlertCircle, badge: "alerts" },
	{ to: "/app/incidents", label: "Incidents", icon: FileText },
	{ to: "/app/ai-insights", label: "AI İçgörüler", icon: Sparkles },
	{ to: "/app/service-map", label: "Servis Haritası", icon: GitFork },
	{ to: "/app/compare", label: "Karşılaştır", icon: GitCompare },
	{ to: "/app/logs", label: "Loglar", icon: Scroll },
];

// ─── Categorized "More" menu (opened via popover) ───────────────────────────
const MORE_GROUPS: NavGroup[] = [
	{
		title: "Reliability",
		items: [
			{ to: "/app/slo", label: "SLO", icon: Target },
			{ to: "/app/probes", label: "Probes", icon: Activity },
			{ to: "/app/runbooks", label: "Runbooks", icon: BookOpen },
			{ to: "/app/notifications", label: "Bildirimler", icon: Bell },
		],
	},
	{
		title: "Infrastructure",
		items: [
			{ to: "/app/kubernetes", label: "Kubernetes", icon: Cloud },
			{ to: "/app/status-pages", label: "Status Sayfaları", icon: Globe },
		],
	},
	{
		title: "Güvenlik & Erişim",
		items: [
			{ to: "/app/security", label: "Güvenlik", icon: Shield },
			{ to: "/app/api-tokens", label: "API Tokens", icon: Key },
		],
	},
	{
		title: "AI",
		items: [
			{ to: "/app/ai-usage", label: "AI Maliyetleri", icon: CircleDollarSign },
		],
	},
];

// Flat list used for active-state lookups in the More toggle indicator
const MORE_FLAT: NavItem[] = MORE_GROUPS.flatMap((g) => g.items);

// ════════════════════════════════════════════════════════════════════════════
// DOCK ITEM (single icon w/ tooltip + badge)
// ════════════════════════════════════════════════════════════════════════════

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
		// biome-ignore lint/a11y/noStaticElementInteractions: wrapper hosts tooltip; interactive child handles keyboard + focus
		<div
			className="relative"
			onMouseEnter={() => onHover(true)}
			onMouseLeave={() => onHover(false)}
		>
			<NavLink to={item.to} end={item.end} aria-label={item.label}>
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

			<Tooltip visible={hovered}>{item.label}</Tooltip>
		</div>
	);
}

function Tooltip({
	visible,
	children,
}: {
	visible: boolean;
	children: React.ReactNode;
}) {
	return (
		<div
			className={`absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap pointer-events-none transition-all duration-150 ${
				visible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-1"
			}`}
			style={{
				background: "var(--surface-overlay)",
				border: "1px solid var(--border-default)",
				boxShadow: "var(--panel-shadow)",
				color: "var(--text-primary)",
				zIndex: 60,
			}}
		>
			{children}
		</div>
	);
}

// ════════════════════════════════════════════════════════════════════════════
// MORE POPOVER (categorized grid)
// ════════════════════════════════════════════════════════════════════════════

function MoreToggle({
	hasActiveItem,
	hovered,
	onHover,
	open,
	onOpenChange,
	onNavigate,
	currentPath,
}: {
	hasActiveItem: boolean;
	hovered: boolean;
	onHover: (hovered: boolean) => void;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onNavigate: (path: string) => void;
	currentPath: string;
}) {
	return (
		<Popover open={open} onOpenChange={onOpenChange}>
			{/* biome-ignore lint/a11y/noStaticElementInteractions: hover tooltip wrapper, interactive child is the popover trigger button */}
			<div
				className="relative"
				onMouseEnter={() => onHover(true)}
				onMouseLeave={() => onHover(false)}
			>
				<PopoverTrigger asChild>
					<button
						type="button"
						aria-label="Daha fazla sayfa"
						className="w-9 h-9 flex items-center justify-center rounded-lg relative transition-colors"
						style={{
							background:
								open || hasActiveItem ? "var(--surface-sunken)" : "transparent",
							color:
								open || hasActiveItem
									? "var(--color-teal)"
									: "var(--text-muted)",
						}}
					>
						<Grid3x3 className="w-4 h-4" />
						{hasActiveItem && !open && (
							<span
								className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full"
								style={{ background: "var(--color-teal)" }}
							/>
						)}
						{(open || hasActiveItem) && (
							<span
								className="absolute -left-2.5 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
								style={{ background: "var(--color-teal)" }}
							/>
						)}
					</button>
				</PopoverTrigger>
				<Tooltip visible={hovered && !open}>Daha Fazla</Tooltip>
			</div>

			<PopoverContent
				side="right"
				align="center"
				sideOffset={14}
				className="w-[340px] p-0"
				style={{
					background: "var(--surface-overlay)",
					border: "1px solid var(--border-default)",
					boxShadow: "var(--panel-shadow)",
				}}
			>
				<div
					className="px-4 py-3 flex items-center justify-between"
					style={{ borderBottom: "1px solid var(--border-subtle)" }}
				>
					<span
						className="text-[10px] uppercase tracking-[0.22em] font-bold"
						style={{ color: "var(--text-faint)" }}
					>
						Tüm Sayfalar
					</span>
					<span
						className="inline-flex items-center gap-1 text-[10px] font-mono"
						style={{ color: "var(--text-muted)" }}
					>
						<Command className="w-3 h-3" /> K
					</span>
				</div>

				<div className="p-3 flex flex-col gap-3 max-h-[70vh] overflow-y-auto">
					{MORE_GROUPS.map((group) => (
						<div key={group.title}>
							<div
								className="px-1 mb-1.5 text-[9px] uppercase tracking-[0.22em] font-bold"
								style={{ color: "var(--text-faint)" }}
							>
								{group.title}
							</div>
							<div className="grid grid-cols-3 gap-1">
								{group.items.map((item) => {
									const Icon = item.icon;
									const active = currentPath.startsWith(item.to);
									return (
										<button
											key={item.to}
											type="button"
											onClick={() => {
												onOpenChange(false);
												onNavigate(item.to);
											}}
											className="group flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-lg transition-colors text-center"
											style={{
												background: active
													? "var(--color-teal-subtle)"
													: "transparent",
												border: `1px solid ${
													active
														? "var(--color-teal-border)"
														: "var(--border-subtle)"
												}`,
											}}
										>
											<Icon
												className="w-4 h-4"
												style={{
													color: active
														? "var(--color-teal)"
														: "var(--text-muted)",
												}}
											/>
											<span
												className="text-[10px] leading-tight font-medium line-clamp-2"
												style={{
													color: active
														? "var(--text-primary)"
														: "var(--text-secondary)",
												}}
											>
												{item.label}
											</span>
										</button>
									);
								})}
							</div>
						</div>
					))}
				</div>
			</PopoverContent>
		</Popover>
	);
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN DOCK
// ════════════════════════════════════════════════════════════════════════════

export function HybridDock() {
	const location = useLocation();
	const navigate = useNavigate();
	const { services } = useServices();
	const { isConnected } = useWSStore();
	const { user } = useAuthStore();
	const { logout } = useAuth();
	const [hovered, setHovered] = useState<string | null>(null);
	const [moreOpen, setMoreOpen] = useState(false);

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

	const moreHasActive = MORE_FLAT.some((it) => isActive(it.to, it.end));

	const initials = user?.email
		? user.email.substring(0, 2).toUpperCase()
		: "NN";

	return (
		<aside
			className="fixed left-3 top-1/2 -translate-y-1/2 z-40 hidden md:flex flex-col items-center gap-1 py-2 px-1.5 max-h-[calc(100vh-24px)]"
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
				aria-label="Ana sayfa"
				className="w-9 h-9 flex items-center justify-center rounded-lg shrink-0 transition-transform hover:scale-105 active:scale-95"
				style={{ color: "var(--text-primary)" }}
			>
				<Logo className="w-7 h-7" />
			</button>

			<div
				className="w-6 h-px shrink-0"
				style={{ background: "var(--border-subtle)" }}
			/>

			{/* Core nav (always visible) */}
			<div className="flex flex-col gap-0.5 py-1 shrink-0">
				{CORE_NAV.map((item) => (
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
				className="w-6 h-px shrink-0"
				style={{ background: "var(--border-subtle)" }}
			/>

			{/* More toggle (categorized popover) */}
			<div className="py-1 shrink-0">
				<MoreToggle
					hasActiveItem={moreHasActive}
					hovered={hovered === "more"}
					onHover={(h) => setHovered(h ? "more" : null)}
					open={moreOpen}
					onOpenChange={setMoreOpen}
					onNavigate={navigate}
					currentPath={location.pathname}
				/>
			</div>

			{/* Spacer pushes settings/user to bottom; safe because dock has max-h */}
			<div className="flex-1 min-h-2" />

			<div
				className="w-6 h-px shrink-0"
				style={{ background: "var(--border-subtle)" }}
			/>

			{/* Settings */}
			<div className="shrink-0">
				<DockItem
					item={{ to: "/app/settings", label: "Ayarlar", icon: Settings }}
					active={isActive("/app/settings")}
					badge={null}
					hovered={hovered === "/app/settings"}
					onHover={(h) => setHovered(h ? "/app/settings" : null)}
				/>
			</div>

			{/* User */}
			{/* biome-ignore lint/a11y/noStaticElementInteractions: wrapper hosts tooltip; interactive child (DropdownMenuTrigger button) handles keyboard + focus */}
			<div
				className="relative mt-1 shrink-0"
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
								title={isConnected ? "Canlı" : "Bağlantı yok"}
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
				<Tooltip visible={hovered === "user"}>
					{user?.email ?? "Hesabım"}
				</Tooltip>
			</div>
		</aside>
	);
}

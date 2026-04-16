import { AlertCircle, ChevronRight, Search, Server } from "lucide-react";
import { motion } from "motion/react";
import { Link, useLocation, useNavigate } from "react-router";
import { useServices } from "@/hooks/useServices";
import { useWSStore } from "@/store/wsStore";

type Crumb = { label: string; path: string };

function buildBreadcrumbs(pathname: string, services: { id: string; name: string }[]): Crumb[] {
	const crumbs: Crumb[] = [{ label: "Genel Bakış", path: "/app" }];
	const serviceDetailMatch = pathname.match(/^\/app\/services\/(.+)$/);
	if (serviceDetailMatch) {
		const serviceId = serviceDetailMatch[1];
		const svcName = services.find((s) => s.id === serviceId)?.name ?? "Detay";
		crumbs.push({ label: "Servisler", path: "/app/services" });
		crumbs.push({ label: svcName, path: pathname });
	} else if (pathname === "/app/services") {
		crumbs.push({ label: "Servisler", path: "/app/services" });
	} else if (pathname === "/app/alerts") {
		crumbs.push({ label: "Uyarılar", path: "/app/alerts" });
	} else if (pathname === "/app/ai-insights") {
		crumbs.push({ label: "AI İçgörüler", path: "/app/ai-insights" });
	} else if (pathname === "/app/service-map") {
		crumbs.push({ label: "Servis Haritası", path: "/app/service-map" });
	} else if (pathname === "/app/settings") {
		crumbs.push({ label: "Ayarlar", path: "/app/settings" });
	} else if (pathname === "/app/kubernetes") {
		crumbs.push({ label: "Kubernetes", path: "/app/kubernetes" });
	} else if (pathname === "/app/logs") {
		crumbs.push({ label: "Loglar", path: "/app/logs" });
	} else if (pathname === "/app/security") {
		crumbs.push({ label: "Güvenlik", path: "/app/security" });
	}
	return crumbs;
}

export function FloatingStatusBar({
	onOpenCommandPalette,
}: {
	onOpenCommandPalette: () => void;
}) {
	const navigate = useNavigate();
	const location = useLocation();
	const { isConnected } = useWSStore();
	const { services } = useServices();

	const crumbs = buildBreadcrumbs(location.pathname, services);
	const downCount = services.filter(
		(s) => s.status === "down" || s.status === "degraded",
	).length;
	const upCount = services.filter((s) => s.status === "up").length;
	const total = services.length;

	return (
		<motion.div
			className="fixed z-40 hidden md:block"
			style={{ top: 10, right: 12, left: "auto" }}
			initial={{ opacity: 0, y: -8 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.25, ease: "easeOut" }}
		>
			<div
				className="flex items-center h-9 px-1 gap-0.5 rounded-full"
				style={{
					background:
						"color-mix(in srgb, var(--surface-raised) 90%, transparent)",
					border: "1px solid var(--border-default)",
					backdropFilter: "blur(12px)",
					WebkitBackdropFilter: "blur(12px)",
					boxShadow:
						"0 2px 12px rgba(0,0,0,0.08), 0 0 0 0.5px rgba(0,0,0,0.04)",
				}}
			>
				{/* Breadcrumbs */}
				<nav className="flex items-center gap-0.5 px-2 min-w-0 flex-1">
					{crumbs.map((crumb, i) => (
						<span
							key={crumb.path}
							className="flex items-center gap-0.5 min-w-0"
						>
							{i > 0 && (
								<ChevronRight
									className="w-3 h-3 shrink-0"
									style={{ color: "var(--text-faint)" }}
								/>
							)}
							{i === crumbs.length - 1 ? (
								<span
									className="text-xs font-semibold truncate px-1"
									style={{ color: "var(--text-primary)" }}
								>
									{crumb.label}
								</span>
							) : (
								<Link
									to={crumb.path}
									className="text-xs truncate px-1 hover:underline"
									style={{ color: "var(--text-muted)" }}
								>
									{crumb.label}
								</Link>
							)}
						</span>
					))}
				</nav>

				{/* Divider */}
				<div
					className="w-px h-4 mx-1 shrink-0"
					style={{ background: "var(--border-default)" }}
				/>

				{/* Services health pill */}
				{total > 0 && (
					<button
						type="button"
						onClick={() => navigate("/app/services")}
						className="flex items-center gap-1.5 px-2.5 h-7 rounded-full text-xs font-medium transition-colors shrink-0"
						style={{
							background:
								downCount > 0
									? "var(--status-warn-subtle)"
									: "var(--status-up-subtle)",
							color:
								downCount > 0
									? "var(--status-warn-text)"
									: "var(--status-up-text)",
						}}
					>
						<Server className="w-3 h-3" />
						{upCount}/{total}
					</button>
				)}

				{/* Alert pill */}
				{downCount > 0 && (
					<button
						type="button"
						onClick={() => navigate("/app/alerts")}
						className="flex items-center gap-1.5 px-2.5 h-7 rounded-full text-xs font-semibold transition-colors shrink-0 ml-0.5"
						style={{
							background: "var(--status-down-subtle)",
							color: "var(--status-down-text)",
						}}
					>
						<AlertCircle className="w-3 h-3" />
						{downCount} sorun
					</button>
				)}

				{/* Divider */}
				<div
					className="w-px h-4 mx-1 shrink-0"
					style={{ background: "var(--border-default)" }}
				/>

				{/* Search */}
				<button
					type="button"
					onClick={onOpenCommandPalette}
					className="flex items-center gap-1.5 px-2.5 h-7 rounded-full text-xs transition-colors shrink-0"
					style={{
						color: "var(--text-muted)",
					}}
				>
					<Search className="w-3 h-3" />
					<span className="hidden lg:inline">Ara</span>
					<kbd
						className="hidden lg:inline text-[10px] px-1 py-0.5 rounded ml-0.5"
						style={{
							background: "var(--surface-sunken)",
							border: "1px solid var(--border-default)",
							color: "var(--text-faint)",
						}}
					>
						⌘K
					</kbd>
				</button>

				{/* WS status */}
				<button
					type="button"
					className="flex items-center gap-1.5 px-2.5 h-7 rounded-full text-xs font-medium shrink-0"
					style={{
						color: isConnected ? "var(--status-up-text)" : "var(--text-faint)",
					}}
				>
					<span
						className="w-1.5 h-1.5 rounded-full shrink-0"
						style={{
							background: isConnected
								? "var(--status-up)"
								: "var(--text-faint)",
							boxShadow: isConnected ? "0 0 6px var(--status-up)" : "none",
						}}
					/>
					<span className="hidden lg:inline">
						{isConnected ? "Canlı" : "Kesik"}
					</span>
				</button>
			</div>
		</motion.div>
	);
}

import { AlertCircle, ChevronRight, Search, Server } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router";
import { KbdHint } from "@/components/ui/status-atoms";
import { useServices } from "@/hooks/useServices";
import { useWSStore } from "@/store/wsStore";

type Crumb = { label: string; path: string };

const ROUTE_LABELS: Record<string, string> = {
	"/app": "Genel Bakış",
	"/app/services": "Servisler",
	"/app/alerts": "Uyarılar",
	"/app/ai-insights": "AI İçgörüler",
	"/app/service-map": "Servis Haritası",
	"/app/settings": "Ayarlar",
	"/app/kubernetes": "Kubernetes",
	"/app/logs": "Loglar",
	"/app/security": "Güvenlik",
};

function buildBreadcrumbs(
	pathname: string,
	services: { id: string; name: string }[],
): Crumb[] {
	const crumbs: Crumb[] = [{ label: "Genel Bakış", path: "/app" }];

	const serviceDetailMatch = pathname.match(/^\/app\/services\/(.+)$/);
	if (serviceDetailMatch) {
		const serviceId = serviceDetailMatch[1];
		const svcName = services.find((s) => s.id === serviceId)?.name ?? "Detay";
		crumbs.push({ label: "Servisler", path: "/app/services" });
		crumbs.push({ label: svcName, path: pathname });
		return crumbs;
	}

	if (pathname !== "/app" && ROUTE_LABELS[pathname]) {
		crumbs.push({ label: ROUTE_LABELS[pathname], path: pathname });
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
		<div
			className="fixed top-3 right-3 z-40 hidden md:block"
			style={{ maxWidth: "calc(100vw - 96px)" }}
		>
			<div
				className="flex items-center h-9 px-1 gap-1 rounded-lg"
				style={{
					background: "var(--surface-raised)",
					border: "1px solid var(--border-default)",
					boxShadow: "var(--card-shadow)",
				}}
			>
				{/* Breadcrumbs */}
				<nav className="flex items-center px-2 min-w-0">
					{crumbs.map((crumb, i) => (
						<span
							key={crumb.path}
							className="flex items-center gap-0.5 min-w-0"
						>
							{i > 0 && (
								<ChevronRight
									className="w-3 h-3 shrink-0 mx-0.5"
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
									className="text-xs truncate px-1 transition-colors hover:opacity-100"
									style={{ color: "var(--text-muted)" }}
								>
									{crumb.label}
								</Link>
							)}
						</span>
					))}
				</nav>

				<span
					className="w-px h-4 shrink-0"
					style={{ background: "var(--border-default)" }}
				/>

				{/* Service health pill */}
				{total > 0 && (
					<button
						type="button"
						onClick={() => navigate("/app/services")}
						className="flex items-center gap-1.5 px-2.5 h-7 rounded-md text-xs font-medium transition-colors shrink-0"
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
						title={`${upCount} sağlıklı / ${total} toplam`}
					>
						<Server className="w-3 h-3" />
						<span className="tabular-nums">
							{upCount}/{total}
						</span>
					</button>
				)}

				{downCount > 0 && (
					<button
						type="button"
						onClick={() => navigate("/app/alerts")}
						className="flex items-center gap-1.5 px-2.5 h-7 rounded-md text-xs font-semibold transition-colors shrink-0"
						style={{
							background: "var(--status-down-subtle)",
							color: "var(--status-down-text)",
						}}
					>
						<AlertCircle className="w-3 h-3" />
						<span className="tabular-nums">{downCount}</span>
					</button>
				)}

				<span
					className="w-px h-4 shrink-0"
					style={{ background: "var(--border-default)" }}
				/>

				{/* Search / Command palette */}
				<button
					type="button"
					onClick={onOpenCommandPalette}
					className="flex items-center gap-2 px-2.5 h-7 rounded-md text-xs transition-colors shrink-0 hover:bg-[var(--surface-sunken)]"
					style={{ color: "var(--text-muted)" }}
					title="Komut paleti"
				>
					<Search className="w-3 h-3" />
					<span className="hidden lg:inline">Ara</span>
					<span className="hidden lg:flex items-center gap-0.5">
						<KbdHint>⌘</KbdHint>
						<KbdHint>K</KbdHint>
					</span>
				</button>

				{/* WS status */}
				<div
					className="flex items-center gap-1.5 px-2.5 h-7 text-xs font-medium shrink-0"
					style={{
						color: isConnected ? "var(--status-up-text)" : "var(--text-faint)",
					}}
					title={isConnected ? "WebSocket bağlı" : "WebSocket kopuk"}
				>
					<span
						className="w-1.5 h-1.5 rounded-full shrink-0"
						style={{
							background: isConnected
								? "var(--status-up)"
								: "var(--text-faint)",
						}}
					/>
					<span className="hidden lg:inline">
						{isConnected ? "Canlı" : "Kesik"}
					</span>
				</div>
			</div>
		</div>
	);
}

import { AlertCircle, ChevronRight, Search, Server } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router";
import { KbdHint } from "@/components/ui/status-atoms";
import { useServices } from "@/hooks/useServices";
import { useWSStore } from "@/store/wsStore";
import { usePageMetaValue } from "./PageMetaContext";

type Crumb = { label: string; path: string };

const ROUTE_LABELS: Record<string, string> = {
	"/app": "Genel Bakış",
	"/app/services": "Servisler",
	"/app/alerts": "Uyarılar",
	"/app/incidents": "Incidents",
	"/app/ai-insights": "AI İçgörüler",
	"/app/service-map": "Servis Haritası",
	"/app/compare": "Karşılaştır",
	"/app/logs": "Loglar",
	"/app/slo": "SLO",
	"/app/probes": "Probes",
	"/app/runbooks": "Runbooks",
	"/app/notifications": "Bildirimler",
	"/app/status-pages": "Durum Sayfaları",
	"/app/api-tokens": "API Tokenları",
	"/app/ai-usage": "AI Kullanımı",
	"/app/settings": "Ayarlar",
	"/app/kubernetes": "Kubernetes",
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

/**
 * Full-width unified top bar.
 *
 * Replaces the old floating status pill + the per-page big PageHeader.
 * Layout:
 *
 *   [breadcrumb · page title]                [pills · search · live · actions]
 *
 * Page title / actions are pushed via PageMetaContext (PageHeader does this
 * automatically) so individual pages don't need refactoring.
 */
export function TopBar({
	onOpenCommandPalette,
}: {
	onOpenCommandPalette: () => void;
}) {
	const navigate = useNavigate();
	const location = useLocation();
	const { isConnected } = useWSStore();
	const { services } = useServices();
	const { title, eyebrow, actions } = usePageMetaValue();

	const crumbs = buildBreadcrumbs(location.pathname, services);
	const downCount = services.filter(
		(s) => s.status === "down" || s.status === "degraded",
	).length;
	const upCount = services.filter((s) => s.status === "up").length;
	const total = services.length;

	// Title shown inline. Prefer registered page title; fall back to last
	// breadcrumb so we always have something even on routes that haven't
	// registered meta yet.
	const inlineTitle = title ?? crumbs[crumbs.length - 1]?.label ?? "";
	const inlineEyebrow = eyebrow ?? null;

	return (
		<div
			className="sticky top-0 z-30 w-full"
			style={{
				background: "var(--background)",
				borderBottom: "1px solid var(--border-subtle)",
			}}
		>
			<div className="flex items-center h-12 gap-3 px-4 sm:px-6 lg:px-8">
				{/* LEFT — breadcrumb + inline title */}
				<div className="flex items-center min-w-0 flex-1 gap-3">
					<nav className="hidden sm:flex items-center min-w-0 shrink-0">
						{crumbs.map((crumb, i) => {
							const isLast = i === crumbs.length - 1;
							return (
								<span
									key={crumb.path}
									className="flex items-center gap-0.5 min-w-0"
								>
									{i > 0 && (
										<ChevronRight
											className="w-3 h-3 shrink-0 mx-1"
											style={{ color: "var(--text-faint)" }}
										/>
									)}
									{isLast ? (
										<span
											className="text-xs font-medium truncate"
											style={{ color: "var(--text-muted)" }}
										>
											{crumb.label}
										</span>
									) : (
										<Link
											to={crumb.path}
											className="text-xs truncate transition-colors hover:opacity-100"
											style={{ color: "var(--text-faint)" }}
										>
											{crumb.label}
										</Link>
									)}
								</span>
							);
						})}
					</nav>

					{/* Title divider + inline title (compact) */}
					<span
						className="hidden md:block w-px h-4 shrink-0"
						style={{ background: "var(--border-default)" }}
					/>
					<div className="flex items-baseline gap-2 min-w-0">
						{inlineEyebrow && (
							<span
								className="hidden lg:inline text-[10px] font-bold uppercase tracking-[0.16em] shrink-0"
								style={{ color: "var(--text-faint)" }}
							>
								{inlineEyebrow}
							</span>
						)}
						<h1
							className="text-sm font-semibold tracking-tight leading-none truncate"
							style={{ color: "var(--text-primary)" }}
						>
							{inlineTitle}
						</h1>
					</div>
				</div>

				{/* RIGHT — global pills + actions */}
				<div className="flex items-center gap-1 shrink-0">
					{/* Service health pill */}
					{total > 0 && (
						<button
							type="button"
							onClick={() => navigate("/app/services")}
							className="hidden md:flex items-center gap-1.5 px-2.5 h-7 rounded-md text-xs font-medium transition-colors"
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
							className="hidden md:flex items-center gap-1.5 px-2.5 h-7 rounded-md text-xs font-semibold transition-colors"
							style={{
								background: "var(--status-down-subtle)",
								color: "var(--status-down-text)",
							}}
						>
							<AlertCircle className="w-3 h-3" />
							<span className="tabular-nums">{downCount}</span>
						</button>
					)}

					{/* Search / Command palette */}
					<button
						type="button"
						onClick={onOpenCommandPalette}
						className="flex items-center gap-2 px-2.5 h-7 rounded-md text-xs transition-colors hover:bg-[var(--surface-sunken)]"
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
						className="hidden md:flex items-center gap-1.5 px-2.5 h-7 text-xs font-medium"
						style={{
							color: isConnected
								? "var(--status-up-text)"
								: "var(--text-faint)",
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
						<span className="hidden xl:inline">
							{isConnected ? "Canlı" : "Kesik"}
						</span>
					</div>

					{actions && (
						<>
							<span
								className="w-px h-5 mx-1.5 shrink-0"
								style={{ background: "var(--border-default)" }}
							/>
							<div className="flex items-center gap-2 shrink-0">
								{actions}
							</div>
						</>
					)}
				</div>
			</div>
		</div>
	);
}

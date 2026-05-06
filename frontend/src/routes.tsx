import { createBrowserRouter, Navigate } from "react-router";
import { DashboardLayout } from "@/components/DashboardLayout";
import { AuthGuard, GuestGuard, ServicesRedirect } from "@/components/guards";
import { lazyWithPreload } from "@/lib/lazyWithPreload";
import { ErrorPage } from "@/pages/ErrorPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

/* Each lazy route is created via lazyWithPreload so the chunk fetch can be
   triggered ahead of click time — see prefetch wiring in SideRail / MobileNav
   (link hover/focus) and the idle prefetch in App.tsx. */

const LandingPage = lazyWithPreload(() =>
	import("@/pages/LandingPage").then((m) => ({ default: m.LandingPage })),
);
const LoginPage = lazyWithPreload(() =>
	import("@/pages/LoginPage").then((m) => ({ default: m.LoginPage })),
);
const RegisterPage = lazyWithPreload(() =>
	import("@/pages/RegisterPage").then((m) => ({ default: m.RegisterPage })),
);
const ForgotPasswordPage = lazyWithPreload(() =>
	import("@/pages/ForgotPasswordPage").then((m) => ({
		default: m.ForgotPasswordPage,
	})),
);
const ResetPasswordPage = lazyWithPreload(() =>
	import("@/pages/ResetPasswordPage").then((m) => ({
		default: m.ResetPasswordPage,
	})),
);

const DashboardPage = lazyWithPreload(() =>
	import("@/pages/DashboardPage").then((m) => ({ default: m.DashboardPage })),
);
const ServicesPage = lazyWithPreload(() =>
	import("@/pages/ServicesPage").then((m) => ({ default: m.ServicesPage })),
);
const ServiceDetailPage = lazyWithPreload(() =>
	import("@/pages/ServiceDetailPage").then((m) => ({
		default: m.ServiceDetailPage,
	})),
);
const AlertsPage = lazyWithPreload(() =>
	import("@/pages/AlertsPage").then((m) => ({ default: m.AlertsPage })),
);
const AIInsightsPage = lazyWithPreload(() =>
	import("@/pages/AIInsightsPage").then((m) => ({ default: m.AIInsightsPage })),
);
const ServiceMapPage = lazyWithPreload(() =>
	import("@/pages/ServiceMapPage").then((m) => ({
		default: m.ServiceMapPage,
	})),
);
const SettingsPage = lazyWithPreload(() =>
	import("@/pages/SettingsPage").then((m) => ({ default: m.SettingsPage })),
);
const KubernetesPage = lazyWithPreload(() =>
	import("@/pages/KubernetesPage").then((m) => ({
		default: m.KubernetesPage,
	})),
);
const LogsPage = lazyWithPreload(() =>
	import("@/pages/LogsPage").then((m) => ({ default: m.LogsPage })),
);
const SecurityPage = lazyWithPreload(() =>
	import("@/pages/SecurityPage").then((m) => ({ default: m.SecurityPage })),
);
const NotificationsPage = lazyWithPreload(() =>
	import("@/pages/NotificationsPage").then((m) => ({
		default: m.NotificationsPage,
	})),
);
const SLOPage = lazyWithPreload(() =>
	import("@/pages/SLOPage").then((m) => ({ default: m.SLOPage })),
);
const StatusPagesAdmin = lazyWithPreload(() =>
	import("@/pages/StatusPagesAdmin").then((m) => ({
		default: m.StatusPagesAdmin,
	})),
);
const PublicStatusPage = lazyWithPreload(() =>
	import("@/pages/PublicStatusPage").then((m) => ({
		default: m.PublicStatusPage,
	})),
);
const IncidentsPage = lazyWithPreload(() =>
	import("@/pages/IncidentsPage").then((m) => ({ default: m.IncidentsPage })),
);
const ProbesPage = lazyWithPreload(() =>
	import("@/pages/ProbesPage").then((m) => ({ default: m.ProbesPage })),
);
const RunbooksPage = lazyWithPreload(() =>
	import("@/pages/RunbooksPage").then((m) => ({ default: m.RunbooksPage })),
);
const AIUsagePage = lazyWithPreload(() =>
	import("@/pages/AIUsagePage").then((m) => ({ default: m.AIUsagePage })),
);
const ApiTokensPage = lazyWithPreload(() =>
	import("@/pages/ApiTokensPage").then((m) => ({ default: m.ApiTokensPage })),
);
const ComparePage = lazyWithPreload(() =>
	import("@/pages/ComparePage").then((m) => ({ default: m.ComparePage })),
);

/* ROUTE_PRELOAD — central map from URL pathname to its preload function so
   nav components (SideRail, MobileNav, CommandPalette, breadcrumbs) can warm
   the chunk on hover/focus without importing each page module directly. The
   key matches the literal `to` prop used in NavLinks. Routes with dynamic
   segments use a function-style key (see `preloadRoute` resolver below). */
const ROUTE_PRELOAD: Record<string, () => Promise<unknown>> = {
	"/app": DashboardPage.preload,
	"/app/services": ServicesPage.preload,
	"/app/alerts": AlertsPage.preload,
	"/app/ai-insights": AIInsightsPage.preload,
	"/app/service-map": ServiceMapPage.preload,
	"/app/settings": SettingsPage.preload,
	"/app/kubernetes": KubernetesPage.preload,
	"/app/logs": LogsPage.preload,
	"/app/security": SecurityPage.preload,
	"/app/notifications": NotificationsPage.preload,
	"/app/slo": SLOPage.preload,
	"/app/status-pages": StatusPagesAdmin.preload,
	"/app/incidents": IncidentsPage.preload,
	"/app/probes": ProbesPage.preload,
	"/app/runbooks": RunbooksPage.preload,
	"/app/ai-usage": AIUsagePage.preload,
	"/app/api-tokens": ApiTokensPage.preload,
	"/app/compare": ComparePage.preload,
};

/** preloadRoute(path) — start fetching the chunk for a route. Safe to call
 *  repeatedly (dynamic import dedupes). Matches dynamic segments by prefix:
 *  e.g. `/app/services/abc-123` resolves to ServiceDetailPage. */
export function preloadRoute(pathname: string): void {
	const direct = ROUTE_PRELOAD[pathname];
	if (direct) {
		direct();
		return;
	}
	if (pathname.startsWith("/app/services/")) {
		ServiceDetailPage.preload();
		return;
	}
	if (pathname.startsWith("/status/")) {
		PublicStatusPage.preload();
	}
}

/** preloadDashboardRoutes — called from App.tsx on idle to warm the *most*
 *  frequently visited chunks. Previous implementation preloaded every page
 *  (~25 chunks ≈ 600KB JS) eagerly which dominated cold-start bandwidth even
 *  though >70% of sessions only touch dashboard/services/alerts. The rest are
 *  warmed lazily on link hover/focus by `preloadRoute` (see SideRail/MobileNav).
 */
export function preloadDashboardRoutes(): void {
	DashboardPage.preload();
	ServicesPage.preload();
	AlertsPage.preload();
	ServiceDetailPage.preload();
}

export const router = createBrowserRouter([
	{
		path: "/",
		element: <LandingPage />,
		errorElement: <ErrorPage />,
	},
	{
		path: "/login",
		element: (
			<GuestGuard>
				<LoginPage />
			</GuestGuard>
		),
		errorElement: <ErrorPage />,
	},
	{
		path: "/register",
		element: (
			<GuestGuard>
				<RegisterPage />
			</GuestGuard>
		),
		errorElement: <ErrorPage />,
	},
	{
		path: "/forgot-password",
		element: (
			<GuestGuard>
				<ForgotPasswordPage />
			</GuestGuard>
		),
		errorElement: <ErrorPage />,
	},
	{
		path: "/reset-password",
		element: (
			<GuestGuard>
				<ResetPasswordPage />
			</GuestGuard>
		),
		errorElement: <ErrorPage />,
	},
	{
		path: "/status/:slug",
		element: <PublicStatusPage />,
		errorElement: <ErrorPage />,
	},
	{
		path: "/dashboard",
		element: <Navigate to="/app" replace />,
	},
	{
		path: "/services",
		element: <Navigate to="/app/services" replace />,
	},
	{
		path: "/services/:serviceId",
		element: <ServicesRedirect />,
	},
	{
		path: "/alerts",
		element: <Navigate to="/app/alerts" replace />,
	},
	{
		path: "/ai-insights",
		element: <Navigate to="/app/ai-insights" replace />,
	},
	{
		path: "/service-map",
		element: <Navigate to="/app/service-map" replace />,
	},
	{
		path: "/settings",
		element: <Navigate to="/app/settings" replace />,
	},
	{
		path: "/kubernetes",
		element: <Navigate to="/app/kubernetes" replace />,
	},
	{
		path: "/app",
		element: (
			<AuthGuard>
				<DashboardLayout />
			</AuthGuard>
		),
		errorElement: <ErrorPage />,
		children: [
			{ index: true, element: <DashboardPage /> },
			{ path: "services", element: <ServicesPage /> },
			{ path: "services/:serviceId", element: <ServiceDetailPage /> },
			{ path: "alerts", element: <AlertsPage /> },
			{ path: "ai-insights", element: <AIInsightsPage /> },
			{ path: "service-map", element: <ServiceMapPage /> },
			{ path: "settings", element: <SettingsPage /> },
			{ path: "kubernetes", element: <KubernetesPage /> },
			{ path: "logs", element: <LogsPage /> },
			{ path: "security", element: <SecurityPage /> },
			{ path: "notifications", element: <NotificationsPage /> },
			{ path: "slo", element: <SLOPage /> },
			{ path: "status-pages", element: <StatusPagesAdmin /> },
			{ path: "incidents", element: <IncidentsPage /> },
			{ path: "probes", element: <ProbesPage /> },
			{ path: "runbooks", element: <RunbooksPage /> },
			{ path: "ai-usage", element: <AIUsagePage /> },
			{ path: "api-tokens", element: <ApiTokensPage /> },
			{ path: "compare", element: <ComparePage /> },
		],
	},
	{
		path: "*",
		element: <NotFoundPage />,
	},
]);

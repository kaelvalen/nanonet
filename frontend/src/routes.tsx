import { lazy } from "react";
import { createBrowserRouter, Navigate } from "react-router";
import { DashboardLayout } from "@/components/DashboardLayout";
import { AuthGuard, GuestGuard, ServicesRedirect } from "@/components/guards";
import { ErrorPage } from "@/pages/ErrorPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

const LandingPage = lazy(() =>
	import("@/pages/LandingPage").then((m) => ({ default: m.LandingPage })),
);
const LoginPage = lazy(() =>
	import("@/pages/LoginPage").then((m) => ({ default: m.LoginPage })),
);
const RegisterPage = lazy(() =>
	import("@/pages/RegisterPage").then((m) => ({ default: m.RegisterPage })),
);
const ForgotPasswordPage = lazy(() =>
	import("@/pages/ForgotPasswordPage").then((m) => ({
		default: m.ForgotPasswordPage,
	})),
);
const ResetPasswordPage = lazy(() =>
	import("@/pages/ResetPasswordPage").then((m) => ({
		default: m.ResetPasswordPage,
	})),
);

const DashboardPage = lazy(() =>
	import("@/pages/DashboardPage").then((m) => ({ default: m.DashboardPage })),
);
const ServicesPage = lazy(() =>
	import("@/pages/ServicesPage").then((m) => ({ default: m.ServicesPage })),
);
const ServiceDetailPage = lazy(() =>
	import("@/pages/ServiceDetailPage").then((m) => ({
		default: m.ServiceDetailPage,
	})),
);
const AlertsPage = lazy(() =>
	import("@/pages/AlertsPage").then((m) => ({ default: m.AlertsPage })),
);
const AIInsightsPage = lazy(() =>
	import("@/pages/AIInsightsPage").then((m) => ({ default: m.AIInsightsPage })),
);
const ServiceMapPage = lazy(() =>
	import("@/pages/ServiceMapPage").then((m) => ({
		default: m.ServiceMapPage,
	})),
);
const SettingsPage = lazy(() =>
	import("@/pages/SettingsPage").then((m) => ({ default: m.SettingsPage })),
);
const KubernetesPage = lazy(() =>
	import("@/pages/KubernetesPage").then((m) => ({
		default: m.KubernetesPage,
	})),
);
const LogsPage = lazy(() =>
	import("@/pages/LogsPage").then((m) => ({ default: m.LogsPage })),
);
const SecurityPage = lazy(() =>
	import("@/pages/SecurityPage").then((m) => ({ default: m.SecurityPage })),
);
const NotificationsPage = lazy(() =>
	import("@/pages/NotificationsPage").then((m) => ({
		default: m.NotificationsPage,
	})),
);
const SLOPage = lazy(() =>
	import("@/pages/SLOPage").then((m) => ({ default: m.SLOPage })),
);
const StatusPagesAdmin = lazy(() =>
	import("@/pages/StatusPagesAdmin").then((m) => ({
		default: m.StatusPagesAdmin,
	})),
);
const PublicStatusPage = lazy(() =>
	import("@/pages/PublicStatusPage").then((m) => ({
		default: m.PublicStatusPage,
	})),
);
const IncidentsPage = lazy(() =>
	import("@/pages/IncidentsPage").then((m) => ({ default: m.IncidentsPage })),
);
const ProbesPage = lazy(() =>
	import("@/pages/ProbesPage").then((m) => ({ default: m.ProbesPage })),
);
const RunbooksPage = lazy(() =>
	import("@/pages/RunbooksPage").then((m) => ({ default: m.RunbooksPage })),
);
const AIUsagePage = lazy(() =>
	import("@/pages/AIUsagePage").then((m) => ({ default: m.AIUsagePage })),
);
const ApiTokensPage = lazy(() =>
	import("@/pages/ApiTokensPage").then((m) => ({ default: m.ApiTokensPage })),
);
const ComparePage = lazy(() =>
	import("@/pages/ComparePage").then((m) => ({ default: m.ComparePage })),
);

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

import { createBrowserRouter, Navigate, useParams } from "react-router";
import { DashboardLayout } from "@/components/DashboardLayout";
import { AIInsightsPage } from "@/pages/AIInsightsPage";
import { AlertsPage } from "@/pages/AlertsPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { ErrorPage } from "@/pages/ErrorPage";
import { ForgotPasswordPage } from "@/pages/ForgotPasswordPage";
import { KubernetesPage } from "@/pages/KubernetesPage";
import { LandingPage } from "@/pages/LandingPage";
import { LoginPage } from "@/pages/LoginPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { ResetPasswordPage } from "@/pages/ResetPasswordPage";
import { ServiceDetailPage } from "@/pages/ServiceDetailPage";
import { ServiceMapPage } from "@/pages/ServiceMapPage";
import { ServicesPage } from "@/pages/ServicesPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { useAuthStore } from "@/store/authStore";

function AuthGuard({ children }: { children: React.ReactNode }) {
	const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
	const isInitializing = useAuthStore((s) => s.isInitializing);

	if (isInitializing) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
			</div>
		);
	}

	if (!isAuthenticated) {
		return <Navigate to="/login" replace />;
	}

	return <>{children}</>;
}

function GuestGuard({ children }: { children: React.ReactNode }) {
	const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
	const isInitializing = useAuthStore((s) => s.isInitializing);

	if (isInitializing) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
			</div>
		);
	}

	if (isAuthenticated) {
		return <Navigate to="/app" replace />;
	}

	return <>{children}</>;
}

function LandingRoute() {
	return <LandingPage />;
}

function ServicesRedirect() {
	const { serviceId } = useParams();
	return <Navigate to={`/app/services/${serviceId}`} replace />;
}

export const router = createBrowserRouter([
	{
		path: "/",
		element: <LandingRoute />,
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
		],
	},
	{
		path: "*",
		element: <NotFoundPage />,
	},
]);

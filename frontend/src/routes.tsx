import { createBrowserRouter, Navigate } from "react-router";
import { useAuthStore } from "@/store/authStore";
import { DashboardLayout } from "@/components/DashboardLayout";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { ServicesPage } from "@/pages/ServicesPage";
import { ServiceDetailPage } from "@/pages/ServiceDetailPage";
import { AlertsPage } from "@/pages/AlertsPage";
import { AIInsightsPage } from "@/pages/AIInsightsPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { ErrorPage } from "@/pages/ErrorPage";
import { ForgotPasswordPage } from "@/pages/ForgotPasswordPage";
import { ResetPasswordPage } from "@/pages/ResetPasswordPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { KubernetesPage } from "@/pages/KubernetesPage";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isInitializing = useAuthStore((s) => s.isInitializing);
  if (isInitializing) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function GuestGuard({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export const router = createBrowserRouter([
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
    path: "/",
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
      { path: "settings", element: <SettingsPage /> },
      { path: "kubernetes", element: <KubernetesPage /> },
    ],
  },
  {
    path: "*",
    element: <NotFoundPage />,
  },
]);

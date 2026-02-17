import { createBrowserRouter } from "react-router";
import { DashboardLayout } from "./components/DashboardLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { ServicesPage } from "./pages/ServicesPage";
import { ServiceDetailPage } from "./pages/ServiceDetailPage";
import { AIInsightsPage } from "./pages/AIInsightsPage";
import { AlertsPage } from "./pages/AlertsPage";
import { SettingsPage } from "./pages/SettingsPage";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: DashboardLayout,
    children: [
      { index: true, Component: DashboardPage },
      { path: "services", Component: ServicesPage },
      { path: "services/:serviceId", Component: ServiceDetailPage },
      { path: "alerts", Component: AlertsPage },
      { path: "ai-insights", Component: AIInsightsPage },
      { path: "settings", Component: SettingsPage },
    ],
  },
]);
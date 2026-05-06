import { Redirect, Tabs } from "expo-router";
import { useAuthStore } from "../../src/store/authStore";

export default function AppLayout() {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: { backgroundColor: "#0f172a", borderTopColor: "#1e293b" },
        tabBarActiveTintColor: "#3b82f6",
        tabBarInactiveTintColor: "#64748b",
        headerStyle: { backgroundColor: "#0f172a" },
        headerTintColor: "#f1f5f9",
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Dashboard" }} />
      <Tabs.Screen name="alerts" options={{ title: "Alerts" }} />
      <Tabs.Screen name="incidents" options={{ title: "Incidents" }} />
      <Tabs.Screen name="logs" options={{ title: "Logs" }} />
      <Tabs.Screen name="notifications" options={{ title: "Ayarlar" }} />
      <Tabs.Screen name="services/[id]" options={{ href: null }} />
      <Tabs.Screen name="slo" options={{ href: null }} />
      <Tabs.Screen name="ai" options={{ href: null }} />
    </Tabs>
  );
}

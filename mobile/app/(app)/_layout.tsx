import { Redirect, Tabs } from "expo-router";
import { Bell, Flame, Layers, ScrollText, Settings } from "lucide-react-native";
import { useWebSocket } from "../../src/hooks/useWebSocket";
import { useAuthStore } from "../../src/store/authStore";
import { NN } from "../../src/theme/tokens";

export default function AppLayout() {
  useWebSocket();
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: NN.bgElevated,
          borderTopColor: NN.border,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: NN.signal,
        tabBarInactiveTintColor: NN.dim,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        headerStyle: {
          backgroundColor: NN.bgElevated,
          shadowColor: "transparent",
          borderBottomWidth: 1,
          borderBottomColor: NN.border,
        },
        headerTintColor: NN.ink,
        headerTitleStyle: { fontWeight: "700", fontSize: 17 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Servisler",
          tabBarIcon: ({ color, size }) => <Layers color={color} size={size ?? 22} strokeWidth={2.2} />,
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: "Alertler",
          tabBarIcon: ({ color, size }) => <Bell color={color} size={size ?? 22} strokeWidth={2.2} />,
        }}
      />
      <Tabs.Screen
        name="incidents"
        options={{
          title: "Olaylar",
          tabBarIcon: ({ color, size }) => <Flame color={color} size={size ?? 22} strokeWidth={2.2} />,
        }}
      />
      <Tabs.Screen
        name="logs"
        options={{
          title: "Loglar",
          tabBarIcon: ({ color, size }) => <ScrollText color={color} size={size ?? 22} strokeWidth={2.2} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Ayarlar",
          tabBarIcon: ({ color, size }) => <Settings color={color} size={size ?? 22} strokeWidth={2.2} />,
        }}
      />
      <Tabs.Screen name="services/[id]" options={{ href: null }} />
      <Tabs.Screen name="slo" options={{ href: null }} />
      <Tabs.Screen name="ai" options={{ href: null }} />
    </Tabs>
  );
}

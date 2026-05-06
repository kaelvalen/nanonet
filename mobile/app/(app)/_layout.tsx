import { Redirect, Tabs } from "expo-router";
import { Text } from "react-native";
import { useAuthStore } from "../../src/store/authStore";

function TabIcon({ icon, focused }: { icon: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{icon}</Text>
  );
}

export default function AppLayout() {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: "#0f172a",
          borderTopColor: "#1e293b",
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: "#3b82f6",
        tabBarInactiveTintColor: "#475569",
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        headerStyle: { backgroundColor: "#0f172a", shadowColor: "transparent", borderBottomWidth: 1, borderBottomColor: "#1e293b" },
        headerTintColor: "#f1f5f9",
        headerTitleStyle: { fontWeight: "700", fontSize: 17 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Servisler",
          tabBarIcon: ({ focused }) => <TabIcon icon="⬡" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: "Alertler",
          tabBarIcon: ({ focused }) => <TabIcon icon="⚠" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="incidents"
        options={{
          title: "Olaylar",
          tabBarIcon: ({ focused }) => <TabIcon icon="🔥" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="logs"
        options={{
          title: "Loglar",
          tabBarIcon: ({ focused }) => <TabIcon icon="≡" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Ayarlar",
          tabBarIcon: ({ focused }) => <TabIcon icon="⚙" focused={focused} />,
        }}
      />
      <Tabs.Screen name="services/[id]" options={{ href: null }} />
      <Tabs.Screen name="slo" options={{ href: null }} />
      <Tabs.Screen name="ai" options={{ href: null }} />
    </Tabs>
  );
}

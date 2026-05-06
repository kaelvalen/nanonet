import * as Notifications from "expo-notifications";
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { pushApi } from "../../src/api/push";
import { useAuthStore } from "../../src/store/authStore";
import { authApi } from "../../src/api/auth";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function registerForPushNotifications(): Promise<string | null> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return null;
  const tokenData = await Notifications.getExpoPushTokenAsync();
  return tokenData.data;
}

export default function NotificationsScreen() {
  const qc = useQueryClient();
  const { clearAuth } = useAuthStore();
  const [pushToken, setPushToken] = useState<string | null>(null);

  const { data: pref } = useQuery({
    queryKey: ["push-pref"],
    queryFn: pushApi.getPreference,
  });

  const updateMutation = useMutation({
    mutationFn: pushApi.updatePreference,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["push-pref"] }),
  });

  useEffect(() => {
    registerForPushNotifications().then(async (token) => {
      if (!token) return;
      setPushToken(token);
      const platform = Platform.OS === "ios" ? "ios" : "android";
      await pushApi.registerToken(token, platform).catch(() => null);
    });
  }, []);

  const handleLogout = async () => {
    try {
      if (pushToken) await pushApi.deleteToken(pushToken).catch(() => null);
      await authApi.logout();
    } finally {
      await clearAuth();
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 24, gap: 20 }}>
      <Text style={styles.heading}>Ayarlar</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Push Bildirimler</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Bildirimler</Text>
          <Switch
            value={pref?.enabled ?? true}
            onValueChange={(v) => updateMutation.mutate({ enabled: v })}
            trackColor={{ true: "#3b82f6" }}
          />
        </View>

        <Text style={[styles.label, { marginTop: 16, marginBottom: 8 }]}>Minimum Seviye</Text>
        {(["info", "warn", "crit"] as const).map((sev) => (
          <Pressable
            key={sev}
            style={[styles.sevOption, pref?.min_severity === sev && styles.sevActive]}
            onPress={() => updateMutation.mutate({ min_severity: sev })}
          >
            <Text style={[styles.sevText, pref?.min_severity === sev && styles.sevTextActive]}>
              {sev.toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Çıkış Yap</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  heading: { fontSize: 22, fontWeight: "700", color: "#f1f5f9", marginBottom: 8 },
  section: { backgroundColor: "#1e293b", borderRadius: 12, padding: 16 },
  sectionTitle: { color: "#94a3b8", fontSize: 13, fontWeight: "600", marginBottom: 16, textTransform: "uppercase", letterSpacing: 1 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  label: { color: "#e2e8f0", fontSize: 15 },
  sevOption: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, marginBottom: 6, backgroundColor: "#0f172a" },
  sevActive: { backgroundColor: "#1d4ed8" },
  sevText: { color: "#94a3b8", fontSize: 14 },
  sevTextActive: { color: "#fff", fontWeight: "600" },
  logoutBtn: { backgroundColor: "#7f1d1d", borderRadius: 12, padding: 16, alignItems: "center" },
  logoutText: { color: "#fca5a5", fontWeight: "700", fontSize: 15 },
});

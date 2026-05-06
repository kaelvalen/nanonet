import * as Notifications from "expo-notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import type { ReactNode } from "react";
import { Bot, Cpu, Layers, Sparkles } from "lucide-react-native";
import { getApiBaseUrl, getWsDashboardUrl, saveServerEndpoints } from "../../src/api/client";
import { authApi } from "../../src/api/auth";
import { pushApi } from "../../src/api/push";
import { useAuthStore } from "../../src/store/authStore";
import { NN } from "../../src/theme/tokens";

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

function NavRow({
  icon,
  title,
  sub,
  onPress,
  isLast,
}: {
  icon: ReactNode;
  title: string;
  sub?: string;
  onPress: () => void;
  isLast?: boolean;
}) {
  return (
    <Pressable style={[styles.navRow, isLast && styles.navRowLast]} onPress={onPress}>
      <View style={styles.navIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.navTitle}>{title}</Text>
        {sub ? <Text style={styles.navSub}>{sub}</Text> : null}
      </View>
      <Text style={styles.arrow}>›</Text>
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const qc = useQueryClient();
  const { clearAuth } = useAuthStore();
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [apiEdit, setApiEdit] = useState("");
  const [wsEdit, setWsEdit] = useState("");

  useFocusEffect(
    useCallback(() => {
      setApiEdit(getApiBaseUrl());
      setWsEdit("");
    }, []),
  );

  const persistServer = async () => {
    if (!apiEdit.trim()) {
      Alert.alert("API", "REST tabanı zorunlu (örn. https://sunucu/api/v1).");
      return;
    }
    try {
      await saveServerEndpoints(apiEdit.trim(), wsEdit.trim() ? wsEdit.trim() : undefined);
      Alert.alert("Tamam", "Sunucu adresi güncellendi. Canlı WebSocket için çıkış yapıp tekrar girmeniz önerilir.");
    } catch {
      Alert.alert("Hata", "Adresler kaydedilemedi.");
    }
  };

  const effectiveWs = getWsDashboardUrl();

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
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 14 }}>
      <Text style={styles.kicker}>Konsol özeti</Text>
      <Text style={styles.heading}>Operasyon kontrol paneli</Text>
      <Text style={styles.lead}>Mikroservis sağlığını grafikleri, agent komutları ve AI içgörüleriyle birlikte takip edin.</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Keşfedilecek özellikler</Text>
        <NavRow
          icon={<Sparkles color={NN.signal} size={22} />}
          title="İçgörüler"
          sub="Claude destekli anomali özeti ve önerilen aksiyonlar"
          onPress={() => router.push("/(app)/ai")}
        />
        <NavRow
          icon={<Layers color={NN.signal} size={22} />}
          title="SLO hedefleri"
          sub="Hata bütçesi ve burn-rate takibi"
          onPress={() => router.push("/(app)/slo")}
        />
        <NavRow
          icon={<Cpu color={NN.signal} size={22} />}
          title="Servis listesi"
          sub="Tüm mikroservislerin bağlantı ve health durumu"
          onPress={() => router.replace("/(app)")}
          isLast
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sunucu (internet / dış ağ)</Text>
        <Text style={styles.serverHint}>
          Aynı uygulama hem yerel hem dış hat üzerinden çalışır: telefon HTTPS ile erişebildiği sürece adresi burada veya girişte girin (kayıtlı).
        </Text>
        <Text style={styles.miniLabel}>REST API</Text>
        <TextInput
          style={styles.serverInput}
          value={apiEdit}
          onChangeText={setApiEdit}
          placeholder="https://api.domain.com/api/v1"
          placeholderTextColor={NN.dim}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <Text style={styles.miniLabel}>WebSocket — boş bırakırsanız API adresinden otomatik türetilir</Text>
        <TextInput
          style={styles.serverInput}
          value={wsEdit}
          onChangeText={setWsEdit}
          placeholder="wss://api.domain.com/ws"
          placeholderTextColor={NN.dim}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <Text style={styles.wsActive} selectable>
          Şu an: {effectiveWs || "—"}
        </Text>
        <Pressable style={styles.saveServerBtn} onPress={persistServer}>
          <Text style={styles.saveServerTxt}>Kaydet</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Push bildirimleri</Text>
        <View style={styles.switchRow}>
          <Text style={styles.label}>Alert push</Text>
          <Switch
            value={pref?.enabled ?? true}
            onValueChange={(v) => updateMutation.mutate({ enabled: v })}
            trackColor={{ true: NN.signalDim, false: NN.borderStrong }}
            thumbColor={NN.signal}
          />
        </View>
        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Minimum önem derecesi</Text>
        {(["info", "warn", "crit"] as const).map((sev) => (
          <Pressable
            key={sev}
            style={[styles.sevOption, pref?.min_severity === sev && styles.sevActive]}
            onPress={() => updateMutation.mutate({ min_severity: sev })}
          >
            <Text style={[styles.sevText, pref?.min_severity === sev && styles.sevTextActive]}>{sev.toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.logoutBtn} onPress={handleLogout}>
        <Bot color="#fecaca" size={22} />
        <Text style={styles.logoutText}>Çıkış yap</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: NN.bg },
  kicker: { color: NN.dim, fontSize: 11, letterSpacing: 1.1, textTransform: "uppercase" },
  heading: { fontSize: 24, fontWeight: "700", color: NN.ink, marginTop: 2 },
  lead: { color: NN.muted, fontSize: 14, lineHeight: 21, marginTop: 10 },
  section: { backgroundColor: NN.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: NN.border },
  sectionTitle: { color: NN.dim, fontSize: 12, fontWeight: "700", marginBottom: 10, letterSpacing: 0.9, textTransform: "uppercase" },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: NN.border,
  },
  navRowLast: { borderBottomWidth: 0 },
  navIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: NN.bgElevated },
  navTitle: { color: NN.ink, fontSize: 15, fontWeight: "700" },
  navSub: { color: NN.muted, fontSize: 12, marginTop: 4, lineHeight: 17 },
  arrow: { color: NN.dim, fontSize: 22 },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  label: { color: NN.ink, fontSize: 15 },
  sevOption: {
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: NN.bgElevated,
    borderWidth: 1,
    borderColor: NN.border,
  },
  sevActive: { borderColor: NN.signal, backgroundColor: NN.signalDim },
  sevText: { color: NN.muted, fontSize: 14, fontWeight: "600" },
  sevTextActive: { color: NN.signal },
  serverHint: { color: NN.muted, fontSize: 12, lineHeight: 18, marginBottom: 10 },
  miniLabel: { color: NN.dim, fontSize: 11, marginBottom: 6, marginTop: 8, fontWeight: "600", textTransform: "uppercase" },
  serverInput: {
    backgroundColor: NN.bgElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: NN.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: NN.ink,
    fontSize: 14,
  },
  wsActive: { color: NN.signal, fontSize: 11, marginTop: 8, marginBottom: 10 },
  saveServerBtn: {
    alignSelf: "flex-start",
    backgroundColor: NN.signalDim,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: NN.signal + "44",
    marginTop: 4,
  },
  saveServerTxt: { color: NN.signal, fontWeight: "700" },
  logoutBtn: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#3a1616",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: NN.bad + "44",
    marginTop: 8,
  },
  logoutText: { color: "#fecaca", fontWeight: "700", fontSize: 16 },
});

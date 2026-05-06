import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert as RNAlert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { alertsApi } from "../../src/api/alerts";
import { servicesApi } from "../../src/api/services";
import { EmptyState } from "../../src/components/EmptyState";
import { NN } from "../../src/theme/tokens";
import type { Alert as ServiceAlert, Service } from "@nanonet/shared-types";

const SEVERITIES = ["all", "crit", "warn", "info"] as const;
type Filter = (typeof SEVERITIES)[number];

const SEV_COLOR: Record<string, string> = {
  crit: NN.bad,
  warn: NN.warn,
  info: "#5ec8ff",
};
const SEV_LABEL: Record<string, string> = {
  crit: "KRİTİK",
  warn: "UYARI",
  info: "BİLGİ",
};

export default function AlertsScreen() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");

  const { data: servicesData = [] } = useQuery({
    queryKey: ["services"],
    queryFn: servicesApi.list,
    staleTime: 60_000,
  });

  const serviceMap = Object.fromEntries((servicesData as Service[]).map((s) => [s.id, s.name]));

  const { data: alerts = [], isLoading, refetch } = useQuery({
    queryKey: ["alerts"],
    queryFn: () => alertsApi.list(),
    refetchInterval: 30_000,
  });

  const resolveM = useMutation({
    mutationFn: (alertId: string) => alertsApi.resolve(alertId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alerts"] }),
  });

  const filtered = filter === "all" ? alerts : alerts.filter((a) => a.severity === filter);

  const active = alerts.filter((a) => !a.resolved_at).length;

  const openSnooze = (alertId: string) => {
    RNAlert.alert("Erteleme", "Ne kadar süreyle susturulsun?", [
      { text: "15 dk", onPress: () => void alertsApi.snooze(alertId, 15).then(() => qc.invalidateQueries({ queryKey: ["alerts"] })) },
      { text: "60 dk", onPress: () => void alertsApi.snooze(alertId, 60).then(() => qc.invalidateQueries({ queryKey: ["alerts"] })) },
      { text: "İptal", style: "cancel" },
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.kicker}>Korelasyon için olay günlükleri</Text>
      <View style={styles.topBar}>
        <Text style={styles.heading}>Aktif riskler</Text>
        {active > 0 && (
          <View style={styles.activeBadge}>
            <Text style={styles.activeBadgeText}>{active} tetiklenmiş</Text>
          </View>
        )}
      </View>

      <View style={styles.filters}>
        {SEVERITIES.map((s) => (
          <Pressable key={s} style={[styles.chip, filter === s && styles.chipActive]} onPress={() => setFilter(s)}>
            <Text style={[styles.chipText, filter === s && styles.chipTextActive]}>
              {s === "all" ? "Tümü" : SEV_LABEL[s] ?? s.toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </View>

      {filtered.length === 0 && !isLoading ? (
        <EmptyState message="Uyarılı koşullar yakalanmadığında bu liste boştur." />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(a, i) => (a.id && a.id !== "00000000-0000-0000-0000-000000000000" ? a.id : `alert-${i}`)}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={NN.signal} />}
          renderItem={({ item }: { item: ServiceAlert }) => (
            <AlertCard
              alert={item}
              serviceName={serviceMap[item.service_id]}
              onResolve={() =>
                RNAlert.alert("Alert", "Çözüldü olarak işaretlensin mi?", [
                  { text: "İptal", style: "cancel" },
                  {
                    text: "Çöz",
                    onPress: () => resolveM.mutate(item.id),
                  },
                ])
              }
              onSnooze={() => openSnooze(item.id)}
            />
          )}
          contentContainerStyle={{ paddingBottom: 28 }}
        />
      )}
    </View>
  );
}

function AlertCard({
  alert,
  serviceName,
  onResolve,
  onSnooze,
}: {
  alert: ServiceAlert;
  serviceName?: string;
  onResolve: () => void;
  onSnooze: () => void;
}) {
  const color = SEV_COLOR[alert.severity] ?? NN.muted;
  const resolved = !!alert.resolved_at;
  return (
    <View style={[styles.card, { borderLeftColor: color }]}>
      <View style={styles.cardTop}>
        <View style={[styles.sevBadge, { borderColor: color + "55" }]}>
          <Text style={[styles.sevText, { color }]}>{SEV_LABEL[alert.severity] ?? alert.severity.toUpperCase()}</Text>
        </View>
        {resolved && (
          <View style={styles.resolvedBadge}>
            <Text style={styles.resolvedBadgeTxt}>ÇÖZÜLDÜ</Text>
          </View>
        )}
      </View>
      {serviceName && (
        <Text style={styles.svcTag} numberOfLines={1}>
          {serviceName}
        </Text>
      )}
      <Text style={styles.message}>{alert.message}</Text>
      <Text style={styles.kind}>{alert.type}</Text>
      <Text style={styles.time}>{new Date(alert.triggered_at).toLocaleString("tr-TR")}</Text>
      {!resolved && (
        <View style={styles.actions}>
          <Pressable style={styles.btnGhost} onPress={onSnooze}>
            <Text style={styles.btnGhostTxt}>Ertele</Text>
          </Pressable>
          <Pressable style={styles.btnSolid} onPress={onResolve}>
            <Text style={styles.btnSolidTxt}>Çözüldü</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: NN.bg, paddingTop: 16 },
  kicker: {
    paddingHorizontal: 16,
    color: NN.dim,
    fontSize: 11,
    letterSpacing: 1,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  heading: { fontSize: 22, fontWeight: "700", color: NN.ink },
  activeBadge: { backgroundColor: NN.bad + "22", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  activeBadgeText: { color: NN.bad, fontSize: 11, fontWeight: "700" },
  filters: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginBottom: 12 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: NN.surface,
    borderWidth: 1,
    borderColor: NN.border,
  },
  chipActive: { borderColor: NN.signal, backgroundColor: NN.signalDim },
  chipText: { color: NN.muted, fontSize: 12, fontWeight: "600" },
  chipTextActive: { color: NN.signal },
  card: {
    backgroundColor: NN.surface,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: NN.border,
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  sevBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, backgroundColor: NN.bgElevated },
  sevText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.4 },
  resolvedBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: NN.signalDim },
  resolvedBadgeTxt: { fontSize: 10, fontWeight: "700", color: NN.signal },
  svcTag: { fontSize: 12, color: NN.signal, marginBottom: 6, fontWeight: "600" },
  message: { color: NN.ink, fontSize: 14, marginBottom: 8, lineHeight: 21 },
  kind: { color: NN.dim, fontSize: 11, marginBottom: 6 },
  time: { color: NN.dim, fontSize: 11 },
  actions: { flexDirection: "row", gap: 10, marginTop: 12 },
  btnGhost: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: NN.border,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: NN.bgElevated,
  },
  btnGhostTxt: { color: NN.muted, fontWeight: "600" },
  btnSolid: { flex: 1, borderRadius: 8, paddingVertical: 10, alignItems: "center", backgroundColor: NN.signal },
  btnSolidTxt: { color: NN.bg, fontWeight: "700" },
});

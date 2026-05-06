import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { alertsApi } from "../../src/api/alerts";
import { servicesApi } from "../../src/api/services";
import { EmptyState } from "../../src/components/EmptyState";
import type { Alert, Service } from "@nanonet/shared-types";

const SEVERITIES = ["all", "crit", "warn", "info"] as const;
type Filter = (typeof SEVERITIES)[number];

const SEV_COLOR: Record<string, string> = {
  crit: "#ef4444",
  warn: "#f59e0b",
  info: "#3b82f6",
};
const SEV_LABEL: Record<string, string> = {
  crit: "KRİTİK",
  warn: "UYARI",
  info: "BİLGİ",
};

export default function AlertsScreen() {
  const [filter, setFilter] = useState<Filter>("all");

  const { data: servicesData = [] } = useQuery({
    queryKey: ["services"],
    queryFn: servicesApi.list,
    staleTime: 60_000,
  });

  const serviceMap = Object.fromEntries(
    (servicesData as Service[]).map((s) => [s.id, s.name])
  );

  const { data: alerts = [], isLoading, refetch } = useQuery({
    queryKey: ["alerts"],
    queryFn: () => alertsApi.list(),
    refetchInterval: 30_000,
  });

  const filtered = filter === "all" ? alerts : alerts.filter((a) => a.severity === filter);

  const active = alerts.filter((a) => !a.resolved_at).length;

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.heading}>Alertler</Text>
        {active > 0 && (
          <View style={styles.activeBadge}>
            <Text style={styles.activeBadgeText}>{active} aktif</Text>
          </View>
        )}
      </View>

      <View style={styles.filters}>
        {SEVERITIES.map((s) => (
          <Pressable
            key={s}
            style={[styles.chip, filter === s && styles.chipActive]}
            onPress={() => setFilter(s)}
          >
            <Text style={[styles.chipText, filter === s && styles.chipTextActive]}>
              {s === "all" ? "Tümü" : SEV_LABEL[s] ?? s.toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </View>

      {filtered.length === 0 && !isLoading ? (
        <EmptyState message="Alert bulunamadı." />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(a, i) =>
            a.id && a.id !== "00000000-0000-0000-0000-000000000000" ? a.id : `alert-${i}`
          }
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor="#3b82f6" />}
          renderItem={({ item }: { item: Alert }) => (
            <AlertCard alert={item} serviceName={serviceMap[item.service_id]} />
          )}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </View>
  );
}

function AlertCard({ alert, serviceName }: { alert: Alert; serviceName?: string }) {
  const color = SEV_COLOR[alert.severity] ?? "#94a3b8";
  const resolved = !!alert.resolved_at;
  return (
    <View style={[styles.card, { borderLeftColor: color, opacity: resolved ? 0.55 : 1 }]}>
      <View style={styles.cardTop}>
        <View style={[styles.sevBadge, { backgroundColor: color + "22" }]}>
          <Text style={[styles.sevText, { color }]}>
            {SEV_LABEL[alert.severity] ?? alert.severity.toUpperCase()}
          </Text>
        </View>
        {resolved && <Text style={styles.resolvedTag}>Çözüldü</Text>}
        {serviceName && (
          <Text style={styles.serviceTag} numberOfLines={1}>{serviceName}</Text>
        )}
      </View>
      <Text style={styles.message}>{alert.message}</Text>
      <Text style={styles.time}>{new Date(alert.triggered_at).toLocaleString("tr-TR")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", paddingTop: 16 },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, marginBottom: 12 },
  heading: { fontSize: 22, fontWeight: "700", color: "#f1f5f9" },
  activeBadge: { backgroundColor: "#ef444422", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  activeBadgeText: { color: "#ef4444", fontSize: 12, fontWeight: "600" },
  filters: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginBottom: 12 },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: "#1e293b" },
  chipActive: { backgroundColor: "#3b82f6" },
  chipText: { color: "#94a3b8", fontSize: 12, fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  card: { backgroundColor: "#1e293b", marginHorizontal: 16, marginBottom: 8, borderRadius: 12, padding: 14, borderLeftWidth: 3 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" },
  sevBadge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  sevText: { fontSize: 11, fontWeight: "700" },
  resolvedTag: { fontSize: 11, color: "#22c55e", backgroundColor: "#14532d33", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  serviceTag: { fontSize: 11, color: "#94a3b8", flex: 1 },
  message: { color: "#e2e8f0", fontSize: 14, marginBottom: 6, lineHeight: 20 },
  time: { color: "#64748b", fontSize: 11 },
});

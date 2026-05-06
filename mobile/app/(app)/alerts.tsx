import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { alertsApi } from "../../src/api/alerts";
import { EmptyState } from "../../src/components/EmptyState";
import type { Alert } from "@nanonet/shared-types";

const SEVERITIES = ["all", "crit", "warn", "info"] as const;
type Filter = (typeof SEVERITIES)[number];

const SEV_COLOR: Record<string, string> = { crit: "#ef4444", warn: "#f59e0b", info: "#3b82f6" };

export default function AlertsScreen() {
  const [filter, setFilter] = useState<Filter>("all");
  const { data: alerts = [], isLoading, refetch } = useQuery({
    queryKey: ["alerts"],
    queryFn: () => alertsApi.list(),
    refetchInterval: 30_000,
  });

  const filtered = filter === "all" ? alerts : alerts.filter((a) => a.severity === filter);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Alerts</Text>
      <View style={styles.filters}>
        {SEVERITIES.map((s) => (
          <Pressable
            key={s}
            style={[styles.chip, filter === s && styles.chipActive]}
            onPress={() => setFilter(s)}
          >
            <Text style={[styles.chipText, filter === s && styles.chipTextActive]}>
              {s.toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </View>
      {filtered.length === 0 && !isLoading ? (
        <EmptyState message="Alert bulunamadı." />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(a) => a.id}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
          renderItem={({ item }: { item: Alert }) => <AlertCard alert={item} />}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </View>
  );
}

function AlertCard({ alert }: { alert: Alert }) {
  const color = SEV_COLOR[alert.severity] ?? "#94a3b8";
  const resolved = !!alert.resolved_at;
  return (
    <View style={[styles.card, { borderLeftColor: color, opacity: resolved ? 0.6 : 1 }]}>
      <View style={styles.cardRow}>
        <Text style={[styles.severity, { color }]}>{alert.severity.toUpperCase()}</Text>
        {resolved && <Text style={styles.resolved}>Çözüldü</Text>}
      </View>
      <Text style={styles.message}>{alert.message}</Text>
      <Text style={styles.time}>{new Date(alert.triggered_at).toLocaleString()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", paddingTop: 16 },
  heading: { fontSize: 22, fontWeight: "700", color: "#f1f5f9", paddingHorizontal: 16, marginBottom: 12 },
  filters: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginBottom: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: "#1e293b" },
  chipActive: { backgroundColor: "#3b82f6" },
  chipText: { color: "#94a3b8", fontSize: 12, fontWeight: "600" },
  chipTextActive: { color: "#fff" },
  card: { backgroundColor: "#1e293b", marginHorizontal: 16, marginBottom: 10, borderRadius: 12, padding: 16, borderLeftWidth: 3 },
  cardRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  severity: { fontSize: 12, fontWeight: "700" },
  resolved: { fontSize: 12, color: "#64748b" },
  message: { color: "#e2e8f0", fontSize: 14, marginBottom: 6 },
  time: { color: "#64748b", fontSize: 12 },
});

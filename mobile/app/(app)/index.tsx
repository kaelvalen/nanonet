import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { EmptyState } from "../../src/components/EmptyState";
import { StatusBadge } from "../../src/components/StatusBadge";
import { servicesApi } from "../../src/api/services";
import { useWebSocket } from "../../src/hooks/useWebSocket";
import type { Service } from "@nanonet/shared-types";

const AGENT_COLOR: Record<string, string> = {
  healthy: "#22c55e",
  stale: "#f59e0b",
  down: "#ef4444",
  unknown: "#64748b",
};

export default function DashboardScreen() {
  useWebSocket();
  const router = useRouter();
  const { data: services = [], isLoading, refetch } = useQuery({
    queryKey: ["services"],
    queryFn: servicesApi.list,
    refetchInterval: 30_000,
  });

  const up = services.filter((s) => s.status === "up").length;
  const down = services.filter((s) => s.status === "down").length;
  const degraded = services.filter((s) => s.status === "degraded").length;

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.heading}>Servisler</Text>
        <Text style={styles.count}>{services.length} toplam</Text>
      </View>

      <View style={styles.summaryRow}>
        <SummaryPill label="Çalışıyor" value={up} color="#22c55e" />
        <SummaryPill label="Bozuk" value={down} color="#ef4444" />
        <SummaryPill label="Bozulan" value={degraded} color="#f59e0b" />
      </View>

      {services.length === 0 && !isLoading ? (
        <EmptyState message="Henüz servis eklenmemiş." />
      ) : (
        <FlatList
          data={services}
          keyExtractor={(s) => s.id}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor="#3b82f6" />}
          renderItem={({ item }: { item: Service }) => (
            <Pressable
              style={styles.card}
              onPress={() => router.push(`/(app)/services/${item.id}` as never)}
            >
              <View style={styles.cardHeader}>
                <View style={styles.cardLeft}>
                  <StatusDot status={item.status} />
                  <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                </View>
                <StatusBadge status={item.status} />
              </View>
              <Text style={styles.cardHost}>{item.host}:{item.port}</Text>
              <View style={styles.cardFooter}>
                {item.agent_connected ? (
                  <View style={styles.agentPill}>
                    <View style={[styles.agentDot, { backgroundColor: AGENT_COLOR[item.agent_status ?? "unknown"] }]} />
                    <Text style={styles.agentText}>
                      agent {item.agent_status ?? "unknown"}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.noAgent}>agent bağlı değil</Text>
                )}
                <Text style={styles.cardArrow}>›</Text>
              </View>
            </Pressable>
          )}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </View>
  );
}

function StatusDot({ status }: { status: Service["status"] }) {
  const color =
    status === "up" ? "#22c55e" :
    status === "degraded" ? "#f59e0b" :
    status === "down" ? "#ef4444" : "#64748b";
  return <View style={[styles.dot, { backgroundColor: color }]} />;
}

function SummaryPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[styles.pill, { borderColor: color + "33" }]}>
      <Text style={[styles.pillValue, { color }]}>{value}</Text>
      <Text style={styles.pillLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", paddingTop: 16 },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", paddingHorizontal: 16, marginBottom: 14 },
  heading: { fontSize: 22, fontWeight: "700", color: "#f1f5f9" },
  count: { fontSize: 13, color: "#64748b" },
  summaryRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginBottom: 16 },
  pill: { flex: 1, backgroundColor: "#1e293b", borderRadius: 10, padding: 10, alignItems: "center", borderWidth: 1 },
  pillValue: { fontSize: 20, fontWeight: "700" },
  pillLabel: { fontSize: 11, color: "#94a3b8", marginTop: 2 },
  card: { backgroundColor: "#1e293b", marginHorizontal: 16, marginBottom: 8, borderRadius: 12, padding: 14 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  cardLeft: { flexDirection: "row", alignItems: "center", flex: 1, gap: 8, marginRight: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  cardName: { fontSize: 15, fontWeight: "600", color: "#f1f5f9", flex: 1 },
  cardHost: { fontSize: 12, color: "#64748b", marginBottom: 8, marginLeft: 16 },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  agentPill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#0f172a", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  agentDot: { width: 6, height: 6, borderRadius: 3 },
  agentText: { fontSize: 11, color: "#94a3b8" },
  noAgent: { fontSize: 11, color: "#475569" },
  cardArrow: { color: "#475569", fontSize: 18 },
});

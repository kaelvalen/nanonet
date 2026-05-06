import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { EmptyState } from "../../src/components/EmptyState";
import { StatusBadge } from "../../src/components/StatusBadge";
import { servicesApi } from "../../src/api/services";
import { useWebSocket } from "../../src/hooks/useWebSocket";
import type { Service } from "@nanonet/shared-types";

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
      <Text style={styles.heading}>Dashboard</Text>
      <View style={styles.counters}>
        <Counter label="UP" value={up} color="#86efac" />
        <Counter label="DOWN" value={down} color="#fca5a5" />
        <Counter label="DEGRADED" value={degraded} color="#fcd34d" />
      </View>
      {services.length === 0 && !isLoading ? (
        <EmptyState message="Henüz servis yok." />
      ) : (
        <FlatList
          data={services}
          keyExtractor={(s) => s.id}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
          renderItem={({ item }: { item: Service }) => (
            <Pressable
              style={styles.card}
              onPress={() => router.push(`/(app)/services/${item.id}` as never)}
            >
              <View style={styles.cardRow}>
                <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                <StatusBadge status={item.status} />
              </View>
              <Text style={styles.cardHost}>{item.host}:{item.port}</Text>
            </Pressable>
          )}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </View>
  );
}

function Counter({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.counter}>
      <Text style={[styles.counterValue, { color }]}>{value}</Text>
      <Text style={styles.counterLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", paddingTop: 16 },
  heading: { fontSize: 22, fontWeight: "700", color: "#f1f5f9", paddingHorizontal: 16, marginBottom: 12 },
  counters: { flexDirection: "row", justifyContent: "space-around", marginBottom: 16, paddingHorizontal: 16 },
  counter: { alignItems: "center" },
  counterValue: { fontSize: 28, fontWeight: "700" },
  counterLabel: { fontSize: 12, color: "#64748b", marginTop: 2 },
  card: { backgroundColor: "#1e293b", marginHorizontal: 16, marginBottom: 10, borderRadius: 12, padding: 16 },
  cardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  cardName: { fontSize: 16, fontWeight: "600", color: "#f1f5f9", flex: 1, marginRight: 8 },
  cardHost: { fontSize: 13, color: "#64748b" },
});

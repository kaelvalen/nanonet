import { useQuery } from "@tanstack/react-query";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { sloApi, type SLOCompliance } from "../../src/api/slo";
import { EmptyState } from "../../src/components/EmptyState";

export default function SLOScreen() {
  const { data: slos = [], isLoading, refetch } = useQuery({
    queryKey: ["slo"],
    queryFn: sloApi.list,
  });

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>SLO</Text>
      {slos.length === 0 && !isLoading ? (
        <EmptyState message="SLO tanımlanmamış." />
      ) : (
        <FlatList
          data={slos}
          keyExtractor={(s) => s.slo.id}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
          renderItem={({ item }: { item: SLOCompliance }) => <SLOCard item={item} />}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </View>
  );
}

function SLOCard({ item }: { item: SLOCompliance }) {
  const ok = item.compliance_pct >= item.slo.target;
  const budgetColor =
    item.budget_remaining_pct > 20
      ? "#86efac"
      : item.budget_remaining_pct > 5
      ? "#fcd34d"
      : "#fca5a5";
  return (
    <View style={styles.card}>
      <Text style={styles.name}>{item.slo.name}</Text>
      <Text style={styles.type}>{item.slo.sli_type} · {item.slo.window_days}d window</Text>
      <View style={styles.row}>
        <Text style={styles.label}>Uyum</Text>
        <Text style={[styles.value, { color: ok ? "#86efac" : "#fca5a5" }]}>
          {item.compliance_pct.toFixed(2)}% / {item.slo.target}%
        </Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Hata Bütçesi</Text>
        <Text style={[styles.value, { color: budgetColor }]}>
          {item.budget_remaining_pct.toFixed(1)}% kaldı
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", paddingTop: 16 },
  heading: { fontSize: 22, fontWeight: "700", color: "#f1f5f9", paddingHorizontal: 16, marginBottom: 12 },
  card: { backgroundColor: "#1e293b", marginHorizontal: 16, marginBottom: 10, borderRadius: 12, padding: 16 },
  name: { color: "#f1f5f9", fontSize: 15, fontWeight: "600", marginBottom: 2 },
  type: { color: "#64748b", fontSize: 12, marginBottom: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  label: { color: "#94a3b8", fontSize: 13 },
  value: { fontSize: 13, fontWeight: "600" },
});

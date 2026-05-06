import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { sloApi, type SLOCompliance } from "../../src/api/slo";
import { EmptyState } from "../../src/components/EmptyState";
import { NN } from "../../src/theme/tokens";

export default function SLOScreen() {
  const { serviceId } = useLocalSearchParams<{ serviceId?: string }>();

  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ["slo-compliance", serviceId],
    queryFn: () => sloApi.listWithCompliance(serviceId),
  });

  return (
    <View style={styles.container}>
      <Text style={styles.kicker}>Hedefler ve bütçe</Text>
      <Text style={styles.heading}>SLO uyumu</Text>
      {serviceId && <Text style={styles.scope}>Bu ekran yalnızca seçilen servisin SLO’larını gösterir.</Text>}
      {rows.length === 0 && !isLoading ? (
        <EmptyState message="Tanımlı SLO bulunamadı — web konsolundan hedef oluşturun." />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.slo.id}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={NN.signal} />}
          renderItem={({ item }: { item: SLOCompliance }) => <ComplianceCard row={item} />}
          contentContainerStyle={{ paddingBottom: 28 }}
        />
      )}
    </View>
  );
}

function ComplianceCard({ row }: { row: SLOCompliance }) {
  const budgetRemaining = Math.max(0, 100 - row.error_budget_used);
  const budgetColor =
    budgetRemaining > 35 ? NN.ok : budgetRemaining > 12 ? NN.warn : NN.bad;
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.name}>{row.slo.name}</Text>
        <View style={[styles.pill, row.healthy ? styles.pillOk : styles.pillBad]}>
          <Text style={[styles.pillTxt, row.healthy ? styles.pillTxtOk : styles.pillTxtBad]}>
            {row.healthy ? "HEDEF İÇİNDE" : "RİSK"}
          </Text>
        </View>
      </View>
      <Text style={styles.meta}>
        {String(row.slo.sli_type)} · %{row.slo.target.toFixed(1)} · {row.slo.window_days} gün pencere
      </Text>
      <MetricRow label="Güncel SLI %" value={`${row.current_sli.toFixed(2)}%`} valueColor={NN.signal} />
      <MetricRow label="Hatalı örnek" value={`${row.bad_samples}/${row.total_samples}`} />
      <MetricRow label="Bütçe tüketimi %" value={`${row.error_budget_used.toFixed(1)}%`} valueColor={NN.warn} />
      <MetricRow label="Kalan bütçe (tahmini)" value={`~${budgetRemaining.toFixed(0)}%`} valueColor={budgetColor} />
      <MetricRow
        label="Burn rate"
        value={row.burn_rate.toFixed(2)}
        valueColor={row.burn_rate > 1 ? NN.bad : NN.muted}
      />
    </View>
  );
}

function MetricRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.lab}>{label}</Text>
      <Text style={[styles.val, valueColor ? { color: valueColor } : {}]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: NN.bg, paddingTop: 16 },
  kicker: { color: NN.dim, fontSize: 11, letterSpacing: 1.1, paddingHorizontal: 16, textTransform: "uppercase" },
  heading: { fontSize: 22, fontWeight: "700", color: NN.ink, paddingHorizontal: 16, marginBottom: 8 },
  scope: { color: NN.muted, fontSize: 12, paddingHorizontal: 16, marginBottom: 12 },
  card: {
    backgroundColor: NN.surface,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: NN.border,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 6 },
  name: { color: NN.ink, fontSize: 16, fontWeight: "700", flex: 1 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  pillOk: { backgroundColor: NN.signalDim },
  pillBad: { backgroundColor: NN.bad + "22" },
  pillTxt: { fontSize: 10, fontWeight: "700" },
  pillTxtOk: { color: NN.signal },
  pillTxtBad: { color: NN.bad },
  meta: { color: NN.muted, fontSize: 12, marginBottom: 14 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  lab: { color: NN.muted, fontSize: 13 },
  val: { color: NN.ink, fontSize: 13, fontWeight: "600", fontVariant: ["tabular-nums"] },
});

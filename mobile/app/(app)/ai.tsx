import { useQuery } from "@tanstack/react-query";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { aiApi } from "../../src/api/ai";
import { EmptyState } from "../../src/components/EmptyState";
import { NN } from "../../src/theme/tokens";
import type { AIInsight } from "@nanonet/shared-types";

export default function AIInsightsScreen() {
  const { data: insights = [], isLoading, refetch } = useQuery({
    queryKey: ["ai-insights"],
    queryFn: () => aiApi.insights(40),
    refetchInterval: 120_000,
  });

  return (
    <View style={styles.container}>
      <Text style={styles.kicker}>NanoNet · model destekli RCA</Text>
      <Text style={styles.heading}>Anomali özeti</Text>
      <Text style={styles.help}>
        Metrik korelasyonları ve geçmiş uyarılardan türetilmiş kısa aksiyon önerileri. Her içgörü ilgili bir alert kaydına bağlıdır.
      </Text>
      {insights.length === 0 && !isLoading ? (
        <EmptyState message="Henüz işlenmiş içgörü yok — uyarılar oluştuğunda veya manuel analiz çalıştığında buraya düşer." />
      ) : (
        <FlatList
          data={insights}
          keyExtractor={(i) => i.id}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={NN.signal} />}
          renderItem={({ item }: { item: AIInsight }) => <InsightCard item={item} />}
          contentContainerStyle={{ paddingBottom: 28 }}
        />
      )}
    </View>
  );
}

function InsightCard({ item }: { item: AIInsight }) {
  const pri = (p: string) => (p === "high" ? NN.bad : p === "medium" ? NN.warn : NN.muted);
  return (
    <View style={styles.card}>
      <Text style={styles.model}>{item.model}</Text>
      <Text style={styles.summary}>{item.summary}</Text>
      {item.root_cause ? <Text style={styles.cause}>Kök neden: {item.root_cause}</Text> : null}
      {(item.recommendations ?? []).slice(0, 3).map((r, i) => (
        <View key={i} style={styles.recRow}>
          <View style={[styles.priPill, { borderColor: pri(r.priority) }]}>
            <Text style={[styles.priTxt, { color: pri(r.priority) }]}>{r.priority.toUpperCase()}</Text>
          </View>
          <Text style={styles.rec}>{r.action}</Text>
        </View>
      ))}
      <Text style={styles.time}>{new Date(item.created_at).toLocaleString("tr-TR")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: NN.bg, paddingTop: 16 },
  kicker: { color: NN.dim, paddingHorizontal: 16, fontSize: 11, letterSpacing: 1.1, textTransform: "uppercase" },
  heading: { fontSize: 23, fontWeight: "700", color: NN.ink, paddingHorizontal: 16, marginBottom: 8 },
  help: {
    color: NN.muted,
    fontSize: 13,
    lineHeight: 19,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 12,
    padding: 16,
    backgroundColor: NN.surface,
    borderWidth: 1,
    borderColor: NN.border,
  },
  model: { fontSize: 11, color: NN.signal, marginBottom: 8, fontWeight: "700", letterSpacing: 0.8 },
  summary: { color: NN.ink, fontSize: 15, marginBottom: 10, lineHeight: 22 },
  cause: { color: NN.warn, fontSize: 13, marginBottom: 10, lineHeight: 19 },
  recRow: { flexDirection: "row", gap: 8, marginBottom: 8, alignItems: "flex-start" },
  priPill: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    backgroundColor: NN.bgElevated,
  },
  priTxt: { fontSize: 9, fontWeight: "700" },
  rec: { flex: 1, color: NN.muted, fontSize: 13, lineHeight: 19 },
  time: { color: NN.dim, fontSize: 11, marginTop: 8 },
});

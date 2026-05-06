import { useQuery } from "@tanstack/react-query";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { aiApi } from "../../src/api/ai";
import { EmptyState } from "../../src/components/EmptyState";
import type { AIInsight } from "@nanonet/shared-types";

export default function AIInsightsScreen() {
  const { data: insights = [], isLoading, refetch } = useQuery({
    queryKey: ["ai-insights"],
    queryFn: aiApi.insights,
    refetchInterval: 120_000,
  });

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>AI Insights</Text>
      {insights.length === 0 && !isLoading ? (
        <EmptyState message="Henüz AI analizi yok." />
      ) : (
        <FlatList
          data={insights}
          keyExtractor={(i) => i.id}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
          renderItem={({ item }: { item: AIInsight }) => <InsightCard item={item} />}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </View>
  );
}

function InsightCard({ item }: { item: AIInsight }) {
  return (
    <View style={styles.card}>
      <Text style={styles.summary}>{item.summary}</Text>
      {item.root_cause && (
        <Text style={styles.cause}>Kök neden: {item.root_cause}</Text>
      )}
      {item.recommendations?.slice(0, 2).map((r, i) => (
        <Text key={i} style={styles.rec}>• {r.action}</Text>
      ))}
      <Text style={styles.time}>{new Date(item.created_at).toLocaleString()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", paddingTop: 16 },
  heading: { fontSize: 22, fontWeight: "700", color: "#f1f5f9", paddingHorizontal: 16, marginBottom: 12 },
  card: { backgroundColor: "#1e293b", marginHorizontal: 16, marginBottom: 10, borderRadius: 12, padding: 16 },
  summary: { color: "#e2e8f0", fontSize: 14, marginBottom: 8 },
  cause: { color: "#f59e0b", fontSize: 13, marginBottom: 6 },
  rec: { color: "#94a3b8", fontSize: 13, marginBottom: 3 },
  time: { color: "#64748b", fontSize: 11, marginTop: 8 },
});

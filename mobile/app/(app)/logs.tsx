import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { logsApi } from "../../src/api/logs";
import { EmptyState } from "../../src/components/EmptyState";
import type { ServiceLog } from "@nanonet/shared-types";

const LEVEL_COLOR: Record<string, string> = {
  error: "#ef4444", warn: "#f59e0b", info: "#3b82f6", debug: "#64748b",
};

export default function LogsScreen() {
  const { serviceId } = useLocalSearchParams<{ serviceId?: string }>();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["logs", serviceId],
    queryFn: () => logsApi.list({ serviceId }),
    refetchInterval: 30_000,
  });

  const logs = data?.logs ?? [];

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Logs</Text>
      {logs.length === 0 && !isLoading ? (
        <EmptyState message="Log bulunamadı." />
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(l) => l.id}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
          renderItem={({ item }: { item: ServiceLog }) => <LogRow log={item} />}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </View>
  );
}

function LogRow({ log }: { log: ServiceLog }) {
  const color = LEVEL_COLOR[log.level] ?? "#94a3b8";
  return (
    <View style={styles.row}>
      <Text style={[styles.level, { color }]}>{log.level.toUpperCase()}</Text>
      <Text style={styles.message} numberOfLines={3}>{log.message}</Text>
      <Text style={styles.time}>{new Date(log.time).toLocaleTimeString()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", paddingTop: 16 },
  heading: { fontSize: 22, fontWeight: "700", color: "#f1f5f9", paddingHorizontal: 16, marginBottom: 12 },
  row: { borderBottomWidth: 1, borderBottomColor: "#1e293b", paddingHorizontal: 16, paddingVertical: 10 },
  level: { fontSize: 10, fontWeight: "700", marginBottom: 2 },
  message: { color: "#e2e8f0", fontSize: 13, fontFamily: "monospace", marginBottom: 4 },
  time: { color: "#64748b", fontSize: 11 },
});

import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { logsApi } from "../../src/api/logs";
import { servicesApi } from "../../src/api/services";
import { EmptyState } from "../../src/components/EmptyState";
import type { Service, ServiceLog } from "@nanonet/shared-types";

const LEVEL_COLOR: Record<string, string> = {
  error: "#ef4444",
  warn: "#f59e0b",
  info: "#3b82f6",
  debug: "#64748b",
};

const SOURCE_LABEL: Record<string, string> = {
  agent: "agent",
  system: "system",
  k8s: "k8s",
  health_check: "health",
  command: "cmd",
};

export default function LogsScreen() {
  const { serviceId } = useLocalSearchParams<{ serviceId?: string }>();

  const { data: servicesData = [] } = useQuery({
    queryKey: ["services"],
    queryFn: servicesApi.list,
    staleTime: 60_000,
  });

  const serviceMap = Object.fromEntries(
    (servicesData as Service[]).map((s) => [s.id, s.name])
  );

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["logs", serviceId],
    queryFn: () => logsApi.list({ serviceId }),
    refetchInterval: 30_000,
  });

  const logs = data?.logs ?? [];

  const filteredServiceName = serviceId ? serviceMap[serviceId] : null;

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.heading}>Loglar</Text>
        {filteredServiceName && (
          <Text style={styles.filterTag}>{filteredServiceName}</Text>
        )}
      </View>
      {logs.length === 0 && !isLoading ? (
        <EmptyState message="Log bulunamadı." />
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(l, i) =>
            l.id && l.id !== "00000000-0000-0000-0000-000000000000" ? l.id : `log-${i}`
          }
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor="#3b82f6" />}
          renderItem={({ item }: { item: ServiceLog }) => (
            <LogRow log={item} serviceName={serviceMap[item.service_id]} />
          )}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </View>
  );
}

function LogRow({ log, serviceName }: { log: ServiceLog; serviceName?: string }) {
  const color = LEVEL_COLOR[log.level] ?? "#94a3b8";
  const sourceLabel = SOURCE_LABEL[log.source] ?? log.source;
  return (
    <View style={styles.row}>
      <View style={styles.rowMeta}>
        <View style={[styles.levelBadge, { backgroundColor: color + "22" }]}>
          <Text style={[styles.level, { color }]}>{log.level.toUpperCase()}</Text>
        </View>
        <Text style={styles.source}>{sourceLabel}</Text>
        {serviceName && <Text style={styles.serviceName} numberOfLines={1}>{serviceName}</Text>}
        <Text style={styles.time}>{new Date(log.time).toLocaleTimeString()}</Text>
      </View>
      <Text style={styles.message} numberOfLines={4}>{log.message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", paddingTop: 16 },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, marginBottom: 12 },
  heading: { fontSize: 22, fontWeight: "700", color: "#f1f5f9" },
  filterTag: { fontSize: 12, color: "#3b82f6", backgroundColor: "#1e3a5f", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  row: { borderBottomWidth: 1, borderBottomColor: "#1e293b", paddingHorizontal: 16, paddingVertical: 10 },
  rowMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" },
  levelBadge: { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  level: { fontSize: 10, fontWeight: "700" },
  source: { fontSize: 10, color: "#64748b", backgroundColor: "#1e293b", paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  serviceName: { fontSize: 11, color: "#94a3b8", flex: 1 },
  time: { fontSize: 10, color: "#475569" },
  message: { color: "#e2e8f0", fontSize: 13, fontFamily: "monospace" },
});

import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBadge } from "../../../src/components/StatusBadge";
import { MetricChart } from "../../../src/components/MetricChart";
import { servicesApi } from "../../../src/api/services";
import type { ServiceMetrics } from "@nanonet/shared-types";

export default function ServiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data: service } = useQuery({
    queryKey: ["service", id],
    queryFn: () => servicesApi.get(id),
    enabled: !!id,
  });

  const { data: metrics = [] } = useQuery({
    queryKey: ["serviceMetrics", id],
    queryFn: () => servicesApi.metrics(id),
    enabled: !!id,
    refetchInterval: 60_000,
  });

  const toChartData = (key: keyof ServiceMetrics) =>
    metrics.map((m, i) => ({ x: i, y: Number(m[key] ?? 0) }));

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 32 }}>
      <View style={styles.header}>
        <Text style={styles.name}>{service?.name ?? "…"}</Text>
        {service && <StatusBadge status={service.status} />}
      </View>
      <Text style={styles.host}>{service?.host}:{service?.port}</Text>

      <ChartSection label="CPU %" data={toChartData("cpu_percent")} color="#3b82f6" />
      <ChartSection label="Memory (MB)" data={toChartData("memory_used_mb")} color="#8b5cf6" />
      <ChartSection label="Latency (ms)" data={toChartData("latency_ms")} color="#10b981" />
      <ChartSection label="Error Rate" data={toChartData("error_rate")} color="#ef4444" />

      {service?.agent_connected && (
        <View style={styles.agentRow}>
          <Text style={styles.agentLabel}>Agent</Text>
          <Text style={styles.agentValue}>
            {service.agent_status ?? "unknown"} · v{service.agent_version}
          </Text>
        </View>
      )}

      <Pressable
        style={styles.link}
        onPress={() => router.push({ pathname: "/(app)/logs", params: { serviceId: id } } as never)}
      >
        <Text style={styles.linkText}>Loglara git →</Text>
      </Pressable>

      <Pressable
        style={styles.link}
        onPress={() => router.push({ pathname: "/(app)/slo", params: { serviceId: id } } as never)}
      >
        <Text style={styles.linkText}>SLO →</Text>
      </Pressable>
    </ScrollView>
  );
}

function ChartSection({ label, data, color }: { label: string; data: { x: number; y: number }[]; color: string }) {
  return (
    <View style={{ marginBottom: 20, paddingHorizontal: 16 }}>
      <Text style={{ color: "#94a3b8", fontSize: 13, marginBottom: 8 }}>{label}</Text>
      <MetricChart data={data} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, paddingBottom: 4 },
  name: { fontSize: 20, fontWeight: "700", color: "#f1f5f9", flex: 1 },
  host: { color: "#64748b", fontSize: 13, paddingHorizontal: 16, marginBottom: 20 },
  agentRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#1e293b", marginHorizontal: 16, borderRadius: 10, marginBottom: 12 },
  agentLabel: { color: "#94a3b8", fontSize: 14 },
  agentValue: { color: "#f1f5f9", fontSize: 14 },
  link: { marginHorizontal: 16, marginTop: 8 },
  linkText: { color: "#3b82f6", fontSize: 15 },
});

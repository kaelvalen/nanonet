import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ActivityIndicator } from "react-native";
import { useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Radio, Layers } from "lucide-react-native";
import { AddServiceModal } from "../../src/components/AddServiceModal";
import { EmptyState } from "../../src/components/EmptyState";
import { StatusBadge } from "../../src/components/StatusBadge";
import { servicesApi } from "../../src/api/services";
import { useWsStore } from "../../src/store/wsStore";
import { NN } from "../../src/theme/tokens";
import type { Service } from "@nanonet/shared-types";

const AGENT_COLOR: Record<string, string> = {
  healthy: NN.ok,
  stale: NN.warn,
  down: NN.bad,
  unknown: NN.dim,
};

export default function DashboardScreen() {
  const wsLive = useWsStore((s) => s.connected);
  const router = useRouter();
  const [modal, setModal] = useState(false);

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
        <View>
          <Text style={styles.kicker}>NanoNet · Telemetry</Text>
          <Text style={styles.heading}>Servis durumu</Text>
        </View>
        <View style={styles.topRight}>
          <View style={[styles.livePill, wsLive ? styles.liveOn : styles.liveOff]}>
            <Radio size={14} color={wsLive ? NN.signal : NN.dim} />
            <Text style={[styles.liveText, wsLive ? { color: NN.signal } : { color: NN.dim }]}>
              {wsLive ? "CANLI METRİK" : "BAĞLANTI YOK"}
            </Text>
          </View>
          {isLoading && <ActivityIndicator color={NN.signal} style={{ marginLeft: 10 }} />}
        </View>
      </View>

      <Text style={styles.summaryHint}>
        Toplam <Text style={{ color: NN.ink, fontWeight: "700" }}>{services.length}</Text> kayıtlı servis · health + agent özeti
      </Text>

      <View style={styles.summaryRow}>
        <SummaryPill label="Healthy" value={up} color={NN.ok} />
        <SummaryPill label="Down" value={down} color={NN.bad} />
        <SummaryPill label="Risk" value={degraded} color={NN.warn} />
      </View>

      <Pressable style={styles.addRow} onPress={() => setModal(true)}>
        <Layers size={20} color={NN.signal} />
        <Text style={styles.addText}>Bu kümeye izlenen servis ekle</Text>
      </Pressable>

      <AddServiceModal visible={modal} onClose={() => setModal(false)} />

      {services.length === 0 && !isLoading ? (
        <EmptyState title="Kayıtlı servis yok" message="Agent ve health endpoint bağlayarak izlemeyi başlatın." />
      ) : (
        <FlatList
          data={services}
          keyExtractor={(s) => s.id}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={NN.signal} />}
          renderItem={({ item }: { item: Service }) => (
            <Pressable style={styles.card} onPress={() => router.push(`/(app)/services/${item.id}` as never)}>
              <View style={styles.cardHeader}>
                <View style={styles.cardLeft}>
                  <StatusDot status={item.status} />
                  <Text style={styles.cardName} numberOfLines={1}>
                    {item.name}
                  </Text>
                </View>
                <StatusBadge status={item.status} />
              </View>
              <Text style={styles.mono}>
                {item.host}:{item.port}{item.health_endpoint}
              </Text>
              <View style={styles.cardFooter}>
                {item.agent_connected ? (
                  <View style={styles.agentPill}>
                    <View style={[styles.agentDot, { backgroundColor: AGENT_COLOR[item.agent_status ?? "unknown"] }]} />
                    <Text style={styles.agentText}>agent · {item.agent_status ?? "?"}</Text>
                  </View>
                ) : (
                  <Text style={styles.noAgent}>Agent bağlantısı yok</Text>
                )}
                <Text style={styles.arrow}>›</Text>
              </View>
            </Pressable>
          )}
          contentContainerStyle={{ paddingBottom: 96 }}
        />
      )}

      <Pressable style={styles.fab} onPress={() => setModal(true)} accessibilityLabel="servis ekle">
        <Text style={styles.fabPlus}>+</Text>
      </Pressable>
    </View>
  );
}

function StatusDot({ status }: { status: Service["status"] }) {
  const color =
    status === "up" ? NN.ok : status === "degraded" ? NN.warn : status === "down" ? NN.bad : NN.dim;
  return <View style={[styles.dot, { backgroundColor: color }]} />;
}

function SummaryPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={[styles.pill, { borderColor: color + "44" }]}>
      <Text style={[styles.pillValue, { color }]}>{value}</Text>
      <Text style={styles.pillLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: NN.bg, paddingTop: 14 },
  topBar: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16, marginBottom: 6 },
  kicker: { color: NN.dim, fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase" },
  heading: { fontSize: 22, fontWeight: "700", color: NN.ink, marginTop: 2 },
  topRight: { flexDirection: "row", alignItems: "center" },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  liveOn: { borderColor: NN.signal + "55", backgroundColor: NN.signalDim },
  liveOff: { borderColor: NN.border, backgroundColor: NN.bgElevated },
  liveText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6 },
  summaryHint: { color: NN.muted, fontSize: 13, paddingHorizontal: 16, marginBottom: 12 },
  summaryRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginBottom: 12 },
  pill: { flex: 1, backgroundColor: NN.surface, borderRadius: 10, padding: 10, alignItems: "center", borderWidth: 1 },
  pillValue: { fontSize: 20, fontWeight: "700" },
  pillLabel: { fontSize: 11, color: NN.muted, marginTop: 2 },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: NN.border,
    backgroundColor: NN.bgElevated,
  },
  addText: { color: NN.signal, fontWeight: "600", fontSize: 14 },
  card: {
    backgroundColor: NN.surface,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: NN.border,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  cardLeft: { flexDirection: "row", alignItems: "center", flex: 1, gap: 8, marginRight: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  cardName: { fontSize: 15, fontWeight: "600", color: NN.ink, flex: 1 },
  mono: { fontSize: 12, color: NN.muted, marginBottom: 8, marginLeft: 16, fontVariant: ["tabular-nums"] },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  agentPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: NN.bgElevated,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: NN.border,
  },
  agentDot: { width: 6, height: 6, borderRadius: 3 },
  agentText: { fontSize: 11, color: NN.muted },
  noAgent: { fontSize: 11, color: NN.dim },
  arrow: { color: NN.dim, fontSize: 18 },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: NN.signal,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: NN.signal,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  fabPlus: { color: NN.bg, fontSize: 30, fontWeight: "300", marginTop: -2 },
});

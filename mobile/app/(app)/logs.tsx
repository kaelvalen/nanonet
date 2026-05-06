import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Filter } from "lucide-react-native";
import { logsApi } from "../../src/api/logs";
import { servicesApi } from "../../src/api/services";
import { EmptyState } from "../../src/components/EmptyState";
import { NN } from "../../src/theme/tokens";
import type { Service, ServiceLog } from "@nanonet/shared-types";

const LEVEL_COLOR: Record<string, string> = {
  error: NN.bad,
  warn: NN.warn,
  info: "#5ec8ff",
  debug: NN.dim,
};

const SOURCE_LABEL: Record<string, string> = {
  agent: "agent",
  system: "system",
  k8s: "k8s",
  health_check: "health",
  command: "cmd",
};

export default function LogsScreen() {
  const { serviceId: routeServiceId } = useLocalSearchParams<{ serviceId?: string }>();
  const [pickedId, setPickedId] = useState<string | undefined>(routeServiceId);
  const [filterOpen, setFilterOpen] = useState(false);

  const effectiveId = pickedId ?? routeServiceId;

  const { data: servicesData = [] } = useQuery({
    queryKey: ["services"],
    queryFn: servicesApi.list,
    staleTime: 60_000,
  });

  const serviceMap = useMemo(() => Object.fromEntries((servicesData as Service[]).map((s) => [s.id, s.name])), [servicesData]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["logs", effectiveId],
    queryFn: () => logsApi.list({ serviceId: effectiveId }),
    refetchInterval: 30_000,
  });

  const logs = data?.logs ?? [];

  const filterLabel =
    effectiveId === undefined ? "Tüm servisler" : serviceMap[effectiveId] ?? "Tek servis";

  return (
    <View style={styles.container}>
      <Text style={styles.kicker}>Tanıklık günlükleri · agent / health / kubectl</Text>
      <View style={styles.topBar}>
        <Text style={styles.heading}>Log akışı</Text>
      </View>
      <Pressable style={styles.filterChip} onPress={() => setFilterOpen(true)}>
        <Filter color={NN.signal} size={18} />
        <Text style={styles.filterLabel}>{filterLabel}</Text>
        <Text style={styles.filterHint}>filtre ›</Text>
      </Pressable>

      <Modal visible={filterOpen} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Servis filtresi</Text>
            <Pressable
              style={[styles.pick, !effectiveId && styles.pickOn]}
              onPress={() => {
                setPickedId(undefined);
                setFilterOpen(false);
              }}
            >
              <Text style={[styles.pickTxt, !effectiveId && styles.pickTxtOn]}>Tüm servisler</Text>
            </Pressable>
            {(servicesData as Service[]).map((s) => (
              <Pressable
                key={s.id}
                style={[styles.pick, effectiveId === s.id && styles.pickOn]}
                onPress={() => {
                  setPickedId(s.id);
                  setFilterOpen(false);
                }}
              >
                <Text style={[styles.pickTxt, effectiveId === s.id && styles.pickTxtOn]} numberOfLines={1}>
                  {s.name}
                </Text>
                <Text style={styles.pickSub}>{s.host}</Text>
              </Pressable>
            ))}
            <Pressable style={styles.sheetCancel} onPress={() => setFilterOpen(false)}>
              <Text style={styles.sheetCancelTxt}>Kapat</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {logs.length === 0 && !isLoading ? (
        <EmptyState message="Henüz log satırı yok ya da seçiminiz filtreliyor." />
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(l, i) => (l.id && l.id !== "00000000-0000-0000-0000-000000000000" ? l.id : `log-${i}`)}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={NN.signal} />}
          renderItem={({ item }: { item: ServiceLog }) => (
            <LogRow log={item} serviceName={serviceMap[item.service_id]} />
          )}
          contentContainerStyle={{ paddingBottom: 28 }}
        />
      )}
    </View>
  );
}

function LogRow({ log, serviceName }: { log: ServiceLog; serviceName?: string }) {
  const color = LEVEL_COLOR[log.level] ?? NN.muted;
  const sourceLabel = SOURCE_LABEL[log.source] ?? log.source;
  return (
    <View style={styles.row}>
      <View style={styles.rowMeta}>
        <View style={[styles.levelBadge, { borderColor: color + "55" }]}>
          <Text style={[styles.level, { color }]}>{log.level.toUpperCase()}</Text>
        </View>
        <Text style={styles.source}>{sourceLabel}</Text>
        {serviceName ? (
          <Text style={styles.serviceName} numberOfLines={1}>
            {serviceName}
          </Text>
        ) : null}
        <Text style={styles.time}>{new Date(log.time).toLocaleTimeString()}</Text>
      </View>
      <Text style={styles.message} numberOfLines={5}>
        {log.message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: NN.bg, paddingTop: 16 },
  kicker: { color: NN.dim, fontSize: 11, letterSpacing: 0.9, paddingHorizontal: 16, marginBottom: 8, textTransform: "uppercase" },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, marginBottom: 8 },
  heading: { fontSize: 22, fontWeight: "700", color: NN.ink },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: NN.border,
    backgroundColor: NN.surface,
  },
  filterLabel: { flex: 1, color: NN.ink, fontWeight: "600" },
  filterHint: { color: NN.dim },
  modalBg: { flex: 1, justifyContent: "flex-end", backgroundColor: NN.overlay },
  sheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 18,
    maxHeight: "70%",
    backgroundColor: NN.surface,
    borderWidth: 1,
    borderColor: NN.border,
  },
  sheetTitle: { color: NN.ink, fontSize: 17, fontWeight: "700", marginBottom: 12 },
  pick: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: NN.border,
    marginBottom: 8,
    backgroundColor: NN.bgElevated,
  },
  pickOn: { borderColor: NN.signal, backgroundColor: NN.signalDim },
  pickTxt: { color: NN.ink, fontWeight: "600" },
  pickTxtOn: { color: NN.signal },
  pickSub: { color: NN.dim, fontSize: 12, marginTop: 2 },
  sheetCancel: { marginTop: 8, alignItems: "center", padding: 14 },
  sheetCancelTxt: { color: NN.muted, fontWeight: "600" },
  row: { borderBottomWidth: 1, borderBottomColor: NN.border, paddingHorizontal: 16, paddingVertical: 12 },
  rowMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8, flexWrap: "wrap" },
  levelBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, backgroundColor: NN.bgElevated },
  level: { fontSize: 10, fontWeight: "700" },
  source: {
    fontSize: 11,
    color: NN.dim,
    backgroundColor: NN.bgElevated,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: NN.border,
  },
  serviceName: { fontSize: 11, color: NN.muted, flex: 1 },
  time: { fontSize: 10, color: NN.dim, fontVariant: ["tabular-nums"] },
  message: { color: NN.ink, fontSize: 13, lineHeight: 18 },
});

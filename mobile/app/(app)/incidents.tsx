import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, FlatList, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { incidentsApi, type IncidentListItem } from "../../src/api/incidents";
import { EmptyState } from "../../src/components/EmptyState";
import { NN } from "../../src/theme/tokens";

const SEV_COLOR: Record<string, string> = { crit: NN.bad, warn: NN.warn, info: "#5ec8ff" };

export default function IncidentsScreen() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<IncidentListItem | null>(null);

  const { data: incidents = [], isLoading, refetch } = useQuery({
    queryKey: ["incidents"],
    queryFn: incidentsApi.list,
    refetchInterval: 60_000,
  });

  const resolveM = useMutation({
    mutationFn: (id: string) => incidentsApi.resolve(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["incidents"] });
      setSelected(null);
    },
  });

  const askResolve = (row: IncidentListItem) => {
    if (row.resolved_at) return;
    Alert.alert("Incident", "Çözüldü olarak kapatılsın mı?", [
      { text: "İptal", style: "cancel" },
      { text: "Kapat", onPress: () => resolveM.mutate(row.id) },
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.kicker}>Birden çok alert grubu</Text>
      <Text style={styles.heading}>Incident merkezi</Text>
      {incidents.length === 0 && !isLoading ? (
        <EmptyState message="Açık incident yok — operasyonel gürültü temiz." />
      ) : (
        <FlatList
          data={incidents}
          keyExtractor={(i, idx) =>
            i.id && i.id !== "00000000-0000-0000-0000-000000000000" ? i.id : `inc-${idx}`
          }
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={NN.signal} />}
          renderItem={({ item }: { item: IncidentListItem }) => (
            <Pressable
              style={[styles.card, { borderLeftColor: SEV_COLOR[item.severity] ?? NN.muted }]}
              onPress={() => setSelected(item)}
            >
              <Text style={[styles.sev, { color: SEV_COLOR[item.severity] }]}>
                {(item.severity ?? "").toUpperCase()}
              </Text>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.sub}>
                {item.service_name} · {item.alert_count} ilişkili alert
              </Text>
              <Text style={styles.time}>{new Date(item.started_at).toLocaleString("tr-TR")}</Text>
            </Pressable>
          )}
          contentContainerStyle={{ paddingBottom: 28 }}
        />
      )}
      <Modal
        visible={!!selected}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelected(null)}
      >
        <ScrollView style={styles.modal} contentContainerStyle={{ paddingBottom: 32 }}>
          <Pressable onPress={() => setSelected(null)}>
            <Text style={styles.close}>Kapat</Text>
          </Pressable>
          {selected && (
            <>
              <Text style={styles.modalTitle}>{selected.title}</Text>
              <Text style={styles.modalSub}>{selected.service_name}</Text>
              <Text style={styles.modalMeta}>Başladı: {new Date(selected.started_at).toLocaleString("tr-TR")}</Text>
              {selected.resolved_at ? (
                <Text style={styles.modalMeta}>Çözüldü: {new Date(selected.resolved_at).toLocaleString("tr-TR")}</Text>
              ) : null}
              <Text style={styles.modalMeta}>{selected.alert_count} ilişkili alert</Text>
              {!selected.resolved_at && (
                <Pressable
                  style={[styles.resolveBtn, resolveM.isPending && { opacity: 0.65 }]}
                  disabled={resolveM.isPending}
                  onPress={() => askResolve(selected)}
                >
                  <Text style={styles.resolveBtnTxt}>Incident’i çöz</Text>
                </Pressable>
              )}
            </>
          )}
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: NN.bg, paddingTop: 16 },
  kicker: { color: NN.dim, paddingHorizontal: 16, fontSize: 11, letterSpacing: 1, textTransform: "uppercase" },
  heading: { fontSize: 22, fontWeight: "700", color: NN.ink, paddingHorizontal: 16, marginBottom: 14 },
  card: {
    backgroundColor: NN.surface,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: NN.border,
  },
  sev: { fontSize: 11, fontWeight: "700", marginBottom: 6, letterSpacing: 0.6 },
  title: { color: NN.ink, fontSize: 15, fontWeight: "600", marginBottom: 4 },
  sub: { color: NN.muted, fontSize: 13, marginBottom: 8 },
  time: { color: NN.dim, fontSize: 12 },
  modal: { flex: 1, backgroundColor: NN.bg, padding: 24 },
  close: { color: NN.muted, fontSize: 15, marginBottom: 20 },
  modalTitle: { color: NN.ink, fontSize: 21, fontWeight: "700", marginBottom: 8 },
  modalSub: { color: NN.muted, fontSize: 14, marginBottom: 16 },
  modalMeta: { color: NN.dim, fontSize: 14, marginBottom: 8 },
  resolveBtn: {
    marginTop: 20,
    backgroundColor: NN.signal,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  resolveBtnTxt: { color: NN.bg, fontWeight: "700" },
});

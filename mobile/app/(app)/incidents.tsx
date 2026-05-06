import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { FlatList, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { incidentsApi, type IncidentListItem } from "../../src/api/incidents";
import { EmptyState } from "../../src/components/EmptyState";

const SEV_COLOR: Record<string, string> = { crit: "#ef4444", warn: "#f59e0b", info: "#3b82f6" };

export default function IncidentsScreen() {
  const [selected, setSelected] = useState<IncidentListItem | null>(null);
  const { data: incidents = [], isLoading, refetch } = useQuery({
    queryKey: ["incidents"],
    queryFn: incidentsApi.list,
    refetchInterval: 60_000,
  });

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Incidents</Text>
      {incidents.length === 0 && !isLoading ? (
        <EmptyState message="Aktif incident yok." />
      ) : (
        <FlatList
          data={incidents}
          keyExtractor={(i, idx) =>
            i.id && i.id !== "00000000-0000-0000-0000-000000000000" ? i.id : `inc-${idx}`
          }
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
          renderItem={({ item }: { item: IncidentListItem }) => (
            <Pressable
              style={[styles.card, { borderLeftColor: SEV_COLOR[item.severity] ?? "#94a3b8" }]}
              onPress={() => setSelected(item)}
            >
              <Text style={[styles.sev, { color: SEV_COLOR[item.severity] }]}>
                {item.severity.toUpperCase()}
              </Text>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.sub}>{item.service_name} · {item.alert_count} alert</Text>
              <Text style={styles.time}>{new Date(item.started_at).toLocaleString()}</Text>
            </Pressable>
          )}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
      <Modal
        visible={!!selected}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelected(null)}
      >
        <ScrollView style={styles.modal}>
          <Pressable onPress={() => setSelected(null)}>
            <Text style={styles.close}>✕ Kapat</Text>
          </Pressable>
          {selected && (
            <>
              <Text style={styles.modalTitle}>{selected.title}</Text>
              <Text style={styles.modalSub}>{selected.service_name}</Text>
              <Text style={styles.modalMeta}>
                Başladı: {new Date(selected.started_at).toLocaleString()}
              </Text>
              {selected.resolved_at && (
                <Text style={styles.modalMeta}>
                  Çözüldü: {new Date(selected.resolved_at).toLocaleString()}
                </Text>
              )}
              <Text style={styles.modalMeta}>{selected.alert_count} ilişkili alert</Text>
            </>
          )}
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", paddingTop: 16 },
  heading: { fontSize: 22, fontWeight: "700", color: "#f1f5f9", paddingHorizontal: 16, marginBottom: 12 },
  card: { backgroundColor: "#1e293b", marginHorizontal: 16, marginBottom: 10, borderRadius: 12, padding: 16, borderLeftWidth: 3 },
  sev: { fontSize: 11, fontWeight: "700", marginBottom: 4 },
  title: { color: "#f1f5f9", fontSize: 15, fontWeight: "600", marginBottom: 2 },
  sub: { color: "#94a3b8", fontSize: 13, marginBottom: 4 },
  time: { color: "#64748b", fontSize: 12 },
  modal: { flex: 1, backgroundColor: "#0f172a", padding: 24 },
  close: { color: "#64748b", fontSize: 15, marginBottom: 20 },
  modalTitle: { color: "#f1f5f9", fontSize: 20, fontWeight: "700", marginBottom: 8 },
  modalSub: { color: "#94a3b8", fontSize: 14, marginBottom: 16 },
  modalMeta: { color: "#64748b", fontSize: 14, marginBottom: 8 },
});

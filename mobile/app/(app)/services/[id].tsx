import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Play, Power, Radio, RefreshCw } from "lucide-react-native";
import { MonitoringSparkline, type SeriesPoint } from "../../../src/components/MonitoringSparkline";
import { StatusBadge } from "../../../src/components/StatusBadge";
import { servicesApi } from "../../../src/api/services";
import { NN } from "../../../src/theme/tokens";
import type { CommandLog, ServiceMetrics } from "@nanonet/shared-types";

const DURATION_PRESETS: { label: string; value: string }[] = [
  { label: "1 saat", value: "1h" },
  { label: "6 saat", value: "6h" },
  { label: "24 saat", value: "24h" },
];

function toSeries(metrics: ServiceMetrics[], key: keyof ServiceMetrics): SeriesPoint[] {
  const out: SeriesPoint[] = [];
  const seen = new Set<string>();
  for (const m of metrics) {
    const v = m[key];
    if (v == null || Number.isNaN(Number(v))) continue;
    const t = new Date(m.time).getTime();
    const k = `${t}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ t, y: Number(v) });
  }
  out.sort((a, b) => a.t - b.t);
  return out;
}

const CMD_STATUS: Record<string, string> = {
  queued: "kuyrukta",
  received: "iletilmiş",
  success: "başarılı",
  failed: "hata",
  timeout: "zaman aşımı",
};

export default function ServiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [range, setRange] = useState("1h");

  const { data: service, refetch: refetchService } = useQuery({
    queryKey: ["service", id],
    queryFn: () => servicesApi.get(id!),
    enabled: !!id,
  });

  const { data: metrics = [], refetch: refetchMetrics, isFetching: loadingMetrics } = useQuery({
    queryKey: ["serviceMetrics", id, range],
    queryFn: () => servicesApi.metrics(id!, range, 400),
    enabled: !!id,
  });

  const { data: cmdData, refetch: refetchCmd } = useQuery({
    queryKey: ["serviceCommands", id],
    queryFn: () => servicesApi.commands(id!, 1, 12),
    enabled: !!id,
  });

  const latest = metrics.length ? metrics[metrics.length - 1] : null;

  const restartM = useMutation({
    mutationFn: () => servicesApi.restart(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["service", id] });
      refetchCmd();
      Alert.alert("Restart", "Komut kuyruğa alındı — agent üzerinden iletilir.");
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      Alert.alert("Restart", err?.response?.data?.error ?? "İstek reddedildi");
    },
  });

  const stopM = useMutation({
    mutationFn: () => servicesApi.stop(id!, true),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["service", id] });
      refetchCmd();
      Alert.alert("Stop", "Durdurma komutu gönderildi.");
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      Alert.alert("Stop", err?.response?.data?.error ?? "İstek reddedildi");
    },
  });

  const startM = useMutation({
    mutationFn: () => servicesApi.start(id!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["service", id] });
      refetchCmd();
      Alert.alert("Start", "Başlatma komutu gönderildi.");
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      Alert.alert("Start", err?.response?.data?.error ?? "İstek reddedildi");
    },
  });

  const pingM = useMutation({
    mutationFn: () => servicesApi.ping(id!),
    onSuccess: () => {
      refetchService();
      Alert.alert("Ping", "Latency snapshot alındı.");
    },
    onError: () => Alert.alert("Ping", "Agent ulaşılamadı veya hata oluştu."),
  });

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={loadingMetrics}
          onRefresh={() => {
            refetchMetrics();
            refetchService();
            refetchCmd();
          }}
          tintColor={NN.signal}
        />
      }
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{service?.name ?? "…"}</Text>
          <Text style={styles.host}>
            {service?.host}:{service?.port}
            {service?.health_endpoint}
          </Text>
        </View>
        {service && <StatusBadge status={service.status} />}
      </View>

      <View style={styles.durRow}>
        {DURATION_PRESETS.map((d) => (
          <Pressable key={d.value} style={[styles.durChip, range === d.value && styles.durChipOn]} onPress={() => setRange(d.value)}>
            <Text style={[styles.durTxt, range === d.value && styles.durTxtOn]}>{d.label}</Text>
          </Pressable>
        ))}
      </View>

      {latest && (
        <View style={styles.snapshot}>
          <Snap label="CPU %" value={latest.cpu_percent != null ? `${latest.cpu_percent.toFixed(1)}%` : "—"} />
          <Snap label="RAM MB" value={latest.memory_used_mb != null ? `${latest.memory_used_mb.toFixed(0)}` : "—"} />
          <Snap label="ms" value={latest.latency_ms != null ? `${latest.latency_ms.toFixed(0)}` : "—"} />
          <Snap label="ERR %" value={latest.error_rate != null ? `${latest.error_rate.toFixed(2)}` : "—"} />
        </View>
      )}

      <Text style={styles.sectionLabel}>Zaman serisi (son örneklem)</Text>
      <ChartBlock
        label="CPU kullanımı %"
        series={toSeries(metrics, "cpu_percent")}
        color={NN.signal}
        formatY={(y) => `${y.toFixed(0)}%`}
      />
      <ChartBlock label="Bellek MB" series={toSeries(metrics, "memory_used_mb")} color="#5ec8ff" formatY={(y) => `${y.toFixed(0)}`} />
      <ChartBlock label="Gecikme ms" series={toSeries(metrics, "latency_ms")} color={NN.ok} formatY={(y) => `${y.toFixed(0)}`} />
      <ChartBlock
        label="Hata oranı"
        series={toSeries(metrics, "error_rate")}
        color={NN.bad}
        formatY={(y) => `${y.toFixed(2)}`}
      />

      {metrics.some((m) => m.disk_used_gb != null) ? (
        <ChartBlock
          label="Disk GB"
          series={toSeries(metrics, "disk_used_gb")}
          color={NN.warn}
          formatY={(y) => `${y.toFixed(1)} GB`}
        />
      ) : null}

      <Text style={styles.sectionLabel}>Agent komutları</Text>
      <View style={styles.cmdRow}>
        <CmdButton
          icon={<RefreshCw color={NN.bg} size={20} />}
          label="Restart"
          pending={restartM.isPending}
          onPress={() => {
            Alert.alert("Restart", "Bu servise restart komutu gönderilsin mi?", [
              { text: "İptal", style: "cancel" },
              { text: "Gönder", onPress: () => restartM.mutate() },
            ]);
          }}
        />
        <CmdButton
          icon={<Power color={NN.bg} size={20} />}
          label="Stop"
          pending={stopM.isPending}
          variant="danger"
          onPress={() => {
            Alert.alert("Stop", "Servis durdurulsun mu?", [
              { text: "İptal", style: "cancel" },
              { text: "Durdur", style: "destructive", onPress: () => stopM.mutate() },
            ]);
          }}
        />
        <CmdButton icon={<Play color={NN.bg} size={20} />} label="Start" pending={startM.isPending} onPress={() => startM.mutate()} />
        <CmdButton
          icon={<Radio color={NN.signal} size={20} />}
          label="Ping"
          pending={pingM.isPending}
          variant="muted"
          onPress={() => pingM.mutate()}
        />
      </View>

      {service?.agent_connected && (
        <View style={styles.agentRow}>
          <Text style={styles.muted}>Agent</Text>
          <Text style={styles.ink}>
            {service.agent_status ?? "unknown"}
            {service.agent_version ? ` · v${service.agent_version}` : ""}
          </Text>
        </View>
      )}

      <Text style={styles.sectionLabel}>Komut geçmişi</Text>
      <View style={styles.cmdList}>
        {(cmdData?.commands ?? []).length === 0 ? (
          <Text style={styles.emptyCmd}>Henüz komut kaydı yok.</Text>
        ) : (
          (cmdData?.commands ?? []).map((c) => <CommandRow key={c.id} c={c} />)
        )}
      </View>

      <NavLink label="Ham loglar" onPress={() => router.push({ pathname: "/(app)/logs", params: { serviceId: id } } as never)} />
      <NavLink label="Bu servis için SLO uyumu" onPress={() => router.push({ pathname: "/(app)/slo", params: { serviceId: id } } as never)} />
    </ScrollView>
  );
}

function Snap({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.snapCell}>
      <Text style={styles.snapLab}>{label}</Text>
      <Text style={styles.snapVal}>{value}</Text>
    </View>
  );
}

function ChartBlock({
  label,
  series,
  color,
  formatY,
}: {
  label: string;
  series: SeriesPoint[];
  color: string;
  formatY: (y: number) => string;
}) {
  return (
    <View style={styles.chartWrap}>
      <Text style={styles.chartTitle}>{label}</Text>
      <MonitoringSparkline series={series} color={color} formatY={formatY} />
    </View>
  );
}

function CmdButton({
  icon,
  label,
  onPress,
  pending,
  variant,
}: {
  icon: ReactNode;
  label: string;
  onPress: () => void;
  pending?: boolean;
  variant?: "danger" | "muted";
}) {
  const bg = variant === "danger" ? NN.bad : variant === "muted" ? NN.surface : NN.signal;
  const fg = variant === "muted" ? NN.signal : NN.bg;
  const border =
    variant === "muted"
      ? { borderWidth: 1, borderColor: `${NN.signal}44` }
      : {};
  return (
    <Pressable
      style={[styles.cmdBtn, { backgroundColor: bg }, border, pending && { opacity: 0.6 }]}
      onPress={onPress}
      disabled={pending}
    >
      {pending ? <ActivityIndicator color={fg} /> : icon}
      <Text style={[styles.cmdBtnTxt, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

function CommandRow({ c }: { c: CommandLog }) {
  return (
    <View style={styles.cmdItem}>
      <View style={styles.cmdTop}>
        <Text style={styles.cmdAction}>{c.action.toUpperCase()}</Text>
        <Text style={styles.cmdStat}>{CMD_STATUS[c.status] ?? c.status}</Text>
      </View>
      <Text style={styles.cmdTime}>{new Date(c.queued_at).toLocaleString("tr-TR")}</Text>
    </View>
  );
}

function NavLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.link} onPress={onPress}>
      <Text style={styles.linkText}>{label} →</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: NN.bg },
  header: { flexDirection: "row", alignItems: "flex-start", padding: 16, gap: 12 },
  name: { fontSize: 20, fontWeight: "700", color: NN.ink },
  host: { fontSize: 13, color: NN.muted, marginTop: 4, fontVariant: ["tabular-nums"] },
  durRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginBottom: 12 },
  durChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: NN.surface, borderWidth: 1, borderColor: NN.border },
  durChipOn: { borderColor: NN.signal, backgroundColor: NN.signalDim },
  durTxt: { color: NN.muted, fontSize: 12, fontWeight: "600" },
  durTxtOn: { color: NN.signal },
  snapshot: {
    flexDirection: "row",
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 10,
    backgroundColor: NN.surface,
    borderWidth: 1,
    borderColor: NN.border,
    marginBottom: 16,
  },
  snapCell: { flex: 1 },
  snapLab: { fontSize: 10, color: NN.dim, marginBottom: 2, textTransform: "uppercase", letterSpacing: 0.8 },
  snapVal: { fontSize: 15, fontWeight: "700", color: NN.ink, fontVariant: ["tabular-nums"] },
  sectionLabel: {
    color: NN.dim,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginHorizontal: 16,
    marginBottom: 8,
    marginTop: 4,
  },
  chartWrap: { marginHorizontal: 16, marginBottom: 18 },
  chartTitle: { color: NN.muted, fontSize: 13, marginBottom: 8 },
  cmdRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, marginBottom: 12 },
  cmdBtn: {
    minWidth: "22%",
    flexGrow: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  cmdBtnTxt: { color: NN.bg, fontSize: 11, fontWeight: "700" },
  agentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: NN.surface,
    marginHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: NN.border,
    marginBottom: 12,
  },
  muted: { color: NN.muted },
  ink: { color: NN.ink, fontWeight: "600" },
  cmdList: { paddingHorizontal: 16, marginBottom: 8 },
  emptyCmd: { color: NN.dim, fontSize: 13, paddingVertical: 12 },
  cmdItem: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: NN.border },
  cmdTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  cmdAction: { color: NN.signal, fontWeight: "700", fontSize: 12 },
  cmdStat: { color: NN.muted, fontSize: 12 },
  cmdTime: { color: NN.dim, fontSize: 11 },
  link: { marginHorizontal: 16, marginTop: 10 },
  linkText: { color: NN.signal, fontSize: 15, fontWeight: "600" },
});

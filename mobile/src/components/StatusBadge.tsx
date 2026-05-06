import { StyleSheet, Text, View } from "react-native";

type Status = "up" | "down" | "degraded" | "unknown";

const COLORS: Record<Status, { bg: string; text: string }> = {
  up: { bg: "#14532d", text: "#86efac" },
  down: { bg: "#7f1d1d", text: "#fca5a5" },
  degraded: { bg: "#713f12", text: "#fcd34d" },
  unknown: { bg: "#1e293b", text: "#94a3b8" },
};

const LABELS: Record<Status, string> = {
  up: "UP", down: "DOWN", degraded: "DEGRADED", unknown: "UNKNOWN",
};

export function StatusBadge({ status }: { status: Status }) {
  const c = COLORS[status] ?? COLORS.unknown;
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.text, { color: c.text }]}>{LABELS[status] ?? status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  text: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
});

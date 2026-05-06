import { StyleSheet, Text, View } from "react-native";
import { NN } from "../theme/tokens";

type Status = "up" | "down" | "degraded" | "unknown";

const COLORS: Record<Status, { bg: string; text: string }> = {
  up: { bg: NN.signalDim, text: NN.ok },
  down: { bg: NN.bad + "22", text: "#ffb4b8" },
  degraded: { bg: NN.warn + "22", text: NN.warn },
  unknown: { bg: NN.bgElevated, text: NN.muted },
};

const LABELS: Record<Status, string> = {
  up: "UP",
  down: "DOWN",
  degraded: "DEGRADED",
  unknown: "UNKNOWN",
};

export function StatusBadge({ status }: { status: Status }) {
  const c = COLORS[status] ?? COLORS.unknown;
  return (
    <View style={[styles.badge, { backgroundColor: c.bg, borderColor: c.text + "33" }]}>
      <Text style={[styles.text, { color: c.text }]}>{LABELS[status] ?? status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
  },
  text: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
});

import { StyleSheet, Text, View } from "react-native";
import { NN } from "../theme/tokens";

export function EmptyState({ title, message }: { title?: string; message: string }) {
  return (
    <View style={styles.container}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  title: { color: NN.muted, fontSize: 16, fontWeight: "700", marginBottom: 8 },
  text: { color: NN.dim, fontSize: 15, textAlign: "center" },
});

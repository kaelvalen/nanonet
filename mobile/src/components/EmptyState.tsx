import { StyleSheet, Text, View } from "react-native";

export function EmptyState({ message }: { message: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  text: { color: "#64748b", fontSize: 15, textAlign: "center" },
});

import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuthStore } from "../../src/store/authStore";
import { authApi } from "../../src/api/auth";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();

  const handleLogin = async () => {
    if (!email || !password) return;
    setLoading(true);
    try {
      const res = await authApi.login(email, password);
      await setAuth(res.user, res.tokens.access_token, res.tokens.refresh_token);
    } catch {
      Alert.alert("Hata", "E-posta veya şifre hatalı.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.title}>NanoNet</Text>
        <Text style={styles.subtitle}>Servis İzleme</Text>
        <TextInput
          style={styles.input}
          placeholder="E-posta"
          placeholderTextColor="#94a3b8"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Şifre"
          placeholderTextColor="#94a3b8"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <Pressable style={styles.button} onPress={handleLogin} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Giriş Yap</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f172a", justifyContent: "center", padding: 24 },
  card: { backgroundColor: "#1e293b", borderRadius: 16, padding: 28, gap: 16 },
  title: { fontSize: 28, fontWeight: "700", color: "#f1f5f9", textAlign: "center" },
  subtitle: { fontSize: 14, color: "#94a3b8", textAlign: "center", marginTop: -8 },
  input: {
    backgroundColor: "#0f172a",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#f1f5f9",
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#334155",
  },
  button: {
    backgroundColor: "#3b82f6",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
});

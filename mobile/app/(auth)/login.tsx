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
import { useState } from "react";
import { Router } from "lucide-react-native";
import { getApiBaseUrl, getWsDashboardUrl, saveServerEndpoints } from "../../src/api/client";
import { useAuthStore } from "../../src/store/authStore";
import { authApi } from "../../src/api/auth";
import { NN } from "../../src/theme/tokens";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [apiUrl, setApiUrl] = useState(() => getApiBaseUrl());
  const [wsUrl, setWsUrl] = useState("");
  const [showWs, setShowWs] = useState(false);
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();

  const handleLogin = async () => {
    if (!apiUrl.trim()) {
      Alert.alert("Sunucu", "API adresi girin (örn. https://api.sirket.com/api/v1 veya dahili IP).");
      return;
    }
    if (!email || !password) return;
    setLoading(true);
    try {
      await saveServerEndpoints(apiUrl.trim(), showWs && wsUrl.trim() ? wsUrl.trim() : undefined);
      const res = await authApi.login(email, password);
      await setAuth(res.user, res.tokens.access_token, res.tokens.refresh_token);
    } catch {
      Alert.alert("Hata", "Sunucuya ulaşılamadı veya e-posta/şifre hatalı. API adresini ve TLS (https) doğrulayın.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.hero}>
        <View style={styles.logoRing}>
          <Router color={NN.signal} size={36} strokeWidth={2} />
        </View>
        <Text style={styles.brand}>NanoNet</Text>
        <Text style={styles.tagline}>Mikroservis izleme · Agent komutları · AI anomali analizi</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Kontrol merkezi</Text>
        <Text style={styles.cardHint}>
          İnternet veya ofis Wi‑Fi fark etmez — her yerden HTTPS/WSS ile aynı adrese bağlanılır. Adres kayıtlı kalır (cihazda şifreli).
        </Text>
        <Text style={styles.label}>API adresi</Text>
        <TextInput
          style={styles.input}
          placeholder="https://api.domain.com/api/v1"
          placeholderTextColor={NN.dim}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          value={apiUrl}
          onChangeText={setApiUrl}
        />
        <Pressable style={styles.linkBtn} onPress={() => setShowWs((s) => !s)}>
          <Text style={styles.linkTxt}>{showWs ? "▼ WebSocket (gelişmiş) gizle" : "▸ WebSocket (isteğe bağlı)"}</Text>
        </Pressable>
        {showWs ? (
          <>
            <Text style={[styles.help, { marginTop: -4 }]}>
              Boş veya gömülü varsayılan: API adresinden otomatik wss://…/ws/dashboard türetilir. Ters proxy farklıysa burayı doldurun.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="wss://api.domain.com/ws"
              placeholderTextColor={NN.dim}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              value={wsUrl}
              onChangeText={setWsUrl}
            />
          </>
        ) : null}
        <Text style={styles.label}>E-posta</Text>
        <TextInput
          style={styles.input}
          placeholder="E-posta"
          placeholderTextColor={NN.dim}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <Text style={styles.label}>Şifre</Text>
        <TextInput
          style={styles.input}
          placeholder="Şifre"
          placeholderTextColor={NN.dim}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <Pressable style={[styles.button, loading && { opacity: 0.7 }]} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color={NN.bg} /> : <Text style={styles.buttonText}>Giriş yap</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: NN.bg, padding: 28, justifyContent: "center" },
  hero: { alignItems: "center", marginBottom: 28 },
  logoRing: {
    width: 72,
    height: 72,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: NN.signal + "66",
    backgroundColor: NN.signalDim,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  brand: { fontSize: 32, fontWeight: "800", color: NN.ink, letterSpacing: 0.8 },
  tagline: { color: NN.muted, fontSize: 13, marginTop: 8, textAlign: "center", lineHeight: 19, maxWidth: 320 },
  card: {
    backgroundColor: NN.surface,
    borderRadius: 18,
    padding: 22,
    borderWidth: 1,
    borderColor: NN.border,
    gap: 10,
  },
  cardTitle: { fontSize: 18, fontWeight: "700", color: NN.ink },
  cardHint: { color: NN.dim, fontSize: 12, marginBottom: 6, lineHeight: 17 },
  label: { color: NN.muted, fontSize: 12, fontWeight: "600", marginTop: 4 },
  help: { color: NN.dim, fontSize: 11, lineHeight: 16 },
  input: {
    backgroundColor: NN.bgElevated,
    borderRadius: 11,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: NN.ink,
    fontSize: 15,
    borderWidth: 1,
    borderColor: NN.border,
    marginBottom: 2,
  },
  linkBtn: { paddingVertical: 8 },
  linkTxt: { color: NN.signal, fontWeight: "600", fontSize: 13 },
  button: {
    backgroundColor: NN.signal,
    borderRadius: 11,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: { color: NN.bg, fontWeight: "700", fontSize: 16 },
});

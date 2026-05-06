import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { CreateServiceRequest } from "@nanonet/shared-types";
import { servicesApi } from "../api/services";
import { NN } from "../theme/tokens";

interface AddServiceModalProps {
  visible: boolean;
  onClose: () => void;
}

export function AddServiceModal({ visible, onClose }: AddServiceModalProps) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("8080");
  const [health, setHealth] = useState("/health");
  const [poll, setPoll] = useState("30");

  const mutation = useMutation({
    mutationFn: (body: CreateServiceRequest) => servicesApi.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["services"] });
      onClose();
      setName("");
      setHost("");
      setPort("8080");
      setHealth("/health");
      setPoll("30");
    },
    onError: () => Alert.alert("Hata", "Servis eklenemedi. Alanları kontrol edin."),
  });

  const submit = () => {
    const p = parseInt(port, 10);
    const pollSec = parseInt(poll, 10);
    if (!name.trim() || !host.trim() || !health.trim()) {
      Alert.alert("Eksik", "İsim, host ve endpoint zorunlu.");
      return;
    }
    if (Number.isNaN(p) || p < 1 || p > 65535) {
      Alert.alert("Port", "1–65535 arası bir port girin.");
      return;
    }
    mutation.mutate({
      name: name.trim(),
      host: host.trim(),
      port: p,
      health_endpoint: health.startsWith("/") ? health : `/${health}`,
      poll_interval_sec: Number.isFinite(pollSec) ? Math.min(300, Math.max(5, pollSec)) : 30,
    });
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.hitArea} onPress={onClose} accessibilityRole="button" />
        <View style={styles.cardWrap} pointerEvents="box-none">
          <View style={styles.card}>
          <Text style={styles.title}>Yeni izlenen servis</Text>
          <Text style={styles.help}>NanoNet Agent bu host üzerinden sağlık ve metrik toplar.</Text>
          <TextInput placeholder="Servis adı" placeholderTextColor={NN.dim} style={styles.input} value={name} onChangeText={setName} />
          <TextInput placeholder="Host / IP" placeholderTextColor={NN.dim} style={styles.input} value={host} onChangeText={setHost} autoCapitalize="none" />
          <View style={styles.row}>
            <TextInput placeholder="Port" placeholderTextColor={NN.dim} style={[styles.input, styles.half]} value={port} onChangeText={setPort} keyboardType="number-pad" />
            <TextInput placeholder="Poll sn" placeholderTextColor={NN.dim} style={[styles.input, styles.half]} value={poll} onChangeText={setPoll} keyboardType="number-pad" />
          </View>
          <TextInput
            placeholder="Health path"
            placeholderTextColor={NN.dim}
            style={styles.input}
            value={health}
            onChangeText={setHealth}
            autoCapitalize="none"
          />
          <View style={styles.actions}>
            <Pressable style={styles.cancel} onPress={onClose}>
              <Text style={styles.cancelText}>Vazgeç</Text>
            </Pressable>
            <Pressable style={[styles.submit, mutation.isPending && { opacity: 0.65 }]} onPress={submit} disabled={mutation.isPending}>
              <Text style={styles.submitText}>{mutation.isPending ? "Kaydediliyor…" : "Ekle"}</Text>
            </Pressable>
          </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1 },
  hitArea: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: NN.overlay,
  },
  cardWrap: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: { backgroundColor: NN.surface, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: NN.border },
  title: { color: NN.ink, fontSize: 18, fontWeight: "700" },
  help: { color: NN.muted, fontSize: 12, marginTop: 6, marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: NN.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: NN.ink,
    marginBottom: 10,
    backgroundColor: NN.bgElevated,
  },
  row: { flexDirection: "row", gap: 10 },
  half: { flex: 1 },
  actions: { flexDirection: "row", gap: 12, marginTop: 8 },
  cancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: NN.bgElevated,
    alignItems: "center",
    borderWidth: 1,
    borderColor: NN.border,
  },
  cancelText: { color: NN.muted, fontWeight: "600" },
  submit: { flex: 1, paddingVertical: 14, borderRadius: 10, backgroundColor: NN.signalDim, alignItems: "center" },
  submitText: { color: NN.signal, fontWeight: "700" },
});

import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const ROLE_LABELS = { user: "Usuario", tester: "Tester", admin: "Administrador" };

export default function NodeProfileScreen({ user, onBack, onUpdateProfile, onChangePassword, onChangeEmail }) {
  const [name, setName] = useState(user?.name || "");
  const [alias, setAlias] = useState(user?.alias || user?.name || "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => { setName(user?.name || ""); setAlias(user?.alias || user?.name || ""); }, [user?.name, user?.alias]);

  const save = async () => {
    const trimmedName = name.trim();
    const trimmedAlias = alias.trim();
    if (!trimmedName || trimmedName.length > 120) {
      setError("Escribe un nombre de entre 1 y 120 caracteres.");
      setMessage("");
      return;
    }
    if (trimmedAlias.length < 2 || trimmedAlias.length > 40) {
      setError("El alias público debe tener entre 2 y 40 caracteres.");
      setMessage("");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await onUpdateProfile({ name: trimmedName, alias: trimmedAlias });
      setMessage("Tu nombre y alias público se han actualizado.");
    } catch (err) {
      setError(err?.message || "No se pudo actualizar el perfil.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Volver a compras" onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={21} color="#2563eb" />
        </Pressable>
        <Text style={styles.headerTitle}>Mi cuenta</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.avatar}><Ionicons name="person" size={32} color="#2563eb" /></View>
        <Text style={styles.title}>Perfil de Node</Text>
        <Text style={styles.subtitle}>Estos datos pertenecen a tu cuenta Express y son independientes de Convex.</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Nombre</Text>
          <TextInput value={name} onChangeText={setName} maxLength={120} autoCapitalize="words" returnKeyType="done" style={styles.input} accessibilityLabel="Nombre de perfil" />
          <Text style={styles.label}>Alias público</Text>
          <TextInput value={alias} onChangeText={setAlias} maxLength={40} autoCapitalize="none" returnKeyType="done" style={styles.input} accessibilityLabel="Alias público" />
          <Text style={styles.label}>Correo electrónico</Text>
          <Text style={styles.readOnly}>{user?.email || "—"}</Text>
          <Text style={styles.label}>Rol</Text>
          <Text style={styles.readOnly}>{ROLE_LABELS[user?.role] || "Usuario"}</Text>
          <Text style={styles.label}>Verificación de correo</Text>
          <Text style={styles.readOnly}>{user?.emailVerified ? "Verificado" : "Pendiente"}</Text>
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          {message ? <Text accessibilityRole="status" style={styles.success}>{message}</Text> : null}
          <Pressable accessibilityRole="button" disabled={busy} onPress={save} style={({ pressed }) => [styles.saveButton, (pressed || busy) && styles.pressed]}>
            {busy ? <ActivityIndicator color="#fff" /> : <><Ionicons name="save-outline" size={19} color="#fff" /><Text style={styles.saveText}>Guardar nombre</Text></>}
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onChangePassword} style={({ pressed }) => [styles.passwordButton, pressed && styles.pressed]}>
            <Ionicons name="key-outline" size={18} color="#2563eb" /><Text style={styles.passwordText}>Cambiar contraseña</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onChangeEmail} style={({ pressed }) => [styles.passwordButton, pressed && styles.pressed]}>
            <Ionicons name="mail-outline" size={18} color="#2563eb" /><Text style={styles.passwordText}>Cambiar correo</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f4f7fc" },
  header: { minHeight: 58, flexDirection: "row", alignItems: "center", paddingHorizontal: 18, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  backButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#eff6ff" },
  headerTitle: { marginLeft: 12, fontSize: 19, fontWeight: "800", color: "#172033" },
  content: { width: "100%", maxWidth: 620, alignSelf: "center", padding: 22, paddingBottom: 48 },
  avatar: { width: 68, height: 68, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "#e8f1ff", alignSelf: "center", marginTop: 16 },
  title: { marginTop: 16, textAlign: "center", color: "#172033", fontSize: 25, fontWeight: "800" },
  subtitle: { marginTop: 7, marginBottom: 22, textAlign: "center", color: "#64748b", fontSize: 14, lineHeight: 21 },
  card: { padding: 20, borderRadius: 18, borderWidth: 1, borderColor: "#e2e8f0", backgroundColor: "#fff" },
  label: { marginTop: 14, marginBottom: 7, color: "#475569", fontSize: 13, fontWeight: "700" },
  input: { minHeight: 48, paddingHorizontal: 13, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 12, color: "#172033", fontSize: 16 },
  readOnly: { minHeight: 44, justifyContent: "center", paddingHorizontal: 13, paddingTop: 12, borderRadius: 12, backgroundColor: "#f8fafc", color: "#334155", fontSize: 15 },
  error: { marginTop: 13, color: "#b91c1c", fontSize: 14, lineHeight: 20 },
  success: { marginTop: 13, color: "#15803d", fontSize: 14, lineHeight: 20 },
  saveButton: { minHeight: 48, marginTop: 20, borderRadius: 13, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 9, backgroundColor: "#2563eb" },
  saveText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  passwordButton: { minHeight: 46, marginTop: 10, borderRadius: 13, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 9, backgroundColor: "#eff6ff" },
  passwordText: { color: "#1d4ed8", fontSize: 14, fontWeight: "800" },
  pressed: { opacity: 0.75 },
});

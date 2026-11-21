import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const ROLE_LABELS = { user: "Usuario", tester: "Tester", admin: "Administrador" };

export default function NodeProfileScreen({ user, onBack, onUpdateProfile, onClearScanHistory, onChangePassword, onChangeEmail }) {
  const [name, setName] = useState(user?.name || "");
  const [alias, setAlias] = useState(user?.alias || user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [scanHistorySyncEnabled, setScanHistorySyncEnabled] = useState(user?.scanHistorySyncEnabled === true);
  const [busy, setBusy] = useState(false);
  const [clearBusy, setClearBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setName(user?.name || "");
    setAlias(user?.alias || user?.name || "");
    setPhone(user?.phone || "");
    setScanHistorySyncEnabled(user?.scanHistorySyncEnabled === true);
  }, [user?.name, user?.alias, user?.phone, user?.scanHistorySyncEnabled]);

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
      await onUpdateProfile({ name: trimmedName, alias: trimmedAlias, phone: phone.trim(), scanHistorySyncEnabled });
      setMessage("Los cambios del perfil y la sincronización se han guardado.");
    } catch (err) {
      setError(err?.message || "No se pudo actualizar el perfil.");
    } finally {
      setBusy(false);
    }
  };

  const confirmClearHistory = () => Alert.alert(
    "Borrar historial Node",
    "Se eliminarán del servidor Node todos los productos guardados en tu historial. El historial local de este dispositivo no se modificará.",
    [
      { text: "Cancelar", style: "cancel" },
      { text: "Borrar del servidor", style: "destructive", onPress: async () => {
        setClearBusy(true);
        setError("");
        setMessage("");
        try {
          await onClearScanHistory();
          setMessage("El historial guardado en el servidor se ha borrado.");
        } catch (err) {
          setError(err?.message || "No se pudo borrar el historial del servidor.");
        } finally {
          setClearBusy(false);
        }
      } },
    ],
  );

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
          <Text style={styles.label}>Teléfono de contacto (privado)</Text>
          <TextInput value={phone} onChangeText={setPhone} maxLength={30} keyboardType="phone-pad" textContentType="telephoneNumber" returnKeyType="done" style={styles.input} accessibilityLabel="Teléfono de contacto privado" />
          <Text style={styles.fieldHelp}>Solo tú puedes consultar este número desde tu cuenta. Node no lo muestra en el chat.</Text>
          <Text style={styles.label}>Correo electrónico</Text>
          <Text style={styles.readOnly}>{user?.email || "—"}</Text>
          <Text style={styles.label}>Rol</Text>
          <Text style={styles.readOnly}>{ROLE_LABELS[user?.role] || "Usuario"}</Text>
          <Text style={styles.label}>Verificación de correo</Text>
          <Text style={styles.readOnly}>{user?.emailVerified ? "Verificado" : "Pendiente"}</Text>
          <View style={styles.preferenceRow}>
            <View style={styles.preferenceCopy}>
              <Text style={styles.preferenceTitle}>Sincronizar historial del escáner</Text>
              <Text style={styles.preferenceHelp}>Si está activado, los productos escaneados se guardarán en tu cuenta Node y estarán disponibles en otros dispositivos. Desactivado por defecto. Al activarlo no se importan escaneos anteriores.</Text>
            </View>
            <Switch
              value={scanHistorySyncEnabled}
              onValueChange={setScanHistorySyncEnabled}
              disabled={busy}
              accessibilityLabel="Sincronizar historial del escáner con Node"
              trackColor={{ false: "#cbd5e1", true: "#93c5fd" }}
              thumbColor={scanHistorySyncEnabled ? "#2563eb" : "#f8fafc"}
            />
          </View>
          <Pressable accessibilityRole="button" disabled={clearBusy} onPress={confirmClearHistory} style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}>
            {clearBusy ? <ActivityIndicator color="#b91c1c" /> : <><Ionicons name="trash-outline" size={18} color="#b91c1c" /><Text style={styles.clearText}>Borrar historial guardado en Node</Text></>}
          </Pressable>
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          {message ? <Text accessibilityRole="status" style={styles.success}>{message}</Text> : null}
          <Pressable accessibilityRole="button" disabled={busy} onPress={save} style={({ pressed }) => [styles.saveButton, (pressed || busy) && styles.pressed]}>
            {busy ? <ActivityIndicator color="#fff" /> : <><Ionicons name="save-outline" size={19} color="#fff" /><Text style={styles.saveText}>Guardar cambios</Text></>}
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
  fieldHelp: { marginTop: 5, color: "#64748b", fontSize: 12, lineHeight: 18 },
  readOnly: { minHeight: 44, justifyContent: "center", paddingHorizontal: 13, paddingTop: 12, borderRadius: 12, backgroundColor: "#f8fafc", color: "#334155", fontSize: 15 },
  preferenceRow: { marginTop: 18, paddingVertical: 14, paddingHorizontal: 13, borderRadius: 13, backgroundColor: "#f8fafc", flexDirection: "row", alignItems: "center", gap: 12 },
  preferenceCopy: { flex: 1 },
  preferenceTitle: { color: "#334155", fontSize: 14, fontWeight: "800" },
  preferenceHelp: { marginTop: 5, color: "#64748b", fontSize: 13, lineHeight: 19 },
  clearButton: { minHeight: 44, marginTop: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "#fff1f2", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  clearText: { color: "#b91c1c", fontSize: 13, fontWeight: "800" },
  error: { marginTop: 13, color: "#b91c1c", fontSize: 14, lineHeight: 20 },
  success: { marginTop: 13, color: "#15803d", fontSize: 14, lineHeight: 20 },
  saveButton: { minHeight: 48, marginTop: 20, borderRadius: 13, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 9, backgroundColor: "#2563eb" },
  saveText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  passwordButton: { minHeight: 46, marginTop: 10, borderRadius: 13, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 9, backgroundColor: "#eff6ff" },
  passwordText: { color: "#1d4ed8", fontSize: 14, fontWeight: "800" },
  pressed: { opacity: 0.75 },
});

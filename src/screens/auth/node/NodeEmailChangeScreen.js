import React, { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function NodeEmailChangeScreen({ user, onBack, onRequestCode, onConfirmCode, onDone }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const normalizedEmail = email.trim().toLowerCase();

  const requestCode = async () => {
    if (!EMAIL_RE.test(normalizedEmail)) return setError("Introduce una dirección de correo válida.");
    if (normalizedEmail === String(user?.email || "").toLowerCase()) return setError("Introduce una dirección distinta a la actual.");
    setBusy(true); setError(""); setMessage("");
    try {
      await onRequestCode(normalizedEmail);
      setStep("code");
      setMessage(`Si la solicitud puede completarse, recibirás un código en ${normalizedEmail}.`);
    } catch (cause) { setError(cause?.message || "No se pudo solicitar el cambio de correo."); }
    finally { setBusy(false); }
  };

  const confirm = async () => {
    const normalizedCode = code.trim();
    if (!/^\d{8}$/.test(normalizedCode)) return setError("Introduce el código de 8 dígitos recibido.");
    setBusy(true); setError(""); setMessage("");
    try {
      await onConfirmCode({ email: normalizedEmail, code: normalizedCode });
      setStep("success");
      setMessage(`La dirección ${normalizedEmail} está verificada. Por seguridad, inicia sesión de nuevo.`);
    } catch (cause) { setError(cause?.message || "No se pudo confirmar el nuevo correo."); }
    finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Volver al perfil" onPress={onBack} style={styles.backButton}><Ionicons name="arrow-back" size={21} color="#2563eb" /></Pressable>
          <Text style={styles.headerTitle}>Cambiar correo</Text>
        </View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <View style={styles.icon}><Ionicons name={step === "success" ? "checkmark-circle-outline" : "mail-outline"} size={30} color="#2563eb" /></View>
            <Text style={styles.title}>{step === "success" ? "Correo actualizado" : step === "code" ? "Confirma la dirección" : "Nueva dirección"}</Text>
            <Text style={styles.subtitle}>{step === "email" ? `Correo actual: ${user?.email || "—"}. Enviaremos un código a la nueva dirección.` : step === "code" ? `Introduce el código de 8 dígitos enviado a ${normalizedEmail}.` : "Tu cuenta ya usa la dirección verificada."}</Text>
            {step !== "success" ? <>
              <Text style={styles.label}>Nuevo correo electrónico</Text>
              <TextInput accessibilityLabel="Nuevo correo electrónico" value={email} onChangeText={(value) => { setEmail(value); setError(""); }} placeholder="nombre@correo.com" placeholderTextColor="#94a3b8" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} editable={step === "email" && !busy} style={[styles.input, step === "code" && styles.inputReadonly]} />
              {step === "code" ? <>
                <Text style={styles.label}>Código de confirmación</Text>
                <TextInput accessibilityLabel="Código de confirmación" value={code} onChangeText={(value) => { setCode(value.replace(/\D/g, "").slice(0, 8)); setError(""); }} placeholder="8 dígitos" placeholderTextColor="#94a3b8" keyboardType="number-pad" maxLength={8} style={styles.input} />
              </> : null}
            </> : null}
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
            {message ? <Text accessibilityRole="status" style={styles.message}>{message}</Text> : null}
            {step === "email" ? <Button title="Enviar código" icon="paper-plane-outline" busy={busy} onPress={requestCode} /> : step === "code" ? <>
              <Button title="Confirmar correo" icon="checkmark-outline" busy={busy} onPress={confirm} />
              <Pressable accessibilityRole="button" disabled={busy} onPress={requestCode} style={styles.secondary}><Text style={styles.secondaryText}>Reenviar código</Text></Pressable>
            </> : <Button title="Volver al inicio de sesión" icon="log-in-outline" onPress={onDone} />}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Button({ title, icon, onPress, busy = false }) {
  return <Pressable accessibilityRole="button" disabled={busy} onPress={onPress} style={({ pressed }) => [styles.button, (pressed || busy) && styles.pressed]}>
    {busy ? <ActivityIndicator color="#fff" /> : <><Ionicons name={icon} size={18} color="#fff" /><Text style={styles.buttonText}>{title}</Text></>}
  </Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f4f7fc" },
  header: { minHeight: 58, flexDirection: "row", alignItems: "center", paddingHorizontal: 18, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  backButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#eff6ff" },
  headerTitle: { marginLeft: 12, color: "#172033", fontSize: 19, fontWeight: "800" },
  content: { flexGrow: 1, justifyContent: "center", padding: 20 },
  card: { width: "100%", maxWidth: 500, alignSelf: "center", padding: 24, borderRadius: 20, borderWidth: 1, borderColor: "#e2e8f0", backgroundColor: "#fff" },
  icon: { width: 60, height: 60, alignItems: "center", justifyContent: "center", alignSelf: "center", borderRadius: 19, backgroundColor: "#e8f1ff" },
  title: { marginTop: 16, textAlign: "center", color: "#172033", fontSize: 23, fontWeight: "800" },
  subtitle: { marginTop: 8, marginBottom: 16, textAlign: "center", color: "#64748b", fontSize: 14, lineHeight: 21 },
  label: { marginTop: 12, marginBottom: 7, color: "#475569", fontSize: 13, fontWeight: "700" },
  input: { minHeight: 48, paddingHorizontal: 13, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 12, color: "#172033", fontSize: 15 },
  inputReadonly: { backgroundColor: "#f8fafc", color: "#64748b" },
  error: { marginTop: 13, color: "#b91c1c", fontSize: 14, lineHeight: 20 },
  message: { marginTop: 13, color: "#166534", fontSize: 14, lineHeight: 20 },
  button: { minHeight: 48, marginTop: 20, borderRadius: 13, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 9, backgroundColor: "#2563eb" },
  buttonText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  secondary: { alignSelf: "center", padding: 12, marginTop: 4 },
  secondaryText: { color: "#2563eb", fontSize: 14, fontWeight: "700" },
  pressed: { opacity: 0.75 },
});

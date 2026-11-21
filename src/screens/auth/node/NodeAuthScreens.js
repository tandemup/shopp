import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { I18nText as Text } from "@/src/i18n";
import { useNodeAuth } from "@/src/context/NodeAuthContext";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Frame({ title, subtitle, navigation, children, footer, notice }) {
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <View style={styles.brandRow}>
              <View style={styles.logo}><Text style={styles.logoText}>S</Text></View>
              <Text style={styles.brand}>Shopp</Text>
              <View style={styles.nodeBadge}><Text style={styles.nodeBadgeText}>NODE</Text></View>
            </View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
            {notice ? <Text style={styles.success}>{notice}</Text> : null}
            {children}
            {footer ? <View style={styles.footer}>{footer}</View> : null}
            <Pressable accessibilityRole="button" onPress={() => navigation?.navigate?.("AuthHome")} style={styles.backHome}>
              <Ionicons name="arrow-back" size={16} color="#64748b" />
              <Text style={styles.backHomeText}>Volver</Text>
            </Pressable>
          </View>
          <Text style={styles.caption}>Autenticación gestionada por la API Node.js de Shopp</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, value, onChangeText, placeholder, secureTextEntry, keyboardType, autoCapitalize = "none", maxLength }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        maxLength={maxLength}
        style={styles.input}
      />
    </View>
  );
}

function PrimaryButton({ title, onPress, disabled, busy }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.primary, disabled && styles.disabled, pressed && !disabled && styles.pressed]}>
      {busy ? <ActivityIndicator size="small" color="#fff" /> : null}
      <Text style={styles.primaryText}>{busy ? "Procesando…" : title}</Text>
      {!busy ? <Ionicons name="arrow-forward" size={18} color="#fff" /> : null}
    </Pressable>
  );
}

function InlineLink({ title, onPress }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={styles.inlineLink}><Text style={styles.inlineLinkText}>{title}</Text></Pressable>;
}

function errorText(error, fallback) {
  const message = String(error?.message || "").trim();
  return message || fallback;
}

export function NodeLoginScreen({ navigation, route }) {
  const { login } = useNodeAuth();
  const [email, setEmail] = useState(String(route?.params?.email || "").trim().toLowerCase());
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(route?.params?.passwordChanged ? "Contraseña actualizada. Ya puedes iniciar sesión." : "");

  useEffect(() => {
    if (route?.params?.email) setEmail(String(route.params.email).trim().toLowerCase());
    if (route?.params?.passwordChanged) {
      setNotice("Contraseña actualizada. Ya puedes iniciar sesión.");
      navigation.setParams({ passwordChanged: undefined });
    }
  }, [navigation, route?.params?.email, route?.params?.passwordChanged]);

  const submit = async () => {
    if (!EMAIL_RE.test(email.trim().toLowerCase()) || !password) return setError("Introduce un correo y una contraseña válidos.");
    setBusy(true); setError("");
    try { await login({ email: email.trim().toLowerCase(), password }); }
    catch (cause) { setError(errorText(cause, "No se pudo iniciar sesión con Node.")); }
    finally { setBusy(false); }
  };

  return (
    <Frame title="Entrar en Shopp" subtitle="Accede con tu cuenta del backend Node." navigation={navigation} notice={notice} footer={<>
      <InlineLink title="¿Olvidaste la contraseña?" onPress={() => navigation.navigate("ResetPassword", { email })} />
      <View style={styles.footerRow}><Text style={styles.footerText}>¿Aún no tienes cuenta?</Text><InlineLink title="Crear cuenta" onPress={() => navigation.navigate("Register")} /></View>
    </>}>
      <Field label="Correo electrónico" value={email} onChangeText={(value) => { setEmail(value); setError(""); }} placeholder="nombre@correo.com" keyboardType="email-address" />
      <Field label="Contraseña" value={password} onChangeText={(value) => { setPassword(value); setError(""); }} placeholder="Tu contraseña" secureTextEntry />
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <PrimaryButton title="Entrar" onPress={submit} disabled={busy} busy={busy} />
    </Frame>
  );
}

export function NodeRegisterScreen({ navigation }) {
  const { register, verifyEmail } = useNodeAuth();
  const [step, setStep] = useState("register");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const normalizedEmail = email.trim().toLowerCase();
  const passwordValid = password.length >= 8 && password.length <= 128 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /[0-9]/.test(password);

  const startRegistration = async (resend = false) => {
    setError(""); setNotice("");
    if (!name.trim()) return setError("Introduce tu nombre.");
    if (!EMAIL_RE.test(normalizedEmail)) return setError("Introduce un correo válido.");
    if (!passwordValid) return setError("Usa al menos 8 caracteres con mayúsculas, minúsculas y números.");
    if (password !== confirmation) return setError("Las contraseñas no coinciden.");
    setBusy(true);
    try {
      await register({ name: name.trim(), email: normalizedEmail, password });
      setStep("verify");
      setNotice(resend ? "Si la solicitud puede completarse, recibirás un nuevo código." : "Si la solicitud puede completarse, recibirás un código de verificación por correo.");
    } catch (cause) { setError(errorText(cause, "No se pudo iniciar el registro.")); }
    finally { setBusy(false); }
  };

  const confirmEmail = async () => {
    if (!/^\d{8}$/.test(code.trim())) return setError("Introduce el código de 8 dígitos recibido por correo.");
    setBusy(true); setError(""); setNotice("");
    try { await verifyEmail({ email: normalizedEmail, code: code.trim() }); }
    catch (cause) { setError(errorText(cause, "No se pudo verificar el correo.")); }
    finally { setBusy(false); }
  };

  return (
    <Frame title={step === "register" ? "Crear cuenta Node" : "Verificar correo"} subtitle={step === "register" ? "Registra una cuenta para el backend Node de Shopp." : `Introduce el código enviado a ${normalizedEmail}.`} navigation={navigation} notice={notice} footer={<View style={styles.footerRow}><Text style={styles.footerText}>¿Ya tienes cuenta?</Text><InlineLink title="Entrar" onPress={() => navigation.navigate("Login")} /></View>}>
      {step === "register" ? <>
        <Field label="Nombre" value={name} onChangeText={setName} placeholder="Tu nombre" autoCapitalize="words" maxLength={120} />
        <Field label="Correo electrónico" value={email} onChangeText={setEmail} placeholder="nombre@correo.com" keyboardType="email-address" />
        <Field label="Contraseña" value={password} onChangeText={setPassword} placeholder="Mínimo 8 caracteres" secureTextEntry maxLength={128} />
        <Field label="Repetir contraseña" value={confirmation} onChangeText={setConfirmation} placeholder="Confirma la contraseña" secureTextEntry maxLength={128} />
        <Text style={styles.hint}>Debe incluir mayúsculas, minúsculas y números.</Text>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <PrimaryButton title="Enviar código" onPress={() => startRegistration(false)} disabled={busy} busy={busy} />
      </> : <>
        <Field label="Código de verificación" value={code} onChangeText={(value) => { setCode(value.replace(/\D/g, "").slice(0, 8)); setError(""); }} placeholder="8 dígitos" keyboardType="number-pad" maxLength={8} />
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <PrimaryButton title="Verificar y entrar" onPress={confirmEmail} disabled={busy} busy={busy} />
        <InlineLink title="Reenviar código" onPress={() => startRegistration(true)} />
      </>}
    </Frame>
  );
}

export function NodeResetPasswordScreen({ navigation, route, onPasswordResetComplete }) {
  const { requestPasswordReset, resetPassword } = useNodeAuth();
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState(String(route?.params?.email || "").trim().toLowerCase());
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const normalizedEmail = email.trim().toLowerCase();

  const sendCode = async () => {
    if (!EMAIL_RE.test(normalizedEmail)) return setError("Introduce un correo válido.");
    setBusy(true); setError("");
    try {
      await requestPasswordReset(normalizedEmail);
      setStep("code");
      setNotice("Si la cuenta puede recuperarse, recibirás un código por correo.");
    } catch (cause) { setError(errorText(cause, "No se pudo solicitar el código.")); }
    finally { setBusy(false); }
  };

  const submitReset = async () => {
    const validPassword = password.length >= 8 && password.length <= 128 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /[0-9]/.test(password);
    if (!/^\d{8}$/.test(code.trim())) return setError("Introduce el código de 8 dígitos.");
    if (!validPassword) return setError("Usa al menos 8 caracteres con mayúsculas, minúsculas y números.");
    if (password !== confirmation) return setError("Las contraseñas no coinciden.");
    setBusy(true); setError("");
    try {
      await resetPassword({ email: normalizedEmail, code: code.trim(), password });
      if (onPasswordResetComplete) {
        setStep("success");
        setNotice("La contraseña se ha actualizado. Por seguridad, vuelve a iniciar sesión.");
      } else {
        navigation.navigate("Login", { email: normalizedEmail, passwordChanged: true });
      }
    } catch (cause) { setError(errorText(cause, "No se pudo cambiar la contraseña.")); }
    finally { setBusy(false); }
  };

  return (
    <Frame title={step === "success" ? "Contraseña actualizada" : "Restablecer contraseña"} subtitle={step === "email" ? "Solicita un código de recuperación para tu cuenta Node." : step === "code" ? `Introduce el código enviado a ${normalizedEmail}.` : "Tu contraseña ya está actualizada."} navigation={navigation} notice={notice} footer={step === "success" ? null : <InlineLink title="Volver a entrar" onPress={() => navigation.navigate("Login", { email: normalizedEmail })} />}>
      {step === "success" ? <PrimaryButton title="Volver al inicio de sesión" onPress={() => onPasswordResetComplete ? onPasswordResetComplete() : navigation.navigate("Login", { email: normalizedEmail })} /> : step === "email" ? <>
        <Field label="Correo electrónico" value={email} onChangeText={setEmail} placeholder="nombre@correo.com" keyboardType="email-address" />
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <PrimaryButton title="Enviar código" onPress={sendCode} disabled={busy} busy={busy} />
      </> : <>
        <Field label="Código de recuperación" value={code} onChangeText={(value) => setCode(value.replace(/\D/g, "").slice(0, 8))} placeholder="8 dígitos" keyboardType="number-pad" maxLength={8} />
        <Field label="Nueva contraseña" value={password} onChangeText={setPassword} placeholder="Mínimo 8 caracteres" secureTextEntry maxLength={128} />
        <Field label="Repetir contraseña" value={confirmation} onChangeText={setConfirmation} placeholder="Confirma la contraseña" secureTextEntry maxLength={128} />
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <PrimaryButton title="Cambiar contraseña" onPress={submitReset} disabled={busy} busy={busy} />
      </>}
    </Frame>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f1f5f9" },
  scroll: { flexGrow: 1, justifyContent: "center", alignItems: "center", padding: 18 },
  card: { width: "100%", maxWidth: 470, padding: 26, borderRadius: 22, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0", shadowColor: "#0f172a", shadowOpacity: 0.06, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 2 },
  brandRow: { flexDirection: "row", alignItems: "center", marginBottom: 30 },
  logo: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#2563eb" },
  logoText: { color: "#fff", fontSize: 22, fontWeight: "900" },
  brand: { color: "#0f172a", fontSize: 22, fontWeight: "800", marginLeft: 10 },
  nodeBadge: { marginLeft: "auto", backgroundColor: "#eff6ff", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  nodeBadgeText: { color: "#1d4ed8", fontSize: 10, fontWeight: "800", letterSpacing: 0.7 },
  title: { color: "#0f172a", fontSize: 26, lineHeight: 32, fontWeight: "800" },
  subtitle: { color: "#64748b", fontSize: 14, lineHeight: 21, marginTop: 7, marginBottom: 21 },
  field: { marginTop: 12 },
  label: { color: "#334155", fontSize: 13, fontWeight: "700", marginBottom: 7 },
  input: { minHeight: 48, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 11, paddingHorizontal: 13, color: "#0f172a", fontSize: 15, backgroundColor: "#fff" },
  primary: { minHeight: 50, borderRadius: 12, backgroundColor: "#2563eb", marginTop: 19, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 9 },
  primaryText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  disabled: { opacity: 0.65 },
  pressed: { opacity: 0.82 },
  error: { color: "#b91c1c", fontSize: 13, lineHeight: 19, marginTop: 12, padding: 11, borderRadius: 9, backgroundColor: "#fef2f2" },
  success: { color: "#166534", fontSize: 13, lineHeight: 19, marginBottom: 13, padding: 11, borderRadius: 9, backgroundColor: "#f0fdf4" },
  hint: { color: "#64748b", fontSize: 12, lineHeight: 18, marginTop: 8 },
  footer: { marginTop: 15, alignItems: "center" },
  footerRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", flexWrap: "wrap" },
  footerText: { color: "#64748b", fontSize: 13 },
  inlineLink: { paddingHorizontal: 8, paddingVertical: 8 },
  inlineLinkText: { color: "#2563eb", fontSize: 13, fontWeight: "700", textAlign: "center" },
  backHome: { alignSelf: "center", flexDirection: "row", gap: 6, alignItems: "center", marginTop: 22, padding: 6 },
  backHomeText: { color: "#64748b", fontSize: 13, fontWeight: "600" },
  caption: { marginTop: 14, maxWidth: 400, color: "#94a3b8", fontSize: 11, textAlign: "center" },
});

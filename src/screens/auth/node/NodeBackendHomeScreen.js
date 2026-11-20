import React from "react";
import { SafeAreaView, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { I18nText as Text } from "@/src/i18n";

export default function NodeBackendHomeScreen({ user, onSignOut }) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View style={styles.logo}><Text style={styles.logoText}>S</Text></View>
        <Text style={styles.brand}>Shopp</Text>
        <View style={styles.mode}><Text style={styles.modeText}>NODE.JS</Text></View>
      </View>
      <View style={styles.content}>
        <View style={styles.icon}><Ionicons name="checkmark-circle" size={34} color="#16a34a" /></View>
        <Text style={styles.title}>Sesión Node activa</Text>
        <Text style={styles.subtitle}>La autenticación JWT se ha validado con Express.</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Cuenta</Text>
          <Text style={styles.value}>{user?.name || user?.email || "Usuario"}</Text>
          {user?.name ? <Text style={styles.email}>{user.email}</Text> : null}
          <View style={styles.divider} />
          <Text style={styles.label}>Rol</Text>
          <Text style={styles.value}>{user?.role || "user"}</Text>
        </View>
        <View style={styles.notice}>
          <Ionicons name="information-circle-outline" size={20} color="#1d4ed8" />
          <Text style={styles.noticeText}>Esta fase valida el acceso Node. Las demás pantallas siguen pendientes de migración y se conservan en el modo Convex.</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={onSignOut} style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}>
          <Ionicons name="log-out-outline" size={19} color="#fff" />
          <Text style={styles.signOutText}>Cerrar sesión Node</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  header: { minHeight: 66, paddingHorizontal: 22, flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  logo: { width: 36, height: 36, borderRadius: 11, backgroundColor: "#2563eb", alignItems: "center", justifyContent: "center" },
  logoText: { color: "#fff", fontSize: 21, fontWeight: "900" },
  brand: { marginLeft: 10, color: "#0f172a", fontSize: 22, fontWeight: "800" },
  mode: { marginLeft: "auto", borderRadius: 999, backgroundColor: "#eff6ff", paddingHorizontal: 12, paddingVertical: 7 },
  modeText: { color: "#1d4ed8", fontSize: 11, fontWeight: "800", letterSpacing: 0.6 },
  content: { width: "100%", maxWidth: 540, alignSelf: "center", padding: 24, paddingTop: 54 },
  icon: { width: 64, height: 64, borderRadius: 20, backgroundColor: "#dcfce7", alignItems: "center", justifyContent: "center", alignSelf: "center" },
  title: { marginTop: 18, color: "#0f172a", fontSize: 27, fontWeight: "800", textAlign: "center" },
  subtitle: { marginTop: 8, color: "#64748b", fontSize: 15, textAlign: "center", lineHeight: 22 },
  card: { marginTop: 28, padding: 20, borderRadius: 18, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0" },
  label: { color: "#64748b", fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  value: { marginTop: 5, color: "#0f172a", fontSize: 17, fontWeight: "700" },
  email: { marginTop: 3, color: "#64748b", fontSize: 14 },
  divider: { height: 1, backgroundColor: "#e2e8f0", marginVertical: 16 },
  notice: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 18, padding: 15, borderRadius: 14, backgroundColor: "#eff6ff" },
  noticeText: { flex: 1, color: "#1e3a8a", fontSize: 13, lineHeight: 19 },
  signOut: { minHeight: 50, borderRadius: 13, backgroundColor: "#2563eb", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, marginTop: 22 },
  signOutText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  pressed: { opacity: 0.82 },
});

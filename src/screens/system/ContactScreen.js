import React from "react";
import { Linking, Pressable, SafeAreaView, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { I18nText as Text } from "@/src/i18n";

const GITHUB_URL = "https://github.com/tandemup/shopp";
// Configura EXPO_PUBLIC_CONTACT_EMAIL en .env.local para mostrar tu email de contacto.
const CONTACT_EMAIL = (process.env.EXPO_PUBLIC_CONTACT_EMAIL || "").trim();

export default function ContactScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.brand}>
          <View style={styles.logo}><Text style={styles.logoText}>S</Text></View>
          <Text style={styles.brandText}>Shopp</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Volver a información"
          onPress={() => navigation.goBack()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
          <Ionicons name="arrow-back-outline" size={18} color="#2563eb" />
          <Text style={styles.backText}>Volver a Info</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Ionicons name="person-circle-outline" size={48} color="#2563eb" />
          <Text style={styles.title}>Contacto</Text>
          <Text style={styles.description}>
            ¿Quieres participar en las pruebas de Shopp o enviar alguna sugerencia?
            Puedes ponerte en contacto con el responsable del proyecto.
          </Text>
          {CONTACT_EMAIL ? (
            <Pressable accessibilityRole="link" accessibilityLabel="Enviar correo de contacto"
              onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}`)} style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
              <Ionicons name="mail-outline" size={21} color="#2563eb" />
              <Text style={styles.actionText}>{CONTACT_EMAIL}</Text>
              <Ionicons name="open-outline" size={17} color="#64748b" />
            </Pressable>
          ) : (
            <Text style={styles.notice}>Correo de contacto pendiente de configurar.</Text>
          )}
          <Pressable accessibilityRole="link" accessibilityLabel="Abrir GitHub de Shopp"
            onPress={() => Linking.openURL(GITHUB_URL)} style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
            <Ionicons name="logo-github" size={21} color="#0f172a" />
            <Text style={styles.actionText}>github.com/tandemup/shopp</Text>
            <Ionicons name="open-outline" size={17} color="#64748b" />
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f8fafc" },
  header: { height: 68, paddingHorizontal: 20, flexDirection: "row", gap: 12, alignItems: "center", justifyContent: "space-between", backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#e2e8f0" },
  brand: { flexDirection: "row", alignItems: "center", gap: 9 },
  logo: { width: 32, height: 32, backgroundColor: "#2563eb", borderRadius: 9, alignItems: "center", justifyContent: "center" },
  logoText: { color: "white", fontSize: 18, fontWeight: "900" },
  brandText: { color: "#0f172a", fontSize: 22, fontWeight: "900" },
  back: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, borderWidth: 1, borderColor: "#dbe3ef", borderRadius: 10, paddingHorizontal: 12 },
  backText: { color: "#2563eb", fontWeight: "800", fontSize: 14 },
  pressed: { opacity: 0.75 },
  content: { flexGrow: 1, padding: 24, alignItems: "center", justifyContent: "center" },
  card: { width: "100%", maxWidth: 520, backgroundColor: "white", borderColor: "#e2e8f0", borderWidth: 1, borderRadius: 20, padding: 28, alignItems: "center", gap: 18 },
  title: { color: "#0f172a", fontSize: 28, fontWeight: "900" },
  description: { color: "#475569", fontSize: 15, lineHeight: 23, textAlign: "center" },
  notice: { color: "#64748b", fontSize: 13, textAlign: "center" },
  action: { width: "100%", padding: 14, flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 9, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 12 },
  actionText: { fontSize: 14, color: "#0f172a", fontWeight: "700" },
});

import React from "react";
import {
  Linking,
  Pressable,
  SafeAreaView,
  StyleSheet,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { I18nText as Text } from "@/src/i18n";

const GITHUB_URL = "https://github.com/tandemup/shopp";

export default function DevelopmentScreen({ navigation }) {
  const openGitHub = () => Linking.openURL(GITHUB_URL);
  const openLogin = () =>
    navigation.navigate("Login", { developmentMode: true });

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerBrand}>
          <View style={styles.headerLogoMark}>
            <Text style={styles.headerLogoText}>S</Text>
          </View>
          <Text style={styles.headerTitle}>Shopp</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Entrar en Shopp"
          onPress={openLogin}
          style={({ pressed }) => [
            styles.loginButton,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.loginButtonText}>Entrar</Text>
        </Pressable>
      </View>

      <View style={styles.screen}>
        <View style={styles.card}>
          <View style={styles.logoMark}>
            <Text style={styles.logoMarkText}>S</Text>
          </View>

          <Text style={styles.brand}>Shopp</Text>

          <View style={styles.statusRow}>
            <Ionicons name="construct-outline" size={20} color="#2563eb" />
            <Text style={styles.statusText}>EN DESARROLLO</Text>
          </View>

          <Text style={styles.title}>Estamos preparando Shopp</Text>
          <Text style={styles.description}>
            La aplicación está siendo desarrollada y todavía no está disponible
            para uso público.
          </Text>
          <Text style={styles.secondaryText}>
            Estamos trabajando en sus utilidades, estabilidad y experiencia en
            móvil, tablet y escritorio.
          </Text>

          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Abrir repositorio de Shopp en GitHub"
            onPress={openGitHub}
            style={({ pressed }) => [
              styles.githubButton,
              pressed && styles.githubButtonPressed,
            ]}
          >
            <Ionicons name="logo-github" size={20} color="#0f172a" />
            <Text style={styles.githubButtonText}>
              github.com/tandemup/shopp
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    width: "100%",
    minHeight: 68,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  headerBrand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  headerLogoMark: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563eb",
  },
  headerLogoText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
  },
  headerTitle: {
    color: "#0f172a",
    fontSize: 22,
    fontWeight: "900",
  },
  loginButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#dbe3ef",
    backgroundColor: "#ffffff",
  },
  loginButtonText: {
    color: "#2563eb",
    fontSize: 14,
    fontWeight: "800",
  },
  buttonPressed: {
    opacity: 0.75,
  },
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 32,
    backgroundColor: "#f8fafc",
  },
  card: {
    width: "100%",
    maxWidth: 560,
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 24,
    paddingHorizontal: 28,
    paddingVertical: 40,
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  logoMark: {
    width: 58,
    height: 58,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563eb",
    marginBottom: 14,
  },
  logoMarkText: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "900",
  },
  brand: {
    color: "#0f172a",
    fontSize: 28,
    fontWeight: "900",
    marginBottom: 22,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#eff6ff",
    marginBottom: 22,
  },
  statusText: {
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.9,
  },
  title: {
    color: "#0f172a",
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
    textAlign: "center",
  },
  description: {
    marginTop: 14,
    color: "#475569",
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
  },
  secondaryText: {
    marginTop: 10,
    color: "#64748b",
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  githubButton: {
    marginTop: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
  },
  githubButtonPressed: {
    opacity: 0.75,
  },
  githubButtonText: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "700",
  },
});

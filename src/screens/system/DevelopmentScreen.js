import React from "react";
import {
  Pressable,
  SafeAreaView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { I18nText as Text } from "@/src/i18n";

export default function DevelopmentScreen({ navigation, onGuestContinue }) {
  const { width } = useWindowDimensions();
  const compactHeader = width < 820;
  const narrowScreen = width < 520;

  const openLogin = () =>
    navigation.navigate("Login", { developmentMode: true });
  const openInfo = () => navigation.navigate("Information");
  const openTesterRegister = () =>
    navigation.navigate("Register", { testerAccount: true });

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.header, compactHeader && styles.headerCompact]}>
        <View style={styles.headerBrand}>
          <View style={styles.headerLogoMark}>
            <Text style={styles.headerLogoText}>S</Text>
          </View>
          <Text style={styles.headerTitle}>Shopp</Text>
        </View>

        <View style={[styles.headerActions, compactHeader && styles.headerActionsCompact]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Información de Shopp"
            onPress={openInfo}
            style={({ pressed }) => [
              styles.secondaryHeaderButton,
              compactHeader && styles.compactHeaderButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Ionicons name="information-circle-outline" size={18} color="#2563eb" />
            <Text style={styles.secondaryHeaderButtonText}>Info</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Entrar en Shopp"
            onPress={openLogin}
            style={({ pressed }) => [
              styles.secondaryHeaderButton,
              compactHeader && styles.compactHeaderButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.secondaryHeaderButtonText}>Entrar</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Registro de betatester"
            onPress={openTesterRegister}
            style={({ pressed }) => [
              styles.primaryHeaderButton,
              compactHeader && styles.compactHeaderButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.primaryHeaderButtonText}>Registro tester</Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.screen, narrowScreen && styles.screenNarrow]}>
        <View style={[styles.card, narrowScreen && styles.cardNarrow]}>
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

          {onGuestContinue ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Continuar como invitado sin registro"
              onPress={onGuestContinue}
              style={({ pressed }) => [
                styles.guestButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Ionicons name="person-outline" size={19} color="#ffffff" />
              <Text style={styles.guestButtonText}>Continuar como invitado</Text>
            </Pressable>
          ) : null}


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
    paddingHorizontal: 20,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  headerCompact: {
    flexWrap: "wrap",
    gap: 12,
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
  headerActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 10,
  },
  headerActionsCompact: {
    width: "100%",
    justifyContent: "flex-start",
  },
  secondaryHeaderButton: {
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#dbe3ef",
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  secondaryHeaderButtonText: {
    color: "#2563eb",
    fontSize: 14,
    fontWeight: "800",
  },
  primaryHeaderButton: {
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: "#2563eb",
    borderWidth: 1,
    borderColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryHeaderButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  compactHeaderButton: {
    paddingHorizontal: 12,
  },
  buttonPressed: {
    opacity: 0.75,
  },
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 24,
    backgroundColor: "#f8fafc",
  },
  screenNarrow: {
    justifyContent: "flex-start",
  },
  card: {
    width: "100%",
    maxWidth: 460,
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 22,
    paddingHorizontal: 24,
    paddingVertical: 32,
    shadowColor: "#0f172a",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  cardNarrow: {
    maxWidth: 420,
  },
  logoMark: {
    width: 54,
    height: 54,
    borderRadius: 15,
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
    fontSize: 26,
    fontWeight: "900",
    marginBottom: 18,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#eff6ff",
    marginBottom: 18,
  },
  statusText: {
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.9,
  },
  title: {
    color: "#0f172a",
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "900",
    textAlign: "center",
  },
  description: {
    marginTop: 12,
    color: "#475569",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  secondaryText: {
    marginTop: 8,
    color: "#64748b",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  guestButton: {
    marginTop: 24,
    minHeight: 46,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#2563eb",
    flexDirection: "row",
    gap: 9,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "stretch",
  },
  guestButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "800",
  },
  githubButton: {
    marginTop: 20,
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

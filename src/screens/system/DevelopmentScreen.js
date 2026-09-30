import React from "react";
import {
  Linking,
  Pressable,
  SafeAreaView,
  StyleSheet,
  View,
} from "react-native";
import { I18nText as Text } from "@/src/i18n";

const CONTACT_EMAIL = "info@ramshopp.com";

export default function DevelopmentScreen({ navigation }) {
  const openLogin = () =>
    navigation.navigate("Login", { developmentMode: true });

  const openTesterRegistration = () =>
    navigation.navigate("Register", {
      developmentMode: true,
      testerAccount: true,
    });

  const openEmail = () => Linking.openURL(`mailto:${CONTACT_EMAIL}`);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.brand}>
          <View style={styles.logoMark}>
            <Text style={styles.logoMarkText}>S</Text>
          </View>
          <Text style={styles.brandText}>Shopp</Text>
        </View>

        <View style={styles.headerActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Crear cuenta tester"
            onPress={openTesterRegistration}
            style={({ pressed }) => [
              styles.testerButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.testerButtonText}>Crear cuenta tester</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Login"
            onPress={openLogin}
            style={({ pressed }) => [
              styles.loginButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.loginButtonText}>Login</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>En desarrollo</Text>

        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`Contactar por email: ${CONTACT_EMAIL}`}
          onPress={openEmail}
          style={({ pressed }) => [
            styles.contact,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.contactLabel}>Contactar:</Text>
          <Text style={styles.email}>{CONTACT_EMAIL}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#ffffff",
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
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  logoMark: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563eb",
  },
  logoMarkText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
  },
  brandText: {
    color: "#0f172a",
    fontSize: 22,
    fontWeight: "900",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  testerButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
  },
  testerButtonText: {
    color: "#1d4ed8",
    fontSize: 13,
    fontWeight: "800",
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
  pressed: {
    opacity: 0.75,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  title: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 10,
  },
  contact: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  contactLabel: {
    color: "#64748b",
    fontSize: 13,
  },
  email: {
    color: "#2563eb",
    fontSize: 13,
    fontWeight: "700",
  },
});

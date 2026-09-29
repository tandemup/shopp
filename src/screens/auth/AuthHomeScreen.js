import React from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { I18nText as Text } from "@/src/i18n";

export default function AuthHomeScreen({ navigation }) {
  const { width } = useWindowDimensions();
  const compact = width < 700;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, compact && styles.headerCompact]}>
        <View style={styles.brand}>
          <View style={styles.logoMark}>
            <Text style={styles.logoMarkText}>S</Text>
          </View>
          <Text style={styles.logo}>Shopp</Text>
        </View>

        <View style={styles.actions}>
          {!compact ? (
            <>
              <Pressable style={styles.menuButton}>
                <Text style={styles.menuText}>Inicio</Text>
              </Pressable>
              <Pressable style={styles.menuButton}>
                <Text style={styles.menuText}>Características</Text>
              </Pressable>
              <Pressable style={styles.menuButton}>
                <Text style={styles.menuText}>Cómo funciona</Text>
              </Pressable>
            </>
          ) : null}

          <Pressable
            style={({ pressed }) => [styles.loginButton, pressed && styles.pressed]}
            onPress={() => navigation.navigate("Login")}
          >
            <Text style={styles.loginText}>Entrar</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.registerButton, pressed && styles.pressed]}
            onPress={() => navigation.navigate("Register")}
          >
            <Text style={styles.registerText}>Crear cuenta</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.blankPage} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  header: {
    width: "100%",
    minHeight: 72,
    paddingHorizontal: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    ...Platform.select({
      web: { position: "relative" },
      default: {},
    }),
  },
  headerCompact: {
    minHeight: 64,
    paddingHorizontal: 16,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logoMark: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
  },
  logoMarkText: {
    color: "#ffffff",
    fontSize: 19,
    fontWeight: "900",
  },
  logo: {
    fontSize: 24,
    fontWeight: "900",
    color: "#0f172a",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  menuButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  menuText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
  },
  loginButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#dbe3ef",
    backgroundColor: "#ffffff",
  },
  loginText: {
    color: "#2563eb",
    fontSize: 14,
    fontWeight: "800",
  },
  registerButton: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: "#2563eb",
  },
  registerText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  pressed: {
    opacity: 0.8,
  },
  blankPage: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
});

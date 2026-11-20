import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { I18nText as Text } from "@/src/i18n";
import AuthStack from "@/src/navigation/AuthStack";
import NodeShoppingListsScreen from "@/src/screens/auth/node/NodeShoppingListsScreen";
import NodeChatScreen from "@/src/screens/auth/node/NodeChatScreen";
import { useNodeAuth } from "@/src/context/NodeAuthContext";

const APP_MODE = String(process.env.EXPO_PUBLIC_APP_MODE || "development").trim().toLowerCase();
const ACCESS_MODE = String(process.env.EXPO_PUBLIC_ACCESS_MODE || "landing").trim().toLowerCase();

function SessionRestoreError({ error, onRetry, onSignOut }) {
  return (
    <View style={styles.center}>
      <Text style={styles.title}>No se pudo comprobar la sesión</Text>
      <Text style={styles.message}>{error || "Comprueba que Express esté disponible."}</Text>
      <Pressable accessibilityRole="button" style={styles.button} onPress={onRetry}>
        <Text style={styles.buttonText}>Reintentar</Text>
      </Pressable>
      <Pressable accessibilityRole="button" style={styles.linkButton} onPress={onSignOut}>
        <Text style={styles.linkText}>Volver al inicio de sesión</Text>
      </Pressable>
    </View>
  );
}

export default function NodeAppNavigator() {
  const [activeScreen, setActiveScreen] = useState("shopping");
  const { status, user, accessToken, error, signOut, reloadSession } = useNodeAuth();

  if (status === "loading") {
    return <View style={styles.center}><ActivityIndicator size="large" color="#2563eb" /><Text style={styles.message}>Comprobando sesión Node…</Text></View>;
  }
  if (status === "error") return <SessionRestoreError error={error} onRetry={reloadSession} onSignOut={signOut} />;
  if (status === "signed_in" && user) {
    if (activeScreen === "chat") return <NodeChatScreen user={user} accessToken={accessToken} onBack={() => setActiveScreen("shopping")} />;
    return <NodeShoppingListsScreen user={user} accessToken={accessToken} onSignOut={signOut} onOpenChat={() => setActiveScreen("chat")} />;
  }

  return <AuthStack accessMode={APP_MODE === "development" ? "development" : ACCESS_MODE} backendProvider="node" />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, backgroundColor: "#f8fafc" },
  title: { color: "#0f172a", fontSize: 23, fontWeight: "800", textAlign: "center" },
  message: { color: "#64748b", fontSize: 15, lineHeight: 22, marginTop: 12, textAlign: "center" },
  button: { backgroundColor: "#2563eb", borderRadius: 12, marginTop: 22, minHeight: 48, justifyContent: "center", paddingHorizontal: 24 },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  linkButton: { padding: 14, marginTop: 6 },
  linkText: { color: "#2563eb", fontWeight: "700" },
});

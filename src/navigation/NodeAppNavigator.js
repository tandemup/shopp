import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { I18nText as Text } from "@/src/i18n";
import AuthStack from "@/src/navigation/AuthStack";
import NodeShoppingListsScreen from "@/src/screens/auth/node/NodeShoppingListsScreen";
import NodeChatScreen from "@/src/screens/auth/node/NodeChatScreen";
import NodeAdminUsersScreen from "@/src/screens/auth/node/NodeAdminUsersScreen";
import NodeProductReviewsScreen from "@/src/screens/auth/node/NodeProductReviewsScreen";
import NodeProfileScreen from "@/src/screens/auth/node/NodeProfileScreen";
import { NodeResetPasswordScreen } from "@/src/screens/auth/node/NodeAuthScreens";
import NodeEmailChangeScreen from "@/src/screens/auth/node/NodeEmailChangeScreen";
import { useNodeAuth } from "@/src/context/NodeAuthContext";

const APP_MODE = String(process.env.EXPO_PUBLIC_APP_MODE || "development").trim().toLowerCase();
const ACCESS_MODE = String(process.env.EXPO_PUBLIC_ACCESS_MODE || "landing").trim().toLowerCase();
const DEFAULT_AUTH_ACCESS_MODE = APP_MODE === "development" ? "development" : ACCESS_MODE;

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
  const [signedOutAccessMode, setSignedOutAccessMode] = useState(DEFAULT_AUTH_ACCESS_MODE);
  const { status, user, accessToken, error, signOut, reloadSession, updateProfile, requestEmailChange, confirmEmailChange } = useNodeAuth();

  if (status === "loading") {
    return <View style={styles.center}><ActivityIndicator size="large" color="#2563eb" /><Text style={styles.message}>Comprobando sesión Node…</Text></View>;
  }
  if (status === "error") return <SessionRestoreError error={error} onRetry={reloadSession} onSignOut={signOut} />;
  if (status === "signed_in" && user) {
    const canUseChat = user.role === "admin" || user.permissions?.chat === true;
    if (activeScreen === "profile") return <NodeProfileScreen user={user} onBack={() => setActiveScreen("shopping")} onUpdateProfile={updateProfile} onChangePassword={() => setActiveScreen("password")} onChangeEmail={() => setActiveScreen("email")} />;
    if (activeScreen === "email") return <NodeEmailChangeScreen user={user} onBack={() => setActiveScreen("profile")} onRequestCode={requestEmailChange} onConfirmCode={confirmEmailChange} onDone={() => { setSignedOutAccessMode("login"); signOut(); }} />;
    if (activeScreen === "password") {
      const navigation = {
        navigate: (routeName) => {
          if (routeName === "AuthHome") setActiveScreen("profile");
          if (routeName === "Login") {
            setSignedOutAccessMode("login");
            signOut();
          }
        },
      };
      return <NodeResetPasswordScreen route={{ params: { email: user.email } }} navigation={navigation} onPasswordResetComplete={() => { setSignedOutAccessMode("login"); signOut(); }} />;
    }
    if (activeScreen === "chat" && canUseChat) return <NodeChatScreen user={user} accessToken={accessToken} onBack={() => setActiveScreen("shopping")} />;
    if (activeScreen === "users" && user.role === "admin") return <NodeAdminUsersScreen user={user} accessToken={accessToken} onBack={() => setActiveScreen("shopping")} onOpenProductReviews={() => setActiveScreen("productReviews")} />;
    if (activeScreen === "productReviews" && user.role === "admin") return <NodeProductReviewsScreen accessToken={accessToken} onBack={() => setActiveScreen("users")} />;
    return <NodeShoppingListsScreen user={user} accessToken={accessToken} onSignOut={signOut} onOpenProfile={() => setActiveScreen("profile")} onOpenChat={canUseChat ? () => setActiveScreen("chat") : null} onOpenUsers={user.role === "admin" ? () => setActiveScreen("users") : null} />;
  }

  return <AuthStack accessMode={signedOutAccessMode} backendProvider="node" />;
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

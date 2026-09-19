import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { I18nText as Text } from "@/src/i18n";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";

import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";

import AuthStack from "@/src/navigation/AuthStack";
import MainTabs from "@/src/navigation/MainTabs";
import PlaybackProvider from "@/src/components/playback/PlaybackProvider";
import SplashScreen from "@/src/screens/system/SplashScreen";

function AuthenticatedApp() {
  const currentUser = useQuery(api.users.current);
  const { signOut } = useAuthActions();
  if (currentUser === undefined) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" /><Text style={styles.loadingText}>Comprobando cuenta...</Text></View>;
  }
  if (currentUser?.status === "blocked") {
    return <View style={styles.loadingContainer}>
      <Text style={styles.loadingText}>Tu cuenta está bloqueada. Contacta con administración.</Text>
      <Pressable accessibilityRole="button" onPress={() => signOut()} style={styles.signOutButton}>
        <Text style={styles.signOutText}>Cerrar sesión</Text>
      </Pressable>
    </View>;
  }
  if (!currentUser) {
    return <View style={styles.loadingContainer}><Text>No se pudo cargar tu cuenta.</Text></View>;
  }
  return <PlaybackProvider><MainTabs /></PlaybackProvider>;
}

export default function AppNavigator() {
  const [showSplash, setShowSplash] = useState(true);
  const finishSplash = useCallback(() => setShowSplash(false), []);

  if (showSplash) {
    return <SplashScreen onFinish={finishSplash} />;
  }

  return (
    <>
      <AuthLoading>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Cargando Shopp...</Text>
        </View>
      </AuthLoading>

      <Unauthenticated>
        <AuthStack />
      </Unauthenticated>

      <Authenticated>
        <AuthenticatedApp />
      </Authenticated>
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#f8fafc",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#475569",
    fontWeight: "600",
  },
  signOutButton: { marginTop: 18, padding: 12, backgroundColor: "#2563eb", borderRadius: 8 },
  signOutText: { color: "#ffffff", fontWeight: "700" },
});

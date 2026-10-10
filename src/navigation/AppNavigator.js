import React, { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { I18nText as Text } from "@/src/i18n";
import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
  useConvexAuth,
  useQuery,
} from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";

import AuthStack from "@/src/navigation/AuthStack";
import MainTabs from "@/src/navigation/MainTabs";
import PlaybackProvider from "@/src/components/playback/PlaybackProvider";
import SplashScreen from "@/src/screens/system/SplashScreen";

const APP_MODE = String(
  process.env.EXPO_PUBLIC_APP_MODE || "development",
)
  .trim()
  .toLowerCase();

const ACCESS_MODE = String(
  process.env.EXPO_PUBLIC_ACCESS_MODE || "landing",
)
  .trim()
  .toLowerCase();

const GUEST_SESSION_KEY = "@shopp/guest-session-v1";

const SHOW_PUBLIC_ENTRY_FIRST =
  ACCESS_MODE === "landing" || ACCESS_MODE === "survey";

function AuthenticatedApp() {
  const currentUser = useQuery(api.users.current);
  const { signOut } = useAuthActions();

  if (currentUser === undefined) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Comprobando cuenta...</Text>
      </View>
    );
  }

  if (currentUser?.status === "blocked") {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>
          Tu cuenta está bloqueada. Contacta con administración.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => signOut()}
          style={styles.signOutButton}
        >
          <Text style={styles.signOutText}>Cerrar sesión</Text>
        </Pressable>
      </View>
    );
  }

  if (!currentUser) {
    return (
      <View style={styles.loadingContainer}>
        <Text>No se pudo cargar tu cuenta.</Text>
      </View>
    );
  }

  return (
    <PlaybackProvider>
      <MainTabs />
    </PlaybackProvider>
  );
}

export default function AppNavigator() {
  const [showSplash, setShowSplash] = useState(true);
  const [publicEntryComplete, setPublicEntryComplete] = useState(false);
  const [guestMode, setGuestMode] = useState(false);
  const [guestRestored, setGuestRestored] = useState(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(GUEST_SESSION_KEY)
      .then((value) => { if (active && value === "true") setGuestMode(true); })
      .catch(() => {})
      .finally(() => { if (active) setGuestRestored(true); });
    return () => { active = false; };
  }, []);
  const initialAuthStateRef = useRef(null);
  const { isAuthenticated, isLoading } = useConvexAuth();

  const finishSplash = useCallback(() => setShowSplash(false), []);
  const continueToAuthenticatedApp = useCallback(() => {
    setGuestMode(false);
    AsyncStorage.removeItem(GUEST_SESSION_KEY).catch(() => {});
    setPublicEntryComplete(true);
  }, []);

  const continueAsGuest = useCallback(() => {
    setGuestMode(true);
    AsyncStorage.setItem(GUEST_SESSION_KEY, "true").catch(() => {});
    setPublicEntryComplete(true);
  }, []);

  const exitGuestMode = useCallback(() => {
    setGuestMode(false);
    AsyncStorage.removeItem(GUEST_SESSION_KEY).catch(() => {});
    setPublicEntryComplete(false);
  }, []);

  useEffect(() => {
    if (showSplash || isLoading) {
      return;
    }

    // Guardamos cómo estaba la sesión al arrancar. Si el usuario ya estaba
    // autenticado, landing/survey deben seguir mostrándose hasta que pulse Entrar.
    if (initialAuthStateRef.current === null) {
      initialAuthStateRef.current = isAuthenticated;
      return;
    }

    // Si arrancó sin sesión y se autentica desde Login/Register, dejamos
    // automáticamente la zona pública y entramos en Shopp.
    if (
      SHOW_PUBLIC_ENTRY_FIRST &&
      initialAuthStateRef.current === false &&
      isAuthenticated
    ) {
      setPublicEntryComplete(true);
    }
  }, [isAuthenticated, isLoading, showSplash]);

  if (showSplash) {
    return <SplashScreen onFinish={finishSplash} />;
  }

  if (!guestRestored) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" /></View>;
  }

  // Un invitado que vuelve a abrir la aplicación recupera su sesión local.
  if (guestMode) {
    return <PlaybackProvider><MainTabs guestMode onExitGuest={exitGuestMode} /></PlaybackProvider>;
  }

  // Modo de desarrollo público:
  // - sin sesión: pantalla "En desarrollo" con acceso por email;
  // - con sesión válida: acceso normal a Shopp.
  if (APP_MODE === "development") {
    return (
      <>
        <AuthLoading>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>Cargando Shopp...</Text>
          </View>
        </AuthLoading>

        <Unauthenticated>
          <AuthStack accessMode="development" onGuestContinue={continueAsGuest} />
        </Unauthenticated>

        <Authenticated>
          <AuthenticatedApp />
        </Authenticated>
      </>
    );
  }

  // landing y survey son modos de ARRANQUE públicos. Se muestran incluso si
  // Convex conserva una sesión válida. El botón Entrar permite continuar hacia
  // MainTabs sin volver a pedir credenciales cuando ya hay sesión.
  if (SHOW_PUBLIC_ENTRY_FIRST && !publicEntryComplete) {
    return (
      <AuthStack
        accessMode={ACCESS_MODE}
        isAuthenticated={isAuthenticated}
        onAuthenticatedContinue={continueToAuthenticatedApp}
        onGuestContinue={continueAsGuest}
      />
    );
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
        <AuthStack accessMode={ACCESS_MODE} onGuestContinue={continueAsGuest} />
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
  signOutButton: {
    marginTop: 18,
    padding: 12,
    backgroundColor: "#2563eb",
    borderRadius: 8,
  },
  signOutText: { color: "#ffffff", fontWeight: "700" },
});

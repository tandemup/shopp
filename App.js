import React from "react";
import {
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { LocationProvider } from "@/src/context/LocationContext";
import { ListsProvider } from "@/src/context/ListsContext";
import { StoresProvider } from "@/src/context/StoresContext";
import DialogHost from "@/src/components/ui/alert/DialogHost";
import AppNavigator from "@/src/navigation/AppNavigator";
import { I18nProvider, useI18n } from "@/src/i18n";

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL);

export default function App() {
  return (
    <I18nProvider>
      <ShoppApp />
    </I18nProvider>
  );
}

function ShoppApp() {
  return (
    <SafeAreaProvider>
      <ConvexAuthProvider client={convex}>
        <ListsProvider>
          <StoresProvider>
            <LocationProvider>
              <NavigationContainer>
                <AppNavigator />
              </NavigationContainer>
              {Platform.OS === "web" ? <DialogHost /> : null}
              <MobilePortraitGuard />
            </LocationProvider>
          </StoresProvider>
        </ListsProvider>
      </ConvexAuthProvider>
    </SafeAreaProvider>
  );
}

/**
 * iOS Safari does not reliably enforce the orientation declared in the web
 * manifest. Keep phone-sized PWA views unusable in landscape while preserving
 * the regular wide-screen experience on tablets and computers.
 */
function MobilePortraitGuard() {
  const { width, height } = useWindowDimensions();
  const { t } = useI18n();
  const hasCoarsePointer =
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches;

  const isPhoneLandscape =
    hasCoarsePointer && width > height && height <= 600 && width <= 1000;

  if (!isPhoneLandscape) return null;

  return (
    <View
      accessible
      accessibilityRole="alert"
      accessibilityLabel={t("Gira el móvil en vertical")}
      style={styles.portraitGuard}
    >
      <Text style={styles.portraitGuardIcon}>↻</Text>
      <Text style={styles.portraitGuardTitle}>
        {t("Gira el móvil en vertical")}
      </Text>
      <Text style={styles.portraitGuardText}>
        {t("Shopp se usa solo en posición vertical.")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  portraitGuard: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 999999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    backgroundColor: "#FFFBF3",
  },
  portraitGuardIcon: {
    marginBottom: 18,
    color: "#2563EB",
    fontSize: 72,
    fontWeight: "700",
    lineHeight: 78,
  },
  portraitGuardTitle: {
    color: "#172554",
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
  },
  portraitGuardText: {
    maxWidth: 320,
    marginTop: 10,
    color: "#475569",
    fontSize: 16,
    lineHeight: 23,
    textAlign: "center",
  },
});

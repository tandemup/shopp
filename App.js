import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { LocationProvider } from "@/src/context/LocationContext";
import { ListsProvider } from "@/src/context/ListsContext";
import { StoresProvider } from "@/src/context/StoresContext";
import DialogHost from "@/src/components/ui/alert/DialogHost";
import AppNavigator from "@/src/navigation/AppNavigator";
import { I18nProvider } from "@/src/i18n";

const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL?.trim();
const hasValidConvexUrl = /^https:\/\/[^\s/]+\.convex\.cloud\/?$/.test(
  convexUrl || "",
);
const convex = hasValidConvexUrl ? new ConvexReactClient(convexUrl) : null;

export default function App() {
  return (
    <I18nProvider>
      <ShoppApp />
    </I18nProvider>
  );
}

function ShoppApp() {
  if (!convex) {
    return (
      <SafeAreaProvider>
        <View style={styles.configurationError}>
          <Text style={styles.configurationTitle}>Configuración de Shopp</Text>
          <Text style={styles.configurationMessage}>
            Falta EXPO_PUBLIC_CONVEX_URL o no tiene una URL válida de Convex.
            Comprueba .env.local, reinicia Expo y verifica el deployment.
          </Text>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <ConvexAuthProvider client={convex}>
        <ListsProvider>
          <StoresProvider>
            <LocationProvider>
              <NavigationContainer documentTitle={{ enabled: false }}>
                <AppNavigator />
              </NavigationContainer>
              {Platform.OS === "web" ? <DialogHost /> : null}
            </LocationProvider>
          </StoresProvider>
        </ListsProvider>
      </ConvexAuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  configurationError: {
    flex: 1, justifyContent: "center", alignItems: "center",
    padding: 24, backgroundColor: "#f8fafc",
  },
  configurationTitle: { fontSize: 22, fontWeight: "700", color: "#0f172a" },
  configurationMessage: {
    marginTop: 12, maxWidth: 480, textAlign: "center",
    fontSize: 16, lineHeight: 24, color: "#475569",
  },
});

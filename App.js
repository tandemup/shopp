import React from "react";
import { Platform } from "react-native";
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

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL);

export default function App() {
  return (
    <I18nProvider>
      <SafeAreaProvider>
        <ConvexAuthProvider client={convex}>
          <ListsProvider>
            <StoresProvider>
              <LocationProvider>
                <NavigationContainer>
                  <AppNavigator />
                </NavigationContainer>
                {Platform.OS === "web" ? <DialogHost /> : null}
              </LocationProvider>
            </StoresProvider>
          </ListsProvider>
        </ConvexAuthProvider>
      </SafeAreaProvider>
    </I18nProvider>
  );
}

import DialogProvider from "@/src/components/ui/dialog/DialogProvider";
import { ThemeProvider } from "@/src/hooks/useTheme";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { Stack } from "expo-router";
// import "leaflet/dist/leaflet.css";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ConfigProvider } from "@/src/context/ConfigContext";
import { ListsProvider } from "@/src/context/ListsContext";
import { LocationProvider } from "@/src/context/LocationContext";
import { PurchasesProvider } from "@/src/context/PurchasesContext";
import { StoresProvider } from "@/src/context/StoresContext";

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!);

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ConfigProvider>
        <ConvexProvider client={convex}>
          <ThemeProvider>
            <LocationProvider>
              <DialogProvider>
                <StoresProvider>
                  <ListsProvider>
                    <PurchasesProvider>
                      <Stack screenOptions={{ headerShown: false }}>
                        <Stack.Screen name="(tabs)" />

                        <Stack.Screen
                          name="list/[id]"
                          options={{ headerShown: true }}
                        />

                        <Stack.Screen
                          name="(modals)"
                          options={{ presentation: "modal" }}
                        />
                      </Stack>
                    </PurchasesProvider>
                  </ListsProvider>
                </StoresProvider>
              </DialogProvider>
            </LocationProvider>
          </ThemeProvider>
        </ConvexProvider>
      </ConfigProvider>
    </SafeAreaProvider>
  );
}

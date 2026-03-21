import { ConvexProvider, ConvexReactClient } from "convex/react";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import DialogProvider from "../src/components/ui/dialog/DialogProvider";
import { ThemeProvider } from "../src/hooks/useTheme";

import { ConfigProvider } from "@/src/context/configContext";
import { ListsProvider } from "@/src/context/listsContext";
import { LocationProvider } from "@/src/context/locationContext";
import { PurchasesProvider } from "@/src/context/purchasesContext";
import { StoresProvider } from "@/src/context/storesContext";

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

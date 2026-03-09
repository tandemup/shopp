import DialogProvider from "@/src/components/ui/dialog/DialogProvider";
import { ListsProvider } from "@/src/context/ListsContext";
import { PurchasesProvider } from "@/src/context/PurchasesContext";
import { StoresProvider } from "@/src/context/StoresContext";
import { ThemeProvider } from "@/src/hooks/useTheme";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!);

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ConvexProvider client={convex}>
        <ThemeProvider>
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
        </ThemeProvider>
      </ConvexProvider>
    </SafeAreaProvider>
  );
}

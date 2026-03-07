import DialogProvider from "@/components/ui/DialogProvider";
import { ThemeProvider } from "@/hooks/useTheme";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { loadApp } from "../src/lib/loadApp";

SplashScreen.preventAutoHideAsync().catch(() => {});

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, {
  unsavedChangesWarning: false,
});

export default function RootLayout() {
  useEffect(() => {
    async function prepare() {
      try {
        await loadApp();
      } catch (e) {
        console.warn(e);
      } finally {
        await SplashScreen.hideAsync();
      }
    }

    prepare();
  }, []);

  return (
    <ConvexProvider client={convex}>
      <ThemeProvider>
        <DialogProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </DialogProvider>
      </ThemeProvider>
    </ConvexProvider>
  );
}

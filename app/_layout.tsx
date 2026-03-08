import DialogProvider from "@/components/ui/dialog/DialogProvider";
import { ThemeProvider } from "@/hooks/useTheme";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { Stack } from "expo-router";

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!);

export default function RootLayout() {
  return (
    <ConvexProvider client={convex}>
      <ThemeProvider>
        <DialogProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />

            <Stack.Screen name="list/[id]" options={{ headerShown: true }} />

            <Stack.Screen name="(modals)" options={{ presentation: "modal" }} />
          </Stack>
        </DialogProvider>
      </ThemeProvider>
    </ConvexProvider>
  );
}

import { Stack } from "expo-router";

export default function StorefrontLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Tiendas" }} />
      <Stack.Screen name="explore" options={{ title: "Explorar tiendas" }} />
      <Stack.Screen name="favorites" options={{ title: "Favoritas" }} />
    </Stack>
  );
}

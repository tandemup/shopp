import { Stack } from "expo-router";

export default function StoreLayout() {
  return (
    <Stack
      screenOptions={{
        headerTitleAlign: "center",
        headerBackTitle: "Back",
        headerBackVisible: true,
      }}
    >
      <Stack.Screen name="select" options={{ title: "Seleccionar tienda" }} />

      <Stack.Screen name="explore" options={{ title: "Explorar tiendas" }} />

      <Stack.Screen name="favorites" options={{ title: "Tiendas favoritas" }} />

      <Stack.Screen name="nearby" options={{ title: "Tiendas cercanas" }} />
    </Stack>
  );
}

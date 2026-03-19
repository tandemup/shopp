import { Stack } from "expo-router";

export default function StorefrontLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: "Tiendas",
          headerBackTitle: "Atrás",
          headerBackVisible: true,
        }}
      />
      <Stack.Screen
        name="explore"
        options={{
          title: "Explorar tiendas",
          headerBackTitle: "Atrás",
          headerBackVisible: true,
        }}
      />
      <Stack.Screen
        name="favorites"
        options={{
          title: "Favoritas",
          headerBackTitle: "Atrás",
          headerBackVisible: true,
        }}
      />
      <Stack.Screen
        name="nearby"
        options={{
          title: "Cercanas",
          headerBackTitle: "Atrás",
          headerBackVisible: true,
        }}
      />
      <Stack.Screen
        name="select"
        options={{
          title: "Seleccionar tienda",
          headerBackTitle: "Atrás",
          headerBackVisible: true,
        }}
      />
      <Stack.Screen
        name="map"
        options={{
          title: "Mapa",
          headerBackTitle: "Atrás",
          headerBackVisible: true,
        }}
      />
    </Stack>
  );
}

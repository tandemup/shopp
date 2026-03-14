import { Stack } from "expo-router";

export default function ModalLayout() {
  return (
    <Stack
      screenOptions={{
        presentation: "modal",
        headerShown: true,
        animation: "slide_from_bottom",
      }}
    >
      <Stack.Screen name="create-list" options={{ title: "New List" }} />
      <Stack.Screen name="add-item" options={{ title: "Add Item" }} />
      <Stack.Screen name="edit-item" options={{ title: "Edit Item" }} />
    </Stack>
  );
}

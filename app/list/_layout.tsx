import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { Pressable } from "react-native";

export default function ListLayout() {
  const router = useRouter();

  return (
    <Stack
      screenOptions={{
        headerLeft: () => (
          <Pressable
            onPress={() => router.back()}
            style={{ paddingHorizontal: 10 }}
          >
            <Ionicons name="chevron-back" size={22} />
          </Pressable>
        ),
      }}
    >
      <Stack.Screen
        name="[id]"
        options={{
          headerTitle: "Shopping List",
        }}
      />
    </Stack>
  );
}

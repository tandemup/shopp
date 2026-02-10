import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { colors, spacing, typography } from "../../theme";

export default function HomeScreen() {
  const router = useRouter();

  return (
    <View
      style={{
        flex: 1,
        padding: spacing.lg,
        backgroundColor: colors.background,
        justifyContent: "center",
      }}
    >
      <Text style={typography.title}>Expo-Shop</Text>

      <Pressable
        onPress={() => router.push("/products")}
        style={{
          marginTop: spacing.lg,
          backgroundColor: colors.primary,
          padding: spacing.md,
          borderRadius: 8,
        }}
      >
        <Text style={{ color: colors.primaryText }}>Ver productos</Text>
      </Pressable>
    </View>
  );
}

import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { PRODUCTS } from "../../services/products.mock";
import { useCartStore } from "../../state/cartStore";
import { colors, spacing, typography } from "../../theme";

export default function ProductsScreen() {
  const router = useRouter();
  const addProduct = useCartStore((s) => s.addProduct);

  return (
    <View style={{ flex: 1, padding: spacing.md }}>
      <Text style={typography.title}>Productos</Text>

      {PRODUCTS.map((product) => (
        <Pressable
          key={product.id}
          onPress={() => router.push(`/products/${product.id}`)}
          style={{
            paddingVertical: spacing.md,
            borderBottomWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={typography.body}>{product.name}</Text>
          <Text style={typography.small}>{product.price.toFixed(2)} €</Text>
        </Pressable>
      ))}
    </View>
  );
}

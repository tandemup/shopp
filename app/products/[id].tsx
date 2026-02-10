import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { getProductById } from "../../services/products.mock";
import { useCartStore } from "../../state/cartStore";
import { colors, spacing, typography } from "../../theme";

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const product = getProductById(id!);

  const { items, addProduct, removeProduct } = useCartStore();

  if (!product) {
    return (
      <View style={{ padding: spacing.lg }}>
        <Text>Producto no encontrado</Text>
      </View>
    );
  }

  const cartItem = items.find((item) => item.product.id === product.id);

  const quantity = cartItem?.quantity ?? 0;

  return (
    <View
      style={{
        flex: 1,
        padding: spacing.lg,
        backgroundColor: colors.background,
      }}
    >
      {/* Título */}
      <Text style={typography.title}>{product.name}</Text>

      {/* Precio */}
      <Text
        style={{
          ...typography.body,
          marginTop: spacing.sm,
        }}
      >
        {product.price.toFixed(2)} €
      </Text>

      {/* Controles */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginTop: spacing.lg,
        }}
      >
        <Pressable
          onPress={() => removeProduct(product.id)}
          disabled={quantity === 0}
          style={{
            padding: spacing.md,
            opacity: quantity === 0 ? 0.4 : 1,
          }}
        >
          <Text style={typography.title}>−</Text>
        </Pressable>

        <Text style={{ marginHorizontal: spacing.md }}>{quantity}</Text>

        <Pressable
          onPress={() => addProduct(product)}
          style={{ padding: spacing.md }}
        >
          <Text style={typography.title}>+</Text>
        </Pressable>
      </View>

      {/* CTA */}
      {quantity > 0 && (
        <Pressable
          onPress={() => router.push("/cart")}
          style={{
            marginTop: spacing.xl,
            backgroundColor: colors.primary,
            padding: spacing.md,
            borderRadius: 8,
          }}
        >
          <Text style={{ color: colors.primaryText }}>Ver carrito</Text>
        </Pressable>
      )}
    </View>
  );
}

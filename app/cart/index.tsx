import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useCartStore } from "../../state/cartStore";
import { colors, spacing, typography } from "../../theme";

export default function CartScreen() {
  const router = useRouter();
  const { items, addProduct, removeProduct, total } = useCartStore();

  if (items.length === 0) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          padding: spacing.lg,
        }}
      >
        <Text style={typography.body}>Tu carrito está vacío</Text>
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        padding: spacing.lg,
        backgroundColor: colors.background,
      }}
    >
      <Text style={typography.title}>Carrito</Text>

      {items.map((item) => (
        <View
          key={item.product.id}
          style={{
            marginTop: spacing.md,
            paddingBottom: spacing.md,
            borderBottomWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={typography.body}>{item.product.name}</Text>

          <Text style={typography.small}>
            {item.product.price.toFixed(2)} €
          </Text>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: spacing.sm,
            }}
          >
            <Pressable
              onPress={() => removeProduct(item.product.id)}
              style={{ padding: spacing.sm }}
            >
              <Text style={typography.title}>−</Text>
            </Pressable>

            <Text style={{ marginHorizontal: spacing.md }}>
              {item.quantity}
            </Text>

            <Pressable
              onPress={() => addProduct(item.product)}
              style={{ padding: spacing.sm }}
            >
              <Text style={typography.title}>+</Text>
            </Pressable>
          </View>
        </View>
      ))}

      {/* Footer */}
      <View style={{ marginTop: spacing.xl }}>
        <Text style={typography.title}>Total: {total().toFixed(2)} €</Text>

        <Pressable
          onPress={() => router.push("/checkout")}
          style={{
            marginTop: spacing.md,
            backgroundColor: colors.primary,
            padding: spacing.md,
            borderRadius: 8,
          }}
        >
          <Text style={{ color: colors.primaryText }}>Finalizar compra</Text>
        </Pressable>
      </View>
    </View>
  );
}

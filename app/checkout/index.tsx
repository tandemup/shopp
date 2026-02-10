import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useCartStore } from "../../state/cartStore";
import { colors, spacing, typography } from "../../theme";

export default function CheckoutScreen() {
  const router = useRouter();
  const { items, total, clearCart } = useCartStore();

  const onConfirm = () => {
    clearCart();
    router.replace("/home");
  };

  return (
    <View
      style={{
        flex: 1,
        padding: spacing.lg,
        backgroundColor: colors.background,
      }}
    >
      <Text style={typography.title}>Checkout</Text>

      {items.map((item) => (
        <Text key={item.product.id} style={{ marginTop: spacing.sm }}>
          {item.product.name} x {item.quantity}
        </Text>
      ))}

      <Text style={{ marginTop: spacing.lg }}>
        Total: {total().toFixed(2)} €
      </Text>

      <Pressable
        onPress={onConfirm}
        style={{
          marginTop: spacing.xl,
          backgroundColor: colors.primary,
          padding: spacing.md,
          borderRadius: 8,
        }}
      >
        <Text style={{ color: colors.primaryText }}>Confirmar compra</Text>
      </Pressable>
    </View>
  );
}

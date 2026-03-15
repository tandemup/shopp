import { Currency } from "@/src/types/Currency";
import Feather from "@expo/vector-icons/Feather";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  total: number;
  currency?: Currency;
  onCheckout?: () => void;
};

export default function CheckoutBar({ total, currency, onCheckout }: Props) {
  if (!total || total <= 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total: </Text>
        <Text style={styles.totalValue}>
          {total.toFixed(2)} {currency?.symbol ?? "€"}
        </Text>
      </View>

      <Pressable style={styles.button} onPress={onCheckout}>
        <Feather name="shopping-cart" size={20} color="#fff" />
        <Text style={styles.buttonText}>Finalizar compra</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderTopWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 22,
    marginBottom: 10,
  },
  totalLabel: {
    fontSize: 24,
    fontWeight: "bold",
  },
  totalValue: {
    fontSize: 24,
    fontWeight: "bold",
  },

  button: {
    flexDirection: "row",
    gap: 6,
    backgroundColor: "#22C55E",
    paddingVertical: 14,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },

  buttonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 20,
  },
});

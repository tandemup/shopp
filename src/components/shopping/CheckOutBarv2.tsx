import Feather from "@expo/vector-icons/Feather";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  total: number;
  savings?: number;
  itemsCount?: number;
  currency?: { symbol: string };
  onCheckout?: () => void;
};

export default function CheckoutBarv2({
  total,
  savings = 0,
  itemsCount = 0,
  currency,
  onCheckout,
}: Props) {
  if (!total || total <= 0) return null;

  return (
    <View style={styles.container}>
      {/* TOTAL */}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total</Text>

        <Text style={styles.totalValue}>
          {total.toFixed(2)} {currency?.symbol ?? "€"}
        </Text>
      </View>

      {/* SAVINGS */}
      {savings > 0 && (
        <View style={styles.savingsRow}>
          <Text style={styles.savingsText}>
            Ahorras {savings.toFixed(2)} {currency?.symbol ?? "€"}
          </Text>
        </View>
      )}

      {/* ITEMS */}
      {itemsCount > 0 && (
        <Text style={styles.itemsText}>
          {itemsCount} productos seleccionados
        </Text>
      )}

      {/* BUTTON */}
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
    justifyContent: "space-between",
    marginBottom: 6,
  },

  totalLabel: {
    fontSize: 22,
    fontWeight: "bold",
  },

  totalValue: {
    fontSize: 22,
    fontWeight: "bold",
  },

  savingsRow: {
    marginBottom: 4,
  },

  savingsText: {
    color: "#eab308",
    fontWeight: "600",
  },

  itemsText: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 10,
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
    fontSize: 18,
  },
});

/*
      <CheckoutBarv2
        total={total}
        savings={savings}
        itemsCount={checkedItems.length}
        currency={currency}
        onCheckout={handleCheckout}
      />
*/

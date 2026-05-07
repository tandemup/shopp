// components/CheckoutBar.js

import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { formatCurrency } from "../../../utils/store/prices";
import { DEFAULT_CURRENCY } from "../../../constants/currency";

export default function CheckoutBar({ total, currency, onCheckout }) {
  if (!total || total <= 0) return null;

  const currencyCode =
    typeof currency === "string"
      ? currency
      : (currency?.code ?? DEFAULT_CURRENCY.code);

  return (
    <View style={styles.container}>
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total:</Text>
        <Text style={styles.totalValue}>
          {formatCurrency(total, currencyCode)}
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
    justifyContent: "space-between",
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

// components/features/checkout/CheckoutBar.js

import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Feather from "@expo/vector-icons/Feather";

import { formatCurrency } from "@/utils/store/prices";
import { DEFAULT_CURRENCY } from "@/constants/currency";
import CurrencyBadge from "@/components/ui/CurrencyBadge";

export default function CheckoutBar({ listName, total, currency, onCheckout }) {
  const currencyCode =
    typeof currency === "string"
      ? currency
      : (currency?.code ?? DEFAULT_CURRENCY.code);

  const hasTotal = total && total > 0;

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.titleBlock}>
          <Text style={styles.listName} numberOfLines={1}>
            {listName || "Lista"}
          </Text>

          <View style={styles.currencyRow}>
            <CurrencyBadge currency={currency} size="sm" />
          </View>
        </View>

        <View style={styles.actionsBlock}>
          <Text style={styles.totalValue}>
            {formatCurrency(total || 0, currencyCode)}
          </Text>

          <Pressable
            style={[styles.button, !hasTotal && styles.buttonDisabled]}
            onPress={onCheckout}
            disabled={!hasTotal}
          >
            <Feather name="shopping-cart" size={17} color="#fff" />
            <Text style={styles.buttonText}>Finalizar</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    backgroundColor: "#ffffff",
  },

  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  titleBlock: {
    flex: 1,
    minWidth: 0,
  },

  listName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
  },

  currencyRow: {
    marginTop: 4,
    alignItems: "flex-start",
  },

  actionsBlock: {
    alignItems: "flex-end",
    justifyContent: "center",
  },

  totalValue: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 6,
  },

  button: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#22C55E",
  },

  buttonDisabled: {
    opacity: 0.45,
  },

  buttonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});

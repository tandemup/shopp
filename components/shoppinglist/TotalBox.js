import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { PricingEngine, PROMOTIONS, NO_PROMO } from "../utils/pricing";

export default function TotalBox({
  qty,
  unit = "u",
  unitPrice,
  subtotal,
  promo,
  savings,
  total,
  currency = "€",
  warning,
}) {
  const hasPromo = promo && promo !== NO_PROMO && savings > 0;

  return (
    <View style={styles.box}>
      {/* Producto + subtotal */}
      <View style={styles.row}>
        <Text style={styles.product}>
          {qty} {unit} × {unitPrice.toFixed(2)} {currency}/{unit}
        </Text>

        <Text style={styles.subtotal}>
          {subtotal.toFixed(2)} {currency}
        </Text>
      </View>

      {/* Oferta inline */}
      {hasPromo && (
        <Text style={styles.promoLine}>
          {PROMOTIONS[promo]?.label} · ahorras{" "}
          <Text style={styles.savings}>
            −{savings.toFixed(2)} {currency}
          </Text>
        </Text>
      )}

      <View style={styles.separator} />

      {/* Total */}
      <View style={styles.row}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalValue}>
          {total.toFixed(2)} {currency}
        </Text>
      </View>

      {/* Warning */}
      {warning && <Text style={styles.warning}>⚠️ {warning}</Text>}
    </View>
  );
}
const styles = StyleSheet.create({
  box: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8, // 👈 reducido
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: "#E3F2FD",
    borderColor: "#BBDEFB",
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },

  product: {
    fontSize: 13,
    color: "#475569",
  },

  subtotal: {
    fontSize: 13,
    fontWeight: "600",
  },

  promoLine: {
    marginTop: 2,
    fontSize: 12,
    color: "#2563EB",
  },

  savings: {
    fontWeight: "700",
    color: "#16a34a",
  },

  separator: {
    height: 1,
    backgroundColor: "#cbd5f5",
    marginVertical: 5, // 👈 reducido
  },

  totalLabel: {
    fontSize: 15,
    fontWeight: "700",
  },

  totalValue: {
    fontSize: 17,
    fontWeight: "800",
  },

  warning: {
    marginTop: 3,
    fontSize: 12,
    color: "#b91c1c",
  },
});

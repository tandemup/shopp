import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { formatCurrency } from "../../../utils/store/formatters";
import { formatUnit } from "../../../utils/pricing/unitFormat";

export default function ItemRow({ item, onToggle, onEdit }) {
  const priceInfo = item.priceInfo || {};

  const subtotal = priceInfo.total ?? 0;
  const savings = priceInfo.savings ?? 0;

  const hasPromo = Boolean(priceInfo.promo) && priceInfo.promo !== "none";

  const unit = item.unit ?? priceInfo.unit ?? "u";
  const qty = priceInfo.qty ?? 1;
  const unitPrice = priceInfo.unitPrice ?? 0;

  return (
    <View style={[styles.container, !item.checked && styles.containerInactive]}>
      <Pressable style={styles.checkbox} onPress={onToggle} hitSlop={10}>
        <Ionicons
          name={item.checked ? "checkbox-outline" : "square-outline"}
          size={21}
          color={item.checked ? "#2e7d32" : "#999"}
        />
      </Pressable>

      <View style={styles.content}>
        <View style={styles.nameRow}>
          <Text
            style={[styles.name, !item.checked && styles.nameInactive]}
            numberOfLines={1}
          >
            {item.name}
          </Text>

          {hasPromo ? (
            <View style={styles.promoBadge}>
              <Text style={styles.promoText}>
                {priceInfo.promoLabel || "Oferta"}
              </Text>
            </View>
          ) : null}

          {hasPromo && savings > 0 ? (
            <Text style={styles.savingsInline} numberOfLines={1}>
              −{formatCurrency(savings, priceInfo.currency)}
            </Text>
          ) : null}
        </View>

        <Text
          style={[styles.meta, !item.checked && styles.textInactive]}
          numberOfLines={1}
        >
          {qty} {formatUnit(unit)} ×{" "}
          {formatCurrency(unitPrice, priceInfo.currency)}/{formatUnit(unit)}
        </Text>
      </View>

      <Text
        style={[styles.subtotal, !item.checked && styles.subtotalInactive]}
        numberOfLines={1}
      >
        {formatCurrency(subtotal, priceInfo.currency)}
      </Text>

      <Pressable style={styles.chevron} onPress={onEdit} hitSlop={10}>
        <Ionicons name="chevron-forward" size={19} color="#999" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",

    minHeight: 68,

    marginBottom: 6,

    paddingHorizontal: 10,
    paddingVertical: 8,

    borderRadius: 12,

    backgroundColor: "#ffffff",
  },

  containerInactive: {
    backgroundColor: "#f2f2f2",
  },

  checkbox: {
    marginRight: 8,
  },

  content: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },

  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
  },

  name: {
    flexShrink: 1,
    marginRight: 6,

    fontSize: 18,
    fontWeight: "700",

    color: "#222",
  },

  nameInactive: {
    color: "#999",
  },

  promoBadge: {
    flexShrink: 0,

    marginRight: 5,

    paddingHorizontal: 6,
    paddingVertical: 2,

    borderRadius: 6,

    backgroundColor: "#ffeb3b",
  },

  promoText: {
    fontSize: 11,
    fontWeight: "800",

    color: "#000",
  },

  savingsInline: {
    flexShrink: 0,

    fontSize: 11,
    fontWeight: "700",

    color: "#15803d",
  },

  meta: {
    marginTop: 4,

    fontSize: 12,

    color: "#555",
  },

  textInactive: {
    color: "#999",
  },

  subtotal: {
    marginLeft: 6,
    marginRight: 4,

    fontSize: 16,
    fontWeight: "800",

    color: "#2e7d32",
  },

  subtotalInactive: {
    color: "#999",
  },

  chevron: {
    paddingLeft: 3,
  },
});

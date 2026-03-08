import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { formatCurrency } from "../utils/store/formatters";
import { formatUnit } from "../utils/pricing/unitFormat";

export default function ItemRow({ item, onToggle, onEdit }) {
  const priceInfo = item.priceInfo || {};
  const subtotal = priceInfo.total ?? 0;
  const hasPromo = priceInfo.promo && priceInfo.promo !== "none";
  const savings = priceInfo.savings ?? 0;

  return (
    <View style={[styles.container, !item.checked && styles.containerInactive]}>
      {/* Checkbox */}
      <Pressable style={styles.checkbox} onPress={onToggle} hitSlop={10}>
        <Ionicons
          name={item.checked ? "checkbox-outline" : "square-outline"}
          size={20}
          color={item.checked ? "#2e7d32" : "#999"}
        />
      </Pressable>

      {/* Contenido */}
      <View style={styles.content}>
        {/* Nombre + oferta + ahorro */}
        <View style={styles.nameRow}>
          <Text
            style={[styles.name, !item.checked && styles.nameInactive]}
            numberOfLines={1}
          >
            {item.name}
          </Text>

          {hasPromo && (
            <>
              <View style={styles.promoBadge}>
                <Text style={styles.promoText}>
                  {priceInfo.promoLabel || "Oferta"}
                </Text>
              </View>

              {savings > 0 && (
                <Text style={styles.savingsInline}>
                  {" "}
                  −{formatCurrency(savings)}
                </Text>
              )}
            </>
          )}
        </View>
        <Text style={styles.meta} numberOfLines={1}>
          {priceInfo.qty} ×{" "}
          {formatCurrency(priceInfo.unitPrice, priceInfo.currency)}
        </Text>
      </View>

      <Text style={styles.subtotal}>
        {formatCurrency(subtotal, priceInfo.currency)}
      </Text>

      <Pressable style={styles.chevron} onPress={onEdit} hitSlop={10}>
        <Ionicons name="chevron-forward" size={18} color="#999" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
  },

  containerInactive: {
    backgroundColor: "#f2f2f2",
  },

  checkbox: {
    marginRight: 8,
  },

  content: {
    flex: 1,
    marginRight: 8,
  },

  /* -------- Nombre + promo -------- */
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "nowrap",
  },

  name: {
    fontSize: 15,
    fontWeight: "600",
    color: "#222",
    marginRight: 6,
    maxWidth: "70%",
  },

  nameInactive: {
    color: "#999",
  },

  promoBadge: {
    backgroundColor: "#ffeb3b", // amarillo
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 4,
  },

  promoText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#000", // negro
  },

  savingsInline: {
    fontSize: 12,
    fontWeight: "600",
    color: "#15803d",
  },

  /* -------- Meta -------- */
  meta: {
    marginTop: 2,
    fontSize: 12,
    color: "#555",
  },

  subtotal: {
    fontSize: 15,
    fontWeight: "700",
    color: "#2e7d32",
    marginRight: 4,
  },

  chevron: {
    paddingLeft: 2,
  },
});

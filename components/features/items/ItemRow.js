import React from "react";
import { View, Text, StyleSheet, Pressable, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { formatCurrency } from "../../../utils/store/formatters";
import { formatUnit } from "../../../utils/pricing/unitFormat";

export default function ItemRow({
  item,
  categoryImage,
  categoryName,
  onToggle,
  onEdit,
}) {
  const priceInfo = item.priceInfo || {};
  const subtotal = priceInfo.total ?? 0;
  const hasPromo = priceInfo.promo && priceInfo.promo !== "none";
  const savings = priceInfo.savings ?? 0;

  const displayCategoryName = categoryName ?? item.categoryName ?? null;
  const displaySubcategoryName = item.subcategoryName ?? null;
  const hasCategoryInfo = displayCategoryName || displaySubcategoryName;

  return (
    <View style={[styles.container, !item.checked && styles.containerInactive]}>
      <Pressable style={styles.checkbox} onPress={onToggle} hitSlop={10}>
        <Ionicons
          name={item.checked ? "checkbox-outline" : "square-outline"}
          size={20}
          color={item.checked ? "#2e7d32" : "#999"}
        />
      </Pressable>

      {categoryImage ? (
        <View style={styles.categoryImageBox}>
          <Image
            source={categoryImage}
            style={styles.categoryImage}
            resizeMode="contain"
            accessibilityLabel={displayCategoryName ?? "Categoría"}
          />
        </View>
      ) : (
        <View style={styles.categoryPlaceholder}>
          <Ionicons name="cube-outline" size={24} color="#9ca3af" />
        </View>
      )}

      <View style={styles.content}>
        <View style={styles.nameRow}>
          <Text
            style={[styles.name, !item.checked && styles.nameInactive]}
            numberOfLines={1}
          >
            {item.name}
          </Text>

          {hasPromo ? (
            <>
              <View style={styles.promoBadge}>
                <Text style={styles.promoText}>
                  {priceInfo.promoLabel || "Oferta"}
                </Text>
              </View>

              {savings > 0 ? (
                <Text style={styles.savingsInline}>
                  {" "}
                  −{formatCurrency(savings)}
                </Text>
              ) : null}
            </>
          ) : null}
        </View>

        {hasCategoryInfo ? (
          <View style={styles.categoryInfoRow}>
            {displayCategoryName ? (
              <View style={styles.categoryPill}>
                <Text
                  style={[
                    styles.categoryPillText,
                    !item.checked && styles.textInactive,
                  ]}
                  numberOfLines={1}
                >
                  {displayCategoryName}
                </Text>
              </View>
            ) : null}

            {displaySubcategoryName ? (
              <View style={styles.subcategoryPill}>
                <Text
                  style={[
                    styles.subcategoryPillText,
                    !item.checked && styles.textInactive,
                  ]}
                  numberOfLines={1}
                >
                  {displaySubcategoryName}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <Text
          style={[styles.meta, !item.checked && styles.textInactive]}
          numberOfLines={1}
        >
          {priceInfo.qty} {formatUnit(item.unit)} ×{" "}
          {formatCurrency(priceInfo.unitPrice, priceInfo.currency)}/
          {formatUnit(item.unit)}
        </Text>
      </View>

      <Text style={[styles.subtotal, !item.checked && styles.subtotalInactive]}>
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
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginBottom: 8,
    minHeight: 88,
  },

  containerInactive: {
    backgroundColor: "#f2f2f2",
  },

  checkbox: {
    marginRight: 8,
  },

  categoryImageBox: {
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    overflow: "hidden",
  },

  categoryImage: {
    width: 68,
    height: 68,
  },

  categoryPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },

  content: {
    flex: 1,
    marginRight: 8,
    minWidth: 0,
  },

  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "nowrap",
  },

  name: {
    fontSize: 15,
    fontWeight: "700",
    color: "#222",
    marginRight: 6,
    maxWidth: "68%",
  },

  nameInactive: {
    color: "#999",
  },

  categoryInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
    maxWidth: "100%",
  },

  categoryPill: {
    flexShrink: 1,
    maxWidth: "52%",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },

  subcategoryPill: {
    flexShrink: 1,
    maxWidth: "48%",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },

  categoryPillText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#2563eb",
  },

  subcategoryPillText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#475569",
  },

  textInactive: {
    color: "#999",
  },

  promoBadge: {
    backgroundColor: "#ffeb3b",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginRight: 4,
  },

  promoText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#000",
  },

  savingsInline: {
    fontSize: 12,
    fontWeight: "600",
    color: "#15803d",
  },

  meta: {
    marginTop: 4,
    fontSize: 12,
    color: "#555",
  },

  subtotal: {
    fontSize: 15,
    fontWeight: "700",
    color: "#2e7d32",
    marginRight: 4,
  },

  subtotalInactive: {
    color: "#999",
  },

  chevron: {
    paddingLeft: 2,
  },
});

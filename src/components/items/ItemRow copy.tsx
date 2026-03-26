import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useConfig } from "@/src/context/ConfigContext";
import { Item } from "@/src/types/Item";
import { formatCurrency } from "@/src/utils/currency";
import { calculateItemPrice } from "@/src/utils/pricing/PricingEngine";
import { getPromotionLabel } from "@/src/utils/pricing/promotionUtils";
import { toPromotion } from "@/src/utils/pricing/toPromotion";

type Props = {
  item: Item;
  onToggle: () => void;
  onPress: () => void;
};

export default function ItemRow({ item, onToggle, onPress }: Props) {
  const { currency } = useConfig();
  const price = calculateItemPrice({
    ...item,
    promo:
      typeof item.promo === "string" ? toPromotion(item.promo) : item.promo,
  });
  const base = price.baseTotal;
  const total = price.finalTotal;
  const savings = price.savings;

  const checked = item.checked ?? true;
  const hasPromo = savings > 0;
  const qty = item.quantity ?? 1;
  const unitPrice = item.unitPrice ?? 0;

  const promoLabel = getPromotionLabel(item.promo);

  return (
    <View style={[styles.container, !checked && styles.containerDisabled]}>
      <Pressable onPress={onToggle} style={styles.checkbox}>
        <Ionicons
          name={checked ? "checkbox" : "square-outline"}
          size={22}
          color={checked ? "#27ae60" : "#999"}
        />
      </Pressable>

      <View style={styles.content}>
        <View style={styles.left}>
          <View style={styles.rowTop}>
            <Text style={[styles.name, !checked && styles.nameDisabled]}>
              {item.name}
            </Text>

            {hasPromo && promoLabel ? (
              <View style={styles.promoRow}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{promoLabel}</Text>
                </View>

                <Text style={styles.savingsInline}>
                  {formatCurrency(savings, { currency })}
                </Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.unitInfo}>
            {qty} x {formatCurrency(unitPrice, { currency })}
          </Text>
        </View>

        <View style={styles.right}>
          <View style={styles.priceRow}>
            {hasPromo ? (
              <Text style={styles.basePrice}>
                {formatCurrency(base, { currency })}
              </Text>
            ) : null}

            <Text style={styles.finalPrice}>
              {formatCurrency(total, { currency })}
            </Text>
          </View>
        </View>
      </View>

      <Pressable onPress={onPress} style={styles.chevron}>
        <Ionicons name="chevron-forward" size={20} color="#999" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderColor: "#eee",
    backgroundColor: "#fff",
  },

  containerDisabled: {
    opacity: 0.5,
  },

  checkbox: {
    marginRight: 10,
  },

  content: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  left: {
    flex: 1,
    paddingRight: 8,
  },

  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },

  name: {
    fontSize: 16,
    fontWeight: "600",
    color: "#222",
  },

  nameDisabled: {
    color: "#999",
  },

  promoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  badge: {
    backgroundColor: "#FFD600",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },

  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#222",
  },

  savingsInline: {
    fontSize: 12,
    color: "#27ae60",
    fontWeight: "600",
  },

  unitInfo: {
    fontSize: 13,
    color: "#666",
    marginTop: 2,
  },

  right: {
    alignItems: "flex-end",
    justifyContent: "center",
    minWidth: 90,
  },

  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  basePrice: {
    fontSize: 13,
    color: "#999",
    textDecorationLine: "line-through",
  },

  finalPrice: {
    fontSize: 17,
    fontWeight: "700",
    color: "#222",
  },

  chevron: {
    paddingLeft: 6,
  },
});

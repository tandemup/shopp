import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useConfig } from "@/src/context/ConfigContext";
import { Item } from "@/src/types/Item";
import { formatCurrencyCompact } from "@/src/utils/currency/formatCurrencyCompact";
import { calculateItemPrice } from "@/src/utils/pricing/PricingEngine";

type Props = {
  item: Item;
  onToggle: () => void;
  onPress: () => void;
};

export default function ItemRow({ item, onToggle, onPress }: Props) {
  const { currency } = useConfig();

  const price = calculateItemPrice(item);

  const base = price.baseTotal;
  const total = price.finalTotal;
  const savings = price.savings;

  const checked = item.checked ?? true;
  const hasPromo = savings > 0;

  const qty = item.quantity ?? 1;
  const unitPrice = item.unitPrice ?? 0;

  const promoLabel = getPromoLabel(item);

  return (
    <View style={[styles.container, !checked && styles.containerDisabled]}>
      {/* CHECKBOX */}
      <Pressable onPress={onToggle} style={styles.checkbox}>
        <Ionicons
          name={checked ? "checkbox" : "square-outline"}
          size={22}
          color={checked ? "#27ae60" : "#999"}
        />
      </Pressable>

      {/* CONTENT */}
      <View style={styles.content}>
        {/* LEFT COLUMN */}
        <View style={styles.left}>
          {/* NAME + PROMO + SAVINGS */}
          <View style={styles.rowTop}>
            <Text style={[styles.name, !checked && styles.nameDisabled]}>
              {item.name}
            </Text>

            {hasPromo && (
              <View style={styles.promoRow}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{promoLabel}</Text>
                </View>

                <Text style={styles.savingsInline}>
                  {formatCurrencyCompact(savings, currency)}
                </Text>
              </View>
            )}
          </View>

          {/* QTY x UNIT */}
          <Text style={styles.unitInfo}>
            {qty} x {formatCurrencyCompact(unitPrice, currency)}
          </Text>
        </View>

        {/* RIGHT COLUMN */}
        <View style={styles.right}>
          <View style={styles.priceRow}>
            {hasPromo && (
              <Text style={styles.basePrice}>
                {formatCurrencyCompact(base, currency)}
              </Text>
            )}

            <Text style={styles.finalPrice}>
              {formatCurrencyCompact(total, currency)}
            </Text>
          </View>
        </View>
      </View>

      {/* CHEVRON */}
      <Pressable onPress={onPress} style={styles.chevron}>
        <Ionicons name="chevron-forward" size={20} color="#999" />
      </Pressable>
    </View>
  );
}

/* =================================================
   HELPERS
================================================= */

function getPromoLabel(item: Item): string {
  const promo = item.promo;

  if (!promo) return "";

  if (typeof promo === "string") return promo;

  if (promo.type === "percent") return `-${promo.value}%`;

  if (promo.type === "multi") return `${promo.buy}x${promo.pay}`;

  if (promo.type === "2x1") return "2x1";
  if (promo.type === "3x2") return "3x2";

  return "Promo";
}

/* =================================================
   STYLES
================================================= */

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

  /* LEFT */
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

  /* RIGHT */
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

import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { Item } from "@/src/types/Item";
import type { Promotion } from "@/src/types/Promotion";

import { formatCurrency } from "@/src/utils/currency";
import { calculateItemPrice } from "@/src/utils/pricing/pricing";

type Props = {
  item: Item;
  onToggle: () => void;
  onPress: () => void;
};

function getPromoLabel(promo: Promotion): string {
  switch (promo.type) {
    case "2x1":
      return "2x1";
    case "3x2":
      return "3x2";
    case "percent":
      return `-${promo.value}%`;
    case "discount":
      return `-${promo.value}€`;
    case "multi":
      return `${promo.buy}x${promo.pay}`;
    default:
      return "";
  }
}

export default function ItemRow({ item, onToggle, onPress }: Props) {
  //const quantity = Number.isFinite(item.quantity) ? item.quantity : 1;
  //const unitPrice = Number.isFinite(item.unitPrice) ? item.unitPrice : 0;
  const quantity = item.quantity ?? 0;
  const unitPrice = item.unitPrice ?? 0;
  const unit = item.unit ?? "u";

  const promo = (item.promo ?? { type: "none" }) as Promotion;
  const price = calculateItemPrice({ quantity, unitPrice, promo });

  const checked = item.checked ?? true;

  return (
    <View style={[styles.container, !checked && styles.containerChecked]}>
      {/* LEFT */}
      <Pressable onPress={onToggle} style={styles.left}>
        <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
          {checked && <Ionicons name="checkmark" size={14} color="#fff" />}
        </View>

        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>

          <View style={styles.metaRow}>
            {/* PROMO BADGE */}
            {promo.type !== "none" && (
              <View style={styles.promoBadge}>
                <Text style={styles.promoBadgeText}>
                  {getPromoLabel(promo)}
                </Text>
              </View>
            )}

            <Text style={styles.meta}>
              {quantity} {unit} × {formatCurrency(unitPrice)}
              {"/"}
              {unit}
            </Text>
          </View>
        </View>
      </Pressable>

      {/* RIGHT */}
      <Pressable onPress={onPress} style={styles.right}>
        <View style={styles.priceBlock}>
          {/* base tachado */}
          {price.savings > 0 && (
            <Text style={styles.basePrice}>
              {formatCurrency(price.baseTotal)}
            </Text>
          )}

          {/* total */}
          <Text style={styles.totalPrice}>{formatCurrency(price.total)}</Text>

          {/* ahorro */}
          {price.savings > 0 && (
            <Text style={styles.savings}>-{formatCurrency(price.savings)}</Text>
          )}
        </View>

        <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#eee",
  },

  // 🔑 SOLO cuando NO está checked
  containerChecked: {
    opacity: 0.6,
  },

  left: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 10,
  },

  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#d1d5db",
    alignItems: "center",
    justifyContent: "center",
  },

  checkboxChecked: {
    backgroundColor: "#22c55e",
    borderColor: "#22c55e",
  },

  info: {
    flex: 1,
    gap: 4,
  },

  name: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },

  meta: {
    fontSize: 13,
    color: "#6b7280",
  },

  promoBadge: {
    backgroundColor: "#fde68a",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },

  promoBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#92400e",
  },

  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  priceBlock: {
    alignItems: "flex-end",
  },

  basePrice: {
    fontSize: 12,
    color: "#9ca3af",
    textDecorationLine: "line-through",
  },

  totalPrice: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },

  savings: {
    fontSize: 12,
    fontWeight: "600",
    color: "#22c55e",
  },
});

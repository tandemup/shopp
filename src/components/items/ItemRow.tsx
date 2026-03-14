import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { formatCurrency } from "@/src/utils/pricing/formatCurrency";
import { calculatePrice } from "@/src/utils/pricing/pricingEngine";

interface ItemRowProps {
  item: any;
  onToggle: () => void;
  onPress: () => void;
}

export default function ItemRow({ item, onToggle, onPress }: ItemRowProps) {
  const price = calculatePrice({
    quantity: item.quantity ?? 1,
    unitPrice: item.unitPrice ?? 0,
    offer: item.promo ?? "none",
  });
  const checked = item.checked ?? true;

  const hasPromo = item.promo && item.promo !== "none";
  const hasSavings = price.savings > 0;
  console.log(item.promo, price);
  return (
    <View style={[styles.card, !checked && styles.cardDisabled]}>
      {/* ---------- Checkbox ---------- */}

      <Pressable onPress={onToggle} style={styles.checkbox}>
        <Ionicons
          name={checked ? "checkbox" : "square-outline"}
          size={22}
          color={checked ? "#22c55e" : "#9ca3af"}
        />
      </Pressable>

      {/* ---------- Content ---------- */}

      <View style={styles.content}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{item.name}</Text>

          {hasPromo && (
            <View style={styles.promoBadge}>
              <Text style={styles.promoText}>
                {item.promo}
                {hasSavings && `  -${formatCurrency(price.savings)}`}
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.detail}>
          {item.quantity} x {formatCurrency(item.unitPrice)}
        </Text>
      </View>

      {/* ---------- Price ---------- */}

      <View style={styles.priceBox}>
        {hasPromo && (
          <Text style={styles.basePrice}>{formatCurrency(price.base)}</Text>
        )}

        <Text style={styles.finalPrice}>{formatCurrency(price.total)}</Text>
      </View>

      {/* ---------- Chevron ---------- */}

      <Pressable onPress={onPress} style={styles.chevron}>
        <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    marginBottom: 8,
    backgroundColor: "#ffffff",
    borderRadius: 12,
  },

  cardDisabled: {
    backgroundColor: "#f3f4f6",
  },

  checkbox: {
    marginRight: 10,
  },

  content: {
    flex: 1,
  },

  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  name: {
    fontSize: 15,
    fontWeight: "600",
  },

  promoBadge: {
    backgroundColor: "#fde68a",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },

  promoText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#92400e",
  },

  detail: {
    fontSize: 12,
    color: "#6b7280",
  },

  savings: {
    fontSize: 11,
    color: "#16a34a",
    marginTop: 2,
    fontWeight: "600",
  },

  priceBox: {
    alignItems: "flex-end",
    marginRight: 6,
  },

  basePrice: {
    fontSize: 11,
    textDecorationLine: "line-through",
    color: "#9ca3af",
  },

  finalPrice: {
    fontWeight: "700",
    color: "#22c55e",
    fontSize: 14,
  },

  chevron: {
    paddingLeft: 8,
    paddingVertical: 4,
  },
});

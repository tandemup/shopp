import { formatCurrency } from "@/src/utils/currency";
import { calculateItemPrice } from "@/src/utils/pricing/PricingEngine";
import { Ionicons } from "@expo/vector-icons";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  item: {
    id: string;
    name: string;
    quantity?: number;
    unitPrice?: number;
    promo?: {
      type: string;
      value?: number;
      buy?: number;
      pay?: number;
    };
    checked?: boolean;
  };
  onPress: () => void;
  onToggle?: () => void;
};

export default function ItemRow({ item, onPress, onToggle }: Props) {
  const quantity = Number.isFinite(item.quantity) ? Number(item.quantity) : 0;
  const unitPrice = Number.isFinite(item.unitPrice)
    ? Number(item.unitPrice)
    : 0;

  const price = useMemo(() => {
    return calculateItemPrice({
      quantity,
      unitPrice,
      promo: item.promo,
    });
  }, [quantity, unitPrice, item.promo]);

  const total = Number.isFinite(price.total) ? price.total : 0;
  const savings = Number.isFinite(price.savings) ? price.savings : 0;

  const promoLabel = useMemo(() => {
    if (!item.promo) return null;

    switch (item.promo.type) {
      case "2x1":
        return "2x1";
      case "3x2":
        return "3x2";
      case "percent":
        return `-${item.promo.value ?? 0}%`;
      case "discount":
        return `-${item.promo.value ?? 0}€`;
      case "multi":
        return `${item.promo.buy ?? 0}x${item.promo.pay ?? 0}`;
      default:
        return null;
    }
  }, [item.promo]);

  return (
    <Pressable
      style={[styles.card, item.checked === false && styles.cardUnchecked]}
      onPress={onPress}
    >
      <View style={styles.row}>
        <View style={styles.left}>
          <View style={styles.nameRow}>
            <Text
              style={[
                styles.name,
                item.checked === false && styles.nameUnchecked,
              ]}
              numberOfLines={1}
            >
              {item.name}
            </Text>

            {promoLabel && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{promoLabel}</Text>
              </View>
            )}
          </View>

          <Text style={styles.meta}>
            {quantity} × {formatCurrency(unitPrice)}
          </Text>
        </View>
        <View style={styles.right}>
          {/* TOTAL */}
          <View style={styles.priceBlock}>
            {savings > 0 && (
              <Text style={styles.savings}>
                Ahorro {formatCurrency(savings)}
              </Text>
            )}

            <Text style={styles.total}>{formatCurrency(total)}</Text>
          </View>

          {/* ACTIONS */}
          <View style={styles.actions}>
            {/* CHECK */}
            <Pressable
              onPress={(e) => {
                e.stopPropagation(); // 🔴 clave
                onToggle?.();
              }}
              style={[
                styles.checkButton,
                item.checked && styles.checkButtonActive,
              ]}
            >
              <Ionicons
                name="checkmark"
                size={16}
                color={item.checked ? "#fff" : "#9ca3af"}
              />
            </Pressable>

            {/* CHEVRON */}
            <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#ececec",
  },

  cardUnchecked: {
    opacity: 0.55,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  left: {
    flex: 1,
    minWidth: 0,
  },

  right: {
    alignItems: "flex-end",
    justifyContent: "center",
    minWidth: 88,
  },

  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 4,
  },

  name: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    flexShrink: 1,
  },

  nameUnchecked: {
    color: "#6b7280",
  },

  badge: {
    backgroundColor: "#fde68a",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },

  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#92400e",
  },

  meta: {
    fontSize: 13,
    color: "#6b7280",
  },

  total: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    textAlign: "right",
  },

  savings: {
    fontSize: 12,
    fontWeight: "600",
    color: "#22c55e",
    marginBottom: 2,
    textAlign: "right",
  },
});

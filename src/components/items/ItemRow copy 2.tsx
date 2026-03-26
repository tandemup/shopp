import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { Item } from "@/src/types/Item";
import { formatCurrency } from "@/src/utils/currency/formatCurrency";
import { calculateItemPrice } from "@/src/utils/pricing/PricingEngine";
import { toPromotion } from "@/src/utils/pricing/PromotionMapper";

type Props = {
  item: Item;
  listId: string;
  onToggle: () => void;
};

export default function ItemRow({ item, listId, onToggle }: Props) {
  const router = useRouter();

  // 🔑 promo desde promoId
  const promo = toPromotion(item.promoId ?? "none");

  // 🔑 cálculo robusto
  const priceInfo = calculateItemPrice({
    quantity: item.quantity ?? 0,
    unitPrice: item.unitPrice ?? 0,
    promo,
  });

  const handleOpenDetail = () => {
    router.push({
      pathname: "/item/[id]",
      params: { id: item.id, listId },
    });
  };

  return (
    <View style={[styles.container, !item.checked && styles.unchecked]}>
      {/* LEFT */}
      <Pressable style={styles.left} onPress={onToggle}>
        <Ionicons
          name={item.checked ? "checkbox" : "square-outline"}
          size={22}
          color={item.checked ? "#22c55e" : "#64748b"}
        />

        <View style={styles.info}>
          <View style={styles.rowTop}>
            <Text style={styles.name}>{item.name}</Text>

            {/* PROMO BADGE */}
            {promo.type !== "none" && (
              <View style={styles.promoBadge}>
                <Text style={styles.promoText}>{priceInfo.promoLabel}</Text>
              </View>
            )}
          </View>

          {/* SUBLINE */}
          <Text style={styles.meta}>
            {item.quantity ?? 0} × {formatCurrency(item.unitPrice ?? 0)}
          </Text>
        </View>
      </Pressable>

      {/* RIGHT */}
      <Pressable style={styles.right} onPress={handleOpenDetail}>
        {/* Precio base tachado */}
        {priceInfo.savings > 0 && (
          <Text style={styles.basePrice}>
            {formatCurrency(priceInfo.subtotal)}
          </Text>
        )}

        {/* Precio final */}
        <Text style={styles.total}>{formatCurrency(priceInfo.total)}</Text>

        {/* Ahorro */}
        {priceInfo.savings > 0 && (
          <Text style={styles.savings}>
            -{formatCurrency(priceInfo.savings)}
          </Text>
        )}

        <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderBottomWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
  },

  unchecked: {
    opacity: 0.5,
  },

  left: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 10,
  },

  info: {
    flex: 1,
  },

  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  name: {
    fontSize: 16,
    fontWeight: "600",
  },

  meta: {
    fontSize: 13,
    color: "#64748b",
  },

  promoBadge: {
    backgroundColor: "#facc15",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },

  promoText: {
    fontSize: 11,
    fontWeight: "600",
  },

  right: {
    alignItems: "flex-end",
    gap: 2,
  },

  basePrice: {
    fontSize: 12,
    color: "#94a3b8",
    textDecorationLine: "line-through",
  },

  total: {
    fontSize: 16,
    fontWeight: "700",
  },

  savings: {
    fontSize: 12,
    color: "#22c55e",
    fontWeight: "600",
  },
});

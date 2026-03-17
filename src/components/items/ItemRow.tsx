import Feather from "@expo/vector-icons/Feather";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Item } from "@/src/types/Item";
import { calculateItemPrice } from "@/src/utils/pricing/PricingEngine";

type Props = {
  item: Item;
  onToggle: () => void;
  onPress: () => void;
};

/* -------------------------------------------------
   Helpers
-------------------------------------------------- */

function getPromoLabel(promo?: Item["promo"]) {
  if (!promo) return null;

  switch (promo.type) {
    case "percent":
      return `${promo.value}%`;

    case "multi":
      return `${promo.buy}x${promo.pay}`;

    default:
      return null;
  }
}

/* -------------------------------------------------
   Component
-------------------------------------------------- */

export default function ItemRow({ item, onToggle, onPress }: Props) {
  const price = calculateItemPrice(item);

  const total = price.finalTotal;
  const savings = price.savings;

  const quantity = item.quantity ?? 1;
  const unitPrice = item.unitPrice ?? 0;

  const unitInfo = `${quantity} x ${unitPrice.toFixed(2)} €`;

  const disabled = !item.checked;

  const promoLabel = getPromoLabel(item.promo);

  return (
    <View style={[styles.container, disabled && styles.containerDisabled]}>
      {/* CHECKBOX */}
      <Pressable onPress={onToggle} style={styles.checkbox}>
        <Feather
          name={item.checked ? "check-square" : "square"}
          size={20}
          color={item.checked ? "#22C55E" : "#bbb"}
        />
      </Pressable>

      {/* INFO */}
      <View style={styles.info}>
        <Text style={[styles.name, disabled && styles.textDisabled]}>
          {item.name}
        </Text>

        <View style={styles.metaRow}>
          <Text style={[styles.unit, disabled && styles.textDisabled]}>
            {unitInfo}
          </Text>

          {/* BADGE PROMO */}
          {!disabled && promoLabel && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{promoLabel}</Text>
            </View>
          )}

          {/* AHORRO */}
          {savings > 0 && !disabled && (
            <Text style={styles.savings}>-{savings.toFixed(2)} €</Text>
          )}
        </View>
      </View>

      {/* PRECIO */}
      <View style={styles.priceBox}>
        {/* PRECIO FINAL */}
        <Text style={[styles.price, disabled && styles.priceDisabled]}>
          {total.toFixed(2)} €
        </Text>

        {/* PRECIO ORIGINAL */}
        {savings > 0 && !disabled && (
          <Text style={styles.oldPrice}>{price.baseTotal.toFixed(2)} €</Text>
        )}
      </View>

      {/* CHEVRON */}
      <Pressable onPress={onPress} style={styles.chevron}>
        <Feather name="chevron-right" size={18} color="#999" />
      </Pressable>
    </View>
  );
}

/* -------------------------------------------------
   Styles
-------------------------------------------------- */

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 14,
    marginTop: 8,
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },

  containerDisabled: {
    backgroundColor: "#f3f4f6",
    opacity: 0.75,
  },

  checkbox: {
    paddingRight: 10,
    paddingVertical: 6,
  },

  info: {
    flex: 1,
  },

  name: {
    fontSize: 16,
    fontWeight: "500",
  },

  textDisabled: {
    color: "#9ca3af",
  },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },

  unit: {
    fontSize: 12,
    color: "#666",
  },

  badge: {
    backgroundColor: "#facc15",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },

  badgeText: {
    fontSize: 11,
    fontWeight: "600",
  },

  savings: {
    fontSize: 12,
    color: "#16a34a",
    fontWeight: "600",
  },

  priceBox: {
    marginRight: 6,
    alignItems: "flex-end",
  },

  price: {
    fontSize: 16,
    fontWeight: "600",
    color: "#16a34a",
  },

  oldPrice: {
    fontSize: 12,
    color: "#9ca3af",
    textDecorationLine: "line-through",
  },

  priceDisabled: {
    color: "#9ca3af",
  },

  chevron: {
    paddingLeft: 10,
    paddingVertical: 6,
  },
});

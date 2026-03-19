import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Item } from "@/src/context/ListsContext";
import { calculateItemPrice } from "@/src/utils/pricing/PricingEngine";

type Props = {
  item: Item;
  onToggle: () => void;
  onPress: () => void;
};

export default function ItemRow({ item, onToggle, onPress }: Props) {
  const price = calculateItemPrice(item);

  const total = price.finalTotal ?? 0;
  const savings = price.savings ?? 0;

  const disabled = !item.checked;

  return (
    <View style={[styles.container, disabled && styles.containerDisabled]}>
      {/* CHECKBOX */}
      <Pressable onPress={onToggle} style={styles.checkbox}>
        <Ionicons
          name={item.checked ? "checkbox" : "square-outline"}
          size={22}
          color={item.checked ? "#27ae60" : "#999"}
        />
      </Pressable>

      {/* CENTER */}
      <View style={styles.center}>
        <Text style={[styles.name, disabled && styles.nameDisabled]}>
          {item.name}
        </Text>

        <Text style={styles.unit}>
          {item.quantity ?? 1} x {(item.unitPrice ?? 0).toFixed(2)} €
        </Text>

        {savings > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              Oferta · -{savings.toFixed(2)} €
            </Text>
          </View>
        )}
      </View>

      {/* PRICE */}
      <Text style={styles.price}>{total.toFixed(2)} €</Text>

      {/* CHEVRON */}
      <Pressable onPress={onPress} style={styles.chevron}>
        <Ionicons name="chevron-forward" size={20} color="#999" />
      </Pressable>
    </View>
  );
}

/* =========================
   STYLES
========================= */

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderColor: "#eee",
    backgroundColor: "#fff",
  },

  containerDisabled: {
    opacity: 0.5,
  },

  checkbox: {
    marginRight: 12,
  },

  center: {
    flex: 1,
  },

  name: {
    fontSize: 16,
    fontWeight: "500",
    color: "#222",
  },

  nameDisabled: {
    color: "#888",
  },

  unit: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },

  badge: {
    marginTop: 6,
    alignSelf: "flex-start",
    backgroundColor: "#ffeaa7",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },

  badgeText: {
    fontSize: 11,
    color: "#b7791f",
    fontWeight: "600",
  },

  price: {
    width: 70,
    textAlign: "right",
    fontSize: 15,
    fontWeight: "600",
    color: "#000",
  },

  chevron: {
    marginLeft: 10,
  },
});

import { List } from "@/src/types/List";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { getCurrency } from "@/src/utils/currency/currencyUtils";
import { calculateItemPrice } from "@/src/utils/pricing/pricingEngine";

interface Props {
  list: List;
  onPress?: () => void;
  onMenu?: () => void;
}

export default function ListCard({ list, onPress, onMenu }: Props) {
  const currency = getCurrency(list.currency);

  /* --------------------------------------------
     Fecha segura
  --------------------------------------------- */

  const createdAt =
    typeof list.createdAt === "number"
      ? new Date(list.createdAt)
      : new Date(list.createdAt ?? Date.now());

  const formattedDate = createdAt.toLocaleDateString();

  /* --------------------------------------------
     Totales (pricing engine)
  --------------------------------------------- */

  let total = 0;
  let savings = 0;

  list.items.forEach((item) => {
    const price = calculateItemPrice(item);
    total += price.finalTotal;
    savings += price.savings;
  });

  const formattedTotal = total.toFixed(currency.decimals);
  const formattedSavings = savings.toFixed(currency.decimals);
  const totalText = formatCurrency(listTotal);
  const itemCount = list.items.length;

  /* --------------------------------------------
     Render
  --------------------------------------------- */

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={onPress}
    >
      {/* ---------- HEADER ---------- */}

      <View style={styles.header}>
        {/* LEFT */}
        <View style={styles.left}>
          <View style={styles.nameRow}>
            <Text style={styles.listName}>{list.name}</Text>

            <View style={styles.currencyBadge}>
              <Text style={styles.currencyText}>{currency.code}</Text>
            </View>
          </View>
          <View style={styles.date}>
            <Text style={styles.meta}>
              {formattedDate} . {itemCount} items
            </Text>
          </View>
        </View>

        {/* RIGHT */}
        <View style={styles.right}>
          {/* MENU ARRIBA */}
          <Pressable onPress={onMenu} style={styles.menu}>
            <Ionicons name="ellipsis-vertical" size={18} color="#555" />
          </Pressable>

          {/* PRECIO ABAJO */}
          <View style={styles.totalRow}>
            <Text style={styles.totalValue}>{formattedTotal}</Text>
            <Text style={styles.totalCurrency}>{currency.symbol}</Text>
          </View>
        </View>
      </View>

      {/* ---------- SAVINGS ---------- */}

      {savings > 0 && (
        <Text style={styles.savings}>
          Ahorro {formattedSavings} {currency.symbol}
        </Text>
      )}
    </Pressable>
  );
}

/* --------------------------------------------
   Styles
--------------------------------------------- */

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },

  pressed: {
    opacity: 0.85,
  },

  /* ---------- TOP ---------- */

  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },

  left: {
    flex: 1,
  },

  listName: {
    fontSize: 18, // ⬆️ más grande
    fontWeight: "700",
  },

  currencyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "#eef0ff",
  },

  currencyText: {
    fontSize: 13, // ⬆️ más grande
    color: "#4b5bdc",
    fontWeight: "700",
  },

  menu: {
    padding: 4,
  },
  /* ---------- TOTAL ---------- */

  totalRow: {
    flexDirection: "row",
    alignItems: "flex-end",
  },

  totalValue: {
    fontSize: 22, // ⬆️ más protagonista
    fontWeight: "800",
  },

  totalCurrency: {
    fontSize: 13,
    marginLeft: 4,
    marginBottom: 3,
    color: "#666",
  },

  /* ---------- META ---------- */
  date: {
    flex: 1,
    flexDirection: "row",
    marginTop: 5,
  },
  meta: {
    fontSize: 12,
    color: "#666",
  },

  /* ---------- SAVINGS ---------- */

  savings: {
    marginTop: 4,
    fontSize: 12,
    color: "#16a34a",
    fontWeight: "500",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  right: {
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: "100%", // 🔥 importante para separar arriba/abajo
  },

  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
});

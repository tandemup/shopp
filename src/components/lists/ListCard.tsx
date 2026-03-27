import { useConfig } from "@/src/context/ConfigContext";
import { List } from "@/src/types/List";
import { formatCurrency } from "@/src/utils/currency";
import { calculateItemPrice } from "@/src/utils/pricing/PricingEngine";
import { Ionicons } from "@expo/vector-icons";
import { useMemo, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

interface Props {
  list: List;
  onPress?: () => void;
  onMenu?: () => void;
}

export default function ListCard({ list, onPress, onMenu }: Props) {
  const { currency } = useConfig();
  //  const currency = getCurrency(list.currency);

  /* --------------------------------------------
     Animación press
  --------------------------------------------- */

  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  /* --------------------------------------------
     Fecha
  --------------------------------------------- */

  const createdAt =
    typeof list.createdAt === "number"
      ? new Date(list.createdAt)
      : new Date(list.createdAt ?? Date.now());

  const formattedDate = createdAt.toLocaleDateString();

  /* --------------------------------------------
     Totales optimizados
  --------------------------------------------- */

  const { total, savings, itemCount } = useMemo(() => {
    return list.items.reduce(
      (acc, item) => {
        if (!item.checked) return acc;

        const price = calculateItemPrice(item);

        return {
          total: acc.total + (isFinite(price.total) ? price.total : 0),
          savings: acc.savings + (isFinite(price.savings) ? price.savings : 0),
          itemCount: acc.itemCount + 1,
        };
      },
      { total: 0, savings: 0, itemCount: 0 },
    );
  }, [list.items]);

  const formattedTotal = formatCurrency(total, currency);
  const formattedSavings = formatCurrency(savings, currency);
  const hasSavings = savings > 0;

  /* --------------------------------------------
     Render
  --------------------------------------------- */

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.card, hasSavings && styles.cardHighlight]}
      >
        <View style={styles.header}>
          {/* LEFT */}
          <View style={styles.left}>
            <View style={styles.nameRow}>
              <Text style={styles.listName}>{list.name}</Text>

              <View style={styles.currencyBadge}>
                <Text style={styles.currencyText}>{currency}</Text>
              </View>
            </View>

            <Text style={styles.meta}>
              {formattedDate} · {itemCount} items
            </Text>
          </View>

          {/* RIGHT */}
          <View style={styles.right}>
            <Pressable onPress={onMenu} style={styles.menu}>
              <Ionicons name="ellipsis-vertical" size={18} color="#555" />
            </Pressable>

            <Text style={styles.totalValue}>{formattedTotal}</Text>
          </View>
        </View>

        {/* SAVINGS */}
        {hasSavings && (
          <Text style={styles.savings}>💸 Ahorro {formattedSavings}</Text>
        )}
      </Pressable>
    </Animated.View>
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

    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  cardHighlight: {
    borderColor: "#bbf7d0",
    backgroundColor: "#f0fdf4",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
  },

  left: {
    flex: 1,
  },

  /* 🔥 CORRECTO: agrupado, no separado */
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },

  listName: {
    fontSize: 18,
    fontWeight: "700",
    flexShrink: 1,
  },

  currencyBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "#eef2ff",
  },

  currencyText: {
    fontSize: 11,
    color: "#3730a3",
    fontWeight: "700",
  },

  meta: {
    fontSize: 12,
    color: "#666",
  },

  right: {
    alignItems: "flex-end",
    justifyContent: "space-between",
  },

  menu: {
    padding: 4,
    marginBottom: 8,
  },

  totalValue: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111",
  },

  savings: {
    marginTop: 8,
    fontSize: 13,
    color: "#16a34a",
    fontWeight: "700",
  },
});

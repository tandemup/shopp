// PurchaseDetailScreen.js

import React, { useMemo } from "react";
import { View, Text, StyleSheet, FlatList, Pressable } from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { useLists } from "../context/ListsContext";
import { useStores } from "../context/StoresContext";
import { ROUTES } from "../navigation/ROUTES";
import { formatCurrency } from "../utils/store/formatters";

/* -------------------------------------------------
   Screen
-------------------------------------------------- */
export default function PurchaseDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();

  const { product } = route.params;

  const { createList, addItem } = useLists();
  const { getStoreById } = useStores();

  /* ---------------------------
     Compras ordenadas (recientes primero)
  ----------------------------*/
  const purchases = useMemo(() => {
    return [...(product.purchases ?? [])].sort(
      (a, b) => new Date(b.purchasedAt) - new Date(a.purchasedAt),
    );
  }, [product.purchases]);

  /* ---------------------------
     Precio medio
  ----------------------------*/
  const averagePrice = useMemo(() => {
    if (purchases.length === 0) return 0;

    const sum = purchases.reduce(
      (acc, p) => acc + (p.priceInfo?.total ?? 0),
      0,
    );

    return sum / purchases.length;
  }, [purchases]);

  /* ---------------------------
     Repetir (crear nueva lista)
  ----------------------------*/
  const handleRepeatProduct = () => {
    const listName = `Comprar • ${product.name}`;
    const listId = createList(listName);

    const last = purchases[0];

    addItem(listId, {
      name: product.name,
      quantity: last.quantity,
      priceInfo: last.priceInfo,
      checked: true,
    });

    navigation.replace(ROUTES.SHOPPING_LIST, { listId });
  };

  /* ---------------------------
     Render item
  ----------------------------*/
  const renderItem = ({ item }) => {
    const store = item.storeId ? getStoreById(item.storeId) : null;

    return (
      <View style={styles.row}>
        <View>
          <Text style={styles.date}>
            {new Date(item.purchasedAt).toLocaleDateString()}
          </Text>
          {store && <Text style={styles.store}>{store.name}</Text>}
        </View>

        <Text style={styles.price}>
          {formatCurrency(item.priceInfo?.total ?? 0)}
        </Text>
      </View>
    );
  };

  /* ---------------------------
     Render
  ----------------------------*/
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>{product.name}</Text>
        <Text style={styles.subtitle}>
          {purchases.length} compras · Precio medio{" "}
          {formatCurrency(averagePrice)}
        </Text>
      </View>

      <FlatList
        data={purchases}
        keyExtractor={(_, index) => `purchase-${index}`}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 16 }}
      />

      <Pressable style={styles.button} onPress={handleRepeatProduct}>
        <Ionicons name="refresh-outline" size={20} color="#fff" />
        <Text style={styles.buttonText}>Añadir a nueva lista</Text>
      </Pressable>
    </View>
  );
}

/* -------------------------------------------------
   Styles
-------------------------------------------------- */
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: 16,
    backgroundColor: "#F9FAFB",
  },

  header: {
    marginBottom: 16,
  },

  title: {
    fontSize: 22,
    fontWeight: "800",
  },

  subtitle: {
    marginTop: 4,
    color: "#6B7280",
  },

  row: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  date: {
    fontSize: 14,
    fontWeight: "600",
  },

  store: {
    marginTop: 2,
    fontSize: 13,
    color: "#374151",
  },

  price: {
    fontSize: 15,
    fontWeight: "700",
    color: "#059669",
  },

  button: {
    marginTop: 16,
    backgroundColor: "#2563EB",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },

  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

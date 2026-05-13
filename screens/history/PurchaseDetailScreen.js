// PurchaseDetailScreen.js

import React, { useMemo } from "react";
import { View, Text, StyleSheet, FlatList, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useRoute, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { useLists } from "../../context/ListsContext";
import { useStores } from "../../context/StoresContext";
import { ROUTES } from "../../navigation/ROUTES";
import { formatCurrency } from "../../utils/store/formatters";

import DatePill from "../../components/controls/DatePill";
import StorePill from "../../components/controls/StorePill";

/* -------------------------------------------------
   Screen
-------------------------------------------------- */
export default function PurchaseDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();

  const { productId, product: routeProduct } = route.params || {};

  const { purchaseHistory = [] } = useLists();
  const { getStoreById } = useStores();

  /* ---------------------------
     Producto desde historial
  ----------------------------*/
  const product = useMemo(() => {
    if (productId) {
      return purchaseHistory.find((item) => item.id === productId) ?? null;
    }

    return routeProduct ?? null;
  }, [productId, routeProduct, purchaseHistory]);

  /* ---------------------------
     Compras ordenadas
  ----------------------------*/
  const purchases = useMemo(() => {
    return [...(product?.purchases ?? [])].sort(
      (a, b) => new Date(b.purchasedAt) - new Date(a.purchasedAt),
    );
  }, [product?.purchases]);

  /* ---------------------------
     Precio medio
  ----------------------------*/
  const averagePrice = useMemo(() => {
    if (purchases.length === 0) return 0;

    const sum = purchases.reduce(
      (acc, purchase) => acc + (purchase.priceInfo?.total ?? 0),
      0,
    );

    return sum / purchases.length;
  }, [purchases]);

  /* ---------------------------
     Navegar a detalle de tienda
  ----------------------------*/
  const openStoreDetail = (storeId) => {
    if (!storeId) return;

    navigation.navigate(ROUTES.STORE_DETAIL, {
      storeId,
    });
  };

  /* ---------------------------
     Protección básica
  ----------------------------*/
  if (!product) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={34} color="#9CA3AF" />
          <Text style={styles.emptyTitle}>Producto no disponible</Text>
          <Text style={styles.emptyText}>
            No se ha recibido información del producto seleccionado.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  /* ---------------------------
     Repetir producto
  ----------------------------*/
  const handleRepeatProduct = () => {
    const quantity = product.quantity ?? product.lastQuantity ?? 1;

    const unitPrice =
      product.unitPrice ??
      product.priceInfo?.unitPrice ??
      product.averagePrice ??
      0;

    const newItem = {
      id: String(Date.now()),
      name: product.name ?? "",
      barcode: product.barcode ?? "",
      quantity,
      unitPrice,
      unit: product.unit ?? "u",
      checked: true,
    };

    navigation.navigate(ROUTES.SHOPPING_LISTS, {
      repeatedProduct: newItem,
    });
  };

  /* ---------------------------
     Render item
  ----------------------------*/
  const renderItem = ({ item }) => {
    const store = item.storeId ? getStoreById(item.storeId) : null;

    return (
      <View style={styles.card}>
        <View style={styles.iconBox}>
          <Ionicons name="calendar-outline" size={24} color="#111827" />
        </View>

        <View style={styles.cardText}>
          <View style={styles.metaRow}>
            <DatePill date={item.purchasedAt} />
          </View>

          <View style={styles.storeRow}>
            <StorePill store={store} onPressStore={openStoreDetail} />
          </View>
        </View>

        <View style={styles.priceBox}>
          <Ionicons name="pricetag-outline" size={17} color="#059669" />
          <Text style={styles.price}>
            {formatCurrency(item.priceInfo?.total ?? 0)}
          </Text>
        </View>
      </View>
    );
  };

  /* ---------------------------
     Render
  ----------------------------*/
  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {product.name}
        </Text>

        <Text style={styles.subtitle}>
          {purchases.length} compra{purchases.length === 1 ? "" : "s"} · Precio
          medio {formatCurrency(averagePrice)}
        </Text>

        <FlatList
          data={purchases}
          keyExtractor={(_, index) => `purchase-${index}`}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.listContent,
            purchases.length === 0 && styles.emptyContainer,
          ]}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={34} color="#9CA3AF" />
              <Text style={styles.emptyTitle}>Sin compras registradas</Text>
              <Text style={styles.emptyText}>
                Este producto todavía no tiene compras individuales asociadas.
              </Text>
            </View>
          }
        />

        <Pressable
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleRepeatProduct}
        >
          <Ionicons name="refresh-outline" size={20} color="#FFFFFF" />
          <Text style={styles.buttonText}>Añadir a nueva lista</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

/* -------------------------------------------------
   Styles
-------------------------------------------------- */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },

  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },

  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 8,
  },

  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: "#6B7280",
    marginBottom: 18,
  },

  listContent: {
    paddingTop: 8,
    paddingBottom: 24,
    gap: 14,
  },

  emptyContainer: {
    flexGrow: 1,
    justifyContent: "center",
  },

  card: {
    minHeight: 86,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },

  cardText: {
    flex: 1,
    paddingRight: 10,
    gap: 6,
  },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  storeRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  priceBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#ECFDF5",
  },

  price: {
    fontSize: 15,
    fontWeight: "800",
    color: "#059669",
  },

  button: {
    marginTop: 8,
    marginBottom: 16,
    minHeight: 52,
    backgroundColor: "#2563EB",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },

  buttonPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.99 }],
  },

  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },

  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },

  emptyTitle: {
    marginTop: 10,
    fontSize: 17,
    fontWeight: "700",
    color: "#374151",
    textAlign: "center",
  },

  emptyText: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: "#9CA3AF",
    textAlign: "center",
  },
});

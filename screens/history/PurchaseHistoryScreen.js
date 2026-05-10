import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { useLists } from "../../context/ListsContext";
import { useStores } from "../../context/StoresContext";
import { ROUTES } from "../../navigation/ROUTES";

import StoreFilterBadges from "../../components/features/stores/StoreFilterBadges";
import BarcodeLink from "../../components/controls/BarcodeLink";
import StoreLink from "../../components/controls/StoreLink";

import {
  queryProducts,
  getStoresFromPurchaseHistory,
} from "../../utils/queries/products";

import { priceText } from "../../utils/store/formatters";

/* -------------------------------------------------
   Meta components
-------------------------------------------------- */

const CreatedDatePill = ({ createdAt }) => {
  const date = createdAt ? new Date(createdAt) : null;

  return (
    <View style={styles.metaPill}>
      <Ionicons name="calendar-outline" size={15} color="#6B7280" />

      <Text style={styles.subInfo} numberOfLines={1}>
        {date && !Number.isNaN(date.getTime())
          ? date.toLocaleDateString("es-ES", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })
          : "Sin fecha"}
      </Text>
    </View>
  );
};

const PurchaseCountText = ({ frequency }) => {
  const count = Number(frequency ?? 0);

  return (
    <Text style={styles.purchaseCountText}>
      {count === 1 ? "1 compra" : `${count} compras`}
    </Text>
  );
};

/* -------------------------------------------------
   Screen
-------------------------------------------------- */

export default function PurchaseHistoryScreen() {
  const navigation = useNavigation();
  const lists = useLists();

  const { purchaseHistory = [], rebuildPurchaseHistory } = lists;
  const { getStoreById } = useStores();

  const [search, setSearch] = useState("");
  const [selectedStore, setSelectedStore] = useState(null);

  const stores = useMemo(() => {
    return getStoresFromPurchaseHistory(purchaseHistory, getStoreById);
  }, [purchaseHistory, getStoreById]);

  const products = useMemo(() => {
    const base = queryProducts({
      purchaseHistory,
      search,
      storeId: selectedStore,
    });

    return [...base].sort(
      (a, b) => (b.lastPurchasedAt ?? 0) - (a.lastPurchasedAt ?? 0),
    );
  }, [purchaseHistory, search, selectedStore]);

  const openSearch = (query) => {
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    Linking.openURL(url);
  };

  const reloadPurchaseHistory = () => {
    if (typeof rebuildPurchaseHistory !== "function") {
      console.warn(
        "rebuildPurchaseHistory no está disponible en ListsContext/useLists()",
      );
      return;
    }

    try {
      rebuildPurchaseHistory();
      console.log("purchaseHistory reconstruido");
    } catch (e) {
      console.error("Error al reconstruir purchaseHistory", e);
    }
  };

  const renderItem = ({ item }) => {
    const store = item.storeId ? getStoreById(item.storeId) : null;

    const goToDetail = () => {
      navigation.navigate(ROUTES.PURCHASE_DETAIL, {
        productId: item.id,
      });
    };

    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        onPress={goToDetail}
      >
        <View style={styles.iconBox}>
          <Ionicons name="receipt-outline" size={26} color="#111827" />
        </View>

        <View style={styles.cardText}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.name}
          </Text>

          {item.barcode ? (
            <BarcodeLink
              barcode={item.barcode}
              label="Buscar código"
              iconColor="#0F52BA"
            />
          ) : null}

          <View style={styles.purchaseMetaRow}>
            <PurchaseCountText frequency={item.frequency} />
            <CreatedDatePill createdAt={item.lastPurchasedAt} />
          </View>

          <StoreLink
            store={store}
            labelPrefix="Última tienda:"
            queryPrefix={item.name}
            iconColor="#2563EB"
            textColor="#2563EB"
          />
        </View>

        <View style={styles.right}>
          <View style={styles.priceBox}>
            <Ionicons name="pricetag-outline" size={17} color="#059669" />
            <Text style={styles.price}>{priceText(item.priceInfo)}</Text>
          </View>

          <Ionicons name="chevron-forward" size={22} color="#9CA3AF" />
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["left", "right", "bottom"]}>
      <View style={styles.content}>
        <Text style={styles.title}>Historial de compras</Text>

        <Text style={styles.subtitle}>
          Consulta productos comprados anteriormente, filtra por tienda o busca
          por nombre y código de barras.
        </Text>

        {__DEV__ && typeof rebuildPurchaseHistory === "function" && (
          <Pressable
            onPress={reloadPurchaseHistory}
            style={({ pressed }) => [
              styles.reloadButton,
              pressed && styles.cardPressed,
            ]}
          >
            <Ionicons name="refresh-outline" size={16} color="#374151" />
            <Text style={styles.reloadText}>Recargar historial</Text>
          </Pressable>
        )}

        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color="#9CA3AF" />

          <TextInput
            style={styles.searchInput}
            placeholder="Buscar producto…"
            placeholderTextColor="#9CA3AF"
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        </View>

        <StoreFilterBadges
          stores={stores}
          value={selectedStore}
          onChange={setSelectedStore}
        />

        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.listContent,
            products.length === 0 && styles.emptyContainer,
          ]}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={34} color="#9CA3AF" />
              <Text style={styles.emptyTitle}>No hay resultados</Text>
              <Text style={styles.emptyText}>
                Prueba a cambiar la búsqueda o el filtro de tienda.
              </Text>
            </View>
          }
        />
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

  reloadButton: {
    alignSelf: "flex-start",
    marginBottom: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#E5E7EB",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  reloadText: {
    fontSize: 13,
    color: "#374151",
    fontWeight: "700",
  },

  searchBox: {
    minHeight: 48,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },

  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#111827",
    paddingVertical: 12,
    marginLeft: 8,
    outlineStyle: "none",
  },

  listContent: {
    paddingTop: 8,
    paddingBottom: 24,
    gap: 14,
  },

  card: {
    minHeight: 96,
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

  cardPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.99 }],
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
  },

  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },

  purchaseMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
    marginBottom: 2,
  },

  purchaseCountText: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "600",
  },

  metaPill: {
    minHeight: 28,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "#F3F4F6",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },

  subInfo: {
    fontSize: 13,
    color: "#6B7280",
  },

  link: {
    marginTop: 4,
    fontSize: 13,
    color: "#2563EB",
    textDecorationLine: "underline",
  },

  right: {
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 10,
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

  emptyContainer: {
    flexGrow: 1,
    justifyContent: "center",
  },

  emptyState: {
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

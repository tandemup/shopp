import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useNavigation } from "@react-navigation/native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import BarcodeLink from "../components/BarcodeLink";
import StoreFilterBadges from "../components/StoreFilterBadges";
import { useLists } from "../context/ListsContext";
import { useStores } from "../context/StoresContext";
import { ROUTES } from "../navigation/ROUTES";
import { buildPurchaseHistoryFromArchivedLists } from "../utils/buildPurchaseHistoryFromArchivedLists";

import {
  getStoresFromPurchaseHistory,
  queryProducts,
} from "../utils/queries/products";

import {
  joinText,
  priceText,
  purchaseMetaText,
} from "../utils/store/formatters";

/* -------------------------------------------------
   Screen
-------------------------------------------------- */
export default function PurchaseHistoryScreen() {
  const navigation = useNavigation();
  const { purchaseHistory, archivedLists, rebuildPurchaseHistory } = useLists();

  const { getStoreById } = useStores();

  const [search, setSearch] = useState("");
  const [selectedStore, setSelectedStore] = useState(null);

  /* ---------------------------
     Stores (badges)
  ----------------------------*/
  const stores = useMemo(() => {
    return getStoresFromPurchaseHistory(purchaseHistory, getStoreById);
  }, [purchaseHistory, getStoreById]);

  if (__DEV__) {
    // console.log("STORES:", stores);
  }

  /* ---------------------------
     Products (query + sort)
  ----------------------------*/
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

  /* ---------------------------
     Helpers
  ----------------------------*/
  const openSearch = (query) => {
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    Linking.openURL(url);
  };

  /* ---------------------------
     Render item
  ----------------------------*/
  const renderItem = ({ item }) => {
    const store = item.storeId ? getStoreById(item.storeId) : null;

    const goToDetail = () => {
      navigation.navigate(ROUTES.PURCHASE_DETAIL, {
        product: item,
      });
    };

    return (
      <View style={styles.card}>
        {/* INFO */}
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{item.name}</Text>

          {item.barcode ? (
            <BarcodeLink
              barcode={item.barcode}
              label="Buscar código"
              iconColor="#0F52BA"
            />
          ) : null}

          <Text style={styles.meta}>
            {purchaseMetaText(item.frequency, item.lastPurchasedAt)}
          </Text>

          {store?.name ? (
            <Pressable onPress={() => openSearch(`${item.name} ${store.name}`)}>
              <Text style={styles.link}>
                {joinText("Última tienda: ", store.name)}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {/* RIGHT SIDE */}
        <View style={styles.right}>
          <View style={styles.priceBox}>
            <Ionicons name="pricetag-outline" size={18} color="#059669" />
            <Text style={styles.price}>{priceText(item.priceInfo)}</Text>
          </View>
        </View>

        <Pressable style={styles.chevron} onPress={goToDetail} hitSlop={10}>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </Pressable>
      </View>
    );
  };

  const reloadPurchaseHistory = async () => {
    try {
      rebuildPurchaseHistory();

      await AsyncStorage.setItem(
        "@purchaseHistory",
        JSON.stringify(buildPurchaseHistoryFromArchivedLists(archivedLists)),
      );

      console.log("purchaseHistory reconstruido");
    } catch (e) {
      console.error("Error al reconstruir purchaseHistory", e);
    }
  };

  /* ---------------------------
     Render
  ----------------------------*/
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Historial de compras</Text>
      {__DEV__ && (
        <Pressable onPress={reloadPurchaseHistory} style={styles.reloadButton}>
          <Text style={styles.reloadText}>{"🔄 "} Recargar historial</Text>
        </Pressable>
      )}

      <TextInput
        style={styles.search}
        placeholder="Buscar producto…"
        placeholderTextColor="#9CA3AF"
        value={search}
        onChangeText={setSearch}
        autoCorrect={false}
        clearButtonMode="while-editing"
      />

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
        contentContainerStyle={products.length === 0 && styles.emptyContainer}
        ListEmptyComponent={<Text style={styles.empty}>No hay resultados</Text>}
      />
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

  title: {
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 12,
  },

  search: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  card: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  name: {
    fontSize: 16,
    fontWeight: "700",
  },

  barcode: {
    marginTop: 2,
    fontSize: 12,
    color: "#374151",
  },

  meta: {
    marginTop: 4,
    color: "#6B7280",
    fontSize: 13,
  },

  link: {
    marginTop: 4,
    fontSize: 13,
    color: "#2563EB",
    textDecorationLine: "underline",
  },

  priceBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  price: {
    fontSize: 15,
    fontWeight: "700",
    color: "#059669",
  },

  emptyContainer: {
    flexGrow: 1,
    justifyContent: "center",
  },

  empty: {
    textAlign: "center",
    color: "#9CA3AF",
  },
  reloadButton: {
    alignSelf: "flex-start",
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#E5E7EB",
  },

  reloadText: {
    fontSize: 13,
    color: "#374151",
    fontWeight: "600",
  },

  chevron: {
    paddingLeft: 6,
  },
});

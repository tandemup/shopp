import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import DatePill from "../../components/controls/DatePill";
import StorePill from "../../components/controls/StorePill";
import SearchBar from "../../components/features/search/SearchBar";

import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { useLists } from "../../context/ListsContext";
import { useStores } from "../../context/StoresContext";
import { ROUTES } from "../../navigation/ROUTES";

import BarcodeLink from "../../components/controls/BarcodeLink";
import StoreFilterBadges from "../../components/features/stores/StoreFilterBadges";

import {
  queryProducts,
  getStoresFromPurchaseHistory,
} from "../../utils/queries/products";

import { formatCurrency, priceText } from "../../utils/store/formatters";

/* -------------------------------------------------
   Helpers
-------------------------------------------------- */

const toTimestamp = (value) => {
  if (!value) return 0;

  if (typeof value === "number") return value;

  const date = new Date(value);
  const time = date.getTime();

  return Number.isNaN(time) ? 0 : time;
};

const getPurchaseQuantity = (purchase) => {
  const quantity = Number(purchase?.quantity ?? purchase?.qty ?? 1);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
};

const groupPurchasesByStore = (purchases = [], getStoreById) => {
  const map = new Map();

  purchases.forEach((purchase) => {
    const key = purchase.storeId ?? "__no_store__";
    const store = purchase.storeId ? getStoreById(purchase.storeId) : null;

    if (!map.has(key)) {
      map.set(key, {
        storeId: purchase.storeId ?? null,
        store,
        purchases: [],
        totalUnits: 0,
        totalSpent: 0,
        lastPurchasedAt: purchase.purchasedAt,
      });
    }

    const group = map.get(key);

    group.purchases.push(purchase);
    group.totalUnits += getPurchaseQuantity(purchase);
    group.totalSpent += Number(purchase.priceInfo?.total ?? 0);

    if (
      toTimestamp(purchase.purchasedAt) > toTimestamp(group.lastPurchasedAt)
    ) {
      group.lastPurchasedAt = purchase.purchasedAt;
    }
  });

  return Array.from(map.values()).sort(
    (a, b) => toTimestamp(b.lastPurchasedAt) - toTimestamp(a.lastPurchasedAt),
  );
};

/* -------------------------------------------------
   Components
-------------------------------------------------- */

const ProductCountText = ({ units, purchases }) => {
  const safeUnits = Number(units ?? 0);
  const safePurchases = Number(purchases ?? 0);

  return (
    <View style={styles.iconRow}>
      <Ionicons name="cart-outline" size={17} color="#6B7280" />
      <Text style={styles.productsText}>
        {safeUnits === 1 ? "1 producto" : `${safeUnits} productos`} ·{" "}
        {safePurchases === 1 ? "1 compra" : `${safePurchases} compras`}
      </Text>
    </View>
  );
};

const StoreSummaryRow = ({ group, onPressStore }) => {
  return (
    <View style={styles.storeSummaryRow}>
      <View style={styles.storeSummaryLeft}>
        <View style={styles.storePillWrap}>
          <StorePill store={group.store} onPressStore={onPressStore} />
        </View>

        <View style={styles.storeMetaRow}>
          <DatePill
            date={group.lastPurchasedAt}
            fallback="Sin fecha"
            icon="calendar-outline"
          />

          <Text style={styles.storeUnitsText}>
            {group.totalUnits === 1
              ? "1 producto"
              : `${group.totalUnits} productos`}
          </Text>
        </View>
      </View>

      <Text style={styles.storeTotal}>{formatCurrency(group.totalSpent)}</Text>
    </View>
  );
};

const PurchaseHistoryCard = ({
  item,
  expanded,
  onToggle,
  onPressDetails,
  onPressStore,
  getStoreById,
}) => {
  const storeGroups = useMemo(() => {
    return groupPurchasesByStore(item.purchases, getStoreById);
  }, [item.purchases, getStoreById]);

  const lastStore = item.storeId ? getStoreById(item.storeId) : null;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <View style={styles.iconBox}>
          <Ionicons name="receipt-outline" size={26} color="#111827" />
        </View>

        <View style={styles.cardText}>
          <View style={styles.topRow}>
            <Pressable
              onPress={onPressDetails}
              style={styles.titlePressable}
              hitSlop={6}
            >
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.name}
              </Text>
            </Pressable>

            <Pressable onPress={onToggle} style={styles.chevronPressable}>
              <Ionicons
                name="chevron-forward"
                size={22}
                color="#9CA3AF"
                style={{
                  transform: [{ rotate: expanded ? "90deg" : "0deg" }],
                }}
              />
            </Pressable>
          </View>

          {item.barcode ? (
            <BarcodeLink
              barcode={item.barcode}
              label="Buscar código"
              iconColor="#0F52BA"
            />
          ) : null}

          {Boolean(item.categoryName || item.subcategoryName) && (
            <View style={styles.categoryRow}>
              {item.categoryName ? (
                <View style={styles.categoryPill}>
                  <Text style={styles.categoryPillText} numberOfLines={1}>
                    {item.categoryName}
                  </Text>
                </View>
              ) : null}

              {item.subcategoryName ? (
                <View style={styles.subcategoryPill}>
                  <Text style={styles.subcategoryPillText} numberOfLines={1}>
                    {item.subcategoryName}
                  </Text>
                </View>
              ) : null}
            </View>
          )}

          <View style={styles.infoRow}>
            <DatePill
              date={item.lastPurchasedAt}
              fallback="Sin fecha"
              icon="calendar-outline"
            />
            <StorePill store={lastStore} onPressStore={onPressStore} />
          </View>
        </View>
      </View>

      <View style={styles.separator} />

      <View style={styles.bottomRow}>
        <ProductCountText units={item.totalUnits} purchases={item.frequency} />

        <View style={styles.priceBox}>
          <Ionicons name="pricetag-outline" size={17} color="#059669" />
          <Text style={styles.price}>{priceText(item.priceInfo)}</Text>
        </View>
      </View>

      {expanded && (
        <View style={styles.storesContainer}>
          <Text style={styles.sectionTitle}>Comprado en tiendas</Text>

          {storeGroups.map((group) => (
            <StoreSummaryRow
              key={group.storeId ?? "no-store"}
              group={group}
              onPressStore={onPressStore}
            />
          ))}
        </View>
      )}
    </View>
  );
};

/* -------------------------------------------------
   Screen
-------------------------------------------------- */

export default function PurchaseHistoryScreen() {
  const navigation = useNavigation();
  const lists = useLists();

  const { purchaseHistory = [] } = lists;
  const { getStoreById } = useStores();

  const [search, setSearch] = useState("");
  const [selectedStore, setSelectedStore] = useState(null);
  const [expandedProductId, setExpandedProductId] = useState(null);

  const sourceProducts = useMemo(() => {
    return purchaseHistory;
  }, [purchaseHistory]);

  const stores = useMemo(() => {
    return getStoresFromPurchaseHistory(sourceProducts, getStoreById);
  }, [sourceProducts, getStoreById]);

  const products = useMemo(() => {
    const base = queryProducts({
      purchaseHistory: sourceProducts,
      search,
      storeId: selectedStore,
    });

    return [...base].sort(
      (a, b) => toTimestamp(b.lastPurchasedAt) - toTimestamp(a.lastPurchasedAt),
    );
  }, [sourceProducts, search, selectedStore]);

  const openStoreDetail = (storeId) => {
    if (!storeId) return;

    navigation.navigate(ROUTES.STORES_TAB, {
      screen: ROUTES.STORE_DETAIL,
      params: {
        storeId,
      },
    });
  };

  const openPurchaseDetail = (product) => {
    navigation.navigate(ROUTES.PURCHASE_DETAIL, {
      productId: product.id,
      product,
    });
  };

  const renderItem = ({ item }) => (
    <PurchaseHistoryCard
      item={item}
      expanded={expandedProductId === item.id}
      onToggle={() =>
        setExpandedProductId(expandedProductId === item.id ? null : item.id)
      }
      onPressDetails={() => openPurchaseDetail(item)}
      onPressStore={openStoreDetail}
      getStoreById={getStoreById}
    />
  );

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      <View style={styles.content}>
        <Text style={styles.title}>Historial de compras</Text>

        <Text style={styles.subtitle}>
          Consulta productos comprados anteriormente, cuántas unidades has
          comprado y en qué tiendas.
        </Text>

        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Buscar producto, supermercado o código..."
          style={styles.searchBar}
        />

        <StoreFilterBadges
          stores={stores}
          value={selectedStore}
          onChange={setSelectedStore}
        />

        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          extraData={expandedProductId}
          renderItem={renderItem}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.listContent,
            products.length === 0 && styles.emptyContainer,
          ]}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconBox}>
                <Ionicons name="receipt-outline" size={30} color="#9CA3AF" />
              </View>
              <Text style={styles.emptyTitle}>No hay historial de compras</Text>
              <Text style={styles.emptySubtitle}>
                Cuando archives una lista de compra aparecerán aquí sus
                productos agrupados.
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
    marginBottom: 20,
  },

  searchBar: {
    marginBottom: 16,
  },

  listContent: {
    paddingBottom: 60,
  },

  emptyContainer: {
    flexGrow: 1,
    justifyContent: "center",
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
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
  },

  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  titlePressable: {
    flex: 1,
    paddingVertical: 2,
  },

  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
  },

  chevronPressable: {
    padding: 6,
    marginLeft: 8,
  },

  categoryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },

  categoryPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },

  subcategoryPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  categoryPillText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#2563EB",
  },

  subcategoryPillText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#475569",
  },

  infoRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },

  separator: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 12,
  },

  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  iconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
  },

  productsText: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "600",
    flexShrink: 1,
  },

  priceBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#ECFDF5",
    flexShrink: 0,
  },

  price: {
    fontSize: 15,
    fontWeight: "800",
    color: "#059669",
  },

  storePillWrap: {
    alignSelf: "flex-start",
  },

  storesContainer: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: 12,
    gap: 10,
  },

  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 2,
  },

  storeSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 6,
  },

  storeSummaryLeft: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },

  storeTotal: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
    flexShrink: 0,
  },

  storeSummaryLeft: {
    flex: 1,
    gap: 6,
    minWidth: 0,
  },

  storeMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },

  storeUnitsText: {
    fontSize: 13,
    color: "#6B7280",
    fontWeight: "600",
  },

  storeTotal: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
  },

  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  emptyIconBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },

  emptyTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 6,
  },

  emptySubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: "#6B7280",
    textAlign: "center",
  },
});

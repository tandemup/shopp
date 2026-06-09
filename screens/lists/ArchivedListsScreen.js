// screens/lists/ArchivedListsScreen.js

import React, { useMemo, useState } from "react";

import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import DatePill from "../../components/controls/DatePill";
import StorePill from "../../components/controls/StorePill";

import SearchBar from "../../components/features/search/SearchBar";

import { useLists } from "../../context/ListsContext";
import { useStores } from "../../context/StoresContext";

import { ROUTES } from "../../navigation/ROUTES";

import { normalizePriceInfo } from "../../utils/core/defaultItem";
import { formatCurrency } from "../../utils/store/formatters";

/* ────────────────────────────────────────────────
   HEADER ROW
──────────────────────────────────────────────── */

const HeaderRow = ({ title, expanded, onToggle }) => {
  return (
    <View style={styles.topRow}>
      <Text style={styles.listTitle} numberOfLines={1}>
        {title}
      </Text>

      <Pressable
        style={styles.chevronPressable}
        hitSlop={10}
        onPress={onToggle}
      >
        <Ionicons
          name="chevron-forward"
          size={22}
          color="#9CA3AF"
          style={{
            transform: [
              {
                rotate: expanded ? "90deg" : "0deg",
              },
            ],
          }}
        />
      </Pressable>
    </View>
  );
};

/* ────────────────────────────────────────────────
   INFO ROW
──────────────────────────────────────────────── */

const InfoRow = ({ archivedAt, store, onPressStore }) => {
  return (
    <View style={styles.infoRow}>
      <DatePill
        date={archivedAt}
        fallback="Sin fecha"
        icon="calendar-outline"
      />

      <StorePill store={store} onPressStore={onPressStore} />
    </View>
  );
};

/* ────────────────────────────────────────────────
   PRODUCTS AND TOTAL ROW
──────────────────────────────────────────────── */

const ProductsAndTotalRow = ({ count, total }) => {
  return (
    <View style={styles.bottomRow}>
      <View style={styles.iconRow}>
        <Ionicons name="cart-outline" size={17} color="#6B7280" />

        <Text style={styles.productsText}>{count} productos</Text>
      </View>

      <Text style={styles.totalPrice}>{formatCurrency(total.toFixed(2))}</Text>
    </View>
  );
};

/* ────────────────────────────────────────────────
   ARCHIVED ITEM ROW
──────────────────────────────────────────────── */

const ArchivedItemRow = ({ item, isLast }) => {
  const priceInfo = normalizePriceInfo(item.priceInfo);

  const { total, promo, promoLabel, savings, summary, warning } = priceInfo;

  const hasOffer = Boolean(promo || promoLabel);

  return (
    <View style={[styles.itemRow, isLast && styles.itemRowLast]}>
      <View style={styles.itemIconBox}>
        <Ionicons name="receipt-outline" size={18} color="#111827" />
      </View>

      <View style={styles.itemContent}>
        <View style={styles.nameRow}>
          <Text style={styles.itemName} numberOfLines={1}>
            {item.name}
          </Text>

          {hasOffer ? (
            <View style={styles.offerBadgeInline}>
              <Text style={styles.offerText}>{promoLabel || promo}</Text>
            </View>
          ) : null}
        </View>

        {summary && summary.length > 0 ? (
          <Text style={styles.summaryText}>{summary}</Text>
        ) : null}

        {typeof item.barcode === "string" && item.barcode.length > 0 ? (
          <Text style={styles.barcode}>🔎 {item.barcode}</Text>
        ) : null}

        {typeof savings === "number" && savings > 0 ? (
          <Text style={styles.savingText}>💸 {formatCurrency(savings)}</Text>
        ) : null}

        {typeof warning === "string" && warning.length > 0 ? (
          <Text style={styles.warningText}>⚠ {warning}</Text>
        ) : null}
      </View>

      <View style={styles.itemPriceColumn}>
        {typeof total === "number" ? (
          <Text style={styles.itemPrice}>{formatCurrency(total)}</Text>
        ) : null}
      </View>
    </View>
  );
};

/* ────────────────────────────────────────────────
   ARCHIVED LIST CARD
──────────────────────────────────────────────── */

const ArchivedListCard = ({
  list,
  store,
  expanded,
  onToggle,
  onPressStore,
}) => {
  const items = list.items || [];

  const total = items.reduce((sum, item) => {
    return sum + Number(item.priceInfo?.total ?? item.price ?? 0);
  }, 0);

  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <View style={styles.iconBox}>
          <Ionicons name="archive-outline" size={26} color="#111827" />
        </View>

        <View style={styles.cardText}>
          <HeaderRow
            title={list.name}
            expanded={expanded}
            onToggle={onToggle}
          />

          <InfoRow
            archivedAt={list.archivedAt || list.createdAt}
            store={store}
            onPressStore={onPressStore}
          />
        </View>
      </View>

      <View style={styles.separator} />

      <ProductsAndTotalRow count={items.length} total={total} />

      {expanded ? (
        <View style={styles.itemsContainer}>
          {items.map((item, index) => {
            return (
              <ArchivedItemRow
                key={item.id}
                item={item}
                isLast={index === items.length - 1}
              />
            );
          })}
        </View>
      ) : null}
    </View>
  );
};

/* ────────────────────────────────────────────────
   SCREEN
──────────────────────────────────────────────── */

export default function ArchivedListsScreen({ navigation }) {
  const { archivedLists } = useLists();

  const { getStoreById } = useStores();

  const [expandedListId, setExpandedListId] = useState(null);

  const [search, setSearch] = useState("");

  /* ────────────────────────────────────────────────
     SORT LISTS
  ──────────────────────────────────────────────── */

  const sortedLists = useMemo(() => {
    return [...(archivedLists ?? [])].sort((listA, listB) => {
      const dateA = new Date(listA.archivedAt || listA.createdAt);

      const dateB = new Date(listB.archivedAt || listB.createdAt);

      return dateB - dateA;
    });
  }, [archivedLists]);

  /* ────────────────────────────────────────────────
     FILTER LISTS
  ──────────────────────────────────────────────── */

  const filteredLists = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return sortedLists;
    }

    return sortedLists.filter((list) => {
      const listNameMatch = list.name?.toLowerCase().includes(query);

      const store = list.storeId ? getStoreById(list.storeId) : null;

      const storeMatch = store?.name?.toLowerCase().includes(query);

      const itemsMatch = (list.items || []).some((item) => {
        const nameMatch = item.name?.toLowerCase().includes(query);

        const barcodeMatch =
          typeof item.barcode === "string" &&
          item.barcode.toLowerCase().includes(query);

        return nameMatch || barcodeMatch;
      });

      return listNameMatch || storeMatch || itemsMatch;
    });
  }, [search, sortedLists, getStoreById]);

  /* ────────────────────────────────────────────────
     NAVIGATE TO STORE DETAIL
  ──────────────────────────────────────────────── */

  function openStoreInfo(storeId) {
    if (!storeId) {
      return;
    }

    navigation.navigate(ROUTES.STORES_TAB, {
      screen: ROUTES.STORE_DETAIL,

      params: {
        storeId,
      },
    });
  }

  /* ────────────────────────────────────────────────
     TOGGLE LIST DETAILS
  ──────────────────────────────────────────────── */

  function toggleExpandedList(listId) {
    setExpandedListId((currentListId) => {
      return currentListId === listId ? null : listId;
    });
  }

  /* ────────────────────────────────────────────────
     RENDER ITEM
  ──────────────────────────────────────────────── */

  function renderItem({ item }) {
    return (
      <ArchivedListCard
        list={item}
        store={item.storeId ? getStoreById(item.storeId) : null}
        expanded={expandedListId === item.id}
        onToggle={() => {
          toggleExpandedList(item.id);
        }}
        onPressStore={openStoreInfo}
      />
    );
  }

  /* ────────────────────────────────────────────────
     RENDER
  ──────────────────────────────────────────────── */

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      <View style={styles.content}>
        <Text style={styles.title}>Listas archivadas</Text>

        <Text style={styles.subtitle}>
          Consulta las listas ya pagadas, revisa sus productos y accede al
          detalle de cada compra archivada.
        </Text>

        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Buscar lista, supermercado o producto…"
          style={styles.searchBar}
        />

        <FlatList
          data={filteredLists}
          keyExtractor={(item) => {
            return item.id;
          }}
          extraData={expandedListId}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconBox}>
                <Ionicons name="archive-outline" size={30} color="#9CA3AF" />
              </View>

              <Text style={styles.emptyTitle}>No hay listas archivadas</Text>

              <Text style={styles.emptySubtitle}>
                Cuando archives una lista de compra aparecerá aquí.
              </Text>
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
}

/* ────────────────────────────────────────────────
   STYLES
──────────────────────────────────────────────── */

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
    marginBottom: 8,
    color: "#111827",
    fontSize: 28,
    fontWeight: "800",
  },

  subtitle: {
    marginBottom: 20,
    color: "#6B7280",
    fontSize: 15,
    lineHeight: 22,
  },

  searchBar: {
    marginBottom: 16,
  },

  listContent: {
    paddingBottom: 60,
  },

  card: {
    marginBottom: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,

    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 18,

    backgroundColor: "#FFFFFF",

    shadowColor: "#000000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },

    elevation: 2,
  },

  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  iconBox: {
    width: 48,
    height: 48,
    marginRight: 14,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: 16,

    backgroundColor: "#F3F4F6",
  },

  cardText: {
    flex: 1,
  },

  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  listTitle: {
    color: "#111827",
    fontSize: 17,
    fontWeight: "700",
  },

  chevronPressable: {
    marginLeft: 8,
    padding: 6,
  },

  infoRow: {
    marginTop: 8,

    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",

    gap: 8,
  },

  separator: {
    height: 1,
    marginVertical: 12,

    backgroundColor: "#E5E7EB",
  },

  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  iconRow: {
    flexDirection: "row",
    alignItems: "center",

    gap: 6,
  },

  productsText: {
    color: "#6B7280",
    fontSize: 14,
    fontWeight: "600",
  },

  totalPrice: {
    color: "#16A34A",
    fontSize: 20,
    fontWeight: "800",
  },

  itemsContainer: {
    marginTop: 12,

    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },

  itemRow: {
    paddingVertical: 12,

    flexDirection: "row",
    alignItems: "flex-start",

    gap: 12,

    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },

  itemRowLast: {
    borderBottomWidth: 0,
  },

  itemIconBox: {
    width: 34,
    height: 34,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: 12,

    backgroundColor: "#F3F4F6",
  },

  itemContent: {
    flex: 1,
  },

  nameRow: {
    flexDirection: "row",
    alignItems: "center",

    gap: 8,
  },

  itemName: {
    flexShrink: 1,

    color: "#111827",
    fontSize: 15,
    fontWeight: "700",
  },

  barcode: {
    marginTop: 4,

    color: "#2563EB",
    fontSize: 12,
  },

  summaryText: {
    marginTop: 4,

    color: "#6B7280",
    fontSize: 12,
    lineHeight: 17,
  },

  savingText: {
    marginTop: 4,

    color: "#16A34A",
    fontSize: 12,
    fontWeight: "700",
  },

  warningText: {
    marginTop: 4,

    color: "#B45309",
    fontSize: 12,
  },

  itemPriceColumn: {
    minWidth: 82,

    alignItems: "flex-end",
    justifyContent: "flex-start",
  },

  itemPrice: {
    marginLeft: 8,

    color: "#111827",
    fontSize: 15,
    fontWeight: "800",
  },

  offerBadgeInline: {
    flexShrink: 0,

    paddingHorizontal: 8,
    paddingVertical: 3,

    borderRadius: 999,

    backgroundColor: "#FEF3C7",
  },

  offerText: {
    color: "#92400E",
    fontSize: 11,
    fontWeight: "700",
  },

  emptyCard: {
    paddingHorizontal: 20,
    paddingVertical: 28,

    alignItems: "center",

    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 18,

    backgroundColor: "#FFFFFF",

    shadowColor: "#000000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 4,
    },

    elevation: 2,
  },

  emptyIconBox: {
    width: 56,
    height: 56,
    marginBottom: 14,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: 18,

    backgroundColor: "#F3F4F6",
  },

  emptyTitle: {
    marginBottom: 6,

    color: "#111827",
    fontSize: 17,
    fontWeight: "800",
  },

  emptySubtitle: {
    color: "#6B7280",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
});

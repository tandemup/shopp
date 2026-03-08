import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  FlatList,
  Linking,
} from "react-native";
import SearchBar from "../components/SearchBar";
import { Ionicons } from "@expo/vector-icons";

import { ROUTES } from "../navigation/ROUTES";
import { useLists } from "../context/ListsContext";
import { useStores } from "../context/StoresContext";
import { normalizePriceInfo } from "../utils/core/defaultItem";

/* ────────────────────────────────────────────────
   STORE LINK
──────────────────────────────────────────────── */

const StoreSearchLink = ({ store, onPressStore }) => {
  if (!store) return <Text style={{ color: "#999" }}>Sin tienda</Text>;

  const handlePress = () => {
    if (onPressStore) {
      onPressStore(store.id);
      return;
    }
    Linking.openURL(
      `https://www.google.com/search?q=${encodeURIComponent(store.name)}`,
    );
  };

  return (
    <TouchableOpacity onPress={handlePress} style={styles.storeLink}>
      <Ionicons name="location-outline" size={16} color="#2563eb" />
      <Text style={styles.storeText}>{store.name}</Text>
    </TouchableOpacity>
  );
};

/* ────────────────────────────────────────────────
   HEADER ROW (FIXED)
──────────────────────────────────────────────── */
const HeaderRow = ({ title, expanded, onToggle, onPressDetails }) => (
  <View style={styles.topRow}>
    {/* TITLE */}
    <Pressable
      onPress={onPressDetails}
      style={styles.titlePressable}
      hitSlop={6}
    >
      <Text style={styles.listTitle} numberOfLines={1}>
        {title}
      </Text>
    </Pressable>

    {/* CHEVRON — always right */}
    <Pressable onPress={onToggle} style={styles.chevronPressable} hitSlop={10}>
      <Ionicons
        name="chevron-forward"
        size={22}
        color="#555"
        style={{
          transform: [{ rotate: expanded ? "90deg" : "0deg" }],
        }}
      />
    </Pressable>
  </View>
);

const InfoRow = ({ archivedAt, store, onPressStore }) => (
  <View style={styles.infoRow}>
    <Ionicons name="calendar-outline" size={16} color="#777" />
    <Text style={styles.subInfo}>
      {new Date(archivedAt).toLocaleDateString("es-ES", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })}
    </Text>
    <Text style={styles.dot}>•</Text>
    <StoreSearchLink store={store} onPressStore={onPressStore} />
  </View>
);

const ProductsAndTotalRow = ({ count, total }) => (
  <View style={styles.bottomRow}>
    <View style={styles.iconRow}>
      <Ionicons name="cart-outline" size={17} color="#777" />
      <Text style={styles.productsText}>{count} productos</Text>
    </View>
    <Text style={styles.totalPrice}>{total.toFixed(2)} €</Text>
  </View>
);

/* ────────────────────────────────────────────────
   ITEM ROW — OPCIÓN C
──────────────────────────────────────────────── */
const PriceRow = ({ label, value, highlight = false }) => {
  if (value === null || value === undefined) return null;

  return (
    <View style={styles.priceRow}>
      <Text style={styles.priceLabel}>{label}</Text>
      <Text
        style={[styles.priceValue, highlight && styles.priceValueHighlight]}
      >
        {value}
      </Text>
    </View>
  );
};

const ArchivedItemRow = ({ item }) => {
  const pi = normalizePriceInfo(item.priceInfo);
  const { total, currency, promo, promoLabel, savings, summary, warning } = pi;
  const hasOffer = !!(promo || promoLabel);

  return (
    <View style={styles.itemRow}>
      {/* LEFT COLUMN */}
      <View style={{ flex: 1 }}>
        <View style={styles.nameRow}>
          <Text style={styles.itemName} numberOfLines={1}>
            {item.name}
          </Text>

          {hasOffer && (
            <View style={styles.offerBadgeInline}>
              <Text style={styles.offerText}>{promoLabel || promo}</Text>
            </View>
          )}

          {typeof savings === "number" && savings > 0 && (
            <Text style={styles.savingText}>
              {"💸 "} {savings.toFixed(2)} {currency}
            </Text>
          )}
        </View>

        {summary && summary.length > 0 && (
          <Text style={styles.summaryText}>{summary}</Text>
        )}

        {typeof item.barcode === "string" && item.barcode.length > 0 && (
          <Text style={styles.barcode}>🔎 {item.barcode}</Text>
        )}

        {typeof warning === "string" && (
          <Text style={styles.warningText}>⚠ {warning}</Text>
        )}
      </View>

      {/* RIGHT COLUMN — PRICE */}
      <View style={styles.itemPriceColumn}>
        {typeof total === "number" && (
          <Text style={styles.itemPrice}>
            {total.toFixed(2)} {currency}
          </Text>
        )}
      </View>
    </View>
  );
};

/* ────────────────────────────────────────────────
   CARD
──────────────────────────────────────────────── */

const ArchivedListCard = ({
  list,
  store,
  expanded,
  onToggle,
  onPressDetails,
  onPressStore,
}) => {
  const items = list.items || [];
  const total = items.reduce(
    (sum, it) => sum + Number(it.priceInfo?.total ?? it.price ?? 0),
    0,
  );

  return (
    <View style={styles.card}>
      <HeaderRow
        title={list.name}
        expanded={expanded}
        onToggle={onToggle}
        onPressDetails={onPressDetails}
      />

      <InfoRow
        archivedAt={list.archivedAt || list.createdAt}
        store={store}
        onPressStore={onPressStore}
      />

      <View style={styles.separator} />

      <ProductsAndTotalRow count={items.length} total={total} />

      {expanded && (
        <View style={styles.itemsContainer}>
          {items.map((item) => (
            <ArchivedItemRow key={item.id} item={item} />
          ))}
        </View>
      )}
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

  // ✅ SORT: most recent first
  const sortedLists = useMemo(() => {
    return [...(archivedLists ?? [])].sort(
      (a, b) =>
        new Date(b.archivedAt || b.createdAt) -
        new Date(a.archivedAt || a.createdAt),
    );
  }, [archivedLists]);

  const filteredLists = useMemo(() => {
    if (!search.trim()) return sortedLists;

    const q = search.toLowerCase();

    return sortedLists.filter((list) => {
      // 🟦 1. Nombre de la lista
      const listNameMatch = list.name?.toLowerCase().includes(q);

      // 🟦 2. Supermercado
      const store = list.storeId ? getStoreById(list.storeId) : null;
      const storeMatch = store?.name?.toLowerCase().includes(q);

      // 🟦 3. Items dentro de la lista
      const itemsMatch = (list.items || []).some((item) => {
        const nameMatch = item.name?.toLowerCase().includes(q);
        const barcodeMatch =
          typeof item.barcode === "string" &&
          item.barcode.toLowerCase().includes(q);

        return nameMatch || barcodeMatch;
      });

      return listNameMatch || storeMatch || itemsMatch;
    });
  }, [search, sortedLists, getStoreById]);

  const openDetails = (list) => {
    navigation.navigate(ROUTES.ARCHIVED_LIST_DETAIL, {
      listId: list.id,
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.screenTitle}>Listas Archivadas</Text>

      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder="Buscar lista o supermercado…"
        style={{ marginBottom: 14 }}
      />

      <FlatList
        data={filteredLists}
        keyExtractor={(item) => item.id}
        extraData={expandedListId}
        renderItem={({ item }) => (
          <ArchivedListCard
            list={item}
            store={item.storeId ? getStoreById(item.storeId) : null}
            expanded={expandedListId === item.id}
            onToggle={() =>
              setExpandedListId(expandedListId === item.id ? null : item.id)
            }
            onPressDetails={() => openDetails(item)}
            onPressStore={() => {}}
          />
        )}
        contentContainerStyle={{ paddingBottom: 60 }}
      />
    </View>
  );
}

/* ────────────────────────────────────────────────
   STYLES
──────────────────────────────────────────────── */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#F2F3F7",
  },

  screenTitle: {
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 18,
  },

  card: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },

  /* ───────── HEADER ───────── */

  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  listTitle: {
    fontSize: 18,
    fontWeight: "700",
  },

  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },

  subInfo: {
    fontSize: 14,
    color: "#666",
  },

  dot: {
    color: "#aaa",
  },

  storeLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  storeText: {
    color: "#2563eb",
    fontSize: 14,
  },

  separator: {
    height: 1,
    backgroundColor: "rgba(0,0,0,0.08)",
    marginVertical: 10,
  },

  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  iconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  productsText: {
    fontSize: 15,
  },

  totalPrice: {
    fontSize: 20,
    fontWeight: "700",
    color: "#16a34a",
  },

  /* ───────── ITEMS ───────── */

  itemsContainer: {
    marginTop: 8,
  },

  itemRow1: {
    flexDirection: "row",
    paddingVertical: 12,
    gap: 12,
  },

  itemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 12,
    gap: 12,
  },

  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  itemName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111",
    flexShrink: 1,
  },

  barcode: {
    fontSize: 12,
    color: "#2563eb",
    marginTop: 4,
  },

  itemPrice: {
    fontSize: 16,
    fontWeight: "700",
    marginLeft: 12,
  },

  itemPriceColumn: {
    alignItems: "flex-end",
    justifyContent: "flex-start",
    minWidth: 80,
  },

  titlePressable: {
    flexShrink: 1,
    paddingVertical: 4,
  },

  chevronPressable: {
    padding: 8, // 🔑 crea zona táctil clara
    marginLeft: 8,
  },

  /* ───────── OFFER ───────── */

  offerBadgeInline: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    flexShrink: 0,
  },

  offerText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#92400e",
  },

  /* ───────── DETAILS ───────── */

  summaryText: {
    fontSize: 12,
    color: "#555",
    marginTop: 4,
    whiteSpace: "pre-line", // RN Web
  },

  savingText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#16a34a",
    marginTop: 4,
  },
  warningText: {
    fontSize: 12,
    color: "#b45309",
    marginTop: 4,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 2,
  },

  priceLabel: {
    fontSize: 12,
    color: "#555",
  },

  priceValue: {
    fontSize: 12,
    fontWeight: "600",
    color: "#16a34a",
  },

  priceValueHighlight: {
    fontSize: 14,
    fontWeight: "800",
  },
});

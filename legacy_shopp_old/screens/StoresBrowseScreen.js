import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable } from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { useStores } from "../context/StoresContext";
import { useLocation } from "../context/LocationContext";
import { distanceMetersBetween } from "../utils/math/distance";
import { formatDistance } from "../utils/math/formatDistance";

import SearchBar from "../components/SearchBar";
import { ROUTES } from "../navigation/ROUTES";

/* -------------------------------------------------
   Screen
-------------------------------------------------- */
export default function StoresBrowseScreen() {
  const route = useRoute();
  const navigation = useNavigation();

  const { selectForListId, mode } = route.params || {};
  const isSelectMode = mode === "select";

  const { stores, toggleFavoriteStore, isFavoriteStore } = useStores();
  const { location } = useLocation(); // { lat, lng }

  const [query, setQuery] = useState("");

  /* ---------------------------------------------
     Ordenar + enriquecer con distancia
  ---------------------------------------------- */
  const orderedStores = useMemo(() => {
    const enriched = stores.map((store) => {
      if (
        location?.lat != null &&
        location?.lng != null &&
        store.location?.lat != null &&
        store.location?.lng != null
      ) {
        const distance = distanceMetersBetween(
          location.lat,
          location.lng,
          store.location.lat,
          store.location.lng,
        );
        return { ...store, distance };
      }

      return { ...store, distance: null };
    });

    if (location?.lat != null && location?.lng != null) {
      return [...enriched].sort((a, b) => {
        if (a.distance == null) return 1;
        if (b.distance == null) return -1;
        return a.distance - b.distance;
      });
    }

    return [...enriched].sort((a, b) =>
      (a.name || "").localeCompare(b.name || ""),
    );
  }, [stores, location]);

  const normalize = (text = "") =>
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  const filteredStores = useMemo(() => {
    if (!query.trim()) return orderedStores;

    const q = normalize(query);

    return orderedStores.filter((s) => {
      return (
        normalize(s.name).includes(q) ||
        normalize(s.address).includes(q) ||
        normalize(s.city).includes(q)
      );
    });
  }, [orderedStores, query]);

  console.log(filteredStores.map((item) => item.id));
  /* ---------------------------------------------
     Navegación
  ---------------------------------------------- */
  const handlePressStore = (store) => {
    if (isSelectMode && selectForListId) {
      navigation.navigate(ROUTES.SHOPPING_TAB, {
        screen: ROUTES.SHOPPING_LIST,
        params: {
          listId: selectForListId,
          selectedStore: store,
        },
      });
      return;
    }

    navigation.navigate(ROUTES.STORE_DETAIL, {
      storeId: store.id,
    });
  };

  /* ---------------------------------------------
     Render fila
  ---------------------------------------------- */
  const renderStoreRow = ({ item: store }) => {
    const isFavorite = isFavoriteStore(store.id);

    return (
      <View style={styles.rowContainer}>
        <Pressable
          style={styles.rowInfo}
          onPress={() => handlePressStore(store)}
          android_ripple={{ color: "#eee" }}
        >
          <Text style={styles.rowName}>{store.name}</Text>

          {store.address && (
            <Text style={styles.rowAddress}>📍 {store.address}</Text>
          )}

          <Text style={styles.rowMetaCity}>
            {store.city}
            {store.distance != null && ` · ${formatDistance(store.distance)}`}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => toggleFavoriteStore(store.id)}
          hitSlop={10}
          style={styles.starButton}
        >
          <Ionicons
            name={isFavorite ? "star" : "star-outline"}
            size={22}
            color={isFavorite ? "#f5c518" : "#bbb"}
          />
        </Pressable>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <SearchBar
        value={query}
        onChange={setQuery}
        placeholder="Buscar tienda…"
        style={styles.search}
      />

      <Text style={styles.countText}>
        {query.trim()
          ? `${filteredStores.length} resultado${filteredStores.length === 1 ? "" : "s"}`
          : `${filteredStores.length} tienda${filteredStores.length === 1 ? "" : "s"}`}
      </Text>

      <FlatList
        data={filteredStores}
        keyExtractor={(item) => item.id}
        renderItem={renderStoreRow}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No se encontraron tiendas</Text>
          </View>
        }
      />
    </View>
  );
}

/* -------------------------------------------------
   Styles
-------------------------------------------------- */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f6f6f6",
  },

  content: {
    padding: 12,
    paddingBottom: 24,
  },

  search: {
    marginTop: 12,
    marginBottom: 12,
    marginHorizontal: 12,
  },

  rowContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    margin: 5,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    backgroundColor: "#fff",
  },

  rowInfo: {
    flex: 1,
  },

  rowName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111",
  },

  rowAddress: {
    marginTop: 4,
    fontSize: 13,
    color: "#444",
  },

  rowMetaCity: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
  },

  starButton: {
    paddingLeft: 12,
    justifyContent: "center",
  },

  emptyContainer: {
    padding: 24,
    alignItems: "center",
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  countText: {
    marginHorizontal: 16,
    marginBottom: 6,
    fontSize: 13,
    color: "#666",
    fontWeight: "600",
  },
});

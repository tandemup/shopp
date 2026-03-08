// screens/StoreSelectScreen.js
import React from "react";
import { View, Text, FlatList, StyleSheet, Pressable } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { useStores } from "../context/StoresContext";
import { useLists } from "../context/ListsContext";
import { ROUTES } from "../navigation/ROUTES";

/* --------------------------------------------------
 Helpers
-------------------------------------------------- */
const formatDistance = (d) => {
  if (d == null) return "";
  return d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1)} km`;
};

export default function StoreSelectScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  const { selectForListId } = route.params ?? {};

  const { favoriteStores, toggleFavoriteStore, isFavoriteStore } = useStores();
  const { updateListStore } = useLists();

  /* --------------------------------------------------
   Actions
  -------------------------------------------------- */
  const handleSelectStore = (store) => {
    if (!selectForListId) return;

    updateListStore(selectForListId, store.id);
    navigation.goBack();
  };

  const handlePressStore = (store) => {
    navigation.navigate(ROUTES.STORE_DETAIL, {
      storeId: store.id,
      listId: selectForListId,
    });
  };

  function ExplorerButton({ display }) {
    if (!display) return null;

    return (
      <Pressable
        style={styles.exploreButton}
        onPress={() =>
          navigation.navigate(ROUTES.STORES_TAB, {
            screen: ROUTES.STORES,
            params: { mode: "select", selectForListId },
          })
        }
      >
        <Text style={styles.exploreText}>Explorar tiendas</Text>
      </Pressable>
    );
  }

  /* --------------------------------------------------
   Empty state
  -------------------------------------------------- */
  if (!favoriteStores || favoriteStores.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No tienes tiendas favoritas</Text>
        <Text style={styles.emptySubtitle}>
          Marca una tienda como favorita para poder seleccionarla rápidamente
        </Text>
        <ExplorerButton display />
      </View>
    );
  }

  /* --------------------------------------------------
   Render
  -------------------------------------------------- */
  const renderStoreRow = ({ item: store }) => {
    const isFavorite = isFavoriteStore(store.id);
    const isSelectMode = Boolean(selectForListId);

    return (
      <View style={styles.rowContainer}>
        <Pressable
          style={styles.rowInfo}
          onPress={() =>
            isSelectMode ? handleSelectStore(store) : handlePressStore(store)
          }
          android_ripple={{ color: "#eee" }}
        >
          <Text style={styles.rowName}>{store.name}</Text>

          {store.address && (
            <Text style={styles.rowAddress}>📍 {store.address}</Text>
          )}

          <Text style={styles.rowMeta}>
            <Text style={styles.rowMetaCity}>{store.city}</Text>
            {store.distance != null && (
              <Text style={styles.rowMetaDistance}>
                {" · "}
                {formatDistance(store.distance)}
              </Text>
            )}
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
    <FlatList
      data={favoriteStores}
      keyExtractor={(item) => item.id}
      renderItem={renderStoreRow}
      contentContainerStyle={styles.list}
    />
  );
}

/* --------------------------------------------------
 Styles
-------------------------------------------------- */
const styles = StyleSheet.create({
  list: {
    paddingVertical: 8,
  },

  emptyContainer: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    alignItems: "center",
  },

  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },

  emptySubtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 24,
  },

  exploreButton: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },

  exploreText: {
    color: "#fff",
    fontWeight: "600",
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
    marginTop: 2,
    fontSize: 13,
    color: "#555",
  },

  rowMeta: {
    marginTop: 4,
    fontSize: 13,
    color: "#666",
  },

  rowMetaCity: {
    fontWeight: "700",
  },

  rowMetaDistance: {
    fontWeight: "600",
  },

  starButton: {
    paddingLeft: 12,
  },
});

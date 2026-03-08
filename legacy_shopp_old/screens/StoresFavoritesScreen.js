import React from "react";
import { View, Text, FlatList, Pressable, StyleSheet } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import { useStores } from "../context/StoresContext";
import { useLocation } from "../context/LocationContext";
import { distanceMetersBetween } from "../utils/math/distance";
import { formatDistance } from "../utils/math/formatDistance";
import { ROUTES } from "../navigation/ROUTES";

export default function StoresFavoritesScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  const { listId } = route.params || {};
  const { favoriteStores, toggleFavoriteStore, isFavoriteStore } = useStores();

  if (!favoriteStores || favoriteStores.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>No tienes tiendas favoritas</Text>
        <Text style={styles.emptyText}>
          Marca una tienda con la estrella para acceder rápidamente a ella
        </Text>
      </View>
    );
  }

  /* ---------------------------------------------
     Navigation
  ---------------------------------------------- */
  const handlePressStore = (store) => {
    navigation.navigate(ROUTES.STORE_DETAIL, {
      storeId: store.id,
      listId,
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

          <Text style={styles.rowMeta}>
            <Text style={styles.rowMetaCity}>{store.city}</Text>
            <Text style={styles.rowMetaDistance}>
              {store.distance != null && ` · ${formatDistance(store.distance)}`}
            </Text>
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
      style={styles.container}
      contentContainerStyle={styles.content}
    />
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

  list: {
    paddingVertical: 8,
  },

  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },

  emptyText: {
    textAlign: "center",
    color: "#666",
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
    fontWeight: "600",
    color: "#666",
  },

  rowMetaCity: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "800",
    color: "#666",
  },

  rowMetaDistance: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
  },

  starButton: {
    paddingLeft: 12,
    justifyContent: "center",
  },
});

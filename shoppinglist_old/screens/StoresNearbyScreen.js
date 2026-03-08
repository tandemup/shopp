import React from "react";
import { View, Text, FlatList, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { useStores } from "../context/StoresContext";
import { useStoresWithDistance } from "../hooks/useStoresWithDistance";
import { ROUTES } from "../navigation/ROUTES";

/* ---------------------------------------------
   Helpers
---------------------------------------------- */
const formatDistanceKm = (distance) => {
  if (!Number.isFinite(distance)) return null;

  if (distance < 1) {
    return `${Math.round(distance * 1000)} m`;
  }

  return `${distance.toFixed(1)} km`;
};

/* ---------------------------------------------
   Screen
---------------------------------------------- */
export default function StoresNearbyScreen() {
  const navigation = useNavigation();

  const { toggleFavoriteStore, isFavoriteStore } = useStores();
  const { sortedStores, loading, hasLocation } = useStoresWithDistance();

  const handlePressStore = (store) => {
    navigation.navigate(ROUTES.STORE_DETAIL, {
      storeId: store.id,
    });
  };

  /* ---------------------------------------------
     Render fila (MISMO PATRÓN que StoresBrowseScreen)
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
            {Number.isFinite(store.distance) && (
              <Text style={styles.rowMetaDistance}>
                {" · a "}
                {formatDistanceKm(store.distance)}
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

  /* ---------------------------------------------
     Render
  ---------------------------------------------- */
  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Buscando tiendas cercanas…</Text>
      </View>
    );
  }

  if (!hasLocation) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>No se pudo obtener tu ubicación</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={sortedStores}
      keyExtractor={(item) => item.id}
      renderItem={renderStoreRow}
      contentContainerStyle={styles.content}
    />
  );
}

/* ---------------------------------------------
   Styles (COPIADOS de StoresBrowseScreen)
---------------------------------------------- */
const styles = StyleSheet.create({
  content: {
    padding: 12,
    paddingBottom: 24,
  },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  muted: {
    fontSize: 14,
    color: "#777",
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

  rowMeta: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
  },

  rowMetaCity: {
    fontSize: 13,
    fontWeight: "800",
    color: "#666",
  },

  rowMetaDistance: {
    fontSize: 13,
    fontWeight: "600",
    color: "#666",
  },

  starButton: {
    paddingLeft: 12,
    justifyContent: "center",
  },
});

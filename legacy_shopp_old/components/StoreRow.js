import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useStores } from "../context/StoresContext";
import { formatDistance } from "../utils/math/formatDistance";

export default function StoreRow({ store, onPress }) {
  const {
    favoriteStoreIds = [],
    toggleFavoriteStore,
    isFavoriteStore,
  } = useStores();

  const isFavorite =
    typeof isFavoriteStore === "function"
      ? isFavoriteStore(store.id)
      : favoriteStoreIds.includes(store.id);

  const handleToggleFavorite = () => {
    if (typeof toggleFavoriteStore === "function") {
      toggleFavoriteStore(store.id);
    }
  };

  return (
    <View style={styles.container}>
      {/* Área navegable */}
      <Pressable
        style={styles.info}
        onPress={onPress}
        android_ripple={{ color: "#eee" }}
      >
        <Text style={styles.name}>{store.name}</Text>

        {(store.city || store.distance != null) && (
          <Text style={styles.meta}>
            {store.city || ""}
            {store.distance != null && ` · ${formatDistance(store.distance)}`}
          </Text>
        )}
      </Pressable>

      {/* Botón favorito */}
      <Pressable
        onPress={handleToggleFavorite}
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
}
const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    backgroundColor: "#fff",
  },

  info: {
    flex: 1,
  },

  name: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111",
  },

  meta: {
    marginTop: 4,
    fontSize: 13,
    color: "#666",
  },

  starButton: {
    paddingLeft: 12,
    justifyContent: "center",
  },
});

import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { I18nText as Text } from "@/src/i18n";

import { Ionicons } from "@expo/vector-icons";
import { useConfig } from "@/src/context/ConfigContext";

export default function StoreCard({ store, onPress }) {
  const { isFavoriteStore, toggleFavoriteStore } = useConfig();
  const isFav = isFavoriteStore(store.id);

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.header}>
        <Text style={styles.name}>{store.name}</Text>

        <Pressable onPress={() => toggleFavoriteStore(store.id)} hitSlop={8}>
          <Ionicons
            name={isFav ? "star" : "star-outline"}
            size={22}
            color={isFav ? "#facc15" : "#9ca3af"}
          />
        </Pressable>
      </View>

      {store.address ? (
        <Text style={styles.address}>{store.address}</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  name: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
    marginRight: 8,
  },
  address: {
    fontSize: 13,
    color: "#666",
    marginTop: 4,
  },
});

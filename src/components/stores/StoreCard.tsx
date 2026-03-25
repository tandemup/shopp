import { Ionicons } from "@expo/vector-icons";
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { Store } from "@/src/context/StoresContext";

type Props = {
  store: Store;
  onPress: (store: Store) => void;
  onToggleFavorite: (id: string) => void;
};

function StoreCardBase({ store, onPress, onToggleFavorite }: Props) {
  const handlePress = () => {
    onPress(store);
  };

  const handleToggle = () => {
    onToggleFavorite(store.id);
  };

  return (
    <Pressable style={styles.card} onPress={handlePress}>
      {/* CONTENT */}
      <View style={styles.content}>
        <Text style={styles.name}>{store.name}</Text>

        <Text style={styles.address}>
          📍 {store.address}, {store.city}
        </Text>
      </View>

      {/* ⭐ FAVORITE */}
      <Pressable onPress={handleToggle} hitSlop={10} style={styles.star}>
        <Ionicons
          name={store.favorite ? "star" : "star-outline"}
          size={22}
          color={store.favorite ? "#f5c518" : "#999"}
        />
      </Pressable>
    </Pressable>
  );
}

/* ---------------------------------------------
   🔥 MEMO → evita re-render de toda la lista
---------------------------------------------- */
export const StoreCard = memo(
  StoreCardBase,
  (prev, next) =>
    prev.store.id === next.store.id &&
    prev.store.favorite === next.store.favorite,
);

/* ---------------------------------------------
   STYLES
---------------------------------------------- */
const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,

    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",

    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },

  content: {
    flex: 1,
    paddingRight: 10,
  },

  name: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },

  address: {
    fontSize: 13,
    color: "#666",
  },

  star: {
    padding: 6,
  },
});

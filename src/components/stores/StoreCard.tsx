import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export type Store = {
  id: string;
  name: string;
  address?: string;
  city?: string;
  isFavorite?: boolean;
  distance?: number;
};

type Props = {
  store: Store;
  onPress: (id: string) => void;
  onToggleFavorite: (id: string) => void;
};

function StoreCardComponent({ store, onPress, onToggleFavorite }: Props) {
  return (
    <Pressable
      onPress={() => onPress(store.id)}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      android_ripple={{ color: "#eee" }}
    >
      <View style={styles.row}>
        {/* -------------------------
            Info tienda
        -------------------------- */}
        <View style={styles.textContainer}>
          <Text style={styles.name}>{store.name}</Text>

          {store.address && (
            <Text style={styles.address}>📍 {store.address}</Text>
          )}

          {store.city && <Text style={styles.city}>{store.city}</Text>}

          {store.distance != null && (
            <Text style={styles.distance}>{store.distance.toFixed(1)} km</Text>
          )}
        </View>

        {/* -------------------------
            Favorito ⭐
        -------------------------- */}
        <Pressable
          onPress={(e) => {
            e.stopPropagation(); // 🔥 evita abrir la tienda
            onToggleFavorite(store.id);
          }}
          hitSlop={8}
        >
          <Text style={[styles.star, store.isFavorite && styles.starActive]}>
            {store.isFavorite ? "★" : "☆"}
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

/* 🔥 Evita re-render innecesario */
export const StoreCard = memo(StoreCardComponent);

/* ===============================
   Styles
================================ */

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,

    borderWidth: 1,
    borderColor: "#eee",

    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },

    elevation: 1,
  },

  cardPressed: {
    opacity: 0.6,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  textContainer: {
    flex: 1,
    paddingRight: 10,
  },

  name: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },

  address: {
    fontSize: 13,
    color: "#6b7280",
  },

  city: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 2,
  },

  distance: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
  },

  star: {
    fontSize: 20,
    color: "#d1d5db",
  },

  starActive: {
    color: "#facc15",
  },
});

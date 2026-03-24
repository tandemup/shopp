import { Store } from "@/src/context/StoresContext";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  store: Store;
  onPress: () => void;
  onToggleFavorite: () => void;
};

export default function StoreCard({ store, onPress, onToggleFavorite }: Props) {
  /* ---------------------------------------------
     Helpers seguros (evitan JSX dentro de Text)
  ---------------------------------------------- */
  const addressLine =
    store.address && store.city
      ? `${store.address}, ${store.city}`
      : store.address || store.city || "";

  const distanceText =
    store.distance != null
      ? store.distance < 1
        ? `${Math.round(store.distance * 1000)} m`
        : `${store.distance.toFixed(1)} km`
      : null;

  return (
    <View style={styles.card}>
      {/* ⭐ FAVORITE */}
      <Pressable
        style={styles.starButton}
        onPress={onToggleFavorite}
        hitSlop={12}
      >
        <Ionicons
          name={store.isFavorite ? "star" : "star-outline"}
          size={22}
          color={store.isFavorite ? "#f5c518" : "#bbb"}
        />
      </Pressable>

      {/* CONTENIDO CLICKABLE */}
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.content, pressed && styles.pressed]}
      >
        {/* Nombre */}
        <Text style={styles.name} numberOfLines={1}>
          {store.name}
        </Text>

        {/* Dirección (SIN JSX dentro de Text) */}
        {addressLine ? (
          <Text style={styles.address} numberOfLines={1}>
            📍 {addressLine}
          </Text>
        ) : null}

        {/* Distancia */}
        {distanceText ? (
          <Text style={styles.distance}>{distanceText}</Text>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,

    borderWidth: 1,
    borderColor: "#eee",

    // sombra iOS
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },

    // sombra Android
    elevation: 1,

    position: "relative",
  },

  content: {
    flex: 1,
  },

  pressed: {
    opacity: 0.7,
  },

  name: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111",
    paddingRight: 30, // espacio para estrella
  },

  starButton: {
    position: "absolute",
    top: 10,
    right: 10,
    padding: 6,
    zIndex: 10,
  },

  address: {
    marginTop: 6,
    fontSize: 13,
    color: "#555",
  },

  distance: {
    marginTop: 6,
    fontSize: 12,
    color: "#1a73e8",
    fontWeight: "600",
  },
});

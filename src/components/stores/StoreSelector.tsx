import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Store = {
  id: string;
  name: string;
  city?: string;
};

type Props = {
  store?: Store;
  onPress?: () => void;
};

export default function StoreSelector({ store, onPress }: Props) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <Ionicons name="storefront-outline" size={22} color="#666" />

      <View style={styles.textContainer}>
        <Text style={styles.label}>Tienda</Text>

        <Text style={styles.value}>
          {store
            ? `${store.name}${store.city ? ` · ${store.city}` : ""}`
            : "Seleccionar tienda"}
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={20} color="#999" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    marginVertical: 8,
  },

  textContainer: {
    flex: 1,
    marginLeft: 12,
  },

  label: {
    fontSize: 13,
    color: "#888",
  },

  value: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
  },
});

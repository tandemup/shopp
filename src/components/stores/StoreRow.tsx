import { useStores } from "@/src/context/storesContext";
import { Store } from "@/src/types/store";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  store: Store;
  onPress?: () => void;
};

export default function StoreRow({ store, onPress }: Props) {
  const { toggleFavorite } = useStores();

  return (
    <Pressable onPress={onPress} style={{ padding: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: "600" }}>{store.name}</Text>

          <Text style={{ color: "#666" }}>{store.address}</Text>
        </View>

        <Pressable onPress={() => toggleFavorite(store.id)}>
          <Ionicons
            name={store.isFavorite ? "star" : "star-outline"}
            size={20}
            color="#f1c40f"
          />
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "white",
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",

    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
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
    color: "#555",
  },

  city: {
    fontSize: 12,
    color: "#888",
  },
});

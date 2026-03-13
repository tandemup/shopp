import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function StoreRow({ store, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.container}>
      <View style={styles.textContainer}>
        <Text style={styles.name}>{store.name}</Text>

        <Text style={styles.address}>{store.address}</Text>

        <Text style={styles.city}>{store.city}</Text>
      </View>

      <Ionicons name="chevron-forward" size={20} color="#999" />
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

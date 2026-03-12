import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function StoreSelector() {
  return (
    <Pressable style={styles.card}>
      <Ionicons name="storefront-outline" size={22} color="#2563eb" />

      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={styles.label}>Tienda seleccionada</Text>
        <Text style={styles.value}>Seleccionar tienda</Text>
      </View>

      <Ionicons name="chevron-forward" size={20} color="#999" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
  },

  label: {
    fontSize: 12,
    color: "#777",
  },

  value: {
    fontSize: 15,
    fontWeight: "500",
  },
});

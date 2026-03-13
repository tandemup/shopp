import { useStores } from "@/src/context/StoresContext";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

export default function StoreSelector() {
  const router = useRouter();
  const { currentStore } = useStores();

  const handlePress = () => {
    router.push("/store/select");
  };

  return (
    <Pressable style={styles.card} onPress={handlePress}>
      <Ionicons name="storefront-outline" size={22} color="#666" />

      <View style={styles.textContainer}>
        <Text style={styles.label}>Tienda seleccionada</Text>

        <Text style={styles.value}>
          {currentStore
            ? `${currentStore.name} · ${currentStore.city ?? ""}`
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

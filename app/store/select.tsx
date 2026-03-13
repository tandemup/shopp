import { useStore } from "@/src/context/StoreContext";
import { useRouter } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

export default function StoreSelector() {
  const { store, setCurrentStore } = useStore();
  const router = useRouter();

  const handleSelect = (store: any) => {
    setCurrentStore(store);
    router.back();
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={store}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => handleSelect(item)}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.city}>{item.city}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },

  card: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#fff",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#eee",
  },

  name: {
    fontSize: 18,
    fontWeight: "600",
  },

  city: {
    color: "#666",
  },
});

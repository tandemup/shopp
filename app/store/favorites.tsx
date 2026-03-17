import { router, useLocalSearchParams } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import StoreRow from "@/src/components/stores/StoreRow";
import { useLists } from "@/src/context/ListsContext";
import { useStores } from "@/src/context/StoresContext";

export default function FavoriteStoresScreen() {
  const { listId } = useLocalSearchParams<{ listId: string }>();

  const { stores } = useStores();
  const { updateListStore } = useLists();

  const favorites = stores.filter((s) => s.favorite);

  const selectStore = (storeId: string) => {
    if (!listId) return;

    updateListStore(listId, storeId);
    router.replace(`/list/${listId}`);
  };

  if (!favorites.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.title}>No tienes tiendas favoritas</Text>
        <Text style={styles.subtitle}>
          Marca una tienda ⭐ para acceder rápidamente
        </Text>

        <Pressable
          style={styles.button}
          onPress={() => router.push(`/store/explore?listId=${listId}`)}
        >
          <Text style={styles.buttonText}>Explorar tiendas</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={{ padding: 16 }}
      data={favorites}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <StoreRow store={item} onPress={() => selectStore(item.id)} />
      )}
    />
  );
}

const styles = StyleSheet.create({
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
  },
  subtitle: {
    color: "#666",
    marginTop: 8,
    marginBottom: 20,
    textAlign: "center",
  },
  button: {
    backgroundColor: "#27ae60",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
  },
});

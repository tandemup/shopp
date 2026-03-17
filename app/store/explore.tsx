import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, TextInput, View } from "react-native";

import StoreRow from "@/src/components/stores/StoreRow";
import { useLists } from "@/src/context/ListsContext";
import { useStores } from "@/src/context/StoresContext";

export default function ExploreStoresScreen() {
  const { listId } = useLocalSearchParams<{ listId: string }>();

  const { stores, toggleFavorite } = useStores();
  const { updateListStore } = useLists();

  const [query, setQuery] = useState("");

  /* -----------------------------
     FILTRADO + ORDEN
  ------------------------------ */

  const filtered = useMemo(() => {
    return stores
      .filter((s) => s.name.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => Number(b.favorite) - Number(a.favorite));
  }, [stores, query]);

  /* -----------------------------
     SELECCIÓN
  ------------------------------ */

  const handleSelect = (storeId: string) => {
    if (!listId) return;

    updateListStore(listId, storeId);

    // navegación robusta (mejor que back)
    // router.replace(`/list/${listId}`);
    router.back();
  };

  /* -----------------------------
     RENDER
  ------------------------------ */

  return (
    <View style={styles.container}>
      <TextInput
        placeholder="Buscar tienda…"
        value={query}
        onChangeText={setQuery}
        style={styles.search}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <StoreRow
            store={item}
            onPress={() => handleSelect(item.id)}
            onToggleFavorite={() => toggleFavorite(item.id)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No se encontraron tiendas</Text>
          </View>
        }
      />
    </View>
  );
}

/* -----------------------------
   STYLES
------------------------------ */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#f2f2f2",
  },

  search: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    fontSize: 15,
  },

  empty: {
    marginTop: 20,
    alignItems: "center",
  },

  emptyText: {
    color: "#666",
  },
});

// screens/StoresScreen.js
import React, { useMemo, useState } from "react";
import { View, Text, FlatList, StyleSheet, TextInput } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";

import { useStores } from "../context/StoresContext";
import StoreCard from "../components/StoreCard";
import { ROUTES } from "../navigation/ROUTES";

export default function StoresScreen() {
  const navigation = useNavigation();
  const route = useRoute();

  const { selectForListId } = route.params ?? {};

  const { stores } = useStores();
  const [query, setQuery] = useState("");

  // ────────────────────────────────────────────────
  // FILTRO BÚSQUEDA
  // ────────────────────────────────────────────────
  const filteredStores = useMemo(() => {
    if (!query.trim()) return stores;
    const q = query.toLowerCase();
    return stores.filter(
      (s) =>
        s.name.toLowerCase().includes(q) || s.address?.toLowerCase().includes(q)
    );
  }, [stores, query]);

  // ────────────────────────────────────────────────
  // TAP EN TIENDA (MODO DUAL)
  // ────────────────────────────────────────────────
  const handlePressStore = (store) => {
    // 🔥 MODO SELECCIÓN
    if (selectForListId) {
      navigation.navigate(ROUTES.SHOPPING_LIST, {
        listId: selectForListId,
        selectedStore: store,
      });
      return;
    }

    // 🧭 MODO NORMAL
    navigation.navigate(ROUTES.STORE_DETAIL, {
      storeId: store.id,
    });
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.search}
        placeholder="Buscar tiendas..."
        value={query}
        onChangeText={setQuery}
      />

      <FlatList
        data={filteredStores}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <StoreCard store={item} onPress={() => handlePressStore(item)} />
        )}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  search: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  list: {
    paddingBottom: 16,
  },
});

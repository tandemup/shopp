import { useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, TextInput, View } from "react-native";

import { Store, StoreCard } from "@/src/components/stores/StoreCard";
import { useStores } from "@/src/context/StoresContext";
import { useStoreSelection } from "@/src/hooks/useStoreSelection";

export default function StoreExploreScreen() {
  const { storesSorted, toggleFavorite } = useStores();
  const { handleSelectStore, isSelectMode } = useStoreSelection();

  const [query, setQuery] = useState("");

  /* -------------------------------
     Filtro búsqueda
  -------------------------------- */
  const filteredStores = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) return storesSorted;

    return storesSorted.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.city?.toLowerCase().includes(q) ||
        s.address?.toLowerCase().includes(q),
    );
  }, [query, storesSorted]);

  /* -------------------------------
     Render item
  -------------------------------- */
  const renderItem = ({ item }: { item: Store }) => (
    <StoreCard
      store={item}
      onPress={handleSelectStore}
      onToggleFavorite={toggleFavorite} // ⭐ clave
    />
  );

  /* -------------------------------
     Empty
  -------------------------------- */
  const empty = (
    <View style={styles.empty}>
      <Text style={styles.title}>No se encontraron tiendas</Text>
      <Text style={styles.subtitle}>Prueba con otro término de búsqueda</Text>
    </View>
  );

  /* -------------------------------
     Render
  -------------------------------- */
  return (
    <View style={styles.container}>
      <Text style={styles.header}>
        {isSelectMode ? "Seleccionar tienda" : "Explorar tiendas"}
      </Text>

      <Text style={styles.count}>{filteredStores.length} tiendas</Text>

      <TextInput
        style={styles.search}
        placeholder="Buscar tienda o ciudad..."
        value={query}
        onChangeText={setQuery}
      />

      <FlatList
        data={filteredStores}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={empty}
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={10}
        windowSize={5}
        removeClippedSubviews
      />
    </View>
  );
}

/* ===============================
   Styles
================================ */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: "#f5f5f5",
  },

  header: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 4,
  },

  count: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 10,
  },

  search: {
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },

  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 40,
  },

  title: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 6,
  },

  subtitle: {
    color: "#666",
  },
});

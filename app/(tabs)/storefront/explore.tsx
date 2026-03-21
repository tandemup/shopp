import { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useStores } from "@/src/context/StoresContext";
import { useStoreSelection } from "@/src/hooks/useStoreSelection";

export default function StoreExploreScreen() {
  const { stores } = useStores();
  const { handleSelectStore, isSelectMode } = useStoreSelection();

  const [query, setQuery] = useState("");

  /* -------------------------------
     Filtro búsqueda
  -------------------------------- */
  const filteredStores = useMemo(() => {
    if (!query.trim()) return stores;

    const q = query.toLowerCase();

    return stores.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.city?.toLowerCase().includes(q) ||
        s.address?.toLowerCase().includes(q),
    );
  }, [query, stores]);

  /* -------------------------------
     Render item
  -------------------------------- */
  const renderItem = ({ item }: any) => (
    <Pressable style={styles.card} onPress={() => handleSelectStore(item.id)}>
      <View style={styles.row}>
        <View style={styles.textContainer}>
          <Text style={styles.name}>{item.name}</Text>

          {item.address && <Text style={styles.address}>{item.address}</Text>}

          {item.city && <Text style={styles.city}>{item.city}</Text>}
        </View>

        {item.isFavorite && <Text style={styles.star}>⭐</Text>}
      </View>
    </Pressable>
  );

  /* -------------------------------
     Empty results
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

      {/* ---------- Search ---------- */}
      <TextInput
        style={styles.search}
        placeholder="Buscar tienda o ciudad..."
        value={query}
        onChangeText={setQuery}
      />

      {/* ---------- List ---------- */}
      <FlatList
        data={filteredStores}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={empty}
        contentContainerStyle={{ paddingBottom: 16 }}
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
    padding: 16,
    backgroundColor: "#f2f2f2",
  },

  header: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 10,
  },

  search: {
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  textContainer: {
    flex: 1,
    paddingRight: 10,
  },

  name: {
    fontSize: 15,
    fontWeight: "600",
  },

  address: {
    fontSize: 13,
    color: "#666",
    marginTop: 2,
  },

  city: {
    fontSize: 12,
    color: "#999",
  },

  star: {
    fontSize: 18,
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

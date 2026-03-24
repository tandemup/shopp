import { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { useStores } from "@/src/context/StoresContext";
import type { Store } from "@/src/types/store";

export default function ExploreStoresScreen() {
  const router = useRouter();
  const { stores, toggleFavorite } = useStores();

  const [search, setSearch] = useState("");

  /* ---------------------------------------------
     Filter stores
  ---------------------------------------------- */
  const filteredStores = useMemo(() => {
    if (!search.trim()) return stores;

    return stores.filter((s) =>
      `${s.name} ${s.address} ${s.city}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    );
  }, [stores, search]);

  /* ---------------------------------------------
     Render item
  ---------------------------------------------- */
  const renderItem = ({ item }: { item: Store }) => (
    <Pressable
      style={styles.card}
      onPress={() => {
        router.back(); // o navegación futura a detail/select
      }}
    >
      {/* LEFT CONTENT */}
      <View style={styles.content}>
        <Text style={styles.name}>{item.name}</Text>

        <View style={styles.addressRow}>
          <Ionicons name="location-sharp" size={14} color="#e53935" />
          <Text style={styles.address}>
            {item.address}, {item.zipcode} {item.city}
          </Text>
        </View>

        <Text style={styles.city}>{item.city}</Text>
      </View>

      {/* FAVORITE */}
      <Pressable
        style={styles.favorite}
        onPress={() => toggleFavorite(item.id)}
        hitSlop={10}
      >
        <Ionicons
          name={item.favorite ? "star" : "star-outline"}
          size={22}
          color={item.favorite ? "#f4b400" : "#bbb"}
        />
      </Pressable>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* SEARCH */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color="#999" />
        <TextInput
          placeholder="Buscar tienda..."
          placeholderTextColor="#999"
          value={search}
          onChangeText={setSearch}
          style={styles.input}
        />
      </View>

      {/* COUNT */}
      <Text style={styles.count}>{filteredStores.length} tiendas</Text>

      {/* LIST */}
      <FlatList
        data={filteredStores}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
      />
    </SafeAreaView>
  );
}

/* =====================================================
   STYLES (OLD DESIGN RESTORED)
===================================================== */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },

  /* SEARCH */
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    margin: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "#fff",

    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },

  input: {
    marginLeft: 8,
    flex: 1,
    fontSize: 15,
    color: "#333",
  },

  /* COUNT */
  count: {
    marginHorizontal: 16,
    marginBottom: 8,
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },

  /* LIST */
  list: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },

  /* CARD */
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",

    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,

    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },

  content: {
    flex: 1,
    paddingRight: 10,
  },

  name: {
    fontSize: 16,
    fontWeight: "700",
    color: "#222",
    marginBottom: 4,
  },

  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },

  address: {
    marginLeft: 6,
    fontSize: 13,
    color: "#555",
    flexShrink: 1,
  },

  city: {
    fontSize: 13,
    color: "#777",
    fontWeight: "500",
  },

  /* FAVORITE */
  favorite: {
    padding: 6,
  },
});

import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { StoreCard } from "@/src/components/stores/StoreCard";
import { useLists } from "@/src/context/ListsContext";
import type { Store } from "@/src/context/StoresContext";
import { useStores } from "@/src/context/StoresContext";

export default function StoreFavoritesScreen() {
  const router = useRouter();
  const { assignStoreToList } = useLists();

  const { mode, selectForListId } = useLocalSearchParams();
  const isSelectMode = mode === "select";
  const { favorites, toggleFavorite } = useStores();

  const handleSelectStore = (store: Store) => {
    if (isSelectMode && selectForListId) {
      assignStoreToList(String(selectForListId), store.id);

      router.back(); // 🔥 correcto
      return;
    }

    router.push({
      pathname: "/storefront/info",
      params: { id: store.id },
    });
  };

  /* -------------------------------
     Redirect si no hay favoritas
  -------------------------------- */
  useEffect(() => {
    if (isSelectMode && favorites.length === 0) {
      router.replace({
        pathname: "/storefront/explore",
        params: {
          mode: "select",
          selectForListId,
        },
      });
    }
  }, [favorites, isSelectMode, selectForListId, router]);

  /* -------------------------------
     Render item
  -------------------------------- */
  const renderItem = ({ item }: { item: Store }) => (
    <StoreCard
      store={item}
      onPress={() => handleSelectStore(item)}
      onToggleFavorite={() => toggleFavorite(item.id)}
    />
  );

  /* -------------------------------
     Empty state
  -------------------------------- */
  if (favorites.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.title}>No tienes tiendas favoritas</Text>
        <Text style={styles.subtitle}>
          Marca una tienda ⭐ para acceder rápidamente
        </Text>

        <Pressable
          style={styles.button}
          onPress={() =>
            router.push({
              pathname: "/storefront/explore",
            })
          }
        >
          <Text style={styles.buttonText}>Explorar tiendas</Text>
        </Pressable>
      </View>
    );
  }

  /* -------------------------------
     List
  -------------------------------- */
  return (
    <View style={styles.container}>
      <Text style={styles.header}>Favoritas</Text>

      <FlatList
        data={favorites}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
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
    marginBottom: 12,
    color: "#111",
  },

  listContent: {
    paddingBottom: 24,
  },

  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#fff",
  },

  title: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 6,
    color: "#111",
  },

  subtitle: {
    color: "#666",
    textAlign: "center",
    marginBottom: 16,
    fontSize: 14,
  },

  button: {
    backgroundColor: "#16a34a",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
  },

  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
});

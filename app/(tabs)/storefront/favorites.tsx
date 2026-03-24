import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { Store, StoreCard } from "@/src/components/stores/StoreCard";
import { useLists } from "@/src/context/ListsContext";
import { useStores } from "@/src/context/StoresContext";
import { useStoreSelection } from "@/src/hooks/useStoreSelection";

export default function StoreFavoritesScreen() {
  const router = useRouter();
  const { assignStoreToList } = useLists();

  const { mode, selectForListId } = useLocalSearchParams<{
    mode?: string;
    selectForListId?: string;
  }>();

  const { favoriteStores, toggleFavorite } = useStores();
  const { isSelectMode, handleSelectStore } = useStoreSelection();

  /* -------------------------------
     Redirect si no hay favoritas
  -------------------------------- */
  useEffect(() => {
    if (isSelectMode && favoriteStores.length === 0) {
      router.replace({
        pathname: "/storefront/explore",
        params: {
          mode: "select",
          selectForListId,
        },
      });
    }
  }, [favoriteStores]);

  /* -------------------------------
     Render item
  -------------------------------- */
  const renderItem = ({ item }: { item: Store }) => (
    <StoreCard
      store={item}
      onPress={(id) => {
        if (mode === "select" && selectForListId) {
          assignStoreToList(String(selectForListId), id);
          router.replace(`/list/${selectForListId}`);
          return;
        }

        handleSelectStore(id);
      }}
      onToggleFavorite={toggleFavorite}
    />
  );

  /* -------------------------------
     Empty (modo normal)
  -------------------------------- */
  if (favoriteStores.length === 0) {
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
        data={favoriteStores}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
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
    marginBottom: 12,
  },

  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },

  title: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 6,
  },

  subtitle: {
    color: "#666",
    textAlign: "center",
    marginBottom: 16,
  },

  button: {
    backgroundColor: "#27ae60",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
  },

  buttonText: {
    color: "#fff",
    fontWeight: "600",
  },
});

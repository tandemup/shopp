import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { useLists } from "@/src/context/listsContext";
import { useStores } from "@/src/context/storesContext";
import { useStoreSelection } from "@/src/hooks/useStoreSelection";

export default function StoreFavoritesScreen() {
  const router = useRouter();
  const { assignStoreToList } = useLists();
  const { mode, selectForListId } = useLocalSearchParams<{
    mode?: string;
    selectForListId?: string;
  }>();

  const { favoriteStores } = useStores();

  const { isSelectMode, handleSelectStore } = useStoreSelection();

  /* -------------------------------
     Redirect si no hay favoritas
  -------------------------------- */
  useEffect(() => {
    if (isSelectMode && (!favoriteStores || favoriteStores.length === 0)) {
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
  const renderItem = ({ item }: any) => (
    <Pressable
      style={styles.card}
      onPress={() => {
        if (mode === "select" && selectForListId) {
          assignStoreToList(String(selectForListId), item.id);

          router.replace(`/list/${selectForListId}`);
          return;
        }

        handleSelectStore(item.id);
      }}
    >
      <View style={styles.row}>
        <View style={styles.textContainer}>
          <Text style={styles.name}>{item.name}</Text>

          {item.address && <Text style={styles.address}>{item.address}</Text>}

          {item.city && <Text style={styles.city}>{item.city}</Text>}
        </View>

        <Text style={styles.star}>⭐</Text>
      </View>
    </Pressable>
  );

  /* -------------------------------
     Empty state (solo visible si NO es select)
  -------------------------------- */
  if (!favoriteStores || favoriteStores.length === 0) {
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
    paddingVertical: 10,
    borderRadius: 8,
  },

  buttonText: {
    color: "#fff",
    fontWeight: "600",
  },
});

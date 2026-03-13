import { useLocalSearchParams, useRouter } from "expo-router";
import { FlatList, StyleSheet, Text, View } from "react-native";

import ItemRow from "@/src/components/items/ItemRow";
import SearchCombinedBar from "@/src/components/shopping/SearchCombinedBar";
import StoreSelector from "@/src/components/shopping/StoreSelector";
import TotalBar from "@/src/components/shopping/TotalBar";

import { useLists } from "@/src/context/ListsContext";
import { useStores } from "@/src/context/StoresContext";

import { Item } from "@/src/types/Item";

function makeNewItem(name: string): Item {
  return {
    id: `item-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    name,
    barcode: "",
    unit: "u",
    quantity: 1,
    unitPrice: 0,
    promo: "none",
    checked: false,
  };
}

export default function ShoppingListScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { getList, addItem, toggleItem } = useLists();
  const { getStoreById } = useStores();

  const list = getList(id);

  if (!list) {
    return (
      <View style={styles.container}>
        <Text style={styles.header}>Lista no encontrada</Text>
      </View>
    );
  }

  /* -------------------------------------------------
     Tienda asignada
  -------------------------------------------------- */

  const store = list.storeId ? getStoreById(list.storeId) : undefined;

  /* -------------------------------------------------
     Total
  -------------------------------------------------- */

  const total = list.items
    .filter((item) => item.checked)
    .reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>{list.name}</Text>

      {/* -------- Selector de tienda -------- */}

      <StoreSelector
        store={store}
        onPress={() => router.push(`/store/select?listId=${list.id}`)}
      />

      {/* -------- Barra de búsqueda -------- */}

      <SearchCombinedBar
        onAdd={(name) => {
          const trimmed = name.trim();
          if (!trimmed) return;

          addItem(list.id, makeNewItem(trimmed));
        }}
      />

      {/* -------- Lista de productos -------- */}

      <FlatList
        data={list.items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ItemRow
            item={{
              id: item.id,
              name: item.name,
              quantity: item.quantity,
              price: item.unitPrice,
              checked: item.checked,
              offer:
                item.promo && item.promo !== "none" ? item.promo : undefined,
            }}
            onToggle={() => toggleItem(list.id, item.id)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>No hay productos</Text>
            <Text style={styles.emptyText}>
              Añade uno desde la barra de búsqueda.
            </Text>
          </View>
        }
        contentContainerStyle={
          list.items.length === 0
            ? styles.flatListEmpty
            : styles.flatListContent
        }
      />

      {/* -------- Total -------- */}

      <TotalBar total={total} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#f2f2f2",
  },

  header: {
    fontSize: 22,
    fontWeight: "600",
    marginBottom: 10,
  },

  flatListContent: {
    paddingBottom: 16,
  },

  flatListEmpty: {
    flexGrow: 1,
    paddingBottom: 16,
  },

  emptyBox: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginTop: 8,
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },

  emptyText: {
    color: "#666",
  },
});

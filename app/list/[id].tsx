import { useLocalSearchParams, useRouter } from "expo-router";
import { FlatList, StyleSheet, Text, View } from "react-native";

import ItemRow from "@/src/components/items/ItemRow";
import SearchCombinedBar from "@/src/components/shopping/SearchCombinedBar";
import TotalBar from "@/src/components/shopping/TotalBar";
import StoreSelector from "@/src/components/stores/StoreSelector";

import { useLists } from "@/src/context/ListsContext";
import { useStores } from "@/src/context/StoresContext";

import { Item } from "@/src/types/Item";

import { calculateItemPrice } from "@/src/utils/pricing/calculateItemPrice";

function makeNewItem(name: string): Item {
  return {
    id: `item-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
    name,
    barcode: "",
    unit: "u",
    quantity: 1,
    unitPrice: 0,
    promo: "none",

    // el item cuenta por defecto
    checked: true,
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

  /* -------------------------------
     Tienda asignada
  -------------------------------- */

  const store = list.storeId ? getStoreById(list.storeId) : undefined;

  /* -------------------------------
     Total con promociones
  -------------------------------- */

  const total = list.items
    .filter((item) => item.checked)
    .reduce((sum, item) => {
      const { total } = calculateItemPrice({
        quantity: item.quantity,
        price: item.unitPrice,
        offer: item.promo !== "none" ? item.promo : undefined,
      });

      return sum + total;
    }, 0);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>{list.name}</Text>

      {/* ---------- Store selector ---------- */}

      <StoreSelector
        store={store}
        onPress={() => router.push(`/store/select?listId=${list.id}`)}
      />

      {/* ---------- Search bar ---------- */}

      <SearchCombinedBar
        onAdd={(name) => {
          const trimmed = name.trim();

          if (!trimmed) return;

          addItem(list.id, makeNewItem(trimmed));
        }}
      />

      {/* ---------- Items list ---------- */}
      <FlatList
        data={list.items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ItemRow
            item={{
              ...item,
            }}
            onToggle={() => toggleItem(list.id, item.id)}
            onPress={() => router.push(`/item/${item.id}`)}
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
      />
      {/* ---------- Total ---------- */}

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

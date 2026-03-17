import { useLocalSearchParams, useRouter } from "expo-router";
import { FlatList, StyleSheet, Text, View } from "react-native";

import ItemRow from "@/src/components/items/ItemRow";
import CheckoutBar from "@/src/components/shopping/CheckoutBar";
import SearchCombinedBar from "@/src/components/shopping/SearchCombinedBar";
import StoreSelector from "@/src/components/stores/StoreSelector";

import { useLists } from "@/src/context/ListsContext";
import { useStores } from "@/src/context/StoresContext";

import { Item } from "@/src/types/Item";
import { calculatePrice } from "@/src/utils/pricing/PricingEngine";

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
  const { getList, addItem, toggleItem, archiveList } = useLists();
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
      const { total } = calculatePrice({
        quantity: item.quantity ?? 1,
        unitPrice: item.unitPrice ?? 0,
        offer: item.promo ?? "none",
      });

      return sum + total;
    }, 0);

  const handleCheckout = () => {
    if (!list.items.length) {
      safeAlert("Lista vacía", "No puedes archivar una lista sin productos.", [
        { text: "Aceptar" },
      ]);
      return;
    }

    safeAlert(
      "Finalizar compra",
      "¿Quieres archivar esta lista y guardar el historial de compras?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Confirmar",
          onPress: () => {
            archiveList(list.id);
            router.back();
          },
        },
      ],
    );
  };
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
      <CheckoutBar
        total={total}
        currency={list.currency}
        onCheckout={handleCheckout}
      />
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

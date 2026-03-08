import React, { useMemo, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";

import { useLists } from "../context/ListsContext";
import { useStores } from "../context/StoresContext";

import StoreSelector from "../components/StoreSelector";
import ItemRow from "../components/ItemRow";
import SearchCombinedBar from "../components/SearchCombinedBar";
import CheckoutBar from "../components/CheckoutBar";
import CurrencyBadge from "../components/CurrencyBadge";
import { ROUTES } from "../navigation/ROUTES";
import { safeAlert } from "../utils/core/safeAlert";

export default function ShoppingListScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { listId } = route.params || {};

  const { activeLists, addItem, updateItem, archiveList } = useLists();
  const { getStoreById } = useStores();

  const list = useMemo(
    () => activeLists.find((l) => l.id === listId),
    [activeLists, listId],
  );

  useEffect(() => {
    if (!list) {
      navigation.replace(ROUTES.SHOPPING_LISTS);
    }
  }, [list, navigation]);

  if (!list) {
    return (
      <View style={styles.center}>
        <Text>Esta lista ya no está activa</Text>
      </View>
    );
  }

  const assignedStore = list.storeId ? getStoreById(list.storeId) : null;

  const handleCreateNew = (name) => {
    const trimmed = name?.trim();
    if (!trimmed) return;

    addItem(listId, { name: trimmed });
  };

  const handleAddFromHistory = (historicItem) => {
    addItem(listId, {
      name: historicItem.name,
      priceInfo: historicItem.priceInfo
        ? {
            ...historicItem.priceInfo,
            currency:
              typeof list.currency === "string"
                ? list.currency
                : list.currency?.code,
          }
        : null,
      checked: true,
    });
  };

  const handleToggleItem = (itemId) => {
    const item = list.items.find((i) => i.id === itemId);
    if (!item) return;

    updateItem(listId, itemId, {
      checked: !item.checked,
    });
  };

  const total = useMemo(() => {
    return list.items
      .filter((i) => i.checked)
      .reduce((sum, i) => sum + (i.priceInfo?.total ?? 0), 0);
  }, [list.items]);

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
            navigation.goBack();
          },
        },
      ],
    );
  };

  const renderItem = ({ item }) => (
    <ItemRow
      item={item}
      onToggle={() => handleToggleItem(item.id)}
      onEdit={() =>
        navigation.navigate(ROUTES.ITEM_DETAIL, {
          listId,
          itemId: item.id,
        })
      }
    />
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.listHeader}>
        <Text style={styles.listName}>{list.name}</Text>
        <CurrencyBadge currency={list.currency} size="sm" />
      </View>

      <StoreSelector
        store={assignedStore}
        onPress={() =>
          navigation.navigate(ROUTES.STORE_SELECT, {
            selectForListId: listId,
          })
        }
      />

      <SearchCombinedBar
        currentList={list}
        onCreateNew={handleCreateNew}
        onAddFromHistory={handleAddFromHistory}
      />
      <FlatList
        data={list.items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      />

      <CheckoutBar
        total={total}
        currency={list.currency}
        onCheckout={handleCheckout}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    backgroundColor: "#fff",
  },
  listName: {
    fontSize: 20,
    fontWeight: "600",
    color: "#111",
    flexShrink: 1,
    marginRight: 12,
  },
});

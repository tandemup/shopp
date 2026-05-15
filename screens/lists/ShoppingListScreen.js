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
import { buildHeaderConfig } from "../../utils/layout/headerStyles";

import { useLists } from "../../context/ListsContext";
import { useStores } from "../../context/StoresContext";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import StoreSelector from "../../components/features/stores/StoreSelector";
import ItemRow from "../../components/features/items/ItemRow";
import SearchCombinedBar from "../../components/features/search/SearchCombinedBar";
import CheckoutBar from "../../components/features/checkout/CheckoutBar";
import CurrencyBadge from "../../components/ui/CurrencyBadge";
import { ROUTES } from "../../navigation/ROUTES";
import { safeAlert, safeConfirm } from "../../components/ui/alert/safeAlert";

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
    navigation.setOptions(headerConfig.navigationOptions);
  }, [navigation]);

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

  const headerConfig = buildHeaderConfig({
    title: "Shopping Lists",
    preset: "light",
  });

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <SafeAreaView style={styles.safeArea} edges={["left", "right", "bottom"]}>
        <View style={styles.listHeader}>
          <Text style={styles.listName}>{list.name}</Text>
          <CurrencyBadge currency={list.currency} size="sm" />
        </View>

        <View style={styles.storeSelectorWrapper}>
          <StoreSelector
            store={assignedStore}
            onPress={() =>
              navigation.navigate(ROUTES.STORE_SELECT, {
                selectForListId: listId,
              })
            }
            onInfoPress={(store) =>
              navigation.navigate(ROUTES.STORES_TAB, {
                screen: ROUTES.STORE_DETAIL,
                params: { storeId: store.id },
              })
            }
          />
        </View>

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
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
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
  storeSelectorWrapper: {
    marginBottom: 8,
  },
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },
});

import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ROUTES } from "./ROUTES";

import ShoppingListsScreen from "../screens/ShoppingListsScreen";
import ShoppingListScreen from "../screens/ShoppingListScreen";
import ItemDetailScreen from "../screens/ItemDetailScreen";
import StoresScreen from "../screens/StoresScreen";
import StoreSelectScreen from "../screens/StoreSelectScreen";
import ArchivedListsScreen from "../screens/ArchivedListsScreen";

import PurchaseHistoryScreen from "../screens/PurchaseHistoryScreen";
import PurchaseDetailScreen from "../screens/PurchaseDetailScreen";

import ScannedHistoryScreen from "../screens/ScannedHistoryScreen";
import EditScannedItemScreen from "../screens/EditScannedItemScreen";
import StoreMapScreen from "../screens/StoreMapScreen";
import MenuScreen from "../screens/MenuScreen";

const Stack = createNativeStackNavigator();

export default function ShoppingStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerTitleAlign: "center",
        headerTitleStyle: { fontSize: 20, fontWeight: "700" },
      }}
    >
      <Stack.Screen
        name={ROUTES.SHOPPING_LISTS}
        component={ShoppingListsScreen}
        options={{ title: "Shopping Lists" }}
      />

      <Stack.Screen
        name={ROUTES.SHOPPING_LIST}
        component={ShoppingListScreen}
        options={{ title: "Shopping List" }}
      />

      <Stack.Screen
        name={ROUTES.ITEM_DETAIL}
        component={ItemDetailScreen}
        options={{ title: "Editar producto" }}
      />

      <Stack.Screen
        name={ROUTES.STORES_HOME}
        component={StoresScreen}
        options={{ title: "Tiendas" }}
      />

      <Stack.Screen
        name={ROUTES.STORE_SELECT}
        component={StoreSelectScreen}
        options={{ title: "Seleccionar tienda" }}
      />

      <Stack.Screen
        name={ROUTES.STORE_MAP}
        component={StoreMapScreen}
        options={{ title: "Mapa de tiendas" }}
      />

      <Stack.Screen
        name={ROUTES.ARCHIVED_LISTS}
        component={ArchivedListsScreen}
        options={{ title: "Listas Archivadas" }}
      />
      <Stack.Screen
        name={ROUTES.PURCHASE_HISTORY}
        component={PurchaseHistoryScreen}
        options={{ title: "Historial" }}
      />
      <Stack.Screen
        name={ROUTES.PURCHASE_DETAIL}
        component={PurchaseDetailScreen}
        options={{ title: "Detalle" }}
      />

      <Stack.Screen
        name={ROUTES.SCANNED_HISTORY}
        component={ScannedHistoryScreen}
        options={{ title: "Historial de escaneos" }}
      />

      <Stack.Screen
        name={ROUTES.EDIT_SCANNED_ITEM}
        component={EditScannedItemScreen}
        options={{ title: "Editar escaneo" }}
      />

      <Stack.Screen
        name={ROUTES.MENU}
        component={MenuScreen}
        options={{ title: "Main Menu" }}
      />
    </Stack.Navigator>
  );
}

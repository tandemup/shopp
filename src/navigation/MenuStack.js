import React from "react";
import { tr, useI18n } from "@/src/i18n";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { ROUTES } from "@/src/navigation/ROUTES";
import { DEFAULT_HEADER_OPTIONS } from "@/src/utils/layout/headerStyles";

import MenuScreen from "@/src/screens/settings/MenuScreen";
import ProfileScreen from "@/src/screens/profile/ProfileScreen";
import AdminUsersScreen from "@/src/screens/admin/AdminUsersScreen";
import BarcodeSettingsScreen from "@/src/screens/settings/BarcodeSettingsScreen";
import SearchEngines from "@/src/screens/settings/SearchEngines";
import AdminStoreRequestsScreen from "@/src/screens/admin/AdminStoreRequestsScreen";
import AdminStoreCatalogScreen from "@/src/screens/admin/AdminStoreCatalogScreen";
import AdminStoreOffersScreen from "@/src/screens/admin/AdminStoreOffersScreen";

const Stack = createNativeStackNavigator();

export default function MenuStack() {
  useI18n();
  return (
    <Stack.Navigator
      initialRouteName={ROUTES.MENU}
      screenOptions={DEFAULT_HEADER_OPTIONS}
    >
      <Stack.Screen
        name={ROUTES.MENU}
        component={MenuScreen}
        options={{ title: tr("Menú") }}
      />

      <Stack.Screen
        name={ROUTES.PROFILE}
        component={ProfileScreen}
        options={{ title: "Mi perfil" }}
      />

      <Stack.Screen
        name={ROUTES.ADMIN_USERS}
        component={AdminUsersScreen}
        options={{ title: "Administrar usuarios" }}
      />

      <Stack.Screen
        name={ROUTES.BARCODE_SETTINGS}
        component={BarcodeSettingsScreen}
        options={{ title: tr("Código de barras") }}
      />

      <Stack.Screen
        name={ROUTES.SEARCH_ENGINES}
        component={SearchEngines}
        options={{ title: tr("Motor de búsqueda") }}
      />

      <Stack.Screen
        name={ROUTES.ADMIN_STORE_REQUESTS}
        component={AdminStoreRequestsScreen}
        options={{ title: tr("Peticiones de tiendas") }}
      />

      <Stack.Screen
        name={ROUTES.ADMIN_STORE_CATALOG}
        component={AdminStoreCatalogScreen}
        options={{ title: "Catálogo de supermercados" }}
      />

      <Stack.Screen
        name={ROUTES.ADMIN_STORE_OFFERS}
        component={AdminStoreOffersScreen}
        options={{ title: tr("Ofertas recibidas") }}
      />
    </Stack.Navigator>
  );
}

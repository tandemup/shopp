// navigation/ScannerStack.js

import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ROUTES } from "./ROUTES";

import ScannerTabScreen from "../screens/scanner/ScannerTabScreen";
import ProductBarcodeScannerScreen from "../screens/scanner/ProductBarcodeScannerScreen";
import NewProductScannerScreen2 from "../screens/scanner/NewProductScannerScreen2";
import ProductInfoScreen from "../screens/scanner/ProductInfoScreen";
import EditScannedItemScreen from "../screens/scanner/EditScannedItemScreen";
import ScannedHistoryScreen from "../screens/scanner/ScannedHistoryScreen";
import SearchEngines from "../screens/settings/SearchEngines";
import BarcodeSettingsScreen from "../screens/settings/BarcodeSettingsScreen";

const Stack = createNativeStackNavigator();

export default function ScannerStack() {
  return (
    <Stack.Navigator
      initialRouteName={ROUTES.SCANNER_HOME}
      screenOptions={{
        headerTitleAlign: "center",
        headerTitleStyle: { fontSize: 20, fontWeight: "700" },
        headerBackButtonDisplayMode: "minimal",
      }}
    >
      <Stack.Screen
        name={ROUTES.SCANNER_HOME}
        component={ScannerTabScreen}
        options={{ title: "Scanner" }}
      />

      <Stack.Screen
        name={ROUTES.PRODUCT_BARCODE_SCANNER}
        component={ProductBarcodeScannerScreen}
        options={{
          title: "Leer código de barras",
          headerShown: false,
          presentation: "fullScreenModal",
        }}
      />

      <Stack.Screen
        name={ROUTES.NEW_PRODUCT_SCANNER2}
        component={NewProductScannerScreen2}
        options={{
          title: "Escanear nuevo producto2",
          headerShown: false,
          presentation: "fullScreenModal",
        }}
      />

      <Stack.Screen
        name={ROUTES.PRODUCT_INFO}
        component={ProductInfoScreen}
        options={{
          title: "Información del producto",
        }}
      />

      <Stack.Screen
        name={ROUTES.EDIT_SCANNED_ITEM}
        component={EditScannedItemScreen}
        options={{ title: "Editar escaneo" }}
      />

      <Stack.Screen
        name={ROUTES.SCANNED_HISTORY}
        component={ScannedHistoryScreen}
        options={{ title: "Historial de Escaneos" }}
      />

      <Stack.Screen
        name={ROUTES.SEARCH_ENGINES}
        component={SearchEngines}
        options={{ title: "Motor de búsqueda" }}
      />

      <Stack.Screen
        name={ROUTES.BARCODE_SETTINGS}
        component={BarcodeSettingsScreen}
        options={{ title: "Código de barras" }}
      />
    </Stack.Navigator>
  );
}

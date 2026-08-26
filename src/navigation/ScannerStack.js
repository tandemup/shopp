// navigation/ScannerStack.js
import { tr, useI18n } from "@/src/i18n";

import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ROUTES } from "./ROUTES";
import { DEFAULT_HEADER_OPTIONS } from "@/src/utils/layout/headerStyles";

import ScannerTabScreen from "@/src/screens/scanner/ScannerTabScreen";
import ProductBarcodeScannerScreen from "@/src/screens/scanner/ProductBarcodeScannerScreen";
import NewProductScannerScreen2 from "@/src/screens/scanner/NewProductScannerScreen2";
import EditScannedItemScreen from "@/src/screens/scanner/EditScannedItemScreen";
import ScannedHistoryScreen from "@/src/screens/scanner/ScannedHistoryScreen";
import SearchEngines from "@/src/screens/settings/SearchEngines";
import BarcodeSettingsScreen from "@/src/screens/settings/BarcodeSettingsScreen";
import AdminProductReviewsScreen from "@/src/screens/admin/AdminProductReviewsScreen";

const Stack = createNativeStackNavigator();

export default function ScannerStack() {
  useI18n();
  return (
    <Stack.Navigator
      initialRouteName={ROUTES.SCANNER_HOME}
      screenOptions={DEFAULT_HEADER_OPTIONS}
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
          title: tr("Leer código de barras"),
          headerShown: false,
          presentation: "fullScreenModal",
        }}
      />

      <Stack.Screen
        name={ROUTES.NEW_PRODUCT_SCANNER2}
        component={NewProductScannerScreen2}
        options={{
          title: tr("Escanear nuevo producto2"),
          headerShown: false,
          gestureEnabled: false,
        }}
      />

      <Stack.Screen
        name={ROUTES.EDIT_SCANNED_ITEM}
        component={EditScannedItemScreen}
        options={{ title: tr("Editar escaneo") }}
      />

      <Stack.Screen
        name={ROUTES.SCANNED_HISTORY}
        component={ScannedHistoryScreen}
        options={{ title: tr("Historial de escaneos") }}
      />

      <Stack.Screen
        name={ROUTES.SEARCH_ENGINES}
        component={SearchEngines}
        options={{ title: tr("Motor de búsqueda") }}
      />

      <Stack.Screen
        name={ROUTES.BARCODE_SETTINGS}
        component={BarcodeSettingsScreen}
        options={{ title: tr("Código de barras") }}
      />

      <Stack.Screen
        name="AdminProductReviews"
        component={AdminProductReviewsScreen}
        options={{
          title: tr("Productos pendientes de revisión"),
        }}
      />
    </Stack.Navigator>
  );
}

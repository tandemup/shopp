import React from "react";
import { tr, useI18n } from "@/src/i18n";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ROUTES } from "./ROUTES";
import { DEFAULT_HEADER_OPTIONS } from "@/src/utils/layout/headerStyles";

import PurchaseHistoryScreen from "@/src/screens/history/PurchaseHistoryScreen";
import PurchaseDetailScreen from "@/src/screens/history/PurchaseDetailScreen";

const Stack = createNativeStackNavigator();

export default function HistoryStack() {
  useI18n();
  return (
    <Stack.Navigator screenOptions={DEFAULT_HEADER_OPTIONS}>
      <Stack.Screen
        name={ROUTES.PURCHASE_HISTORY}
        component={PurchaseHistoryScreen}
      />
      <Stack.Screen
        name={ROUTES.PURCHASE_DETAIL}
        component={PurchaseDetailScreen}
      />
    </Stack.Navigator>
  );
}

/*
      <Stack.Screen
        name={ROUTES.ITEM_DETAIL}
        component={ItemDetailScreen}
        options={{ title: "Detalle" }}
      />
*/

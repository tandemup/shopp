import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ROUTES } from "./ROUTES";

import ScannerTab from "../screens/ScannerTab";
import EditScannedItemScreen from "../screens/EditScannedItemScreen";
import ScannedHistoryScreen from "../screens/ScannedHistoryScreen";

const Stack = createNativeStackNavigator();

export default function ScannerStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name={ROUTES.SCANNER_TAB} component={ScannerTab} />
      <Stack.Screen
        name={ROUTES.EDIT_SCANNED_ITEM}
        component={EditScannedItemScreen}
      />
      <Stack.Screen
        name={ROUTES.SCANNED_HISTORY}
        component={ScannedHistoryScreen}
      />
    </Stack.Navigator>
  );
}

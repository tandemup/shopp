// navigation/ArchivedStack.js
import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import ArchivedListsScreen from "../screens/ArchivedListsScreen";
import ArchivedListDetailScreen from "../screens/ArchivedListDetailScreen";

const Stack = createNativeStackNavigator();

export default function ArchivedStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerTitleAlign: "center",
        headerStyle: { backgroundColor: "#fff" },
        headerTitleStyle: { fontSize: 20, fontWeight: "700" },
      }}
    >
      <Stack.Screen
        name="ArchivedLists"
        component={ArchivedListsScreen}
        options={{ title: "Archivadas" }}
      />

      <Stack.Screen
        name="ArchivedListDetail"
        component={ArchivedListDetailScreen}
        options={{ title: "Detalle" }}
      />
    </Stack.Navigator>
  );
}

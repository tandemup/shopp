import React from "react";
import { tr, useI18n } from "@/src/i18n";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { ROUTES } from "@/src/navigation/ROUTES";
import { DEFAULT_HEADER_OPTIONS } from "@/src/utils/layout/headerStyles";

import MenuScreen from "@/src/screens/settings/MenuScreen";
import ProfileScreen from "@/src/screens/profile/ProfileScreen";
import AdminUsersScreen from "@/src/screens/admin/AdminUsersScreen";

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
    </Stack.Navigator>
  );
}

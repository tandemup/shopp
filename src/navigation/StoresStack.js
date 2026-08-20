import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { tr, useI18n } from "@/src/i18n";
import { ROUTES } from "./ROUTES";
import { DEFAULT_HEADER_OPTIONS } from "@/src/utils/layout/headerStyles";

import StoreInfoScreen from "@/src/screens/stores/StoreInfoScreen";
import StoresHomeScreen from "@/src/screens/stores/StoresHomeScreen";
import StoreSelectScreen from "@/src/screens/stores/StoreSelectScreen";
import StoresBrowseScreen from "@/src/screens/stores/StoresBrowseScreen";
import StoresFavoritesScreen from "@/src/screens/stores/StoresFavoritesScreen";
import StoresNearbyScreen from "@/src/screens/stores/StoresNearbyScreen";
import StoreDetailScreen from "@/src/screens/stores/StoreDetailScreen";

const Stack = createNativeStackNavigator();

export default function StoresStack() {
  useI18n();
  return (
    <Stack.Navigator screenOptions={DEFAULT_HEADER_OPTIONS}>
      <Stack.Screen
        name={ROUTES.STORE_INFO}
        component={StoreInfoScreen}
        options={{
          title: "Store Info",
        }}
      />

      <Stack.Screen name={ROUTES.STORES_HOME} component={StoresHomeScreen} />

      <Stack.Screen name={ROUTES.STORE_SELECT} component={StoreSelectScreen} />

      <Stack.Screen
        name={ROUTES.STORES_BROWSE}
        component={StoresBrowseScreen}
      />

      <Stack.Screen
        name={ROUTES.STORES_NEARBY}
        component={StoresNearbyScreen}
      />

      <Stack.Screen
        name={ROUTES.STORES_FAVORITES}
        component={StoresFavoritesScreen}
      />

      <Stack.Screen
        name={ROUTES.STORE_DETAIL}
        component={StoreDetailScreen}
        options={{
          title: "Store Detail",
          headerShown: true,
          headerBackTitleVisible: false,
        }}
      />
    </Stack.Navigator>
  );
}

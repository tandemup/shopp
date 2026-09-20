import React from "react";
import { tr, useI18n } from "@/src/i18n";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { ROUTES } from "./ROUTES";
import { DEFAULT_HEADER_OPTIONS } from "@/src/utils/layout/headerStyles";

import ShoppingListsScreen from "@/src/screens/lists/ShoppingListsScreen";
import ShoppingListScreen from "@/src/screens/lists/ShoppingListScreen";
import ItemDetailScreen from "@/src/screens/lists/ItemDetailScreen";
import StoreSelectScreen from "@/src/screens/stores/StoreSelectScreen";
import ArchivedListsScreen from "@/src/screens/lists/ArchivedListsScreen";
import StoresScreen from "@/src/screens/stores/StoresBrowseScreen";
import PurchaseHistoryScreen from "@/src/screens/history/PurchaseHistoryScreen";
import PurchaseDetailScreen from "@/src/screens/history/PurchaseDetailScreen";
import TicketCaptureScreen from "@/src/screens/history/TicketCaptureScreen";
import ScannedHistoryScreen from "@/src/screens/scanner/ScannedHistoryScreen";
import EditScannedItemScreen from "@/src/screens/scanner/EditScannedItemScreen";
import StoreMapScreen from "@/src/screens/stores/StoreMapScreen";
import MenuScreen from "@/src/screens/settings/MenuScreen";
import WebRtcFireAlarmScreen from "@/src/screens/webRtcFireAlarm/WebRtcFireAlarmScreen";
import EnglishTutorScreen from "@/src/screens/chat/EnglishTutorScreen";
import LibraryScreen from "@/src/screens/library/LibraryScreen";
import PlayListScreen from "@/src/screens/playlist/PlayListScreen";
import RecipesScreen from "@/src/screens/recipes/RecipesScreen";
import ShoppLiveScreen from "@/src/screens/live/ShoppLiveScreen";
import InvestmentsScreen from "@/src/screens/investments/InvestmentsScreen";
import { adminOnly } from "@/src/components/access/AdminOnlyFeature";

const Stack = createNativeStackNavigator();

const DevStoresScreen = adminOnly(StoresScreen, "Tiendas");
const DevStoreMapScreen = adminOnly(StoreMapScreen, "Mapa de tiendas");
const DevScannedHistoryScreen = adminOnly(
  ScannedHistoryScreen,
  "Historial de escaneos",
);
const DevEditScannedItemScreen = adminOnly(
  EditScannedItemScreen,
  "Edición de escaneos",
);
const DevFireAlarmScreen = adminOnly(WebRtcFireAlarmScreen, "Fire Alarm");
const DevEnglishTutorScreen = adminOnly(EnglishTutorScreen, "Tutor de Inglés");
const DevLibraryScreen = adminOnly(LibraryScreen, "Biblioteca");
const DevClassicalMusicScreen = adminOnly(PlayListScreen, "Música clásica");
const DevTutorialsScreen = adminOnly(PlayListScreen, "Tutoriales");
const DevNewsScreen = adminOnly(PlayListScreen, "Noticias");
const DevShoppLiveScreen = adminOnly(ShoppLiveScreen, "Shopp Live");
const DevInvestmentsScreen = adminOnly(InvestmentsScreen, "Inversiones");
const DevPlayListScreen = adminOnly(PlayListScreen, "Playlists musicales");

export default function ShoppingStack() {
  useI18n();
  return (
    <Stack.Navigator screenOptions={DEFAULT_HEADER_OPTIONS}>
      <Stack.Screen
        name={ROUTES.SHOPPING_LISTS}
        component={ShoppingListsScreen}
      />
      <Stack.Screen
        name={ROUTES.SHOPPING_LIST}
        component={ShoppingListScreen}
      />
      <Stack.Screen name={ROUTES.ITEM_DETAIL} component={ItemDetailScreen} />
      <Stack.Screen name={ROUTES.STORES_HOME} component={DevStoresScreen} />
      <Stack.Screen name={ROUTES.STORE_SELECT} component={StoreSelectScreen} />
      <Stack.Screen name={ROUTES.STORE_MAP} component={DevStoreMapScreen} />
      <Stack.Screen
        name={ROUTES.ARCHIVED_LISTS}
        component={ArchivedListsScreen}
      />
      <Stack.Screen
        name={ROUTES.PURCHASE_HISTORY}
        component={PurchaseHistoryScreen}
      />
      <Stack.Screen
        name={ROUTES.PURCHASE_DETAIL}
        component={PurchaseDetailScreen}
      />
      <Stack.Screen
        name={ROUTES.TICKET_CAPTURE}
        component={TicketCaptureScreen}
        options={{ title: "Fotografiar ticket" }}
      />
      <Stack.Screen
        name={ROUTES.SCANNED_HISTORY}
        component={DevScannedHistoryScreen}
      />
      <Stack.Screen
        name={ROUTES.EDIT_SCANNED_ITEM}
        component={DevEditScannedItemScreen}
      />
      <Stack.Screen
        name={ROUTES.WEBRTC_FIRE_ALARM}
        component={DevFireAlarmScreen}
      />
      <Stack.Screen
        name={ROUTES.ENGLISH_TUTOR}
        component={DevEnglishTutorScreen}
        options={{ title: tr("Tutor de Inglés") }}
      />
      <Stack.Screen
        name={ROUTES.LIBRARY}
        component={DevLibraryScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name={ROUTES.PLAY_LIST}
        component={DevPlayListScreen}
        options={{ title: "Play List" }}
      />
      <Stack.Screen
        name={ROUTES.RECIPES}
        component={RecipesScreen}
        options={{ title: "Recetas saludables" }}
      />
      <Stack.Screen
        name={ROUTES.CLASSICAL_MUSIC}
        component={DevClassicalMusicScreen}
        options={{ title: "Música clásica" }}
      />
      <Stack.Screen
        name={ROUTES.TUTORIALS}
        component={DevTutorialsScreen}
        options={{ title: "Tutoriales" }}
      />
      <Stack.Screen
        name={ROUTES.NEWS}
        component={DevNewsScreen}
        options={{ title: "Noticias" }}
      />
      <Stack.Screen
        name={ROUTES.SHOPP_LIVE}
        component={DevShoppLiveScreen}
        options={{ title: "Shopp Live" }}
      />
      <Stack.Screen
        name={ROUTES.INVESTMENTS}
        component={DevInvestmentsScreen}
        options={{ title: "Inversiones" }}
      />
      <Stack.Screen name={ROUTES.MENU} component={MenuScreen} />
    </Stack.Navigator>
  );
}

import React from "react";
import { tr, useI18n } from "@/src/i18n";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { ROUTES } from "@/src/navigation/ROUTES";
import { DEFAULT_HEADER_OPTIONS } from "@/src/utils/layout/headerStyles";
import ChatScreen from "@/src/screens/chat/ChatScreen";
import ChatScreenResponsive from "@/src/screens/chat/ChatScreenResponsive";
import YesterdayNewsScreen from "@/src/screens/chat/YesterdayNewsScreen";
import ParkingScreen from "@/src/screens/parking/ParkingScreen";
import ParkingSettingsScreen from "@/src/screens/parking/ParkingSettingsScreen";
import ParkingGpsDebugScreen from "@/src/screens/parking/ParkingGpsDebugScreen";
import ChatPrototypeScreen from "@/src/screens/chat/ChatPrototypeScreen";
import { adminOnly, featureOnly } from "@/src/components/access/AdminOnlyFeature";
import { APP_FEATURES } from "@/src/utils/featureAccess";

const Stack = createNativeStackNavigator();
const SharedChatScreen = featureOnly(ChatScreen, APP_FEATURES.CHAT, "Chat");
const SharedChatResponsiveScreen = featureOnly(ChatScreenResponsive, APP_FEATURES.CHAT, "Chat responsive");
const SharedYesterdayNewsScreen = featureOnly(YesterdayNewsScreen, APP_FEATURES.CHAT, "Yesterday News");
const SharedParkingScreen = featureOnly(ParkingScreen, APP_FEATURES.PARKING, "Parking");
const SharedParkingSettingsScreen = featureOnly(ParkingSettingsScreen, APP_FEATURES.PARKING, "Ajustes de parking");
const DevGpsScreen = adminOnly(ParkingGpsDebugScreen, "GPS Debug");
const DevChatPrototypeScreen = adminOnly(ChatPrototypeScreen, "Chat prototipo");

export default function ChatStack() {
  useI18n();
  return (
      <Stack.Navigator
      initialRouteName={ROUTES.CHAT_SCREEN}
      screenOptions={DEFAULT_HEADER_OPTIONS}
    >
      <Stack.Screen
        name={ROUTES.CHAT_SCREEN}
        component={SharedChatScreen}
        options={{
          title: "Chat",
          headerShown: false,
        }}
      />

      <Stack.Screen
        name={ROUTES.CHAT_SCREEN_RESPONSIVE}
        component={SharedChatResponsiveScreen}
        options={{
          title: "Chat responsive",
          headerShown: false,
        }}
      />

      <Stack.Screen
        name={ROUTES.YESTERDAY_NEWS_SCREEN}
        component={SharedYesterdayNewsScreen}
        options={{
          title: "Yesterday News",
        }}
      />

      <Stack.Screen
        name={ROUTES.PARKING_SCREEN}
        component={SharedParkingScreen}
        options={{
          title: tr("Parking"),
          headerShown: false,
        }}
      />

      <Stack.Screen
        name={ROUTES.PARKING_SETTINGS}
        component={SharedParkingSettingsScreen}
        options={{
          title: tr("Ajustes de parking"),
          presentation: "card",
          headerShown: false,
          contentStyle: {
            backgroundColor: "#f8fafc",
          },
        }}
      />
      <Stack.Screen
        name={ROUTES.PARKING_GPS_DEBUG}
        component={DevGpsScreen}
        options={{
          title: "GPS Debug",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name={ROUTES.CHAT_PROTOTYPE}
        component={DevChatPrototypeScreen}
        options={{
          title: tr("Chat de compras"),
        }}
      />
      </Stack.Navigator>
  );
}

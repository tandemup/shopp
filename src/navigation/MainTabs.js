import React from "react";
import { tr, useI18n } from "@/src/i18n";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { Platform, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import { ROUTES } from "@/src/navigation/ROUTES";
import ShoppingStack from "@/src/navigation/ShoppingStack";
import StoresStack from "@/src/navigation/StoresStack";
import ChatStack from "@/src/navigation/ChatStack";
import ScannerStack from "@/src/navigation/ScannerStack";
import MenuStack from "@/src/navigation/MenuStack";
import { safeAlert } from "@/src/components/ui/alert/safeAlert";
import { isAdminUser } from "@/src/utils/featureAccess";

const Tab = createBottomTabNavigator();

const SCREEN_BACKGROUND = "#f8fafc";
const TAB_BAR_CONTENT_HEIGHT = Platform.OS === "web" ? 78 : 70;
const TAB_BAR_MIN_BOTTOM_PADDING = Platform.OS === "web" ? 12 : 10;

const WEB_SAFE_BOTTOM = "max(env(safe-area-inset-bottom, 0px), 12px)";
const WEB_TAB_BAR_HEIGHT = `calc(${TAB_BAR_CONTENT_HEIGHT}px + env(safe-area-inset-bottom, 0px))`;

export default function MainTabs() {
  useI18n();
  const currentUser = useQuery(api.users.current);
  const isAdmin = isAdminUser(currentUser);
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, TAB_BAR_MIN_BOTTOM_PADDING);
  const tabBarHeight =
    Platform.OS === "web"
      ? WEB_TAB_BAR_HEIGHT
      : TAB_BAR_CONTENT_HEIGHT + bottomPadding;
  const tabBarBottomPadding =
    Platform.OS === "web" ? WEB_SAFE_BOTTOM : bottomPadding;
  const adminOnlyTabListeners = (tab, screen) =>
    ({ navigation }) => ({
      tabPress: (event) => {
        if (!isAdmin) {
          event.preventDefault();
          safeAlert(
            "Funcionalidad DEV",
            "Esta función está en desarrollo y solo está disponible para administradores.",
          );
          return;
        }

        event.preventDefault();
        navigation.navigate(tab, { screen });
      },
    });

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,

        sceneStyle: {
          flex: 1,
          backgroundColor: SCREEN_BACKGROUND,
          paddingBottom: 0,
        },

        tabBarActiveTintColor: "#2563EB",
        tabBarInactiveTintColor: "#9CA3AF",
        tabBarHideOnKeyboard: true,

        tabBarStyle: {
          height: tabBarHeight,
          paddingTop: 9,
          paddingBottom: tabBarBottomPadding,
          backgroundColor:
            Platform.OS === "web" ? "rgba(255,255,255,0.94)" : "#FFFFFF",
          borderTopColor: "rgba(148,163,184,0.25)",
          borderTopWidth: StyleSheet.hairlineWidth,
          elevation: 10,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.055,
          shadowRadius: 12,
          ...(Platform.OS === "web"
            ? {
                backdropFilter: "blur(18px)",
                WebkitBackdropFilter: "blur(18px)",
              }
            : {}),
        },

        tabBarItemStyle: {
          minHeight: 60,
          paddingTop: 3,
          paddingBottom: 3,
        },

        tabBarIconStyle: {
          marginTop: 0,
          marginBottom: 3,
        },

        tabBarLabelStyle: {
          marginTop: 0,
          marginBottom: 2,
          fontSize: 12.5,
          lineHeight: 16,
          fontWeight: "600",
        },
      }}
    >
      <Tab.Screen
        name={ROUTES.SHOPPING_TAB}
        component={ShoppingStack}
        options={{
          title: "Shopping",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cart" color={color} size={Math.min(size, 29)} />
          ),
        }}
      />

      <Tab.Screen
        name={ROUTES.STORES_TAB}
        component={StoresStack}
        listeners={adminOnlyTabListeners(
          ROUTES.STORES_TAB,
          ROUTES.STORES_HOME,
        )}
        options={{
          title: tr("Tiendas"),
          tabBarBadge: "DEV",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="storefront"
              size={Math.min(size, 28)}
              color={color}
            />
          ),
        }}
      />

      <Tab.Screen
        name={ROUTES.CHAT_TAB}
        component={ChatStack}
        listeners={adminOnlyTabListeners(ROUTES.CHAT_TAB, ROUTES.CHAT_SCREEN)}
        options={{
          title: "Chat",
          tabBarBadge: "DEV",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="chatbox-ellipses-sharp"
              size={Math.min(size, 28)}
              color={color}
            />
          ),
        }}
      />

      <Tab.Screen
        name={ROUTES.SCANNER_TAB}
        component={ScannerStack}
        listeners={({ navigation }) => ({
          tabPress: (event) => {
            event.preventDefault();
            navigation.navigate(ROUTES.SCANNER_TAB, {
              screen: ROUTES.SCANNER_HOME,
            });
          },
        })}
        options={{
          title: "Scanner",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="barcode" color={color} size={Math.min(size, 29)} />
          ),
        }}
      />

      <Tab.Screen
        name={ROUTES.MENU_TAB}
        component={MenuStack}
        listeners={({ navigation }) => ({
          tabPress: (event) => {
            event.preventDefault();

            // Al pulsar Menu siempre mostramos la pantalla raíz del stack.
            // De lo contrario React Navigation conserva la última pantalla
            // visitada dentro del menú.
            navigation.navigate(ROUTES.MENU_TAB, {
              screen: ROUTES.MENU,
            });
          },
        })}
        options={{
          title: tr("Menu"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="menu" size={Math.min(size, 30)} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

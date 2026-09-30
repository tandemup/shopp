import React from "react";
import { tr, useI18n } from "@/src/i18n";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "convex/react";

import { ROUTES } from "@/src/navigation/ROUTES";
import ShoppingStack from "@/src/navigation/ShoppingStack";
import StoresStack from "@/src/navigation/StoresStack";
import ChatStack from "@/src/navigation/ChatStack";
import ScannerStack from "@/src/navigation/ScannerStack";
import MenuStack from "@/src/navigation/MenuStack";
import { api } from "@/convex/_generated/api";
import LibraryScreen from "@/src/screens/library/LibraryScreen";
import RecipesScreen from "@/src/screens/recipes/RecipesScreen";
import { I18nText as Text } from "@/src/i18n";
import { APP_FEATURES, hasFeatureAccess } from "@/src/utils/featureAccess";

const Tab = createBottomTabNavigator();

const SCREEN_BACKGROUND = "#f8fafc";
const TAB_BAR_CONTENT_HEIGHT = Platform.OS === "web" ? 78 : 70;
const TAB_BAR_MIN_BOTTOM_PADDING = Platform.OS === "web" ? 12 : 10;

const WEB_SAFE_BOTTOM = "max(env(safe-area-inset-bottom, 0px), 12px)";
const WEB_TAB_BAR_HEIGHT = `calc(${TAB_BAR_CONTENT_HEIGHT}px + env(safe-area-inset-bottom, 0px))`;

function GuestAccessScreen({ onExitGuest }) {
  return (
    <View style={styles.guestScreen}>
      <View style={styles.guestCard}>
        <Text style={styles.guestBadge}>MODO INVITADO</Text>
        <Text style={styles.guestTitle}>Estás usando Shopp sin cuenta</Text>
        <Text style={styles.guestText}>
          Los datos de este modo permanecen en este dispositivo. Para sincronizar,
          usar funciones asociadas a una cuenta o acceder a utilidades privadas,
          inicia sesión o crea una cuenta.
        </Text>
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.guestExitButton,
            pressed && styles.guestExitButtonPressed,
          ]}
          onPress={onExitGuest}
        >
          <Text style={styles.guestExitText}>Salir del modo invitado</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function MainTabs({ guestMode = false, onExitGuest }) {
  useI18n();
  const currentUser = useQuery(api.users.current, guestMode ? "skip" : {});
  const canUseStores = hasFeatureAccess(currentUser, APP_FEATURES.STORES);
  const canUseScanner = hasFeatureAccess(currentUser, APP_FEATURES.SCANNER);
  const canUseChat = hasFeatureAccess(currentUser, APP_FEATURES.CHAT);
  const canUseParking = hasFeatureAccess(currentUser, APP_FEATURES.PARKING);
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, TAB_BAR_MIN_BOTTOM_PADDING);
  const tabBarHeight =
    Platform.OS === "web"
      ? WEB_TAB_BAR_HEIGHT
      : TAB_BAR_CONTENT_HEIGHT + bottomPadding;
  const tabBarBottomPadding =
    Platform.OS === "web" ? WEB_SAFE_BOTTOM : bottomPadding;

  if (guestMode) {
    return (
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          sceneStyle: { flex: 1, backgroundColor: SCREEN_BACKGROUND },
          tabBarActiveTintColor: "#2563EB",
          tabBarInactiveTintColor: "#9CA3AF",
          tabBarStyle: {
            height: tabBarHeight,
            paddingTop: 9,
            paddingBottom: tabBarBottomPadding,
            backgroundColor: Platform.OS === "web" ? "rgba(255,255,255,0.94)" : "#FFFFFF",
            borderTopColor: "rgba(148,163,184,0.25)",
            borderTopWidth: StyleSheet.hairlineWidth,
          },
          tabBarLabelStyle: { fontSize: 12.5, fontWeight: "600" },
        }}
      >
        <Tab.Screen
          name="GuestLibrary"
          component={LibraryScreen}
          options={{
            title: "Biblioteca",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="library-outline" color={color} size={Math.min(size, 28)} />
            ),
          }}
        />
        <Tab.Screen
          name="GuestRecipes"
          component={RecipesScreen}
          options={{
            title: "Recetas",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="restaurant-outline" color={color} size={Math.min(size, 28)} />
            ),
          }}
        />
        <Tab.Screen name="GuestAccess" options={{
          title: "Acceso",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" color={color} size={Math.min(size, 28)} />
          ),
        }}>
          {() => <GuestAccessScreen onExitGuest={onExitGuest} />}
        </Tab.Screen>
      </Tab.Navigator>
    );
  }

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

      {canUseStores ? <Tab.Screen
        name={ROUTES.STORES_TAB}
        component={StoresStack}
        listeners={({ navigation }) => ({
          tabPress: (event) => {
            event.preventDefault();

            navigation.navigate(ROUTES.STORES_TAB, {
              screen: ROUTES.STORES_HOME,
            });
          },
        })}
        options={{
          title: tr("Tiendas"),
          tabBarBadge: null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="storefront"
              size={Math.min(size, 28)}
              color={color}
            />
          ),
        }}
      /> : null}

      {canUseChat || canUseParking ? <Tab.Screen
        name={ROUTES.CHAT_TAB}
        component={ChatStack}
        listeners={({ navigation }) => ({
          tabPress: (event) => {
            event.preventDefault();

            navigation.navigate(ROUTES.CHAT_TAB, {
              screen: canUseChat ? ROUTES.CHAT_SCREEN : ROUTES.PARKING_SCREEN,
            });
          },
        })}
        options={{
          title: "Chat",
          tabBarBadge: null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="chatbox-ellipses-sharp"
              size={Math.min(size, 28)}
              color={color}
            />
          ),
        }}
      /> : null}

      {canUseScanner ? <Tab.Screen
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
      /> : null}

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


const styles = StyleSheet.create({
  guestScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#f8fafc",
  },
  guestCard: {
    width: "100%",
    maxWidth: 560,
    padding: 28,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  guestBadge: {
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  guestTitle: {
    color: "#0f172a",
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 12,
  },
  guestText: {
    color: "#475569",
    fontSize: 15,
    lineHeight: 23,
    marginBottom: 22,
  },
  guestExitButton: {
    alignSelf: "flex-start",
    backgroundColor: "#2563eb",
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  guestExitButtonPressed: { opacity: 0.82 },
  guestExitText: { color: "#ffffff", fontWeight: "800", fontSize: 14 },
});

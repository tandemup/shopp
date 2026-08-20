// src/utils/layout/headerStyles.js

import { Platform } from "react-native";

export const HEADER_PRESETS = {
  light: {
    // Un blanco cálido muy ligero: mantiene la identidad actual de Shopp
    // sin crear la franja amarilla pesada que se apreciaba en la PWA.
    background: "#FFFBF3",
    text: "#172033",
    statusBarStyle: "dark",
  },

  blue: {
    background: "#2563EB",
    text: "#FFFFFF",
    statusBarStyle: "light",
  },

  dark: {
    background: "#111827",
    text: "#FFFFFF",
    statusBarStyle: "light",
  },
};

/**
 * Estilo base compartido por los NativeStack.
 *
 * El objetivo es que iOS, Android y la PWA utilicen la misma jerarquía visual
 * sin duplicar opciones en cada Stack.Navigator.
 */
export const DEFAULT_HEADER_OPTIONS = {
  headerTitleAlign: "center",
  headerBackButtonDisplayMode: "minimal",
  headerShadowVisible: false,
  headerTintColor: HEADER_PRESETS.light.text,
  headerStyle: {
    backgroundColor: HEADER_PRESETS.light.background,
  },
  headerTitleStyle: {
    color: HEADER_PRESETS.light.text,
    fontSize: Platform.OS === "web" ? 18 : 19,
    fontWeight: "700",
    letterSpacing: -0.25,
  },
  ...(Platform.OS === "ios"
    ? {
        // En una app nativa iOS el blur lo gestiona UINavigationBar.
        headerBlurEffect: "systemChromeMaterialLight",
      }
    : {}),
};

export function buildHeaderConfig({
  title = "",
  preset = "light",
  backgroundColor,
  textColor,
  largeTitle = false,
} = {}) {
  const theme = HEADER_PRESETS[preset] ?? HEADER_PRESETS.light;
  const headerBackground = backgroundColor ?? theme.background;
  const headerTextColor = textColor ?? theme.text;

  return {
    statusBar: {
      style: theme.statusBarStyle,
      translucent: false,
      backgroundColor: Platform.OS === "android" ? headerBackground : undefined,
    },

    navigationOptions: {
      ...DEFAULT_HEADER_OPTIONS,
      title,
      headerLargeTitle: largeTitle,
      headerStyle: {
        ...DEFAULT_HEADER_OPTIONS.headerStyle,
        backgroundColor: headerBackground,
      },
      headerTintColor: headerTextColor,
      headerTitleStyle: {
        ...DEFAULT_HEADER_OPTIONS.headerTitleStyle,
        color: headerTextColor,
      },
      // El blur solo se usa con el preset claro para no alterar headers de color.
      ...(Platform.OS === "ios" && preset === "light"
        ? { headerBlurEffect: "systemChromeMaterialLight" }
        : { headerBlurEffect: undefined }),
    },

    colors: {
      background: headerBackground,
      text: headerTextColor,
    },
  };
}

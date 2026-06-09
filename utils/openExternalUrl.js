// utils/openExternalUrl.js

import { Linking, Platform } from "react-native";

export async function openExternalUrl(url) {
  if (!url) {
    console.warn("No se ha indicado ninguna URL");
    return;
  }

  try {
    if (Platform.OS === "web") {
      const newWindow = window.open(url, "_blank", "noopener,noreferrer");

      if (!newWindow) {
        console.warn(
          "El navegador ha bloqueado la apertura de la nueva pestaña",
        );
      }

      return;
    }

    const supported = await Linking.canOpenURL(url);

    if (!supported) {
      console.warn("No se puede abrir la URL:", url);
      return;
    }

    await Linking.openURL(url);
  } catch (error) {
    console.error("Error al abrir la URL externa:", error);
  }
}

import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";

/**
 * Abre una URL externa de forma compatible con:
 * - Expo Go en iOS
 * - Android
 * - Expo Web / Netlify
 *
 * Devuelve:
 * { ok: true }
 * o
 * { ok: false, error }
 */
export async function openExternalUrl(rawUrl) {
  try {
    const url = String(rawUrl ?? "").trim();

    if (!url) {
      throw new Error("La URL está vacía");
    }

    const parsedUrl = new URL(url);

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      throw new Error(`Protocolo no permitido: ${parsedUrl.protocol}`);
    }

    if (Platform.OS === "web") {
      const newWindow = window.open(
        parsedUrl.toString(),
        "_blank",
        "noopener,noreferrer",
      );

      /*
       * Algunos navegadores bloquean pestañas nuevas si consideran
       * que la apertura no está suficientemente ligada al tap.
       * En ese caso usamos la pestaña actual como fallback.
       */
      if (!newWindow) {
        window.location.assign(parsedUrl.toString());
      }

      return {
        ok: true,
      };
    }

    await WebBrowser.openBrowserAsync(parsedUrl.toString(), {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      controlsColor: "#2563eb",
      toolbarColor: "#ffffff",
      enableBarCollapsing: false,
    });

    return {
      ok: true,
    };
  } catch (error) {
    console.error("Error al abrir la URL externa:", error);

    return {
      ok: false,
      error,
    };
  }
}

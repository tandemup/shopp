import { Linking, Platform } from "react-native";

import * as WebBrowser from "expo-web-browser";

/**
 * Comprueba que solo abrimos direcciones web normales.
 */
function normalizeHttpUrl(value) {
  const url = String(value ?? "").trim();

  if (!/^https?:\/\//i.test(url)) {
    throw new Error(`URL externa no válida: ${url}`);
  }

  return url;
}

/**
 * WEB:
 * Debe llamarse directamente desde el onPress, antes de cualquier await.
 *
 * Safari y otros navegadores móviles pueden bloquear window.open()
 * cuando se ejecuta después de una operación asíncrona.
 *
 * La pestaña vacía se reutilizará después para cargar el buscador.
 */
export function prepareExternalWindow() {
  if (Platform.OS !== "web" || typeof window === "undefined") {
    return null;
  }

  const externalWindow = window.open("", "_blank");

  if (!externalWindow) {
    return null;
  }

  try {
    /*
     * Impide que la página externa pueda modificar la pestaña
     * original de Shopp mediante window.opener.
     */
    externalWindow.opener = null;

    externalWindow.document.title = "Abriendo buscador…";

    externalWindow.document.body.innerHTML = `
      <main style="
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        font-family: Arial, sans-serif;
        background: #f8fafc;
        color: #334155;
        text-align: center;
      ">
        <div>
          <h2 style="margin-bottom: 8px;">Abriendo buscador…</h2>
          <p style="margin: 0;">Preparando la búsqueda del producto.</p>
        </div>
      </main>
    `;
  } catch (error) {
    /*
     * Algunos navegadores restringen el acceso al documento.
     * La pestaña sigue siendo válida aunque no podamos mostrar
     * el mensaje provisional.
     */
    console.warn("No se pudo preparar la pestaña externa:", error);
  }

  return externalWindow;
}

/**
 * Cierra la pestaña provisional si ocurrió un error antes
 * de cargar el buscador.
 */
export function closePreparedExternalWindow(externalWindow) {
  if (!externalWindow || externalWindow.closed) {
    return;
  }

  try {
    externalWindow.close();
  } catch (error) {
    console.warn("No se pudo cerrar la pestaña provisional:", error);
  }
}

/**
 * Abre una URL sin perder la pantalla actual de Shopp.
 *
 * - Web: reutiliza una pestaña creada previamente desde el toque.
 * - Native: abre un navegador integrado y descartable.
 * - Native fallback: utiliza Linking si expo-web-browser falla.
 */
export async function openExternalUrl(value, { preparedWindow = null } = {}) {
  const url = normalizeHttpUrl(value);

  if (Platform.OS === "web") {
    if (!preparedWindow || preparedWindow.closed) {
      return {
        ok: false,
        reason: "popup-blocked",
      };
    }

    try {
      preparedWindow.location.replace(url);

      return {
        ok: true,
        mode: "web-new-tab",
      };
    } catch (error) {
      console.error("No se pudo cargar la URL externa en web:", error);

      closePreparedExternalWindow(preparedWindow);

      return {
        ok: false,
        reason: "web-navigation-error",
        error,
      };
    }
  }

  try {
    await WebBrowser.openBrowserAsync(url);

    return {
      ok: true,
      mode: "native-in-app-browser",
    };
  } catch (webBrowserError) {
    console.warn(
      "No se pudo abrir expo-web-browser. Usando Linking como fallback:",
      webBrowserError,
    );

    try {
      const supported = await Linking.canOpenURL(url);

      if (!supported) {
        return {
          ok: false,
          reason: "unsupported-url",
        };
      }

      await Linking.openURL(url);

      return {
        ok: true,
        mode: "native-linking-fallback",
      };
    } catch (linkingError) {
      console.error("No se pudo abrir la URL externa:", linkingError);

      return {
        ok: false,
        reason: "native-linking-error",
        error: linkingError,
      };
    }
  }
}

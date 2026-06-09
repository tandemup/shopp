// utils/openExternalUrl.js

import { Linking, Platform } from "react-native";

export async function openExternalUrl(url) {
  const safeUrl = String(url || "").trim();

  if (!safeUrl) {
    console.warn("No se ha indicado ninguna URL");

    return {
      ok: false,
      error: "missing_url",
    };
  }

  try {
    if (Platform.OS === "web") {
      if (typeof window === "undefined") {
        return {
          ok: false,
          error: "window_unavailable",
        };
      }

      window.open(safeUrl, "_blank", "noopener,noreferrer");

      return {
        ok: true,
        url: safeUrl,
      };
    }

    const supported = await Linking.canOpenURL(safeUrl);

    if (!supported) {
      console.warn("No se puede abrir la URL:", safeUrl);

      return {
        ok: false,
        error: "unsupported_url",
      };
    }

    await Linking.openURL(safeUrl);

    return {
      ok: true,
      url: safeUrl,
    };
  } catch (error) {
    console.error("Error al abrir la URL externa:", error);

    return {
      ok: false,
      error: "open_failed",
    };
  }
}

// src/storage/settingsStorage.js

import { storage } from "./storage";
import { STORAGE_KEYS } from "./storageKeys";

/* -------------------------------------------------
   Default settings
-------------------------------------------------- */

export const DEFAULT_SEARCH_SETTINGS = {
  productEngines: {
    google: true,
    google_shopping: true,
    bing: false,
    duckduckgo: false,
    openfoodfacts: true,
    barcodelookup: false,
  },

  bookEngines: {
    google_books: true,
    open_library: true,
    amazon_books: false,
  },
};

/* -------------------------------------------------
   Helpers
-------------------------------------------------- */

/*
 * Normaliza la configuración guardada.
 *
 * Esto evita perder nuevos motores si el usuario tiene almacenada
 * una versión antigua e incompleta de los ajustes.
 */
function normalizeSearchSettings(savedSettings) {
  const saved =
    savedSettings && typeof savedSettings === "object" ? savedSettings : {};

  return {
    ...DEFAULT_SEARCH_SETTINGS,
    ...saved,

    productEngines: {
      ...DEFAULT_SEARCH_SETTINGS.productEngines,
      ...(saved.productEngines ?? {}),
    },

    bookEngines: {
      ...DEFAULT_SEARCH_SETTINGS.bookEngines,
      ...(saved.bookEngines ?? {}),
    },
  };
}

/* -------------------------------------------------
   Read settings
-------------------------------------------------- */

export async function getSearchSettings() {
  try {
    const savedSettings = await storage.getJSON(
      STORAGE_KEYS.SEARCH_SETTINGS,
      DEFAULT_SEARCH_SETTINGS,
    );

    return normalizeSearchSettings(savedSettings);
  } catch (error) {
    console.log("Error reading search settings:", error);

    return DEFAULT_SEARCH_SETTINGS;
  }
}

/* -------------------------------------------------
   Save settings
-------------------------------------------------- */

export async function setSearchSettings(settings) {
  try {
    const normalizedSettings = normalizeSearchSettings(settings);

    await storage.setJSON(STORAGE_KEYS.SEARCH_SETTINGS, normalizedSettings);

    return normalizedSettings;
  } catch (error) {
    console.log("Error saving search settings:", error);

    return DEFAULT_SEARCH_SETTINGS;
  }
}

/* -------------------------------------------------
   Enable or disable one product engine
-------------------------------------------------- */

export async function setProductEngineEnabled(engineId, enabled) {
  const cleanEngineId = String(engineId || "").trim();

  if (!cleanEngineId) {
    return getSearchSettings();
  }

  const currentSettings = await getSearchSettings();

  const nextSettings = {
    ...currentSettings,

    productEngines: {
      ...currentSettings.productEngines,
      [cleanEngineId]: Boolean(enabled),
    },
  };

  return setSearchSettings(nextSettings);
}

/* -------------------------------------------------
   Enable or disable one book engine
-------------------------------------------------- */

export async function setBookEngineEnabled(engineId, enabled) {
  const cleanEngineId = String(engineId || "").trim();

  if (!cleanEngineId) {
    return getSearchSettings();
  }

  const currentSettings = await getSearchSettings();

  const nextSettings = {
    ...currentSettings,

    bookEngines: {
      ...currentSettings.bookEngines,
      [cleanEngineId]: Boolean(enabled),
    },
  };

  return setSearchSettings(nextSettings);
}

/* -------------------------------------------------
   Get enabled product engines
-------------------------------------------------- */

export async function getEnabledProductEngines() {
  const settings = await getSearchSettings();

  return Object.entries(settings.productEngines ?? {})
    .filter(([, enabled]) => Boolean(enabled))
    .map(([engineId]) => engineId);
}

/* -------------------------------------------------
   Get enabled book engines
-------------------------------------------------- */

export async function getEnabledBookEngines() {
  const settings = await getSearchSettings();

  return Object.entries(settings.bookEngines ?? {})
    .filter(([, enabled]) => Boolean(enabled))
    .map(([engineId]) => engineId);
}

/* -------------------------------------------------
   Reset settings
-------------------------------------------------- */

export async function resetSearchSettings() {
  try {
    await storage.setJSON(
      STORAGE_KEYS.SEARCH_SETTINGS,
      DEFAULT_SEARCH_SETTINGS,
    );

    return DEFAULT_SEARCH_SETTINGS;
  } catch (error) {
    console.log("Error resetting search settings:", error);

    return DEFAULT_SEARCH_SETTINGS;
  }
}

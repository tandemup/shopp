// src/storage/settingsStorage.js

import { storage } from "./storage";
import { STORAGE_KEYS } from "./storageKeys";

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

export async function getSearchSettings() {
  const saved = await storage.getJSON(
    STORAGE_KEYS.SEARCH_SETTINGS,
    DEFAULT_SEARCH_SETTINGS,
  );

  return {
    ...DEFAULT_SEARCH_SETTINGS,
    ...(saved ?? {}),

    productEngines: {
      ...DEFAULT_SEARCH_SETTINGS.productEngines,
      ...(saved?.productEngines ?? {}),
    },

    bookEngines: {
      ...DEFAULT_SEARCH_SETTINGS.bookEngines,
      ...(saved?.bookEngines ?? {}),
    },
  };
}

export async function setSearchSettings(settings) {
  return await storage.setJSON(STORAGE_KEYS.SEARCH_SETTINGS, settings);
}

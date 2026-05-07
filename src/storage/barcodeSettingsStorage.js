// src/storage/barcodeSettingsStorage.js

import { storage } from "./storage";
import { STORAGE_KEYS } from "./storageKeys";
import { DEFAULT_BARCODE_SETTINGS } from "../../constants/barcodeFormats";

const FALLBACK_KEY = "barcode_settings";

const getBarcodeSettingsKey = () => {
  return STORAGE_KEYS?.BARCODE_SETTINGS || FALLBACK_KEY;
};

export async function getBarcodeSettings() {
  const saved = await storage.getJSON(
    getBarcodeSettingsKey(),
    DEFAULT_BARCODE_SETTINGS,
  );

  return {
    ...DEFAULT_BARCODE_SETTINGS,
    ...(saved ?? {}),

    formats: {
      ...DEFAULT_BARCODE_SETTINGS.formats,
      ...(saved?.formats ?? {}),
    },
  };
}

export async function setBarcodeSettings(settings) {
  return await storage.setJSON(getBarcodeSettingsKey(), settings);
}

export async function getEnabledBarcodeFormats() {
  const settings = await getBarcodeSettings();

  return Object.entries(settings.formats)
    .filter(([, enabled]) => Boolean(enabled))
    .map(([format]) => format);
}

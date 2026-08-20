// src/storage/settingsStorage.js

import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  DEFAULT_ENGINE,
  PRODUCT_SEARCH_ENGINE_IDS,
  SEARCH_ENGINES,
} from "../constants/searchEngines";

const SEARCH_SETTINGS_STORAGE_KEY = "shopp:search-settings";
const LEGACY_SEARCH_SETTINGS_STORAGE_KEYS = ["search_settings"];

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function isValidProductEngineId(engineId) {
  return Boolean(engineId && SEARCH_ENGINES?.[engineId]);
}

function buildEnabledMap(ids, defaultId, source = {}) {
  return safeArray(ids).reduce((result, engineId) => {
    result[engineId] =
      typeof source?.[engineId] === "boolean"
        ? source[engineId]
        : engineId === defaultId;

    return result;
  }, {});
}

export const DEFAULT_SEARCH_SETTINGS = {
  selectedProductEngine: DEFAULT_ENGINE,

  // Campo legacy conservado para pantallas antiguas que todavía lo leen.
  generalEngine: DEFAULT_ENGINE,

  productEngines: buildEnabledMap(PRODUCT_SEARCH_ENGINE_IDS, DEFAULT_ENGINE),
};

function safeJsonParse(value) {
  try {
    if (!value) {
      return null;
    }

    return JSON.parse(value);
  } catch (error) {
    console.warn("[settingsStorage] No se pudo leer la configuración.", error);
    return null;
  }
}

export function normalizeSearchSettings(settings = {}) {
  const selectedProductEngine = isValidProductEngineId(
    settings?.selectedProductEngine,
  )
    ? settings.selectedProductEngine
    : isValidProductEngineId(settings?.generalEngine)
      ? settings.generalEngine
      : DEFAULT_SEARCH_SETTINGS.selectedProductEngine;

  return {
    ...DEFAULT_SEARCH_SETTINGS,

    selectedProductEngine,
    generalEngine: selectedProductEngine,

    productEngines: buildEnabledMap(
      PRODUCT_SEARCH_ENGINE_IDS,
      selectedProductEngine,
      settings?.productEngines,
    ),
  };
}

async function readStoredSettings() {
  const rawValue = await AsyncStorage.getItem(SEARCH_SETTINGS_STORAGE_KEY);
  const parsedValue = safeJsonParse(rawValue);

  if (parsedValue) {
    return parsedValue;
  }

  for (const legacyKey of LEGACY_SEARCH_SETTINGS_STORAGE_KEYS) {
    const legacyRawValue = await AsyncStorage.getItem(legacyKey);
    const legacyParsedValue = safeJsonParse(legacyRawValue);

    if (legacyParsedValue) {
      return legacyParsedValue;
    }
  }

  return null;
}

export async function getSearchSettings() {
  try {
    const storedSettings = await readStoredSettings();

    return normalizeSearchSettings(storedSettings || DEFAULT_SEARCH_SETTINGS);
  } catch (error) {
    console.warn("[settingsStorage] Error leyendo search settings.", error);
    return DEFAULT_SEARCH_SETTINGS;
  }
}

export async function setSearchSettings(settings) {
  try {
    const normalizedSettings = normalizeSearchSettings(settings);

    await AsyncStorage.setItem(
      SEARCH_SETTINGS_STORAGE_KEY,
      JSON.stringify(normalizedSettings),
    );

    return normalizedSettings;
  } catch (error) {
    console.warn("[settingsStorage] Error guardando search settings.", error);
    return normalizeSearchSettings(settings || DEFAULT_SEARCH_SETTINGS);
  }
}

export async function saveSearchSettings(settings) {
  return setSearchSettings(settings);
}

export async function updateSearchSettings(updater) {
  const currentSettings = await getSearchSettings();
  const nextSettings =
    typeof updater === "function" ? updater(currentSettings) : updater;

  return setSearchSettings({
    ...currentSettings,
    ...nextSettings,
  });
}

export async function setSelectedProductEngine(engineId) {
  const safeEngineId = isValidProductEngineId(engineId)
    ? engineId
    : DEFAULT_ENGINE;

  return updateSearchSettings((currentSettings) => ({
    ...currentSettings,
    selectedProductEngine: safeEngineId,
    generalEngine: safeEngineId,
    productEngines: buildEnabledMap(
      PRODUCT_SEARCH_ENGINE_IDS,
      safeEngineId,
      currentSettings?.productEngines,
    ),
  }));
}

export async function clearSearchSettings() {
  try {
    await AsyncStorage.removeItem(SEARCH_SETTINGS_STORAGE_KEY);

    return DEFAULT_SEARCH_SETTINGS;
  } catch (error) {
    console.warn("[settingsStorage] Error borrando search settings.", error);
    return DEFAULT_SEARCH_SETTINGS;
  }
}

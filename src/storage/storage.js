import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const isWeb = Platform.OS === "web";

/**
 * Detecta si localStorage funciona (Safari private safe)
 */
function getWebStorage() {
  if (!isWeb) return null;

  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const testKey = "__storage_test__";
      window.localStorage.setItem(testKey, "1");
      window.localStorage.removeItem(testKey);
      return window.localStorage;
    }
  } catch (e) {
    console.warn("[storage] localStorage no disponible");
  }

  return null;
}

const webStorage = getWebStorage();

/**
 * Cliente único de almacenamiento
 */
export const storage = {
  async getString(key) {
    try {
      if (isWeb && webStorage) {
        return webStorage.getItem(key);
      }
      return await AsyncStorage.getItem(key);
    } catch (err) {
      console.error(`[storage] getString error (${key})`, err);
      return null;
    }
  },

  async setString(key, value) {
    try {
      if (typeof value !== "string") {
        console.warn(`[storage] setString espera string (${key})`);
        return false;
      }

      if (isWeb && webStorage) {
        webStorage.setItem(key, value);
        return true;
      }

      await AsyncStorage.setItem(key, value);
      return true;
    } catch (err) {
      console.error(`[storage] setString error (${key})`, err);
      return false;
    }
  },

  async remove(key) {
    try {
      if (isWeb && webStorage) {
        webStorage.removeItem(key);
        return;
      }

      await AsyncStorage.removeItem(key);
    } catch (err) {
      console.error(`[storage] remove error (${key})`, err);
    }
  },

  // ======================
  // JSON
  // ======================

  async getJSON(key, fallback) {
    try {
      const raw = await this.getString(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (err) {
      console.error(`[storage] getJSON error (${key})`, err);
      return fallback;
    }
  },

  async setJSON(key, value) {
    try {
      return await this.setString(key, JSON.stringify(value));
    } catch (err) {
      console.error(`[storage] setJSON error (${key})`, err);
      return false;
    }
  },

  /**
   * Merge simple (válido para settings)
   */
  async mergeJSON(key, partial, fallback) {
    const current = await this.getJSON(key, fallback);
    const next = { ...current, ...partial };
    await this.setJSON(key, next);
    return next;
  },

  /**
   * Limpia claves de la app
   */
  async clearByPrefix(prefix = "@shopping/") {
    try {
      if (isWeb && webStorage) {
        Object.keys(webStorage).forEach((k) => {
          if (k.startsWith(prefix)) {
            webStorage.removeItem(k);
          }
        });
        return;
      }

      const keys = await AsyncStorage.getAllKeys();
      const appKeys = keys.filter((k) => k.startsWith(prefix));
      await AsyncStorage.multiRemove(appKeys);
    } catch (err) {
      console.error("[storage] clearByPrefix error", err);
    }
  },
};

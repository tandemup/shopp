import AsyncStorage from "@react-native-async-storage/async-storage";
import { webStorage } from "./indexedDbStorage.web";

async function readLegacyAsyncStorageJSON(key) {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw == null) return null;
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch (error) {
    console.warn("[storage.web] No se pudo leer el fallback AsyncStorage", error);
    return null;
  }
}

export const storage = {
  getRawValue: (key) => webStorage.getItem(key),
  setRawValue: (key, value) => webStorage.setItem(key, value),
  getString: (key) => webStorage.getItem(key),
  setString: (key, value) => webStorage.setItem(key, String(value)),
  remove: (key) => webStorage.removeItem(key),
  getJSON: async (key, fallback = null) => {
    const value = await webStorage.getItem(key);
    if (value != null) {
      try {
        return typeof value === "string" ? JSON.parse(value) : value;
      } catch {
        return fallback;
      }
    }

    // Compatibilidad con compilaciones anteriores que, por una resolución de
    // alias incorrecta, pudieron guardar datos web mediante AsyncStorage. Si
    // encontramos la clave allí la copiamos a nuestro IndexedDB canónico.
    const legacyValue = await readLegacyAsyncStorageJSON(key);
    if (legacyValue != null) {
      await webStorage.setItem(key, legacyValue);
      console.info(`[storage.web] Migrada a IndexedDB la clave ${key}`);
      return legacyValue;
    }
    return fallback;
  },
  setJSON: (key, value) => webStorage.setItem(key, value),
  getAllKeys: () => webStorage.getAllKeys(),
  clearByPrefix: (prefix) => webStorage.clearByPrefix(prefix),
  async mergeJSON(key, partial, fallback = {}) {
    const current = await this.getJSON(key, fallback);
    const next = { ...(current || {}), ...partial };
    await this.setJSON(key, next);
    return next;
  },
  async setFile(key, file, metadata = {}) {
    const blob =
      file instanceof Blob
        ? file
        : new Blob([file], { type: metadata.mimeType });
    return webStorage.setItem(key, { blob, metadata, updatedAt: Date.now() });
  },
  async getFile(key) {
    return webStorage.getItem(key);
  },
  removeFile: (key) => webStorage.removeItem(key),
};

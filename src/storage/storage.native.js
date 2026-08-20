import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";

export const storage = {
  async getRawValue(key) {
    const value = await AsyncStorage.getItem(key);
    if (value == null) return null;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  },
  setRawValue: (key, value) =>
    AsyncStorage.setItem(
      key,
      typeof value === "string" ? value : JSON.stringify(value),
    ),
  getString: (key) => AsyncStorage.getItem(key),
  setString: (key, value) => AsyncStorage.setItem(key, String(value)),
  remove: (key) => AsyncStorage.removeItem(key),
  async getJSON(key, fallback = null) {
    const value = await AsyncStorage.getItem(key);
    if (value == null) return fallback;
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  },
  setJSON: (key, value) => AsyncStorage.setItem(key, JSON.stringify(value)),
  getAllKeys: () => AsyncStorage.getAllKeys(),
  async clearByPrefix(prefix) {
    const keys = (await AsyncStorage.getAllKeys()).filter((key) =>
      key.startsWith(prefix),
    );
    if (keys.length) await AsyncStorage.multiRemove(keys);
  },
  async mergeJSON(key, partial, fallback = {}) {
    const current = await this.getJSON(key, fallback);
    const next = { ...(current || {}), ...partial };
    await this.setJSON(key, next);
    return next;
  },
  async setFile(key, fileUri, metadata = {}) {
    const directory = `${FileSystem.documentDirectory}shopp-local/`;
    await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
    const path = `${directory}${encodeURIComponent(key)}`;
    await FileSystem.copyAsync({ from: fileUri, to: path });
    await AsyncStorage.setItem(
      `${key}.__meta`,
      JSON.stringify({ ...metadata, path }),
    );
    return { uri: path, metadata };
  },
  async getFile(key) {
    const raw = await AsyncStorage.getItem(`${key}.__meta`);
    if (!raw) return null;
    const metadata = JSON.parse(raw);
    const info = await FileSystem.getInfoAsync(metadata.path);
    return info.exists ? { uri: metadata.path, metadata } : null;
  },
  async removeFile(key) {
    const file = await this.getFile(key);
    if (file) await FileSystem.deleteAsync(file.uri, { idempotent: true });
    await AsyncStorage.removeItem(`${key}.__meta`);
  },
};

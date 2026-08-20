import { webStorage } from "./indexedDbStorage.web";

export const storage = {
  getRawValue: (key) => webStorage.getItem(key),
  setRawValue: (key, value) => webStorage.setItem(key, value),
  getString: (key) => webStorage.getItem(key),
  setString: (key, value) => webStorage.setItem(key, String(value)),
  remove: (key) => webStorage.removeItem(key),
  getJSON: async (key, fallback = null) => {
    const value = await webStorage.getItem(key);
    if (value == null) return fallback;
    try {
      return typeof value === "string" ? JSON.parse(value) : value;
    } catch {
      return fallback;
    }
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

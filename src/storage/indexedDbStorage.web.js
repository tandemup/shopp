const DB_NAME = "shopp-local-storage";
const DB_VERSION = 1;
const STORE_NAME = "entries";

function openDatabase() {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(
      new Error("IndexedDB no está disponible en este navegador"),
    );
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transaction(mode, action) {
  return openDatabase().then((database) =>
    new Promise((resolve, reject) => {
      const request = action(
        database.transaction(STORE_NAME, mode).objectStore(STORE_NAME),
      );
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }).finally(() => database.close()),
  );
}

export const webStorage = {
  async getItem(key) {
    return (await transaction("readonly", (store) => store.get(key))) ?? null;
  },
  setItem(key, value) {
    return transaction("readwrite", (store) => store.put(value, key));
  },
  removeItem(key) {
    return transaction("readwrite", (store) => store.delete(key));
  },
  async getAllKeys() {
    return (await transaction("readonly", (store) => store.getAllKeys())).map(
      String,
    );
  },
  async clearByPrefix(prefix) {
    const keys = await this.getAllKeys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith(prefix))
        .map((key) => this.removeItem(key)),
    );
  },
};

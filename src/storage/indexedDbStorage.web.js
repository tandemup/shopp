const DB_NAME = "shopp-local-storage";
const DB_VERSION = 3; // Compartida con lyricsStorage.web.js y playlistRepository.web.js
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
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME);
      const playlists = database.objectStoreNames.contains("playlists")
        ? request.transaction.objectStore("playlists")
        : database.createObjectStore("playlists", { keyPath: "id" });
      if (!playlists.indexNames.contains("by_collection"))
        playlists.createIndex("by_collection", "collectionType", { unique: false });
      if (!database.objectStoreNames.contains("playlist-migrations"))
        database.createObjectStore("playlist-migrations", { keyPath: "id" });
    };
    let blocked = false;
    request.onsuccess = () => {
      if (blocked) { request.result.close(); return; }
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      blocked = true;
      reject(new Error("Cierra las demás pestañas de Shopp para actualizar IndexedDB."));
    };
  });
}

function transaction(mode, action) {
  return openDatabase().then(database => new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, mode);
    let result;
    tx.oncomplete = () => { database.close(); resolve(result); };
    tx.onabort = () => { database.close(); reject(tx.error || new Error("IndexedDB abortó la transacción")); };
    tx.onerror = () => {};
    try {
      const request = action(tx.objectStore(STORE_NAME));
      request.onsuccess = () => { result = request.result; };
    } catch (error) {
      try { tx.abort(); } catch { /* already aborted */ }
      reject(error);
    }
  }));
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

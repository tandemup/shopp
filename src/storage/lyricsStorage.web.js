const DB_NAME = "shopp-local-storage";
const DB_VERSION = 1;
const STORE_NAME = "entries";
const PREFIX = "@shopping/playlist-lyrics/";

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB no está disponible en este navegador."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("No se pudo abrir IndexedDB."));
  });
}

function identityPart(track) {
  if (track?.videoId) return `video:${track.videoId}`;
  if (track?.playlistId) return `playlist:${track.playlistId}`;
  if (track?.url) return `url:${encodeURIComponent(String(track.url).trim())}`;
  return "unknown";
}

export function getLyricsStorageKey(track) {
  return `${PREFIX}${identityPart(track)}`;
}

async function withStore(mode, callback) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode);
      const store = tx.objectStore(STORE_NAME);
      let result;
      try {
        result = callback(store, resolve, reject);
      } catch (error) {
        reject(error);
      }
      tx.onerror = () => reject(tx.error || new Error("Error de IndexedDB."));
      tx.onabort = () => reject(tx.error || new Error("Operación cancelada en IndexedDB."));
      if (result !== undefined) resolve(result);
    });
  } finally {
    db.close();
  }
}

export async function getLocalLyrics(track) {
  const key = getLyricsStorageKey(track);
  return withStore("readonly", (store, resolve, reject) => {
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function saveLocalLyrics(track, text, metadata = {}) {
  const key = getLyricsStorageKey(track);
  const record = {
    text: String(text ?? ""),
    fileName: metadata.fileName || "lyrics.lrc",
    mimeType: "text/plain",
    updatedAt: Date.now(),
    videoId: track?.videoId || null,
    playlistId: track?.playlistId || null,
  };
  await withStore("readwrite", (store, resolve, reject) => {
    const request = store.put(record, key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  return record;
}

export async function removeLocalLyrics(track) {
  const key = getLyricsStorageKey(track);
  await withStore("readwrite", (store, resolve, reject) => {
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

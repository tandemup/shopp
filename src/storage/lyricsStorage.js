import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const PREFIX = "@shopping/playlist-lyrics/";

function identityPart(track) {
  if (track?.videoId) return `video:${track.videoId}`;
  if (track?.playlistId) return `playlist:${track.playlistId}`;
  if (track?.url) return `url:${encodeURIComponent(String(track.url).trim())}`;
  return "unknown";
}

export function newLyricsStorageKey() {
  const id = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${PREFIX}track:${id}`;
}

export function getLyricsStorageKey(track) {
  if (typeof track?.lyricsKey === "string" &&
      /^@shopping\/playlist-lyrics\/track:[A-Za-z0-9_-]+$/.test(track.lyricsKey)) {
    return track.lyricsKey;
  }
  return `${PREFIX}${identityPart(track)}`;
}

// The web playlist repository stores LRC records in IndexedDB, in the
// shopp-local-storage/entries object store, within the same transaction as
// playlist metadata. Read that store before checking legacy AsyncStorage.
function readIndexedDbLyrics(key) {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { resolve(null); return; }
    // No version passed: opening an existing database cannot accidentally
    // request an incompatible schema upgrade.
    const request = indexedDB.open("shopp-local-storage");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("entries")) {
        db.close(); resolve(null); return;
      }
      const tx = db.transaction("entries", "readonly");
      const get = tx.objectStore("entries").get(key);
      get.onsuccess = () => resolve(get.result || null);
      get.onerror = () => reject(get.error);
      tx.oncomplete = () => db.close();
      tx.onabort = () => db.close();
    };
  });
}

export async function getLocalLyrics(track) {
  if (track?.lyricsDisabled === true) return null;
  const key = getLyricsStorageKey(track);
  if (Platform.OS === "web") {
    const record = await readIndexedDbLyrics(key);
    if (record && typeof record.text === "string") return record;
  }
  // Backward compatibility with older saves that used AsyncStorage.
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export async function saveLocalLyrics(track, text, metadata = {}) {
  const record = {
    text: String(text ?? ""),
    fileName: metadata.fileName || "lyrics.lrc",
    mimeType: "text/plain",
    updatedAt: Date.now(),
    videoId: track?.videoId || null,
    playlistId: track?.playlistId || null,
  };
  await AsyncStorage.setItem(getLyricsStorageKey(track), JSON.stringify(record));
  return record;
}

export async function removeLocalLyrics(track) {
  await AsyncStorage.removeItem(getLyricsStorageKey(track));
}

import { Platform } from "react-native";
import * as FileSystem from "expo-file-system";
import { storage } from "@/src/storage/storage";

const NATIVE_DIRECTORY = `${FileSystem.cacheDirectory || FileSystem.documentDirectory}library-link-images/`;
const WEB_CACHE_PREFIX = "@shopp/library-link-images/";
const WEB_CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const WEB_CACHE_MAX_ENTRIES = 180;
const WEB_CACHE_MAX_BYTES = 60 * 1024 * 1024;

function keyForUrl(url) {
  let hash = 0;
  for (const char of String(url)) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `link-${hash.toString(16)}.img`;
}

function getWebCacheKey(url) {
  return `${WEB_CACHE_PREFIX}${keyForUrl(url)}`;
}

function canCacheWebImage(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function isFresh(entry) {
  const savedAt = Number(entry?.metadata?.savedAt || 0);
  return savedAt > 0 && Date.now() - savedAt < WEB_CACHE_MAX_AGE_MS;
}

function objectUrlFor(entry) {
  const blob = entry?.blob;
  return blob instanceof Blob && blob.size > 0 ? URL.createObjectURL(blob) : "";
}

async function trimWebImageCache() {
  const keys = (await storage.getAllKeys()).filter((key) =>
    key.startsWith(WEB_CACHE_PREFIX),
  );

  const entries = await Promise.all(
    keys.map(async (key) => ({ key, entry: await storage.getFile(key) })),
  );
  const validEntries = entries
    .filter(({ entry }) => entry?.blob instanceof Blob && entry.blob.size > 0)
    .sort(
      (a, b) =>
        Number(b.entry.metadata?.lastAccessedAt || b.entry.metadata?.savedAt || 0) -
        Number(a.entry.metadata?.lastAccessedAt || a.entry.metadata?.savedAt || 0),
    );

  let retainedBytes = 0;
  const removals = [];
  validEntries.forEach(({ key, entry }, index) => {
    retainedBytes += entry.blob.size;
    if (index >= WEB_CACHE_MAX_ENTRIES || retainedBytes > WEB_CACHE_MAX_BYTES) {
      removals.push(storage.removeFile(key));
    }
  });
  await Promise.all(removals);
}

async function getCachedWebImageUri(url) {
  if (!canCacheWebImage(url)) return url;

  const key = getWebCacheKey(url);
  const existing = await storage.getFile(key);
  if (existing?.blob instanceof Blob && existing.blob.size > 0 && isFresh(existing)) {
    storage.setFile(key, existing.blob, {
      ...(existing.metadata || {}),
      lastAccessedAt: Date.now(),
    }).catch(() => {});
    return objectUrlFor(existing) || url;
  }

  try {
    // Solo se guarda cuando el origen permite CORS. Muchas imágenes se pueden
    // dibujar en <img>, pero el navegador no permite leerlas como Blob.
    const response = await fetch(url, {
      mode: "cors",
      credentials: "omit",
      cache: "force-cache",
    });
    if (!response.ok) return url;

    const contentType = String(response.headers.get("content-type") || "");
    if (!contentType.startsWith("image/")) return url;

    const blob = await response.blob();
    if (!blob.size) return url;

    await storage.setFile(key, blob, {
      savedAt: Date.now(),
      lastAccessedAt: Date.now(),
      sourceUrl: url,
      mimeType: blob.type || contentType,
      size: blob.size,
    });
    trimWebImageCache().catch(() => {});
    return URL.createObjectURL(blob);
  } catch {
    // El origen no permite CORS o no está disponible. React Native Web seguirá
    // mostrando la URL remota y el navegador aplicará su caché HTTP normal.
    return url;
  }
}

export async function getCachedLinkImageUri(url) {
  const normalized = String(url || "").trim();
  if (!normalized) return "";

  try {
    if (Platform.OS === "web") {
      return await getCachedWebImageUri(normalized);
    }

    const directoryInfo = await FileSystem.getInfoAsync(NATIVE_DIRECTORY);
    if (!directoryInfo.exists) await FileSystem.makeDirectoryAsync(NATIVE_DIRECTORY, { intermediates: true });
    const localUri = `${NATIVE_DIRECTORY}${keyForUrl(normalized)}`;
    const localInfo = await FileSystem.getInfoAsync(localUri);
    if (localInfo.exists && localInfo.size > 0) return localUri;
    const downloaded = await FileSystem.downloadAsync(normalized, localUri);
    return downloaded?.status === 200 ? downloaded.uri : normalized;
  } catch (error) {
    if (Platform.OS !== "web") {
      console.warn("[linkImageCache] image cache failed", error);
    }
    return normalized;
  }
}

import { Platform } from "react-native";
import * as FileSystem from "expo-file-system";

const CACHE_NAME = "shopp-library-link-images-v1";
const NATIVE_DIRECTORY = `${FileSystem.cacheDirectory || FileSystem.documentDirectory}library-link-images/`;

function keyForUrl(url) {
  let hash = 0;
  for (const char of String(url)) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `link-${hash.toString(16)}.img`;
}

export async function getCachedLinkImageUri(url) {
  const normalized = String(url || "").trim();
  if (!normalized) return "";

  try {
    if (Platform.OS === "web" && typeof caches !== "undefined") {
      // Cache Storage necesita CORS para leer la respuesta. Las imágenes de
      // periódicos suelen permitir <img src>, pero bloquean fetch(). En ese
      // caso dejamos que el navegador las muestre y use su caché HTTP normal.
      if (typeof window !== "undefined") {
        const imageUrl = new URL(normalized, window.location.href);
        if (imageUrl.origin !== window.location.origin) return normalized;
      }
      const cache = await caches.open(CACHE_NAME);
      const response = await cache.match(normalized);
      if (response) {
        const blob = await response.blob();
        return URL.createObjectURL(blob);
      }
      const responseFromNetwork = await fetch(normalized);
      if (!responseFromNetwork.ok) return normalized;
      await cache.put(normalized, responseFromNetwork.clone());
      return URL.createObjectURL(await responseFromNetwork.blob());
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

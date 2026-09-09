import AsyncStorage from "@react-native-async-storage/async-storage";

const PREFIX = "@shopping/playlist-lyrics/";

function identityPart(track) {
  if (track?.videoId) return `video:${track.videoId}`;
  if (track?.playlistId) return `playlist:${track.playlistId}`;
  if (track?.url) return `url:${encodeURIComponent(String(track.url).trim())}`;
  return "unknown";
}

export function getLyricsStorageKey(track) {
  return `${PREFIX}${identityPart(track)}`;
}

export async function getLocalLyrics(track) {
  const raw = await AsyncStorage.getItem(getLyricsStorageKey(track));
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

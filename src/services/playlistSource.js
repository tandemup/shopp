// Permanent PWA cutover: Music and Classical use IndexedDB by default.
// Legacy "convex" preferences are intentionally ignored; no silent fallback.
import { Platform } from "react-native";
export function getPlaylistSource(collection) {
  if (!['playlist', 'classical'].includes(collection)) return 'convex';
  return Platform.OS === 'web' ? 'local' : 'convex';
}
// Kept for old callers; source switching has been removed from the UI.
export function setPlaylistSource(collection, source) {
  if (!['playlist', 'classical'].includes(collection) || source !== getPlaylistSource(collection)) {
    throw new Error('El origen para Music/Classical es IndexedDB en la PWA.');
  }
}

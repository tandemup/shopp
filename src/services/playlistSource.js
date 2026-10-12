// A browser-local, explicitly selected source for music/classical playlists.
// The default is Convex; no migration is automatic or destructive.
import { Platform } from "react-native";
const PREFIX = "shopp-playlist-source-v1:";
export function getPlaylistSource(collection) {
  if (collection !== "playlist" && collection !== "classical") return "convex";
  if (Platform.OS !== "web" || typeof window === "undefined") return "convex";
  try { return window.localStorage.getItem(PREFIX + collection) === "local" ? "local" : "convex"; }
  catch { return "convex"; }
}
export function setPlaylistSource(collection, source) {
  if (!(["playlist", "classical"].includes(collection)) || !(["convex", "local"].includes(source))) throw new Error("Origen no válido");
  if (Platform.OS !== "web" || typeof window === "undefined") throw new Error("Selección de origen solo disponible en PWA");
  window.localStorage.setItem(PREFIX + collection, source);
}

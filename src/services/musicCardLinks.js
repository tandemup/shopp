// QR públicos de Shopp. No accede a IndexedDB ni Convex.
const VIDEO_ID = /^[a-zA-Z0-9_-]{11}$/;
const PLAYLIST_ID = /^[a-zA-Z0-9_-]{10,120}$/;
const PUBLIC_ID = /^[a-z0-9][a-z0-9-]{5,63}$/;
const text = (value, limit = 80) => String(value ?? "").trim().slice(0, limit);

export function videoIdFromTrack(track) {
  if (VIDEO_ID.test(String(track?.videoId ?? ""))) return String(track.videoId);
  try {
    const u = new URL(String(track?.url || ""));
    if (u.protocol !== "https:" && u.protocol !== "http:") return "";
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    let id = "";
    if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
      id = u.pathname === "/watch" ? u.searchParams.get("v") :
        u.pathname.startsWith("/shorts/") || u.pathname.startsWith("/embed/") ? u.pathname.split("/")[2] : "";
    } else if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
    return VIDEO_ID.test(id || "") ? id : "";
  } catch { return ""; }
}

export function youtubePlaylistIdFromTrack(track) {
  if (PLAYLIST_ID.test(String(track?.playlistId || ""))) return String(track.playlistId);
  try {
    const u = new URL(String(track?.url || ""));
    if (!/^(www\.)?(youtube\.com|m\.youtube\.com|music\.youtube\.com)$/.test(u.hostname)) return "";
    const id = u.searchParams.get("list") || "";
    return PLAYLIST_ID.test(id) ? id : "";
  } catch { return ""; }
}

export function normalizePublicBase(input) {
  try {
    const url = new URL(String(input || ""));
    if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) return "";
    return url.origin;
  } catch { return ""; }
}

export function publicIdForCard() {
  if (typeof globalThis.crypto?.randomUUID === "function") return `shopp-${globalThis.crypto.randomUUID()}`;
  return `shopp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function buildSongCardUrl(base, track, title = "", author = "", destination = "landing") {
  const origin = normalizePublicBase(base);
  if (!origin) return "";
  const v = videoIdFromTrack(track);
  const list = youtubePlaylistIdFromTrack(track);
  if (!v && !list) return "";
  if (destination === "youtube") return v ? `https://www.youtube.com/watch?v=${v}` : `https://www.youtube.com/playlist?list=${list}`;
  const route = destination === "shopp" ? "/?shoppCard=1" : "/music-card.html?card=1";
  const url = new URL(route, origin);
  if (v) url.searchParams.set("v", v);
  else url.searchParams.set("ytpl", list);
  if (title) url.searchParams.set("t", text(title, 60));
  if (author) url.searchParams.set("a", text(author, 60));
  return url.toString();
}

export function buildPlaylistCardUrl(base, publicId, destination = "landing") {
  const origin = normalizePublicBase(base);
  if (!origin || !PUBLIC_ID.test(String(publicId))) return "";
  const url = new URL(destination === "shopp" ? "/?shoppCard=1" : "/music-card.html?card=1", origin);
  url.searchParams.set("p", String(publicId));
  return url.toString();
}

export function getPublicManifestUrl(base, publicId) {
  if (!normalizePublicBase(base) || !PUBLIC_ID.test(String(publicId))) return "";
  return `${normalizePublicBase(base)}/music-cards/${publicId}.json`;
}

export function buildPublicManifest(playlist, publicId, isClassical = false) {
  if (!PUBLIC_ID.test(String(publicId))) throw new Error("Identificador público inválido");
  const tracks = (Array.isArray(playlist?.tracks) ? playlist.tracks : [])
    .map(track => {
      const videoId = videoIdFromTrack(track);
      const playlistId = youtubePlaylistIdFromTrack(track);
      if (!videoId && !playlistId) return null;
      return {
        title: text(track.title || "Canción", 120),
        author: text(track.author || track.artist || playlist?.composer || playlist?.artist || "", 100),
        ...(videoId ? { videoId } : { playlistId }),
      };
    }).filter(Boolean).slice(0, 100);
  if (!tracks.length) throw new Error("La playlist no contiene vídeos de YouTube válidos");
  // Nunca publicar datos internos: no ids privados, emails, claves IndexedDB ni LRC.
  return {
    schema: "shopp-public-music-card", version: 1, id: publicId,
    collectionType: isClassical ? "classical" : "music",
    title: text(playlist?.title || "Playlist Shopp", 120),
    author: text(playlist?.author || playlist?.composer || playlist?.artist || "", 100),
    tracks,
  };
}

import { parseYouTubeUrl } from "@/src/services/urlSafety";

export function normalizeTrack(track) {
  const parsed = parseYouTubeUrl(String(track?.url || ""));
  const videoId = /^[\w-]{11}$/.test(track?.videoId || "") ? track.videoId : parsed.videoId;
  const playlistId = /^[\w-]{10,80}$/.test(track?.playlistId || "") ? track.playlistId : parsed.playlistId;
  const album = track?.kind === "album";
  if (album ? !playlistId : !videoId) return null;
  return { ...track, kind: album ? "album" : "single", videoId: videoId || "", playlistId: album ? playlistId : "" };
}

export function parseLrc(text) {
  const offset = Number(String(text || "").match(/\[offset:([+-]?\d+)\]/i)?.[1] || 0) / 1000;
  const lines = [];
  for (const raw of String(text || "").split(/\r?\n/)) {
    const lyric = raw.replace(/\[[^\]]*\]/g, "").trim();
    if (!lyric) continue;
    for (const match of raw.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g)) {
      lines.push({ time: Math.max(0, Number(match[1]) * 60 + Number(match[2]) + Number(`0.${match[3] || 0}`) - offset), text: lyric });
    }
  }
  return lines.sort((a, b) => a.time - b.time);
}

export function formatTime(value) {
  const seconds = Math.max(0, Math.floor(Number(value) || 0));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function youtubeError(code) {
  if (code === 100) return "Este vídeo ya no está disponible.";
  if (code === 101 || code === 150) return "Este vídeo solo permite reproducirse en YouTube.";
  if (code === 153) return "YouTube no ha podido verificar el origen del reproductor. Prueba a abrirlo en YouTube.";
  return "No se pudo reproducir el vídeo. Puedes reintentarlo o abrirlo en YouTube.";
}

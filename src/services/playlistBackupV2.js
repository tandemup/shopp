// Exportación de respaldo, no altera ni elimina datos de Convex.
import { getLocalLyrics } from "@/src/storage/lyricsStorage";

const MAX_LRC_BYTES = 512 * 1024;

function mediaUrl(track) {
  return track.url || (track.playlistId
    ? `https://www.youtube.com/playlist?list=${track.playlistId}`
    : track.videoId ? `https://www.youtube.com/watch?v=${track.videoId}` : "");
}

async function readLyrics(track, playlistTitle) {
  // Se prefiere la versión asociada al archivo de Convex cuando existe.
  // La versión local solo es el origen si no hay archivo remoto asociado.
  let text = null;
  let fileName = track.lyricsFileName || "lyrics.lrc";
  let source = null;
  if (track.lyricsStorageId) {
    if (!track.lyricsUri) {
      throw new Error(`No existe URL de descarga para LRC en «${playlistTitle}»: ${track.title}. No se generó una copia incompleta.`);
    }
    let response;
    try {
      response = await fetch(track.lyricsUri);
    } catch (cause) {
      throw new Error(`No se puede descargar el LRC de «${playlistTitle}» / «${track.title}»: ${cause.message}`);
    }
    if (!response.ok) throw new Error(`Error HTTP ${response.status} al descargar el LRC de «${playlistTitle}» / «${track.title}».`);
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > MAX_LRC_BYTES) throw new Error(`LRC demasiado grande en «${playlistTitle}» / «${track.title}».`);
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    source = "convex";
  } else {
    const local = await getLocalLyrics(track);
    if (local && typeof local.text === "string") {
      text = local.text;
      fileName = local.fileName || fileName;
      source = "local";
    }
  }
  if (text === null) {
    if (track.lyricsFileName || track.lyricsSize || track.lyricsMimeType) {
      throw new Error(`Falta el contenido LRC indicado en «${playlistTitle}» / «${track.title}». No se generó una copia incompleta.`);
    }
    return null;
  }
  if (new TextEncoder().encode(text).length > MAX_LRC_BYTES) throw new Error(`LRC demasiado grande en «${playlistTitle}» / «${track.title}».`);
  return { fileName, mimeType: "text/plain", text, source };
}

export async function makePlaylistBackupV2(playlists, type, { single = false } = {}) {
  if (!Array.isArray(playlists)) throw new Error("Las playlists no están disponibles; no se ha generado el respaldo.");
  const result = [];
  let lyricsCount = 0;
  for (const playlist of playlists) {
    if (!Array.isArray(playlist.tracks)) throw new Error(`Pistas inválidas en «${playlist.title}».`);
    const tracks = [];
    for (const track of playlist.tracks) {
      const lyrics = await readLyrics(track, playlist.title);
      if (lyrics) lyricsCount += 1;
      const { lyricsUri, ...persistentTrack } = track;
      tracks.push({
        ...persistentTrack,
        url: mediaUrl(track),
        ...(lyrics ? { lyricsBackup: lyrics } : {}),
      });
    }
    // Conservamos _id y demás metadatos originales como referencia para la migración.
    result.push({ ...playlist, tracks });
  }
  const backup = {
    app: "Shopp",
    version: 2,
    type,
    exportedAt: new Date().toISOString(),
    backupStatus: "complete",
    lyricsEntries: lyricsCount,
    ...(single ? result[0] : { playlists: result }),
  };
  return backup;
}

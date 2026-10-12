// Exportación de respaldo, no altera ni elimina datos de Convex.
import { getLocalLyrics } from "@/src/storage/lyricsStorage";

const MAX_LRC_BYTES = 512 * 1024;

function mediaUrl(track) {
  return track.url || (track.playlistId
    ? `https://www.youtube.com/playlist?list=${track.playlistId}`
    : track.videoId ? `https://www.youtube.com/watch?v=${track.videoId}` : "");
}

async function readLyrics(track, playlistTitle, { allowRemoteLyrics = false } = {}) {
  // En funcionamiento local NO se leen archivos de Convex. Solo la migración
  // explícita permite descargar una LRC remota, y siempre prefiere una edición local.
  let text = null;
  let fileName = track.lyricsFileName || "lyrics.lrc";
  let source = null;
  const local = await getLocalLyrics(track);
  if (local && typeof local.text === "string") {
    text = local.text;
    fileName = local.fileName || fileName;
    source = "local";
  } else if (allowRemoteLyrics && track.lyricsStorageId) {
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
  }
  if (text === null) {
    if (track.lyricsFileName || track.lyricsSize || track.lyricsMimeType || track.lyricsStorageId) {
      throw new Error(`Falta el contenido LRC indicado en «${playlistTitle}» / «${track.title}». No se generó una copia incompleta.`);
    }
    return null;
  }
  if (new TextEncoder().encode(text).length > MAX_LRC_BYTES) throw new Error(`LRC demasiado grande en «${playlistTitle}» / «${track.title}».`);
  return { fileName, mimeType: "text/plain", text, source };
}

export async function makePlaylistBackupV2(playlists, type, { single = false, allowRemoteLyrics = false } = {}) {
  if (!Array.isArray(playlists)) throw new Error("Las playlists no están disponibles; no se ha generado el respaldo.");
  const result = [];
  let lyricsCount = 0;
  for (const playlist of playlists) {
    if (!Array.isArray(playlist.tracks)) throw new Error(`Pistas inválidas en «${playlist.title}».`);
    const tracks = [];
    for (const track of playlist.tracks) {
      const lyrics = await readLyrics(track, playlist.title, { allowRemoteLyrics });
      if (lyrics) lyricsCount += 1;
      // El ZIP v2 incluye el texto LRC: nunca necesita IDs ni URLs de Convex.
      const { lyricsUri, lyricsUrl, lyricsStorageId, lyricsKey, ...persistentTrack } = track;
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

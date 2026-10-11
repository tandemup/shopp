// Importación conservadora de respaldos v2. Nunca elimina datos de Convex.
import { parseYouTubeUrl } from '@/src/services/urlSafety';
import { getLocalLyrics, saveLocalLyrics } from '@/src/storage/lyricsStorage';
const MAX_LRC_BYTES = 512 * 1024;
const utf8Size = (str) => new TextEncoder().encode(str).length;

export function validatePlaylistBackupV2(payload, expectedType, { minimumTracks = 1, maximumTracks = 1000 } = {}) {
  if (!payload || payload.app !== 'Shopp' || payload.version !== 2 || payload.backupStatus !== 'complete')
    throw new Error('El archivo no es un respaldo Shopp v2 completo.');
  if (payload.type !== expectedType) throw new Error('El tipo del respaldo no corresponde a esta utilidad.');
  const isList = expectedType.endsWith('playlists');
  const entries = isList ? payload.playlists : [payload];
  if (!Array.isArray(entries) || (!isList && !entries[0])) throw new Error('No hay playlists válidas en el respaldo.');
  const parsed = entries.map((playlist, p) => {
    if (!playlist || typeof playlist.title !== 'string' || !playlist.title.trim() || !Array.isArray(playlist.tracks) ||
        playlist.tracks.length < minimumTracks || playlist.tracks.length > maximumTracks)
      throw new Error(`Playlist ${p + 1}: título o número de elementos no válido.`);
    const tracks = playlist.tracks.map((track, i) => {
      if (!track || typeof track !== 'object') throw new Error(`Elemento ${i+1} no válido.`);
      const kind = track.kind === 'album' ? 'album' : 'single';
      const parsedUrl = parseYouTubeUrl(String(track.url || (kind === 'album' ? `https://www.youtube.com/playlist?list=${track.playlistId || ''}` : `https://www.youtube.com/watch?v=${track.videoId || ''}`)));
      if (!parsedUrl.isValid || (kind === 'album' ? !parsedUrl.playlistId : !parsedUrl.videoId))
        throw new Error(`URL no válida en «${playlist.title}», elemento ${i+1}.`);
      const backup = track.lyricsBackup;
      if (backup != null && (typeof backup.text !== 'string' || utf8Size(backup.text) > MAX_LRC_BYTES ||
          typeof backup.fileName !== 'string' || !backup.fileName.toLowerCase().endsWith('.lrc')))
        throw new Error(`LRC inválido en «${playlist.title}», elemento ${i+1}.`);
      if (!backup && (track.lyricsStorageId || track.lyricsFileName || track.lyricsSize))
        throw new Error(`Faltan letras LRC en «${playlist.title}», elemento ${i+1}.`);
      return {
        kind,
        videoId: parsedUrl.videoId || undefined,
        playlistId: parsedUrl.playlistId || undefined,
        title: String(track.title || '').trim() || `Elemento ${i+1}`,
        lyricsBackup: backup || null,
      };
    });
    return {
      title: playlist.title.trim(), tracks, shareable: playlist.shareable === true,
      collectionType: expectedType.includes('classical') ? 'classical' : 'playlist',
      ...Object.fromEntries(['composer','performer','conductor','orchestra','period','year'].map(k => [k, String(playlist[k] || '')])),
    };
  });
  const actualLyrics = parsed.reduce((n,p) => n+p.tracks.filter(t=>t.lyricsBackup).length,0);
  if (payload.lyricsEntries !== actualLyrics)
    throw new Error(`El respaldo declara ${payload.lyricsEntries} letras pero contiene ${actualLyrics}.`);
  return parsed;
}

export async function importPlaylistBackupV2({ playlists, existing = [], clientId, createPlaylist, generateUploadUrl, setPlaylistShareable }) {
  const signatures = new Set(existing.map(p => `${p.title.toLowerCase()}|${p.tracks.map(t=>t.videoId || t.playlistId).join(',')}`));
  let added = 0, skipped = 0, lyricsRestored = 0;
  // No se reutilizan los IDs de archivo Convex del origen: se sube una copia nueva.
  for (const playlist of playlists) {
    const signature = `${playlist.title.toLowerCase()}|${playlist.tracks.map(t=>t.videoId || t.playlistId).join(',')}`;
    if (signatures.has(signature)) {
      // Una playlist duplicada puede existir en Convex aunque este navegador
      // todavía no tenga las letras en IndexedDB (Safari y Chrome aíslan sus
      // datos locales). Restaurar las LRC que faltan sin crear otra playlist.
      for (const track of playlist.tracks) {
        if (!track.lyricsBackup) continue;
        const current = await getLocalLyrics(track);
        if (String(current?.text || '').trim()) continue;
        await saveLocalLyrics(track, track.lyricsBackup.text, {
          fileName: track.lyricsBackup.fileName,
        });
        lyricsRestored++;
      }
      skipped++;
      continue;
    }
    const tracks = [];
    for (const track of playlist.tracks) {
      const { lyricsBackup, ...clean } = track;
      if (lyricsBackup) {
        const uploadUrl = await generateUploadUrl();
        const bytes = new TextEncoder().encode(lyricsBackup.text);
        const response = await fetch(uploadUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: new Blob([bytes], { type: 'text/plain' }) });
        if (!response.ok) throw new Error(`No se pudo subir LRC (${response.status}).`);
        const uploaded = await response.json();
        if (!uploaded.storageId) throw new Error('Convex no devolvió el ID del archivo LRC.');
        clean.lyricsStorageId = uploaded.storageId;
        clean.lyricsFileName = lyricsBackup.fileName;
        clean.lyricsMimeType = 'text/plain';
        clean.lyricsSize = bytes.byteLength;
      }
      tracks.push(clean);
    }
    const createdId = await createPlaylist({ clientId, title: playlist.title, collectionType: playlist.collectionType,
      ...(playlist.collectionType === 'classical' ? Object.fromEntries(['composer','performer','conductor','orchestra','period','year'].map(k => [k, playlist[k]])) : {}),
      tracks });
    if (playlist.shareable && createdId && setPlaylistShareable) {
      await setPlaylistShareable({ playlistId: createdId, clientId, shareable: true });
    }
    // La copia local es adicional; Convex mantiene su propio LRC restaurado.
    for (const track of playlist.tracks) {
      if (track.lyricsBackup) {
        const current = await getLocalLyrics(track);
        if (!String(current?.text || '').trim()) {
          await saveLocalLyrics(track, track.lyricsBackup.text, {
            fileName: track.lyricsBackup.fileName,
          });
          lyricsRestored++;
        }
      }
    }
    signatures.add(signature); added++;
  }
  return { added, skipped, lyricsRestored };
}

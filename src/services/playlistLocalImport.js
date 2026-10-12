// All playlist and LRC writes are committed atomically in IndexedDB.
// A failed import never leaves half a collection behind.
import * as repository from "@/src/storage/playlists/playlistRepository";
import { getLyricsStorageKey } from "@/src/storage/lyricsStorage";

const length = value => new TextEncoder().encode(String(value || "")).length;
export async function importPlaylistsLocally({ playlists, collection, replace = false }) {
  if (!["playlist", "classical"].includes(collection)) throw new Error("Colección local incorrecta");
  const lyricsByKey = new Map();
  const prepared = playlists.map(playlist => {
    if (playlist.collectionType !== collection) throw new Error("El respaldo corresponde a otra colección.");
    return {
      title: playlist.title,
      collectionType: collection,
      shareable: playlist.shareable === true,
      ...(collection === 'classical'
        ? Object.fromEntries(['composer', 'performer', 'conductor', 'orchestra', 'period', 'year'].map(k => [k, playlist[k] || '']))
        : {}),
      tracks: playlist.tracks.map(track => {
        const { lyricsBackup, ...clean } = track;
        if (lyricsBackup) {
          const key = getLyricsStorageKey(track);
          const record = {
            text: lyricsBackup.text, fileName: lyricsBackup.fileName,
            mimeType: 'text/plain', updatedAt: Date.now(),
            videoId: track.videoId || null, playlistId: track.playlistId || null,
          };
          const previous = lyricsByKey.get(key);
          if (previous && (previous.record.text !== record.text || previous.record.fileName !== record.fileName)) {
            throw new Error(`El respaldo contiene letras LRC contradictorias para ${track.title}.`);
          }
          lyricsByKey.set(key, { key, record });
          return {
            ...clean, lyricsFileName: record.fileName,
            lyricsMimeType: 'text/plain', lyricsSize: length(record.text),
          };
        }
        return clean;
      }),
    };
  });
  return repository.importBatch(collection, prepared, [...lyricsByKey.values()], { replace });
}

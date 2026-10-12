// All playlist and LRC writes are committed atomically in IndexedDB.
// A failed import never leaves half a collection behind.
import * as repository from "@/src/storage/playlists/playlistRepository";
import { newLyricsStorageKey } from "@/src/storage/lyricsStorage";

const length = value => new TextEncoder().encode(String(value || "")).length;
export async function importPlaylistsLocally({ playlists, collection, replace = false }) {
  if (!["playlist", "classical"].includes(collection)) throw new Error("Colección local incorrecta");
  const lyricsByKey = [];
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
          const key = newLyricsStorageKey();
          const record = {
            text: lyricsBackup.text, fileName: lyricsBackup.fileName,
            mimeType: 'text/plain', updatedAt: Date.now(),
            videoId: track.videoId || null, playlistId: track.playlistId || null,
          };
          lyricsByKey.push({ key, record });
          return {
            ...clean, lyricsKey: key, lyricsDisabled: false,
            lyricsFileName: record.fileName,
            lyricsMimeType: 'text/plain', lyricsSize: length(record.text),
          };
        }
        // Preserve explicit per-playlist removal, not the source device key.
        const { lyricsKey, ...portable } = clean;
        return { ...portable, lyricsDisabled: true };
      }),
    };
  });
  return repository.importBatch(collection, prepared, lyricsByKey, { replace });
}

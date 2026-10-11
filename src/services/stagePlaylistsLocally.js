// Phase 3: stage a complete JSON v2 into IndexedDB, without writing to Convex.
// The active playlists UI still reads Convex until explicit cutover.
import { validatePlaylistBackupV2 } from '@/src/services/playlistImportV2';
import * as repo from '@/src/storage/playlists/playlistRepository';
import { getLyricsStorageKey, getLocalLyrics } from '@/src/storage/lyricsStorage';

const typeOf = collection => collection === 'classical'
  ? 'shopp-youtube-classical-playlists' : 'shopp-youtube-playlists';
const originalId = (item, index) => String(item._id || item.id || `legacy-${index}`);
const localId = (collection, original, index) =>
  `${collection}-${String(original || `legacy-${index}`).replace(/[^A-Za-z0-9_-]/g, '_')}`;
const identical = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const relevantTrack = track => ({
  kind: track.kind, videoId: track.videoId || null,
  playlistId: track.playlistId || null, title: track.title,
  url: track.url || null, lyricsFileName: track.lyricsFileName || null,
});
const relevantPlaylist = item => ({
  id: item.id, title: item.title, collectionType: item.collectionType,
  shareable: item.shareable === true, createdAt: item.createdAt,
  updatedAt: item.updatedAt,
  tracks: item.tracks.map(relevantTrack),
  ...Object.fromEntries(['composer','performer','conductor','orchestra','period','year']
    .map(k => [k, item[k] || ''])),
});

export async function stagePlaylistBackupV2Locally(payload, collection) {
  if (!['playlist', 'classical'].includes(collection)) throw new Error('Colección inválida');
  if (!Array.isArray(payload?.playlists)) throw new Error('Selecciona un respaldo completo JSON v2 (Exportar todo).');
  const normalized = validatePlaylistBackupV2(payload, typeOf(collection), {
    minimumTracks: 1, maximumTracks: 1000,
  });
  const items = normalized.map((item, i) => {
    const source = payload.playlists[i];
    const id = localId(collection, originalId(source, i), i);
    return {
      ...source, ...item, id, _id: id, sourceConvexId: source._id || null,
      createdAt: source.createdAt || 0, updatedAt: source.updatedAt || 0,
      tracks: item.tracks.map((track, j) => {
        const originalTrack = source.tracks[j];
        const { lyricsBackup: ignored, lyricsUri: ignoredUri, lyricsUrl: ignoredUrl,
          lyricsStorageId: ignoredStorage, ...persisted } = originalTrack;
        return {
          ...persisted, ...track,
          lyricsBackup: undefined,
          lyricsFileName: track.lyricsBackup?.fileName || persisted.lyricsFileName,
          lyricsUri: undefined, lyricsUrl: undefined, lyricsStorageId: undefined,
        };
      }),
    };
  });
  if (new Set(items.map(x => x.id)).size !== items.length) {
    throw new Error('Hay identificadores repetidos en el respaldo: no se modificó IndexedDB.');
  }
  // Local lyrics may be shared by many playlists with the same video ID.
  const lyricsMap = new Map();
  for (const playlist of normalized) for (const track of playlist.tracks) {
    if (!track.lyricsBackup) continue;
    const key = getLyricsStorageKey(track);
    const { text, fileName } = track.lyricsBackup;
    const prior = lyricsMap.get(key);
    if (prior && (prior.record.text !== text || prior.record.fileName !== fileName)) {
      throw new Error(`Hay dos LRC distintos para la misma canción (${key}).`);
    }
    lyricsMap.set(key, { key, track, record: {
      text, fileName, mimeType: 'text/plain', updatedAt: Date.now(),
      videoId: track.videoId || null, playlistId: track.playlistId || null,
    }});
  }
  const lyrics = [...lyricsMap.values()];
  const before = await repo.list(collection);
  if (before.length) throw new Error('Ya hay playlists locales de esta colección. No se sobrescribió nada.');
  for (const { track, record } of lyrics) {
    const existing = await getLocalLyrics(track);
    if (existing && (existing.text !== record.text || existing.fileName !== record.fileName)) {
      throw new Error(`El dispositivo ya tiene otras letras para ${getLyricsStorageKey(track)}. Se cancela para protegerlas.`);
    }
  }
  const migrationId = `${collection}-${payload.exportedAt || Date.now()}`;
  await repo.stageBackup(collection, items, lyrics, migrationId);
  const actual = await repo.list(collection);
  const expectedById = new Map(items.map(p => [p.id, relevantPlaylist(p)]));
  if (actual.length !== items.length || actual.some(p => !expectedById.has(p.id) ||
      !identical(relevantPlaylist(p), expectedById.get(p.id)))) {
    throw new Error('La verificación del contenido de playlists ha fallado: NO activar almacenamiento local.');
  }
  for (const { track, record } of lyrics) {
    const actualLrc = await getLocalLyrics(track);
    if (!actualLrc || actualLrc.text !== record.text || actualLrc.fileName !== record.fileName) {
      throw new Error('La verificación de letras LRC ha fallado: NO activar almacenamiento local.');
    }
  }
  return { collection, verified: true, verifiedCount: actual.length,
    verifiedTracks: actual.reduce((sum,p) => sum+p.tracks.length,0),
    verifiedLyrics: lyrics.length, migrationId };
}

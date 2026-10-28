// Deliberately explicit: called only by a user-initiated action.
// Requires ConvexClient-like {query,mutation} and generated api.musicSync.
import * as repository from '@/src/storage/playlists/playlistRepository';

export async function previewManualSync(client, api) {
  const [music, classical, remote] = await Promise.all([
    repository.list('playlist'), repository.list('classical'),
    client.query(api.musicSync.inventory, {}),
  ]);
  const local = [...music, ...classical];
  const server = new Map(remote.map(row => [row.localId, row]));
  const localIds = new Set(local.map(row => row.id));
  return {
    localOnly: local.filter(row => !server.has(row.id)).map(row => ({id:row.id,title:row.title,collectionType:row.collectionType})),
    remoteOnly: remote.filter(row => !localIds.has(row.localId) && !row.deletedAt),
    requiresReview: local.filter(row => server.has(row.id)).map(row => ({
      id:row.id,title:row.title,serverRevision:server.get(row.id).revision,
      reason:'Revisión local/servidor no verificada; comparar antes de subir',
    })),
  };
}

// New remote IDs only. Must be invoked after an explicit backup and user confirmation.
// Existing IDs always require separate reconciliation; LRC files are NOT uploaded here.
export async function uploadNewPlaylistManual(client, api, id) {
  const playlist = await repository.get(id);
  if (!playlist) throw new Error('Playlist no encontrada');
  if (!['playlist','classical'].includes(playlist.collectionType)) throw new Error('Colección inválida');
  if (playlist.tracks.some(track => track.lyricsKey || track.lyricsStorageId || track.lyricsFileName || track.lyricsSize)) {
    throw new Error('Esta playlist tiene letras LRC: exporta su respaldo y utiliza el protocolo de transferencia de letras antes de subirla');
  }
  // Preserving correctness: do not silently discard any metadata when sending snapshots.
  return client.mutation(api.musicSync.uploadManual, {
    localId:playlist.id, collectionType:playlist.collectionType,
    expectedRevision:0, snapshot:playlist,
  });
}

import { apiClient } from '../../httpClient';

const request = (path, accessToken, options = {}) =>
  apiClient.request(path, { ...options, accessToken });

// Leave room below the Express limit for the JSON wrapper.
const MAX_BATCH_BYTES = 11 * 1024 * 1024;

function syncBatches(playlists) {
  const batches = [[]];
  const encoder = new TextEncoder();
  let batch = batches[0];
  let bytes = 20;
  for (const playlist of playlists) {
    const size = encoder.encode(JSON.stringify(playlist)).length + 1;
    if (size + 20 > MAX_BATCH_BYTES) {
      throw new Error(`«${playlist.title}» supera el tamaño de sincronización. Usa imágenes más pequeñas o divide la lista.`);
    }
    if (batch.length >= 500 || bytes + size > MAX_BATCH_BYTES) {
      batch = [];
      batches.push(batch);
      bytes = 20;
    }
    batch.push(playlist);
    bytes += size;
  }
  return batches;
}

export function createPlaylistsApi(path) {
  return Object.freeze({
    async list(accessToken) {
      const result = await request(path, accessToken);
      return result.playlists || [];
    },
    async sync(accessToken, playlists) {
      const conflicts = new Set();
      let result;
      const batches = syncBatches(playlists);
      for (const [index, batch] of batches.entries()) {
        result = await request(`${path}/sync`, accessToken, {
          method: 'POST',
          body: { playlists: batch, returnPlaylists: index === batches.length - 1 },
        });
        for (const id of result.conflicts || []) conflicts.add(id);
      }
      return { playlists: result.playlists || [], conflicts: [...conflicts], deletedIds: result.deletedIds || [] };
    },
    remove(accessToken, playlistId) {
      return request(`${path}/${encodeURIComponent(playlistId)}`, accessToken, { method: 'DELETE' });
    },
  });
}


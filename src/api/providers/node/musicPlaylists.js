import { apiClient } from '../../httpClient';

const request = (path, accessToken, options = {}) =>
  apiClient.request(path, { ...options, accessToken });

export const nodeMusicPlaylistsApi = Object.freeze({
  async list(accessToken) {
    const result = await request('api/v1/music-playlists', accessToken);
    return result.playlists || [];
  },
  async sync(accessToken, playlists) {
    const result = await request('api/v1/music-playlists/sync', accessToken, {
      method: 'POST',
      body: { playlists },
    });
    return { playlists: result.playlists || [], conflicts: result.conflicts || [], deletedIds: result.deletedIds || [] };
  },
  remove(accessToken, playlistId) {
    return request(`api/v1/music-playlists/${encodeURIComponent(playlistId)}`, accessToken, { method: 'DELETE' });
  },
});

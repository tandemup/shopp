import { API_BASE_URL } from '../../config';
import { apiClient } from '../../httpClient';
import { nodeRealtimeApi } from './realtime';

export function nodeChatMediaUrl(value) {
  if (typeof value !== 'string' || !value.startsWith('/api/v1/chat/media/')) return undefined;
  const base = new URL(API_BASE_URL);
  const url = new URL(value, base);
  if (url.origin === base.origin && url.pathname.startsWith('/api/v1/chat/media/')) return url.href;
  return undefined;
}

export const nodeChatApi = Object.freeze({
  listRooms(accessToken, signal) {
    return apiClient.request('api/v1/chat/rooms', { accessToken, signal });
  },

  createRoom(accessToken, label, getOrCreate = false) {
    return apiClient.request('api/v1/chat/rooms', { method: 'POST', accessToken, body: { label, getOrCreate } });
  },

  deleteRoom(accessToken, roomId) {
    return apiClient.request(`api/v1/chat/rooms/${encodeURIComponent(roomId)}`, { method: 'DELETE', accessToken });
  },

  listMessages(accessToken, { room = 'compras', limit = 100, beforeId, signal } = {}) {
    const params = new URLSearchParams({ room, limit: String(limit) });
    if (beforeId) params.set('beforeId', String(beforeId));
    return apiClient.request(`api/v1/chat/messages?${params}`, { accessToken, signal });
  },

  sendMessage(accessToken, { room = 'compras', text, username, images, files, keepIndefinitely = false }) {
    return apiClient.request('api/v1/chat/messages', {
      method: 'POST', accessToken,
      body: { room, text, username, images, files, keepIndefinitely },
    });
  },

  deleteMessage(accessToken, messageId) {
    return apiClient.request(`api/v1/chat/messages/${encodeURIComponent(messageId)}`, {
      method: 'DELETE', accessToken,
    });
  },

  async getUploadUrl(accessToken) {
    const { path } = await apiClient.request('api/v1/chat/attachments', { method: 'POST', accessToken });
    return nodeChatMediaUrl(path);
  },

  createYouTubePlaylist(accessToken, body) {
    return apiClient.request('api/v1/chat/youtube-playlists', { method: 'POST', accessToken, body });
  },

  updateYouTubePlaylist(accessToken, { messageId, ...body }) {
    return apiClient.request(`api/v1/chat/youtube-playlists/${encodeURIComponent(messageId)}`, { method: 'PATCH', accessToken, body });
  },

  updateYouTubeAlbum(accessToken, { messageId, ...body }) {
    return apiClient.request(`api/v1/chat/youtube-albums/${encodeURIComponent(messageId)}`, { method: 'PATCH', accessToken, body });
  },

  sharePlaylist(accessToken, body) {
    return apiClient.request('api/v1/chat/shared-playlists', { method: 'POST', accessToken, body });
  },

  getSharedPlaylist(accessToken, messageId) {
    return apiClient.request(`api/v1/chat/shared-playlists/${encodeURIComponent(messageId)}`, { accessToken });
  },

  refreshNews(accessToken) {
    return apiClient.request('api/v1/chat/news/refresh', { method: 'POST', accessToken });
  },

  connect(accessToken, options) { return nodeRealtimeApi.connect(accessToken, options); },

  subscribe(socket, rooms) {
    if (!socket || socket.readyState !== 1) throw new Error('El WebSocket todavía no está conectado.');
    socket.send(JSON.stringify({ type: 'subscribe', rooms: Array.isArray(rooms) ? rooms : [rooms] }));
  },
});

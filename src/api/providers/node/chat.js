import { apiClient } from '../../httpClient';
import { nodeRealtimeApi } from './realtime';

export const nodeChatApi = Object.freeze({
  listMessages(accessToken, { room = 'compras', limit = 100, beforeId } = {}) {
    const params = new URLSearchParams({ room, limit: String(limit) });
    if (beforeId) params.set('beforeId', String(beforeId));
    return apiClient.request(`api/v1/chat/messages?${params}`, { accessToken });
  },

  sendMessage(accessToken, { room = 'compras', text, username, keepIndefinitely = false }) {
    return apiClient.request('api/v1/chat/messages', {
      method: 'POST', accessToken,
      body: { room, text, username, keepIndefinitely },
    });
  },

  deleteMessage(accessToken, messageId) {
    return apiClient.request(`api/v1/chat/messages/${encodeURIComponent(messageId)}`, {
      method: 'DELETE', accessToken,
    });
  },

  connect(accessToken, options) { return nodeRealtimeApi.connect(accessToken, options); },

  subscribe(socket, rooms) {
    if (!socket || socket.readyState !== 1) throw new Error('El WebSocket todavía no está conectado.');
    socket.send(JSON.stringify({ type: 'subscribe', rooms: Array.isArray(rooms) ? rooms : [rooms] }));
  },
});

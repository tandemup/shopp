import { API_BASE_URL } from '../../config';
import { apiClient } from '../../httpClient';

/**
 * Opens an authenticated realtime connection. The short-lived ticket is consumed
 * once during the WebSocket handshake; the regular session token is never sent
 * in the URL or in WebSocket frames.
 */
export const nodeRealtimeApi = Object.freeze({
  async connect(accessToken, { WebSocketImpl = globalThis.WebSocket } = {}) {
    if (!accessToken) throw new Error('Se necesita una sesión para conectar.');
    if (typeof WebSocketImpl !== 'function') throw new Error('Este entorno no dispone de WebSocket.');
    const { ticket } = await apiClient.request('api/v1/realtime/ticket', {
      method: 'POST', accessToken,
    });
    const endpoint = new URL(API_BASE_URL);
    endpoint.protocol = endpoint.protocol === 'https:' ? 'wss:' : 'ws:';
    endpoint.pathname = '/ws';
    endpoint.search = '';
    endpoint.hash = '';
    endpoint.searchParams.set('ticket', ticket);
    return new WebSocketImpl(endpoint.toString());
  },
});

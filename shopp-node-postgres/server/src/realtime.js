import { WebSocketServer, WebSocket } from 'ws';
import { URL } from 'node:url';
import { pool } from './db.js';
import { digestToken } from './security.js';
import { config } from './config.js';

const HEARTBEAT_MS = 30_000;
const MAX_PAYLOAD = 8 * 1024;

export function attachRealtime(server) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_PAYLOAD, perMessageDeflate: false });
  let closing = false;

  server.on('upgrade', async (request, socket, head) => {
    const reject = (status, message) => {
      if (socket.destroyed) return;
      socket.write(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\n\r\n`);
      socket.destroy();
    };
    if (closing) return reject(503, 'Service Unavailable');
    let url;
    try { url = new URL(request.url, 'http://localhost'); }
    catch { return reject(400, 'Bad Request'); }
    if (url.pathname !== '/ws') return reject(404, 'Not Found');
    const origin = request.headers.origin;
    if (origin && !config.corsOrigins.includes(origin)) return reject(403, 'Forbidden');
    const ticket = url.searchParams.get('ticket');
    if (!ticket || !/^[A-Za-z0-9_-]{40,60}$/.test(ticket)) return reject(401, 'Unauthorized');

    try {
      // Consume once and re-check that the issuing session is still live.
      const { rows } = await pool.query(
        `DELETE FROM realtime_tickets t
         USING auth_sessions s, app_users u
         WHERE t.token_hash = $1 AND t.session_id = s.id AND s.user_id = u.id
           AND t.expires_at > NOW() AND s.revoked_at IS NULL AND s.expires_at > NOW()
           AND u.status <> 'blocked'
         RETURNING u.id, u.email, u.name, u.role`,
        [digestToken(ticket)],
      );
      const user = rows[0];
      if (!user) return reject(401, 'Unauthorized');
      wss.handleUpgrade(request, socket, head, (ws) => {
        ws.user = user;
        wss.emit('connection', ws, request);
      });
    } catch (error) {
      console.error('No se pudo autenticar WebSocket:', error.message);
      reject(503, 'Service Unavailable');
    }
  });

  wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
    ws.send(JSON.stringify({ type: 'connected', user: { id: ws.user.id, name: ws.user.name, role: ws.user.role } }));
    ws.on('message', (data, isBinary) => {
      if (isBinary) return ws.close(1003, 'Solo se admite JSON');
      let message;
      try { message = JSON.parse(data.toString()); }
      catch { return ws.close(1007, 'JSON no válido'); }
      if (message?.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', at: new Date().toISOString() }));
      } else {
        ws.send(JSON.stringify({ type: 'error', code: 'unsupported_message' }));
      }
    });
  });

  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) { ws.terminate(); continue; }
      ws.isAlive = false;
      ws.ping();
    }
  }, HEARTBEAT_MS);
  heartbeat.unref();

  return {
    async close() {
      closing = true;
      clearInterval(heartbeat);
      for (const ws of wss.clients) ws.close(1001, 'Servidor cerrándose');
      await new Promise((resolve) => wss.close(resolve));
    },
  };
}

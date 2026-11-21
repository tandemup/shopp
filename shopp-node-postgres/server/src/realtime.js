import { WebSocketServer, WebSocket } from 'ws';
import { URL } from 'node:url';
import { pool } from './db.js';
import { digestToken } from './security.js';
import { config } from './config.js';

const HEARTBEAT_MS = 30_000;
const MAX_PAYLOAD = 8 * 1024;
const CHAT_CHANNEL = 'shopp_chat_events';
let activeRealtime = null;

export async function publishChatEvent(room, event) {
  const payload = JSON.stringify({ room, ...event });
  try {
    await pool.query('SELECT pg_notify($1, $2)', [CHAT_CHANNEL, payload]);
  } catch (error) {
    console.error('No se pudo publicar el aviso de chat:', error.message);
  }
}

export async function attachRealtime(server) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_PAYLOAD, perMessageDeflate: false });
  let closing = false;
  const realtimeApi = {
    publishChatEvent(room, event) {
      const payload = JSON.stringify(event);
      for (const ws of wss.clients) {
        if (ws.readyState === WebSocket.OPEN && ws.rooms?.has(room)) ws.send(payload);
      }
    },
  };
  activeRealtime = realtimeApi;
  let listener = null;
  let listenerRetry = null;

  const onNotification = async ({ payload }) => {
    let event;
    try { event = JSON.parse(payload); }
    catch { return; }
    if (!event || typeof event.room !== 'string' || typeof event.type !== 'string') return;
    if (event.type === 'chat.message.created') {
      try {
        const { rows } = await pool.query(
          `SELECT id, user_id, room, username, text, created_at, expires_at
           FROM chat_messages WHERE id = $1 AND status = 'visible'
             AND (expires_at IS NULL OR expires_at > NOW())`,
          [event.messageId],
        );
        const row = rows[0];
        if (!row) return;
        event.message = {
          id: String(row.id), room: row.room, username: row.username, text: row.text,
          userId: row.user_id, createdAt: new Date(row.created_at).getTime(),
          expiresAt: row.expires_at ? new Date(row.expires_at).getTime() : null,
        };
      } catch (error) {
        console.error('No se pudo cargar el mensaje para difundirlo:', error.message);
        return;
      }
    }
    realtimeApi.publishChatEvent(event.room, event);
  };

  const connectListener = async () => {
    if (closing || listener) return;
    try {
      const client = await pool.connect();
      listener = client;
      client.on('notification', onNotification);
      const onDisconnect = (error) => {
        if (listener !== client) return;
        listener = null;
        client.release(error);
        if (!closing && !listenerRetry) {
          listenerRetry = setTimeout(() => {
            listenerRetry = null;
            connectListener().catch((retryError) => console.error('No se pudo reabrir LISTEN de chat:', retryError.message));
          }, 5_000);
          listenerRetry.unref();
        }
      };
      client.once('error', onDisconnect);
      client.once('end', () => onDisconnect());
      await client.query(`LISTEN ${CHAT_CHANNEL}`);
    } catch (error) {
      if (listener) { listener.release(error); listener = null; }
      console.error('No se pudo activar LISTEN de chat:', error.message);
      if (!closing && !listenerRetry) {
        listenerRetry = setTimeout(() => {
          listenerRetry = null;
          connectListener().catch((retryError) => console.error('No se pudo reabrir LISTEN de chat:', retryError.message));
        }, 5_000);
        listenerRetry.unref();
      }
    }
  };
  await connectListener();

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
           AND (u.role = 'admin' OR u.permissions->>'chat' = 'true')
         RETURNING s.id AS session_id, u.id, u.email, u.name, u.role`,
        [digestToken(ticket)],
      );
      const user = rows[0];
      if (!user) return reject(401, 'Unauthorized');
      wss.handleUpgrade(request, socket, head, (ws) => {
        ws.user = user;
        ws.sessionId = user.session_id;
        wss.emit('connection', ws, request);
      });
    } catch (error) {
      console.error('No se pudo autenticar WebSocket:', error.message);
      reject(503, 'Service Unavailable');
    }
  });

  wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.rooms = new Set();
    ws.on('pong', () => { ws.isAlive = true; });
    ws.send(JSON.stringify({ type: 'connected', user: { id: ws.user.id, name: ws.user.name, role: ws.user.role } }));
    ws.on('message', (data, isBinary) => {
      if (isBinary) return ws.close(1003, 'Solo se admite JSON');
      let message;
      try { message = JSON.parse(data.toString()); }
      catch { return ws.close(1007, 'JSON no válido'); }
      if (message?.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', at: new Date().toISOString() }));
      } else if (message?.type === 'subscribe' && Array.isArray(message.rooms)) {
        const rooms = message.rooms.filter((room) => typeof room === 'string' && /^[a-z0-9_-]{1,50}$/.test(room)).slice(0, 25);
        ws.rooms = new Set(rooms);
        ws.send(JSON.stringify({ type: 'subscribed', rooms }));
      } else {
        ws.send(JSON.stringify({ type: 'error', code: 'unsupported_message' }));
      }
    });
  });

  const heartbeat = setInterval(async () => {
    const sockets = [...wss.clients].filter((ws) => ws.readyState === WebSocket.OPEN);
    if (!sockets.length) return;
    try {
      const sessionIds = sockets.map((ws) => ws.sessionId);
      const { rows } = await pool.query(
        `SELECT s.id FROM auth_sessions s JOIN app_users u ON u.id = s.user_id
         WHERE s.id = ANY($1::bigint[]) AND s.revoked_at IS NULL AND s.expires_at > NOW()
           AND u.status <> 'blocked' AND (u.role = 'admin' OR u.permissions->>'chat' = 'true')`,
        [sessionIds],
      );
      const valid = new Set(rows.map((row) => String(row.id)));
      for (const ws of sockets) {
        if (!valid.has(String(ws.sessionId)) || !ws.isAlive) { ws.terminate(); continue; }
        ws.isAlive = false;
        ws.ping();
      }
    } catch (error) {
      console.error('No se pudieron comprobar las sesiones WebSocket:', error.message);
    }
  }, HEARTBEAT_MS);
  heartbeat.unref();

  return {
    async close() {
      closing = true;
      if (activeRealtime === realtimeApi) activeRealtime = null;
      if (listenerRetry) clearTimeout(listenerRetry);
      listenerRetry = null;
      if (listener) {
        const current = listener;
        listener = null;
        await current.query('UNLISTEN *').catch(() => {});
        current.release();
      }
      clearInterval(heartbeat);
      for (const ws of wss.clients) ws.close(1001, 'Servidor cerrándose');
      await new Promise((resolve) => wss.close(resolve));
    },
  };
}

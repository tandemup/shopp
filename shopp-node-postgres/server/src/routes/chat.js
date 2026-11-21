import { Router } from 'express';
import { pool } from '../db.js';
import { requireAdmin, requireAuth, requireFeature } from '../middleware/auth.js';
import { publishChatEvent } from '../realtime.js';

export const chatRouter = Router();
chatRouter.use(requireAuth, requireFeature('chat'));

const cleanRoom = (value) => String(value || 'compras').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 50) || 'compras';
const cleanUsername = (value, fallback) => String(value || fallback || 'anonymous').trim().slice(0, 40) || 'anonymous';
const mapRoom = (row) => ({ id: row.id, label: row.label, builtin: row.builtin, count: Number(row.message_count) || 0 });
const mapMessage = (row) => ({
  id: String(row.id), room: row.room, username: row.username, text: row.text,
  userId: row.user_id, createdAt: new Date(row.created_at).getTime(),
  expiresAt: row.expires_at ? new Date(row.expires_at).getTime() : null,
});

chatRouter.get('/rooms', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.id, r.label, r.builtin, COUNT(m.id)::integer AS message_count
       FROM chat_rooms r
       LEFT JOIN chat_messages m ON m.room = r.id AND m.status = 'visible'
         AND (m.expires_at IS NULL OR m.expires_at > NOW())
       GROUP BY r.id, r.label, r.builtin
       ORDER BY r.builtin DESC, r.label ASC
       LIMIT 100`,
    );
    res.json({ rooms: rows.map(mapRoom) });
  } catch (error) { next(error); }
});

chatRouter.post('/rooms', async (req, res, next) => {
  const label = typeof req.body?.label === 'string' ? req.body.label.replace(/^#+\s*/, '').trim().slice(0, 45) : '';
  const slug = label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const id = `custom-${slug}`;
  if (!label || !slug || id.length > 50) {
    return res.status(400).json({ error: { code: 'invalid_room', message: 'Indica un nombre de sala válido (máximo 45 caracteres).' } });
  }
  try {
    const existing = await pool.query('SELECT id, label, builtin FROM chat_rooms WHERE id = $1', [id]);
    if (existing.rows[0]) return res.status(409).json({ error: { code: 'room_exists', message: 'Ya existe una sala con ese nombre.' } });
    const ownedCount = await pool.query('SELECT COUNT(*)::integer AS count FROM chat_rooms WHERE created_by = $1', [req.auth.user.id]);
    if (Number(ownedCount.rows[0].count) >= 25) return res.status(409).json({ error: { code: 'user_room_limit', message: 'Cada cuenta puede crear hasta 25 salas personalizadas.' } });
    const count = await pool.query('SELECT COUNT(*)::integer AS count FROM chat_rooms');
    if (Number(count.rows[0].count) >= 100) return res.status(409).json({ error: { code: 'room_limit', message: 'Se alcanzó el máximo de 100 salas.' } });
    const { rows } = await pool.query(
      'INSERT INTO chat_rooms (id, label, builtin, created_by) VALUES ($1, $2, FALSE, $3) RETURNING id, label, builtin',
      [id, label, req.auth.user.id],
    );
    const room = { ...rows[0], message_count: 0 };
    await publishChatEvent('global', { type: 'chat.room.created', roomData: mapRoom(room) });
    res.status(201).json({ room: mapRoom(room) });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: { code: 'room_exists', message: 'Ya existe una sala con ese nombre.' } });
    next(error);
  }
});

chatRouter.delete('/rooms/:roomId', requireAdmin, async (req, res, next) => {
  const room = String(req.params.roomId || '');
  if (!/^[a-z0-9_-]{1,50}$/.test(room)) return res.status(400).json({ error: { code: 'invalid_room', message: 'Identificador de sala no válido.' } });
  const client = await pool.connect();
  let deletedRoom = false;
  try {
    await client.query('BEGIN');
    const result = await client.query('SELECT id, label, builtin FROM chat_rooms WHERE id = $1 FOR UPDATE', [room]);
    const target = result.rows[0];
    if (!target) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: { code: 'room_not_found', message: 'La sala ya no existe.' } });
    }
    await client.query('DELETE FROM chat_messages WHERE room = $1', [room]);
    if (target.builtin) {
      await client.query('COMMIT');
    } else {
      await client.query('DELETE FROM chat_rooms WHERE id = $1', [room]);
      await client.query('COMMIT');
      deletedRoom = true;
    }
    await publishChatEvent('global', { type: deletedRoom ? 'chat.room.deleted' : 'chat.room.cleared', deletedRoomId: room });
    res.json({ ok: true, deletedRoom, clearedMessages: true });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    next(error);
  } finally {
    client.release();
  }
});

chatRouter.get('/messages', async (req, res, next) => {
  try {
    const room = cleanRoom(req.query.room);
    const exists = await pool.query('SELECT 1 FROM chat_rooms WHERE id = $1', [room]);
    if (!exists.rowCount) return res.status(404).json({ error: { code: 'room_not_found', message: 'La sala no existe.' } });
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 100, 1), 200);
    const beforeId = req.query.beforeId && /^\d{1,18}$/.test(String(req.query.beforeId))
      ? String(req.query.beforeId) : null;
    const { rows } = await pool.query(
      `SELECT id, user_id, room, username, text, created_at, expires_at
       FROM chat_messages WHERE room = $1 AND status = 'visible'
         AND (expires_at IS NULL OR expires_at > NOW())
         AND ($2::bigint IS NULL OR id < $2::bigint)
       ORDER BY id DESC LIMIT $3`,
      [room, beforeId, limit],
    );
    const nextBeforeId = rows.length === limit ? String(rows[rows.length - 1].id) : null;
    const messages = rows.reverse().map(mapMessage);
    res.json({ messages, nextBeforeId });
  } catch (error) { next(error); }
});

chatRouter.post('/messages', async (req, res, next) => {
  try {
    const room = cleanRoom(req.body?.room);
    const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
    const maxLength = room === 'youtube' ? 2048 : 280;
    if (!text || text.length > maxLength) {
      return res.status(400).json({ error: { code: 'invalid_message', message: `El mensaje debe tener entre 1 y ${maxLength} caracteres.` } });
    }
    const keepIndefinitely = req.body?.keepIndefinitely === true && req.auth.user.role === 'admin';
    const client = await pool.connect();
    let rows;
    try {
      await client.query('BEGIN');
      const exists = await client.query('SELECT id FROM chat_rooms WHERE id = $1 FOR SHARE', [room]);
      if (!exists.rowCount) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: { code: 'room_not_found', message: 'La sala no existe o ya fue eliminada.' } });
      }
      ({ rows } = await client.query(
      `INSERT INTO chat_messages (user_id, room, username, text, expires_at)
       VALUES ($1, $2, $3, $4, CASE WHEN $5 THEN NULL ELSE NOW() + INTERVAL '24 hours' END)
       RETURNING id, user_id, room, username, text, created_at, expires_at`,
      [req.auth.user.id, room, cleanUsername(req.body?.username, req.auth.user.name), text, keepIndefinitely],
      ));
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
    const message = mapMessage(rows[0]);
    await publishChatEvent(room, { type: 'chat.message.created', messageId: message.id });
    res.status(201).json({ message });
  } catch (error) { next(error); }
});

chatRouter.delete('/messages/:id', async (req, res, next) => {
  if (!/^\d{1,18}$/.test(req.params.id)) return res.status(400).json({ error: { code: 'invalid_id', message: 'Identificador no válido' } });
  try {
    const { rows } = await pool.query(
      `DELETE FROM chat_messages WHERE id = $1 AND ($3::boolean OR user_id = $2)
       RETURNING id, room`,
      [req.params.id, req.auth.user.id, req.auth.user.role === 'admin'],
    );
    if (!rows[0]) return res.status(404).json({ error: { code: 'not_found', message: 'Mensaje no encontrado o sin permiso para borrarlo' } });
    await publishChatEvent(rows[0].room, { type: 'chat.message.deleted', messageId: String(rows[0].id) });
    res.status(204).end();
  } catch (error) { next(error); }
});

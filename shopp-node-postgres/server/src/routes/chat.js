import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { publishChatEvent } from '../realtime.js';

export const chatRouter = Router();
chatRouter.use(requireAuth);

const cleanRoom = (value) => String(value || 'compras').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 50) || 'compras';
const cleanUsername = (value, fallback) => String(value || fallback || 'anonymous').trim().slice(0, 40) || 'anonymous';
const mapMessage = (row) => ({
  id: String(row.id), room: row.room, username: row.username, text: row.text,
  userId: row.user_id, createdAt: new Date(row.created_at).getTime(),
  expiresAt: row.expires_at ? new Date(row.expires_at).getTime() : null,
});

chatRouter.get('/messages', async (req, res, next) => {
  try {
    const room = cleanRoom(req.query.room);
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
    const { rows } = await pool.query(
      `INSERT INTO chat_messages (user_id, room, username, text, expires_at)
       VALUES ($1, $2, $3, $4, CASE WHEN $5 THEN NULL ELSE NOW() + INTERVAL '24 hours' END)
       RETURNING id, user_id, room, username, text, created_at, expires_at`,
      [req.auth.user.id, room, cleanUsername(req.body?.username, req.auth.user.name), text, keepIndefinitely],
    );
    const message = mapMessage(rows[0]);
    publishChatEvent(room, { type: 'chat.message.created', message });
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
    publishChatEvent(rows[0].room, { type: 'chat.message.deleted', messageId: String(rows[0].id) });
    res.status(204).end();
  } catch (error) { next(error); }
});

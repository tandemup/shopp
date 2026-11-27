import { Router } from 'express';
import { pool } from '../db.js';
import { requireAdmin, requireAuth, requireFeature } from '../middleware/auth.js';
import { publishChatEvent } from '../realtime.js';
import { addMediaUrls, attachMedia, attachment, ChatError, chatErrorHandler, createUploadPath } from './chatMedia.js';
import { chatPlaylist, refreshNewsDates, sharedPlaylist } from './chatContent.js';

export const chatRouter = Router();
chatRouter.use(requireAuth, requireFeature('chat'));

const cleanRoom = value => String(value || 'compras').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-').slice(0, 50) || 'compras';
const cleanUsername = (value, user) => String(value || user.public_alias || user.name || 'anonymous').trim().slice(0, 40) || 'anonymous';
const isAdmin = req => req.auth.user.role === 'admin';
const messageColumns = 'id, user_id, room, username, text, created_at, expires_at, status, details';
const unexpired = "(expires_at IS NULL OR expires_at > NOW())";
const missingRoom = () => new ChatError('La sala no existe o ya fue eliminada.', 404, 'room_not_found');
const missingMessage = () => new ChatError('Mensaje no encontrado o sin permiso para modificarlo.', 404, 'not_found');
const validMessageId = value => /^\d{1,18}$/.test(String(value));

function mapMessage(row, req) {
  const own = row.user_id === req.auth.user.id;
  const hidden = row.status === 'hidden';
  const admin = isAdmin(req);
  return {
    id: String(row.id), _id: String(row.id), room: row.room, username: row.username, text: row.text,
    userId: row.user_id, createdAt: new Date(row.created_at).getTime(),
    expiresAt: row.expires_at ? new Date(row.expires_at).getTime() : null,
    canDelete: admin || (own && !hidden), canEditYouTubeAlbum: !hidden && (own || admin),
    isOwnMessage: own, isAdminViewer: admin, isDeletedByUser: hidden,
    ...addMediaUrls(row.details, req.auth.sessionId),
    sharedPlaylist: row.shared_playlist,
  };
}

const mapRoom = row => ({
  id: row.id, label: row.label, builtin: row.builtin,
  count: Math.min(Number(row.message_count) || 0, 200),
  hasMore: Number(row.message_count) > 200,
});

async function transaction(run) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await run(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { client.release(); }
}

chatRouter.get('/rooms', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT r.id, r.label, r.builtin, counts.message_count
     FROM chat_rooms r
     CROSS JOIN LATERAL (
       SELECT COUNT(*)::integer AS message_count FROM (
         SELECT 1 FROM chat_messages m WHERE m.room = r.id
           AND (m.status = 'visible' OR ($1::boolean AND m.status = 'hidden'))
           AND (m.expires_at IS NULL OR m.expires_at > NOW())
         LIMIT 201
       ) messages
     ) counts
     ORDER BY r.builtin DESC, r.label ASC, r.id ASC`,
    [isAdmin(req)],
  );
  res.json({ rooms: rows.map(mapRoom), isAdmin: isAdmin(req) });
});

chatRouter.post('/rooms', async (req, res) => {
  const label = typeof req.body?.label === 'string' ? req.body.label.replace(/^#+\s*/, '').trim().slice(0, 45) : '';
  const slug = label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const id = ['noticias', 'informatica'].includes(slug) ? slug : 'custom-' + slug;
  if (!label || !slug || id.length > 50) throw new ChatError('Indica un nombre de sala válido (máximo 45 caracteres).', 400, 'invalid_room');
  const room = await transaction(async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('shopp-chat-rooms'), 0)");
    const existing = await client.query('SELECT id, label, builtin FROM chat_rooms WHERE id = $1', [id]);
    if (existing.rowCount) {
      if (req.body?.getOrCreate === true) return { room: existing.rows[0], created: false };
      throw new ChatError('Ya existe una sala con ese nombre.', 409, 'room_exists');
    }
    const { rows: [count] } = await client.query(
      'SELECT COUNT(*)::integer AS total, (COUNT(*) FILTER (WHERE created_by = $1))::integer AS owned FROM chat_rooms',
      [req.auth.user.id],
    );
    if (count.owned >= 25) throw new ChatError('Cada cuenta puede crear hasta 25 salas personalizadas.', 409, 'user_room_limit');
    if (count.total >= 100) throw new ChatError('Se alcanzó el máximo de 100 salas.', 409, 'room_limit');
    const { rows: [newRoom] } = await client.query(
      'INSERT INTO chat_rooms (id, label, builtin, created_by) VALUES ($1, $2, FALSE, $3) RETURNING id, label, builtin',
      [id, label, req.auth.user.id],
    );
    return { room: newRoom, created: true };
  });
  const data = mapRoom(room.room);
  if (room.created) await publishChatEvent('global', { type: 'chat.room.created', roomData: data });
  res.status(room.created ? 201 : 200).json({ room: data });
});

chatRouter.delete('/rooms/:roomId', requireAdmin, async (req, res) => {
  const room = req.params.roomId;
  if (!/^[a-z0-9_-]{1,50}$/.test(room)) throw new ChatError('Identificador de sala no válido.', 400, 'invalid_room');
  const deletedRoom = await transaction(async client => {
    const { rows: [target] } = await client.query('SELECT builtin FROM chat_rooms WHERE id = $1 FOR UPDATE', [room]);
    if (!target) throw missingRoom();
    await client.query('DELETE FROM chat_messages WHERE room = $1', [room]);
    if (!target.builtin) await client.query('DELETE FROM chat_rooms WHERE id = $1', [room]);
    return !target.builtin;
  });
  await publishChatEvent('global', { type: deletedRoom ? 'chat.room.deleted' : 'chat.room.cleared', deletedRoomId: room });
  res.json({ ok: true, deletedRoom, clearedMessages: true });
});

chatRouter.get('/messages', async (req, res) => {
  const room = cleanRoom(req.query.room);
  const exists = await pool.query('SELECT 1 FROM chat_rooms WHERE id = $1', [room]);
  if (!exists.rowCount) throw missingRoom();
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 100, 1), 200);
  const beforeId = validMessageId(req.query.beforeId) ? req.query.beforeId : null;
  const { rows } = await pool.query(
    `SELECT ${messageColumns}, shared_playlist - 'payload' AS shared_playlist
     FROM chat_messages WHERE room = $1 AND (status = 'visible' OR ($4::boolean AND status = 'hidden'))
       AND ${unexpired} AND ($2::bigint IS NULL OR id < $2::bigint)
     ORDER BY id DESC LIMIT $3`,
    [room, beforeId, limit, isAdmin(req)],
  );
  const nextBeforeId = rows.length === limit ? String(rows[rows.length - 1].id) : null;
  res.set('Cache-Control', 'private, no-store');
  res.json({ messages: rows.reverse().map(row => mapMessage(row, req)), nextBeforeId });
});

async function insertMessage(client, req, { room, text, details = {}, shared = null, keep = false, attachments = [] }) {
  const exists = await client.query('SELECT id FROM chat_rooms WHERE id = $1 FOR SHARE', [room]);
  if (!exists.rowCount) throw missingRoom();
  const { rows: [row] } = await client.query(
    `INSERT INTO chat_messages (user_id, room, username, text, expires_at, details, shared_playlist)
     VALUES ($1, $2, $3, $4, CASE WHEN $5 THEN NULL ELSE NOW() + INTERVAL '24 hours' END, $6::jsonb, $7::jsonb)
     RETURNING ${messageColumns}`,
    [req.auth.user.id, room, cleanUsername(req.body?.username, req.auth.user), text, keep, JSON.stringify(details), shared && JSON.stringify(shared)],
  );
  await attachMedia(client, req.auth.user.id, row.id, attachments);
  return row;
}

async function sendNewMessage(req, res, data) {
  const row = await transaction(client => insertMessage(client, req, data));
  await publishChatEvent(row.room, { type: 'chat.message.created', messageId: String(row.id) });
  if (row.room === 'noticias') void refreshNewsDates().catch(error => console.warn('No se pudo actualizar Noticias:', error.message));
  res.status(201).json({ message: mapMessage(row, req) });
}

chatRouter.post('/messages', async (req, res) => {
  const room = cleanRoom(req.body?.room);
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  const images = req.body?.images ?? [];
  const files = req.body?.files ?? [];
  if (!Array.isArray(images) || images.length > 8 || !Array.isArray(files) || files.length > 4) {
    throw new ChatError('Máximo 8 imágenes y 4 archivos por mensaje.');
  }
  const maxLength = room === 'youtube' ? 2048 : 280;
  if (text.length > maxLength || (!text && !images.length && !files.length)) {
    throw new ChatError('Escribe un mensaje de hasta ' + maxLength + ' caracteres o añade un adjunto.', 400, 'invalid_message');
  }
  const details = {
    images: images.map(item => attachment(item, 'image')),
    files: files.map(item => attachment(item, 'file')),
  };
  await sendNewMessage(req, res, {
    room, text, details, attachments: [...details.images, ...details.files],
    keep: req.body?.keepIndefinitely === true && isAdmin(req),
  });
});

chatRouter.delete('/messages/:id', async (req, res) => {
  if (!validMessageId(req.params.id)) throw new ChatError('Identificador no válido.', 400, 'invalid_id');
  const params = [req.params.id, req.auth.user.id];
  const { rows: [row] } = isAdmin(req)
    ? await pool.query('DELETE FROM chat_messages WHERE id = $1 RETURNING id, room', params.slice(0, 1))
    : await pool.query("UPDATE chat_messages SET status = 'hidden' WHERE id = $1 AND user_id = $2 AND status IN ('visible', 'hidden') RETURNING id, room", params);
  if (!row) throw missingMessage();
  await publishChatEvent(row.room, { type: 'chat.message.deleted', messageId: String(row.id) });
  res.status(204).end();
});

chatRouter.post('/attachments', (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  res.status(201).json({ path: createUploadPath(req.auth.sessionId) });
});

chatRouter.post('/youtube-playlists', async (req, res) => {
  const { playlist, attachments } = chatPlaylist(req.body);
  await sendNewMessage(req, res, {
    room: 'youtube', text: playlist.title,
    details: { customYouTubePlaylist: playlist }, attachments, keep: isAdmin(req),
  });
});

async function editMediaMessage(req, update) {
  const id = req.params.id;
  if (!validMessageId(id)) throw new ChatError('Identificador no válido.', 400, 'invalid_id');
  const row = await transaction(async client => {
    const { rows: [current] } = await client.query(
      `SELECT id, room, text, details FROM chat_messages
       WHERE id = $1 AND (user_id = $2 OR $3::boolean) AND status = 'visible' AND ${unexpired}
       FOR UPDATE`, [id, req.auth.user.id, isAdmin(req)],
    );
    if (!current) throw missingMessage();
    const { text = current.text, details, attachments, previousIds } = update(current);
    await attachMedia(client, req.auth.user.id, id, attachments);
    const retained = new Set(attachments.map(item => item.storageId));
    for (const removed of previousIds) {
      if (removed && !retained.has(removed)) {
        await client.query('DELETE FROM chat_attachments WHERE id = $1 AND message_id = $2', [removed, id]);
      }
    }
    await client.query('UPDATE chat_messages SET text = $2, details = $3::jsonb WHERE id = $1', [id, text, JSON.stringify(details)]);
    return current;
  });
  await publishChatEvent(row.room, { type: 'chat.message.updated', messageId: id });
}

chatRouter.patch('/youtube-playlists/:id', async (req, res) => {
  const { playlist, attachments } = chatPlaylist(req.body);
  await editMediaMessage(req, current => {
    const previous = current.details.customYouTubePlaylist;
    if (!previous) throw missingMessage();
    return {
      text: playlist.title, details: { ...current.details, customYouTubePlaylist: playlist },
      attachments, previousIds: previous.tracks.map(track => track.lyricsStorageId),
    };
  });
  res.json({ ok: true });
});

chatRouter.patch('/youtube-albums/:id', async (req, res) => {
  const title = typeof req.body?.title === 'string' ? req.body.title.trim().slice(0, 120) : '';
  if (!title) throw new ChatError('Indica el título del álbum.');
  const cover = req.body?.thumbnail ? attachment(req.body.thumbnail, 'image') : null;
  const lyrics = req.body?.lyrics ? attachment(req.body.lyrics, 'lyrics') : null;
  await editMediaMessage(req, current => {
    if (!/https?:\/\/(?:www\.|m\.|music\.)?youtube\.com\/playlist\?[^\s]*\blist=[A-Za-z0-9_-]{10,}/i.test(current.text) &&
        !/https?:\/\/(?:www\.|m\.|music\.)?youtube\.com\/watch\?[^\s]*\blist=[A-Za-z0-9_-]{10,}/i.test(current.text)) {
      throw new ChatError('La publicación no contiene una playlist de YouTube.');
    }
    const album = { ...current.details.youtubeAlbum, title };
    const previousIds = [];
    if (cover) {
      previousIds.push(album.thumbnailStorageId);
      album.thumbnailStorageId = cover.storageId;
      const { mimeType, width, height, size } = cover;
      Object.assign(album, { mimeType, width, height, size });
    }
    if (lyrics) {
      previousIds.push(album.lyricsStorageId);
      Object.assign(album, {
        lyricsStorageId: lyrics.storageId, lyricsFileName: lyrics.fileName,
        lyricsMimeType: lyrics.mimeType, lyricsSize: lyrics.size,
      });
    }
    return { details: { ...current.details, youtubeAlbum: album }, attachments: [cover, lyrics].filter(Boolean), previousIds };
  });
  res.json({ ok: true });
});

chatRouter.post('/shared-playlists', async (req, res) => {
  const shared = sharedPlaylist(req.body);
  const row = await transaction(async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('shopp-chat-shares'), hashtext($1))", [req.auth.user.id]);
    const { rows: [active] } = await client.query(
      `SELECT COUNT(*) AS count FROM chat_messages WHERE user_id = $1 AND shared_playlist IS NOT NULL
       AND status = 'visible' AND ${unexpired}`, [req.auth.user.id],
    );
    if (Number(active.count) >= 5) throw new ChatError('Puedes tener hasta cinco playlists compartidas activas.', 429, 'share_limit');
    return insertMessage(client, req, { room: 'musica', text: 'Playlist compartida: ' + shared.title, shared });
  });
  await publishChatEvent(row.room, { type: 'chat.message.created', messageId: String(row.id) });
  res.status(201).json({ messageId: String(row.id) });
});

chatRouter.get('/shared-playlists/:id', async (req, res) => {
  if (!validMessageId(req.params.id)) throw new ChatError('Identificador no válido.', 400, 'invalid_id');
  const { rows: [row] } = await pool.query(
    `SELECT shared_playlist FROM chat_messages WHERE id = $1 AND room = 'musica' AND status = 'visible' AND ${unexpired}`,
    [req.params.id],
  );
  if (!row?.shared_playlist) throw new ChatError('La playlist compartida ha caducado o se ha borrado.', 404, 'share_not_found');
  const { payload, collectionType } = row.shared_playlist;
  res.set('Cache-Control', 'private, no-store');
  res.json({ payload, collectionType });
});

chatRouter.post('/news/refresh', async (_req, res) => res.json(await refreshNewsDates()));
chatRouter.use(chatErrorHandler);

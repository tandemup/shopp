import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import express from 'express';
import { config, jwtConfigurationError } from '../config.js';
import { pool } from '../db.js';

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_LRC_BYTES = 512 * 1024;
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const mimeTypes = new Set(['image/jpeg', 'application/zip', 'application/json', 'text/plain']);
const prefix = '/api/v1/chat/media';

export class ChatError extends Error {
  constructor(message, status = 400, code = 'invalid_chat_input') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function chatErrorHandler(error, _req, res, next) {
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ error: { code: 'attachment_too_large', message: 'El archivo supera el tamaño permitido.' } });
  }
  if (!(error instanceof ChatError)) return next(error);
  return res.status(error.status).json({ error: { code: error.code, message: error.message } });
}

function signature(scope, data) {
  return createHmac('sha256', config.jwtSecret).update('shopp-chat:' + scope + ':' + data).digest('base64url');
}

function grant(scope, id, sessionId, minutes) {
  const expires = Math.floor(Date.now() / 60_000) + minutes;
  const data = [id, sessionId, expires].join('.');
  return data + '.' + signature(scope, data);
}

function verifyGrant(scope, value) {
  if (jwtConfigurationError() || typeof value !== 'string' || value.length > 160) return null;
  const parts = value.split('.');
  if (parts.length !== 4 || !uuid.test(parts[0]) || !/^\d{1,19}$/.test(parts[1]) ||
      !/^\d{1,10}$/.test(parts[2]) || Number(parts[2]) * 60_000 <= Date.now() ||
      !/^[A-Za-z0-9_-]{43}$/.test(parts[3])) return null;
  const expected = signature(scope, parts.slice(0, 3).join('.'));
  return timingSafeEqual(Buffer.from(parts[3]), Buffer.from(expected)) ? { id: parts[0], sessionId: parts[1] } : null;
}

const activeSession = `FROM auth_sessions s JOIN app_users u ON u.id = s.user_id
  WHERE s.id = $1 AND s.revoked_at IS NULL AND s.expires_at > NOW()
    AND u.status <> 'blocked' AND (u.role = 'admin' OR u.permissions->>'chat' = 'true')`;
const unavailable = () => new ChatError('Adjunto no disponible.', 404, 'attachment_not_found');

export function createUploadPath(sessionId) {
  return prefix + '/upload/' + grant('upload', randomUUID(), sessionId, 10);
}

export function addMediaUrls(details, sessionId) {
  const url = id => id ? prefix + '/' + id + '?grant=' + grant('read', id, sessionId, 60) : undefined;
  const { images, files, youtubeAlbum, customYouTubePlaylist, youtubePublishedAt } = details || {};
  return {
    images: images?.map(image => ({ ...image, uri: url(image.storageId) })),
    files: files?.map(file => ({ ...file, uri: url(file.storageId) })),
    youtubeAlbum: youtubeAlbum ? {
      ...youtubeAlbum, thumbnailUri: url(youtubeAlbum.thumbnailStorageId), lyricsUri: url(youtubeAlbum.lyricsStorageId),
    } : undefined,
    customYouTubePlaylist: customYouTubePlaylist ? {
      ...customYouTubePlaylist,
      tracks: customYouTubePlaylist.tracks.map(track => ({ ...track, lyricsUri: url(track.lyricsStorageId) })),
    } : undefined,
    youtubePublishedAt,
  };
}

export function attachment(input, kind) {
  const id = input?.storageId;
  const size = input?.size;
  const name = String(input?.name || input?.fileName || '').trim();
  const mimeType = kind === 'image' ? 'image/jpeg' : kind === 'lyrics' ? 'text/plain'
    : /\.zip$/i.test(name) ? 'application/zip' : /\.json$/i.test(name) ? 'application/json' : '';
  if (!uuid.test(String(id)) || !mimeType || input.mimeType !== mimeType ||
      !Number.isInteger(size) || size < 1 || size > (kind === 'lyrics' ? MAX_LRC_BYTES : MAX_BYTES)) {
    throw new ChatError('Adjunto no válido. Usa JPEG, ZIP, JSON o LRC según el campo.');
  }
  if (kind === 'image') {
    const { width, height } = input;
    if (![width, height].every(value => Number.isInteger(value) && value > 0 && value <= 2560)) {
      throw new ChatError('La imagen debe tener como máximo 2560 píxeles por lado.');
    }
    return { storageId: id, mimeType, size, width, height };
  }
  if (!name || name.length > 160 || (kind === 'lyrics' && !/\.lrc$/i.test(name))) {
    throw new ChatError('Nombre de adjunto no válido.');
  }
  return kind === 'lyrics' ? { storageId: id, mimeType, size, fileName: name } : { storageId: id, mimeType, size, name };
}

export async function attachMedia(client, userId, messageId, attachments) {
  for (const item of attachments) {
    const { rowCount } = await client.query(
      `UPDATE chat_attachments SET message_id = $1
       WHERE id = $2 AND mime_type = $3 AND size_bytes = $4
         AND (message_id = $1 OR (message_id IS NULL AND user_id = $5 AND created_at > NOW() - INTERVAL '1 hour'))`,
      [messageId, item.storageId, item.mimeType, item.size, userId],
    );
    if (!rowCount) throw new ChatError('El adjunto ha caducado o no pertenece a esta publicación.');
  }
}

export const chatMediaRouter = express.Router();
chatMediaRouter.post('/upload/:grant', async (req, res, next) => {
  const upload = verifyGrant('upload', req.params.grant);
  if (!upload) return next(unavailable());
  try {
    const { rows } = await pool.query('SELECT u.id ' + activeSession, [upload.sessionId]);
    if (!rows[0]) throw unavailable();
    req.chatUpload = { ...upload, userId: rows[0].id };
    next();
  } catch (error) { next(error); }
}, express.raw({ type: () => true, limit: MAX_BYTES }), async (req, res, next) => {
  const { id, userId } = req.chatUpload;
  const type = String(req.get('Content-Type') || '').split(';', 1)[0].trim().toLowerCase();
  const bytes = req.body;
  if (!mimeTypes.has(type) || !Buffer.isBuffer(bytes) || !bytes.length ||
      (type === 'image/jpeg' && bytes.subarray(0, 3).toString('hex') !== 'ffd8ff') ||
      (type === 'text/plain' && bytes.length > MAX_LRC_BYTES)) {
    return next(new ChatError('Archivo vacío, formato incorrecto o tamaño no permitido.'));
  }
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT pg_advisory_xact_lock(hashtext('shopp-chat-upload'), hashtext($1))", [userId]);
      const { rows: [pending] } = await client.query(
        'SELECT COUNT(*) AS count, COALESCE(SUM(size_bytes), 0) AS bytes FROM chat_attachments WHERE user_id = $1 AND message_id IS NULL',
        [userId],
      );
      if (Number(pending.count) >= 32 || Number(pending.bytes) + bytes.length > 128 * 1024 * 1024) {
        throw new ChatError('Demasiados adjuntos pendientes. Termina el envío o espera a que caduquen.', 429, 'pending_media_limit');
      }
      await client.query(
        'INSERT INTO chat_attachments (id, user_id, mime_type, content, size_bytes) VALUES ($1, $2, $3, $4, $5)',
        [id, userId, type, bytes, bytes.length],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      if (error.code === '23505') throw new ChatError('Este enlace de subida ya se utilizó.', 409, 'upload_used');
      throw error;
    } finally { client.release(); }
    res.status(201).json({ storageId: id });
  } catch (error) { next(error); }
});

chatMediaRouter.get('/:id', async (req, res, next) => {
  const read = verifyGrant('read', req.query.grant);
  if (!read || read.id !== req.params.id) return next(unavailable());
  try {
    const { rows } = await pool.query(
      `WITH viewer AS (SELECT u.role ${activeSession})
       SELECT a.mime_type, a.content, m.details FROM chat_attachments a
       JOIN chat_messages m ON m.id = a.message_id CROSS JOIN viewer v
       WHERE a.id = $2 AND (m.expires_at IS NULL OR m.expires_at > NOW())
         AND (m.status = 'visible' OR (m.status = 'hidden' AND v.role = 'admin'))`,
      [read.sessionId, read.id],
    );
    const media = rows[0];
    if (!media) throw unavailable();
    res.set('Cache-Control', 'private, no-store');
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Content-Security-Policy', "default-src 'none'; sandbox");
    res.type(media.mime_type);
    if (media.mime_type === 'application/json' || media.mime_type === 'application/zip') {
      const fileName = media.details.files?.find(file => file.storageId === read.id)?.name;
      res.attachment(fileName || (media.mime_type === 'application/json' ? 'shopp.json' : 'shopp.zip'));
    }
    res.send(media.content);
  } catch (error) { next(error); }
});
chatMediaRouter.use(chatErrorHandler);

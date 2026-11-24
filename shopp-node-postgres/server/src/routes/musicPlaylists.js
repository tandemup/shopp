import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

export const musicPlaylistsRouter = Router();
musicPlaylistsRouter.use(requireAuth);

const idPattern = /^[A-Za-z0-9_-]{1,128}$/;
const videoPattern = /^[A-Za-z0-9_-]{11}$/;
const playlistPattern = /^[A-Za-z0-9_-]{10,80}$/;
const fail = (res, status, code, message) => res.status(status).json({ error: { code, message } });
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function validatePlaylist(value) {
  if (!isObject(value)) return 'La playlist debe ser un objeto JSON.';
  if (typeof value.id !== 'string' || !idPattern.test(value.id)) return 'El identificador de playlist no es válido.';
  if (typeof value.title !== 'string' || !value.title.trim() || value.title.trim().length > 120) return 'El título debe tener entre 1 y 120 caracteres.';
  if (!Array.isArray(value.tracks) || value.tracks.length < 1 || value.tracks.length > 20) return 'La playlist debe contener entre 1 y 20 elementos.';
  let totalBytes = 0;
  for (const [index, track] of value.tracks.entries()) {
    if (!isObject(track)) return `El elemento ${index + 1} no es válido.`;
    const kind = track.kind === 'album' ? 'album' : 'single';
    if (kind === 'album' ? !playlistPattern.test(String(track.playlistId || '')) : !videoPattern.test(String(track.videoId || ''))) {
      return `El enlace del elemento ${index + 1} no es válido.`;
    }
    if (typeof track.title !== 'string' || track.title.length > 120) return `El título del elemento ${index + 1} no es válido.`;
    if (track.lyricsText !== undefined && track.lyricsText !== null) {
      if (typeof track.lyricsText !== 'string' || !String(track.lyricsFileName || '').toLowerCase().endsWith('.lrc')) return `La letra LRC del elemento ${index + 1} no es válida.`;
      const size = Buffer.byteLength(track.lyricsText, 'utf8');
      if (size > 512 * 1024) return `La letra LRC del elemento ${index + 1} supera 512 KB.`;
      totalBytes += size;
    }
  }
  if (totalBytes > 10 * 1024 * 1024) return 'El contenido LRC de la playlist supera 10 MB.';
  if (value.updatedAt !== undefined && (!Number.isSafeInteger(value.updatedAt) || value.updatedAt < 0)) return 'La fecha de actualización no es válida.';
  if (value.createdAt !== undefined && (!Number.isSafeInteger(value.createdAt) || value.createdAt < 0)) return 'La fecha de creación no es válida.';
  return null;
}

function fromRow(row) {
  return {
    id: row.playlist_id,
    _id: row.playlist_id,
    title: row.title,
    collectionType: 'playlist',
    tracks: row.tracks,
    createdAt: Number(row.created_at_ms),
    updatedAt: Number(row.updated_at_ms),
  };
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

musicPlaylistsRouter.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM music_playlists WHERE owner_id = $1 ORDER BY updated_at_ms DESC, playlist_id',
      [req.auth.user.id],
    );
    res.json({ playlists: rows.map(fromRow) });
  } catch (error) { next(error); }
});

// Synchronize local-first IndexedDB records. Newer local records are uploaded;
// a newer server copy wins. Equal timestamps with different content are
// reported as conflicts and are never overwritten silently.
musicPlaylistsRouter.post('/sync', async (req, res, next) => {
  const incoming = req.body?.playlists;
  if (!Array.isArray(incoming) || incoming.length > 500) return fail(res, 400, 'invalid_input', 'playlists debe ser una lista de hasta 500 elementos.');
  for (const item of incoming) {
    const invalid = validatePlaylist(item);
    if (invalid) return fail(res, 400, 'invalid_playlist', invalid);
  }

  const client = await pool.connect();
  const ownerId = req.auth.user.id;
  const conflicts = [];
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM app_users WHERE id=$1 FOR UPDATE', [ownerId]);
    const deletedResult = await client.query(
      'SELECT playlist_id FROM music_playlist_deletions WHERE owner_id=$1',
      [ownerId],
    );
    const deletedIds = new Set(deletedResult.rows.map(row => row.playlist_id));
    for (const item of incoming) {
      // A server tombstone prevents an old offline copy from resurrecting a
      // playlist deleted on another device.
      if (deletedIds.has(item.id)) continue;
      const { rows } = await client.query(
        'SELECT * FROM music_playlists WHERE owner_id = $1 AND playlist_id = $2 FOR UPDATE',
        [ownerId, item.id],
      );
      const existing = rows[0];
      const incomingUpdatedAt = Number(item.updatedAt || 0);
      const createdAt = Number(item.createdAt || Date.now());
      const tracks = item.tracks.map(track => ({
        kind: track.kind === 'album' ? 'album' : 'single',
        videoId: track.videoId || null,
        playlistId: track.playlistId || null,
        title: track.title.trim(),
        lyricsKey: track.lyricsKey || null,
        lyricsDisabled: track.lyricsDisabled === true,
        lyricsFileName: track.lyricsFileName || null,
        lyricsText: track.lyricsText ?? null,
        artworkUrl: typeof track.artworkUrl === 'string' ? track.artworkUrl.slice(0, 2048) : '',
      }));
      const serialized = JSON.stringify(tracks);
      if (!existing) {
        await client.query(
          `INSERT INTO music_playlists (owner_id, playlist_id, title, tracks, created_at_ms, updated_at_ms)
           VALUES ($1,$2,$3,$4::jsonb,$5,$6)`,
          [ownerId, item.id, item.title.trim(), serialized, createdAt, incomingUpdatedAt || Date.now()],
        );
      } else {
        const existingUpdatedAt = Number(existing.updated_at_ms);
        const sameContent = existing.title === item.title.trim() && stableJson(existing.tracks) === stableJson(tracks);
        if (incomingUpdatedAt > existingUpdatedAt) {
          await client.query(
            `UPDATE music_playlists SET title=$3, tracks=$4::jsonb, created_at_ms=$5, updated_at_ms=$6, updated_at=NOW()
             WHERE owner_id=$1 AND playlist_id=$2`,
            [ownerId, item.id, item.title.trim(), serialized, createdAt, incomingUpdatedAt],
          );
        } else if (!sameContent && incomingUpdatedAt === existingUpdatedAt) {
          conflicts.push(item.id);
        }
      }
    }
    const { rows } = await client.query(
      'SELECT * FROM music_playlists WHERE owner_id = $1 ORDER BY updated_at_ms DESC, playlist_id',
      [ownerId],
    );
    await client.query('COMMIT');
    res.json({ playlists: rows.map(fromRow), conflicts, deletedIds: [...deletedIds] });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    next(error);
  } finally { client.release(); }
});

musicPlaylistsRouter.delete('/:playlistId', async (req, res, next) => {
  const playlistId = req.params.playlistId;
  if (!idPattern.test(playlistId)) return fail(res, 400, 'invalid_id', 'El identificador de playlist no es válido.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM app_users WHERE id=$1 FOR UPDATE', [req.auth.user.id]);
    const result = await client.query('DELETE FROM music_playlists WHERE owner_id=$1 AND playlist_id=$2', [req.auth.user.id, playlistId]);
    if (!result.rowCount) {
      const tombstone = await client.query(
        'SELECT 1 FROM music_playlist_deletions WHERE owner_id=$1 AND playlist_id=$2',
        [req.auth.user.id, playlistId],
      );
      if (!tombstone.rowCount) {
        await client.query('ROLLBACK');
        return fail(res, 404, 'not_found', 'No se encontró la playlist.');
      }
    }
    await client.query(
      `INSERT INTO music_playlist_deletions (owner_id, playlist_id, deleted_at_ms)
       VALUES ($1,$2,$3)
       ON CONFLICT (owner_id, playlist_id) DO UPDATE SET deleted_at_ms=GREATEST(music_playlist_deletions.deleted_at_ms, EXCLUDED.deleted_at_ms)`,
      [req.auth.user.id, playlistId, Date.now()],
    );
    await client.query('COMMIT');
    res.status(204).end();
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    next(error);
  } finally { client.release(); }
});

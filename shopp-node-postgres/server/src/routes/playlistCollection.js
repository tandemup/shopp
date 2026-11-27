import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const idPattern = /^[A-Za-z0-9_-]{1,128}$/;
const videoPattern = /^[A-Za-z0-9_-]{11}$/;
const playlistPattern = /^[A-Za-z0-9_-]{10,80}$/;
const fail = (res, status, code, message) => res.status(status).json({ error: { code, message } });
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const MAX_COVER_BYTES = 2 * 1024 * 1024;
const MAX_COVER_BASE64_LENGTH = 4 * Math.ceil(MAX_COVER_BYTES / 3);

function isValidArtwork(value) {
  if (value == null || value === '') return true;
  if (typeof value !== 'string' || value.length > MAX_COVER_BASE64_LENGTH + 23) return false;
  if (/^https:\/\/[^\s]+$/i.test(value) && value.length <= 2048) {
    try {
      const url = new URL(value);
      return Boolean(url.hostname) && !url.username && !url.password;
    } catch { return false; }
  }
  const image = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(value);
  if (!image || image[2].length % 4 !== 0) return false;
  const encoded = image[2];
  const padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0;
  return (encoded.length * 3) / 4 - padding <= MAX_COVER_BYTES;
}

const CLASSICAL_FIELDS = ['composer', 'performer', 'conductor', 'orchestra', 'period', 'year'];
const WORK_FIELDS = ['subtitle', 'composer', 'conductor', 'orchestra', 'soloist'];
const CLASSICAL_IMAGES = ['auto', 'artwork', 'youtube', 'general'];

function normalizeClassicalDetails(playlist) {
  const fields = Object.fromEntries(CLASSICAL_FIELDS.map(key => [key, playlist[key]?.trim() || '']));
  return {
    ...fields,
    shareable: playlist.shareable === true,
    artworkUrl: playlist.artworkUrl || '',
    works: (playlist.works || []).map(work => ({
      id: work.id,
      title: work.title.trim(),
      ...Object.fromEntries(WORK_FIELDS.map(key => [key, work[key]?.trim() || ''])),
      image: CLASSICAL_IMAGES.includes(work.image) ? work.image : 'auto',
      trackKeys: work.trackKeys,
    })),
  };
}

function validateClassicalDetails(value) {
  if (CLASSICAL_FIELDS.some(key => value[key] != null &&
      (typeof value[key] !== 'string' || value[key].length > (key === 'year' ? 20 : 120)))) {
    return 'Los datos de la colección clásica no son válidos.';
  }
  if (!isValidArtwork(value.artworkUrl)) return 'La carátula de la colección no es válida.';
  if (value.works == null) return null;
  if (!Array.isArray(value.works) || value.works.length > 100 || value.works.some(work =>
    !isObject(work) || typeof work.id !== 'string' || !work.id.trim() || work.id.length > 100 ||
    typeof work.title !== 'string' || !work.title.trim() || work.title.length > 300 ||
    WORK_FIELDS.some(key => work[key] != null && (typeof work[key] !== 'string' || work[key].length > 300)) ||
    !Array.isArray(work.trackKeys) || work.trackKeys.length < 1 || work.trackKeys.length > 100 ||
    work.trackKeys.some(key => typeof key !== 'string' || !key.trim() || key.length > 160))) {
    return 'El catálogo de obras contiene datos no válidos.';
  }
  return null;
}

function validatePlaylist(value, collectionType) {
  if (!isObject(value)) return 'La playlist debe ser un objeto JSON.';
  if (value.collectionType != null && value.collectionType !== collectionType) return 'La playlist pertenece a otra colección.';
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
    if (!isValidArtwork(track.artworkUrl)) return `La carátula del elemento ${index + 1} no es válida o supera 2 MB.`;
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
  return collectionType === 'classical' ? validateClassicalDetails(value) : null;
}

function fromRow(row) {
  return {
    ...(row.collection_type === 'classical' ? row.details : { shareable: row.details?.shareable === true }),
    id: row.playlist_id,
    _id: row.playlist_id,
    title: row.title,
    collectionType: row.collection_type,
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

function comparableTracks(tracks) {
  return tracks.map(({ lyricsKey, ...track }) => track);
}

function repairsClippedArtwork(previousTracks, incomingTracks) {
  if (previousTracks.length !== incomingTracks.length) return false;
  let repaired = false;
  const adjusted = previousTracks.map((previous, index) => {
    const cover = incomingTracks[index].artworkUrl;
    if (cover.startsWith('data:image/') && cover.length > 2048 &&
        previous.artworkUrl === cover.slice(0, 2048)) {
      repaired = true;
      return { ...previous, artworkUrl: cover };
    }
    return previous;
  });
  return repaired && stableJson(comparableTracks(adjusted)) === stableJson(comparableTracks(incomingTracks));
}

// SQL identifiers come only from this fixed map, never from request data.
const collectionTables = new Map([
  ['playlist', { playlists: 'music_playlists', deletions: 'music_playlist_deletions' }],
  ['classical', { playlists: 'classical_playlists', deletions: 'classical_playlist_deletions' }],
]);

export function createPlaylistRouter(collectionType, accessMiddleware) {
  const tables = collectionTables.get(collectionType);
  if (!tables) throw new Error('Tipo de colección no válido.');
  const router = Router();
  router.use(requireAuth);
  if (accessMiddleware) router.use(accessMiddleware);

  router.get('/', async (req, res, next) => {
    try {
      const { rows } = await pool.query(
        `SELECT * FROM ${tables.playlists} WHERE owner_id = $1 AND collection_type = $2 ORDER BY updated_at_ms DESC, playlist_id`,
        [req.auth.user.id, collectionType],
      );
      res.json({ playlists: rows.map(fromRow) });
    } catch (error) { next(error); }
  });

  // Synchronize local-first IndexedDB records. Newer local records are uploaded;
  // a newer server copy wins. Equal timestamps with different content are
  // reported as conflicts and are never overwritten silently.
  router.post('/sync', async (req, res, next) => {
    const incoming = req.body?.playlists;
    if (!Array.isArray(incoming) || incoming.length > 500) return fail(res, 400, 'invalid_input', 'playlists debe ser una lista de hasta 500 elementos.');
    for (const item of incoming) {
      const invalid = validatePlaylist(item, collectionType);
      if (invalid) return fail(res, 400, 'invalid_playlist', invalid);
    }

    const client = await pool.connect();
    const ownerId = req.auth.user.id;
    const conflicts = [];
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', [ownerId, collectionType]);
      const deletedResult = await client.query(
        `SELECT playlist_id FROM ${tables.deletions} WHERE owner_id=$1 AND collection_type=$2`,
        [ownerId, collectionType],
      );
      const deletedIds = new Set(deletedResult.rows.map(row => row.playlist_id));
      for (const item of incoming) {
        // A server tombstone prevents an old offline copy from resurrecting a
        // playlist deleted on another device.
        if (deletedIds.has(item.id)) continue;
        const { rows } = await client.query(
          `SELECT * FROM ${tables.playlists} WHERE owner_id = $1 AND playlist_id = $2 AND collection_type = $3 FOR UPDATE`,
          [ownerId, item.id, collectionType],
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
          artworkUrl: track.artworkUrl || '',
        }));
        const details = collectionType === 'classical'
          ? normalizeClassicalDetails(item)
          : { ...existing?.details };
        if (collectionType === 'music' && typeof item.shareable === 'boolean') {
          if (item.shareable) details.shareable = true;
          else delete details.shareable;
        }
        const serialized = JSON.stringify(tracks);
        if (!existing) {
          await client.query(
            `INSERT INTO ${tables.playlists} (owner_id, playlist_id, title, tracks, created_at_ms, updated_at_ms, collection_type, details)
             VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8::jsonb)`,
            [ownerId, item.id, item.title.trim(), serialized, createdAt, incomingUpdatedAt || Date.now(), collectionType, JSON.stringify(details)],
          );
        } else {
          const existingUpdatedAt = Number(existing.updated_at_ms);
          const sameTitle = existing.title === item.title.trim();
          const sameDetails = stableJson(existing.details) === stableJson(details);
          const repairArtwork = incomingUpdatedAt === existingUpdatedAt && sameTitle && sameDetails &&
            repairsClippedArtwork(existing.tracks, tracks);
          const sameContent = sameTitle && sameDetails &&
            stableJson(comparableTracks(existing.tracks)) === stableJson(comparableTracks(tracks));
          if (incomingUpdatedAt > existingUpdatedAt || repairArtwork) {
            await client.query(
              `UPDATE ${tables.playlists} SET title=$3, tracks=$4::jsonb, created_at_ms=$5, updated_at_ms=$6, updated_at=NOW(), details=$8::jsonb
               WHERE owner_id=$1 AND playlist_id=$2 AND collection_type=$7`,
              [ownerId, item.id, item.title.trim(), serialized, createdAt, repairArtwork ? existingUpdatedAt + 1 : incomingUpdatedAt, collectionType, JSON.stringify(details)],
            );
          } else if (!sameContent && incomingUpdatedAt === existingUpdatedAt) {
            conflicts.push(item.id);
          }
        }
      }
      const { rows } = req.body.returnPlaylists === false ? { rows: [] } : await client.query(
        `SELECT * FROM ${tables.playlists} WHERE owner_id = $1 AND collection_type = $2 ORDER BY updated_at_ms DESC, playlist_id`,
        [ownerId, collectionType],
      );
      await client.query('COMMIT');
      res.json({ playlists: rows.map(fromRow), conflicts, deletedIds: [...deletedIds] });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      next(error);
    } finally { client.release(); }
  });

  router.delete('/:playlistId', async (req, res, next) => {
    const playlistId = req.params.playlistId;
    if (!idPattern.test(playlistId)) return fail(res, 400, 'invalid_id', 'El identificador de playlist no es válido.');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))', [req.auth.user.id, collectionType]);
      const result = await client.query(
        `DELETE FROM ${tables.playlists} WHERE owner_id=$1 AND playlist_id=$2 AND collection_type=$3`,
        [req.auth.user.id, playlistId, collectionType],
      );
      if (!result.rowCount) {
        const tombstone = await client.query(
          `SELECT 1 FROM ${tables.deletions} WHERE owner_id=$1 AND playlist_id=$2 AND collection_type=$3`,
          [req.auth.user.id, playlistId, collectionType],
        );
        if (!tombstone.rowCount) {
          await client.query('ROLLBACK');
          return fail(res, 404, 'not_found', 'No se encontró la playlist.');
        }
      }
      await client.query(
        `INSERT INTO ${tables.deletions} (owner_id, playlist_id, deleted_at_ms, collection_type)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (owner_id, collection_type, playlist_id)
         DO UPDATE SET deleted_at_ms=GREATEST(${tables.deletions}.deleted_at_ms, EXCLUDED.deleted_at_ms)`,
        [req.auth.user.id, playlistId, Date.now(), collectionType],
      );
      await client.query('COMMIT');
      res.status(204).end();
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      next(error);
    } finally { client.release(); }
  });

  return router;
}


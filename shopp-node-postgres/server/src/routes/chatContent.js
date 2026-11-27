import { attachment, ChatError } from './chatMedia.js';
import { pool } from '../db.js';
import { publishChatEvent } from '../realtime.js';

const videoId = /^[A-Za-z0-9_-]{11}$/;
const playlistId = /^[A-Za-z0-9_-]{10,80}$/;
const clean = value => typeof value === 'string' ? value.trim() : '';

export function youtubeTrack(track, index) {
  const kind = track?.kind === 'album' ? 'album' : 'single';
  const video = clean(track?.videoId);
  const playlist = clean(track?.playlistId);
  if (!(kind === 'album' ? playlistId.test(playlist) : videoId.test(video))) {
    throw new ChatError('Enlace de YouTube no válido en el elemento ' + (index + 1) + '.');
  }
  const url = kind === 'album' ? 'https://www.youtube.com/playlist?list=' + playlist : 'https://www.youtube.com/watch?v=' + video;
  return {
    kind, url, title: clean(track.title).slice(0, 120) || 'Elemento ' + (index + 1),
    ...(videoId.test(video) ? { videoId: video } : {}),
    ...(playlistId.test(playlist) ? { playlistId: playlist } : {}),
  };
}

export function chatPlaylist(body) {
  const title = clean(body?.title).slice(0, 120);
  const items = body?.tracks;
  if (!title || !Array.isArray(items) || items.length < 2 || items.length > 20) {
    throw new ChatError('Indica un título y entre 2 y 20 elementos de YouTube.');
  }
  const seen = new Set();
  const attachments = [];
  const tracks = items.map((track, index) => {
    const normalized = youtubeTrack(track, index);
    if (seen.has(normalized.url)) throw new ChatError('La playlist contiene enlaces repetidos.');
    seen.add(normalized.url);
    if (!track.lyrics && !track.lyricsStorageId) return normalized;
    const lyrics = attachment(track.lyrics || {
      storageId: track.lyricsStorageId, fileName: track.lyricsFileName,
      mimeType: track.lyricsMimeType, size: track.lyricsSize,
    }, 'lyrics');
    attachments.push(lyrics);
    return {
      ...normalized, lyricsStorageId: lyrics.storageId, lyricsFileName: lyrics.fileName,
      lyricsMimeType: lyrics.mimeType, lyricsSize: lyrics.size,
    };
  });
  return { playlist: { title, tracks }, attachments };
}

export function sharedPlaylist(body) {
  const { collectionType, payload } = body || {};
  const title = clean(body?.title);
  if (!title || title.length > 140 || !['playlist', 'classical'].includes(collectionType) ||
      typeof payload !== 'string' || Buffer.byteLength(payload) > 180 * 1024) {
    throw new ChatError('Respaldo no válido o superior a 180 KB. Las playlists más grandes se pueden enviar como ZIP.');
  }
  let item;
  try { item = JSON.parse(payload); } catch { throw new ChatError('JSON de playlist no válido.'); }
  if (item?.collectionType !== collectionType || clean(item.title) !== title ||
      !Array.isArray(item.tracks) || item.tracks.length < 1 || item.tracks.length > 20) {
    throw new ChatError('El respaldo debe contener entre 1 y 20 elementos de la colección indicada.');
  }
  for (const [index, track] of item.tracks.entries()) {
    youtubeTrack(track, index);
    if (track.lyricsBackup != null && (
      typeof track.lyricsBackup.text !== 'string' ||
      !/\.lrc$/i.test(String(track.lyricsBackup.fileName)) ||
      Buffer.byteLength(track.lyricsBackup.text) > 512 * 1024
    )) throw new ChatError('El respaldo contiene un LRC no válido.');
  }
  return { title, collectionType, trackCount: item.tracks.length, payload };
}

export function extractChatVideoId(text) {
  for (const raw of String(text || '').match(/https?:\/\/[^\s<>"']+/g) || []) {
    try {
      const url = new URL(raw);
      const host = url.hostname.replace(/^www\./, '');
      let id;
      if (host === 'youtu.be') id = url.pathname.slice(1).split('/')[0];
      else if (['youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(host)) {
        id = url.pathname === '/watch' ? url.searchParams.get('v') : /^\/(?:shorts|live|embed)\/([^/]+)/.exec(url.pathname)?.[1];
      }
      if (videoId.test(id || '')) return id;
    } catch {}
  }
  return null;
}

let nextNewsRefresh = 0;

export async function refreshNewsDates() {
  if (Date.now() < nextNewsRefresh) return { ok: true, checked: 0 };
  nextNewsRefresh = Date.now() + 5 * 60_000;
  const { rows } = await pool.query(
    `SELECT id, text FROM chat_messages WHERE room = 'noticias' AND status = 'visible'
     AND (expires_at IS NULL OR expires_at > NOW()) AND NOT (details ? 'youtubePublishedAt')
     ORDER BY id DESC LIMIT 100`,
  );
  const candidates = rows.map(row => ({ id: row.id, video: extractChatVideoId(row.text) }))
    .filter(item => item.video).slice(0, 20);
  let updated = false;
  // La URL se construye solo con el identificador, igual que en el chat Convex.
  for (let index = 0; index < candidates.length; index += 5) {
    await Promise.all(candidates.slice(index, index + 5).map(async ({ id, video }) => {
      try {
        const response = await fetch('https://www.youtube.com/watch?v=' + video, {
          headers: { 'Accept-Language': 'en-US,en;q=0.9' },
          signal: AbortSignal.timeout(4500),
          redirect: 'error',
        });
        if (!response.ok) return;
        const date = /["'](?:publishDate|uploadDate)["']\s*:\s*["'](\d{4}-\d{2}-\d{2})(?:T[^"']*)?["']/i.exec(await response.text())?.[1];
        const timestamp = Date.parse(date + 'T00:00:00Z');
        if (!Number.isFinite(timestamp)) return;
        const result = await pool.query(
          "UPDATE chat_messages SET details = jsonb_set(details, '{youtubePublishedAt}', to_jsonb($2::bigint)) WHERE id = $1 AND NOT (details ? 'youtubePublishedAt')",
          [id, timestamp],
        );
        if (result.rowCount) updated = true;
      } catch (error) {
        console.warn('No se pudo leer la fecha de un vídeo del chat:', error.message);
      }
    }));
  }
  if (updated) await publishChatEvent('noticias', { type: 'chat.message.updated' });
  return { ok: true, checked: candidates.length };
}

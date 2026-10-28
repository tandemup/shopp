// Pure, shared validator for the v1 music sync transport envelope.
// Never accepts remote binary or local-only artwork references.
export const MAX_PACKAGE_BYTES = 350_000;
const keyPattern = /^@shopping\/playlist-lyrics\/track:[A-Za-z0-9_-]+$/;
const idPattern = /^[A-Za-z0-9_-]{1,160}$/;
const byteLength = value => new TextEncoder().encode(JSON.stringify(value)).length;
const fail = message => { throw new Error(message); };
const plain = value => !!value && typeof value === 'object' && !Array.isArray(value);
export function assertMusicSyncPackage({localId, collectionType, snapshot, lyrics = []}) {
  if (!idPattern.test(localId || '')) fail('ID inválido');
  if (!['playlist','classical'].includes(collectionType)) fail('Colección inválida');
  if (!plain(snapshot) || snapshot.id !== localId || snapshot.collectionType !== collectionType ||
      !Array.isArray(snapshot.tracks) || snapshot.tracks.length > 300) fail('Playlist inválida');
  if (!Array.isArray(lyrics) || lyrics.length > 300) fail('Lista LRC inválida');
  const trackKeys = new Set();
  for (const track of snapshot.tracks) {
    if (!plain(track)) fail('Pista inválida');
    if (typeof track.title !== 'string' || track.title.length > 1000) fail('Título de pista inválido');
    if (track.lyricsKey != null && track.lyricsKey !== '') {
      if (!keyPattern.test(track.lyricsKey) || trackKeys.has(track.lyricsKey)) fail('Clave LRC inválida o duplicada');
      trackKeys.add(track.lyricsKey);
    }
    for (const field of ['artworkUrl','coverUrl','imageUrl']) {
      const val = track[field];
      if (val == null || val === '') continue;
      if (typeof val !== 'string' ||
          (/^(blob:|file:|content:|filesystem:)/i.test(val)) ||
          (/^data:/i.test(val) && !/^data:image\/(png|jpeg|webp);base64,/i.test(val)) ||
          (!/^https:\/\//i.test(val) && !/^data:image\//i.test(val))) fail('Carátula no transferible');
    }
  }
  const lyricKeys = new Set();
  for (const entry of lyrics) {
    if (!plain(entry) || !keyPattern.test(entry.key || '') || lyricKeys.has(entry.key) ||
        !plain(entry.record) || typeof entry.record.text !== 'string' ||
        typeof entry.record.fileName !== 'string' || !/\.lrc$/i.test(entry.record.fileName) ||
        new TextEncoder().encode(entry.record.text).length > 120000) fail('LRC inválida o duplicada');
    lyricKeys.add(entry.key);
  }
  if (lyricKeys.size !== trackKeys.size || [...trackKeys].some(key => !lyricKeys.has(key)))
    fail('LRC incompletas o sin pista asociada');
  if (byteLength({snapshot, lyrics}) > MAX_PACKAGE_BYTES) fail('Paquete demasiado grande');
  return true;
}

// Fase 3: transferencia manual; nunca sobrescribe una playlist existente.
import * as repository from '@/src/storage/playlists/playlistRepository';
import { getLocalLyrics, getLyricsStorageKey } from '@/src/storage/lyricsStorage';
const MAX_BYTES = 350000;
const size = value => new TextEncoder().encode(JSON.stringify(value)).length;
const scoped = key => /^@shopping\/playlist-lyrics\/track:[A-Za-z0-9_-]+$/.test(key);

export async function buildCompleteSnapshot(id) {
  const source = await repository.get(id);
  if (!source || !['playlist','classical'].includes(source.collectionType)) throw new Error('Playlist no encontrada');
  const snapshot = JSON.parse(JSON.stringify(source));
  const lyrics = [];
  for (const [index, track] of snapshot.tracks.entries()) {
    if (track.lyricsDisabled) continue;
    const hasLyrics = !!(track.lyricsKey || track.lyricsStorageId || track.lyricsSize || track.lyricsFileName);
    const record = await getLocalLyrics(track);
    if (!record?.text) {
      if (hasLyrics) throw new Error(`Letra no disponible en pista ${index+1}: se cancela la subida`);
      continue;
    }
    const key = getLyricsStorageKey(track);
    if (!scoped(key)) throw new Error(`LRC heredado en pista ${index+1}: migrar primero a clave individual`);
    if (size(record) > 120000) throw new Error('Archivo LRC demasiado grande');
    lyrics.push({key,record:{...record,text:String(record.text)}});
  }
  for (const t of snapshot.tracks) {
    const a = t.artworkUrl;
    if (typeof a === 'string' && /^(file:|blob:|content:)/i.test(a))
      throw new Error('La carátula es local y no es transferible. Exporta una copia antes de sincronizar.');
    if (typeof a === 'string' && a.startsWith('data:image/') && a.length > 120000)
      throw new Error('La carátula incrustada supera el límite; requiere Convex File Storage.');
  }
  const payload={schema:'shopp-music-sync-package',version:1,snapshot,lyrics};
  if (size(payload)>MAX_BYTES) throw new Error('Paquete demasiado grande: usar almacenamiento de archivos');
  return payload;
}

export async function uploadCompleteManual(client, api, id) {
  const packageData=await buildCompleteSnapshot(id);
  return client.mutation(api.musicSync.uploadManual, {
    localId:id,collectionType:packageData.snapshot.collectionType,expectedRevision:0,
    snapshot:packageData.snapshot,lyrics:packageData.lyrics,
  });
}

export async function previewRemoteComplete(client, api, localId) {
  const result=await client.query(api.musicSync.readSnapshot,{localId});
  if(!result) return null;
  const existing=await repository.get(localId);
  return {localId,revision:result.revision,existsLocally:!!existing,
    tracks:result.snapshot?.tracks?.length||0,lyrics:result.lyrics?.length||0,
    canImport:!existing};
}

export async function importNewRemoteManual(client, api, localId) {
  // Backup the device before invoking this method. Existing IDs cannot be replaced.
  const result=await client.query(api.musicSync.readSnapshot,{localId});
  if(!result) throw new Error('Playlist remota inexistente');
  return repository.importSyncedNew(result.snapshot,result.lyrics || []);
}

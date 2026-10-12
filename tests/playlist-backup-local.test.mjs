import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = (await readFile(new URL('../src/services/playlistBackupV2.js', import.meta.url), 'utf8'))
  .replace(/import\s+\{\s*getLocalLyrics\s*\}\s+from\s+[^;]*;/, '')
  .replace(/export\s+(?=(?:async\s+)?function|const|let)/g, '');
const load = local => new Function('getLocalLyrics', source + '\nreturn makePlaylistBackupV2;')(local);
const item = (track = {}) => ({title:'Music', tracks:[{kind:'single',title:'Tema',videoId:'ABCDEFGHIJK',...track}]});
const backed = async (records, opts) => load(async () => records)([item({lyricsFileName:'x.lrc',lyricsStorageId:'convex-id',lyricsUri:'https://convex.invalid'} )], 'shopp-youtube-playlists',opts);
test('Export local prioriza LRC IndexedDB y no hace red aunque el track conserve ID de Convex', async () => {
 let fetches=0; const original=globalThis.fetch;
 globalThis.fetch=async () => {fetches++;throw new Error('Red prohibida');};
 try {
  const payload=await backed({text:'[00:01.00]Local',fileName:'local.lrc'});
  assert.equal(payload.lyricsEntries,1);
  assert.equal(payload.playlists[0].tracks[0].lyricsBackup.text,'[00:01.00]Local');
  assert.equal(payload.playlists[0].tracks[0].lyricsBackup.source,'local');
  assert.equal(payload.playlists[0].tracks[0].lyricsStorageId,undefined);
  assert.equal(fetches,0);
 } finally {globalThis.fetch=original;}
});
test('Export local impide copias incompletas y no consulta Convex como fallback', async () => {
 let fetches=0;const original=globalThis.fetch;
 globalThis.fetch=async () => {fetches++;throw new Error('red prohibida');};
 try { await assert.rejects(()=>backed(null),/Falta el contenido LRC/); assert.equal(fetches,0); }
 finally {globalThis.fetch=original;}
});
test('Migración explícita sí puede descargar LRC antiguas', async () => {
 let fetches=0;const original=globalThis.fetch;
 globalThis.fetch=async () => {fetches++;return {ok:true,arrayBuffer:async()=>new TextEncoder().encode('[00:01.00]Remota').buffer};};
 try {
  const payload=await backed(null,{allowRemoteLyrics:true});
  assert.equal(payload.lyricsEntries,1);
  assert.equal(payload.playlists[0].tracks[0].lyricsBackup.source,'convex');
  assert.equal(fetches,1);
 } finally {globalThis.fetch=original;}
});
test('Export local sin LRC produce respaldo completo vacío', async () => {
 const payload=await load(async()=>null)([item()], 'shopp-youtube-playlists');
 assert.equal(payload.backupStatus,'complete');
 assert.equal(payload.lyricsEntries,0);
 assert.equal(payload.playlists[0].tracks.length,1);
});

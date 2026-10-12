import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../src/', import.meta.url);
const lyricsSrc = (await readFile(new URL('storage/lyricsStorage.web.js', root), 'utf8'))
  .replace(/export\s+(?=(?:async\s+)?function|const|let)/g, '');
const lyrics = new Function(`${lyricsSrc};return {newLyricsStorageKey,getLyricsStorageKey,getLocalLyrics};`)();
const typeName = 'shopp-youtube-playlists';
const base = { kind:'single', videoId:'ABCDEFGHIJK', title:'Canción' };

const makeImporter = async repo => {
  const source = (await readFile(new URL('services/playlistLocalImport.js', root), 'utf8'))
    .replace(/^import\s+[^;]+;\s*$/gm, '')
    .replace(/export\s+(?=(?:async\s+)?function|const|let)/g, '');
  return new Function('repository','newLyricsStorageKey', `${source}; return importPlaylistsLocally;`)(repo, lyrics.newLyricsStorageKey);
};
const makeBackup = async get => {
  const source = (await readFile(new URL('services/playlistBackupV2.js', root), 'utf8'))
    .replace(/^import\s+[^;]+;\s*$/gm, '')
    .replace(/export\s+(?=(?:async\s+)?function|const|let)/g, '');
  return new Function('getLocalLyrics', `${source};return makePlaylistBackupV2;`)(get);
};

test('Una nueva letra usa clave de pista y la clave global anterior permanece legible', () => {
  const a = lyrics.newLyricsStorageKey(), b = lyrics.newLyricsStorageKey();
  assert.match(a,/^@shopping\/playlist-lyrics\/track:[A-Za-z0-9_-]+$/);
  assert.notEqual(a,b);
  assert.equal(lyrics.getLyricsStorageKey({...base,lyricsKey:a}),a);
  assert.equal(lyrics.getLyricsStorageKey(base),'@shopping/playlist-lyrics/video:ABCDEFGHIJK');
});

test('Borrar la LRC explícitamente no recupera una LRC global del mismo vídeo', async () => {
  assert.equal(await lyrics.getLocalLyrics({...base,lyricsDisabled:true}),null);
});

test('Importación v2 asigna letras independientes a pistas con el mismo vídeo',async () => {
  const snapshots=[];
  const importer=await makeImporter({importBatch: async (...args)=>{snapshots.push(args);return {added:1};}});
  const playlist = text=>({collectionType:'playlist',title:'Pop',tracks:[
    {...base,lyricsBackup:{text,fileName:'song.lrc'}}]});
  await importer({playlists:[playlist('[00:01]A'),playlist('[00:02]B')],collection:'playlist'});
  const [type,items,records] = snapshots[0];
  assert.equal(type,'playlist');
  assert.equal(items.length,2);
  assert.equal(records.length,2);
  assert.notEqual(items[0].tracks[0].lyricsKey,items[1].tracks[0].lyricsKey);
  assert.equal(records[0].record.text,'[00:01]A');
  assert.equal(records[1].record.text,'[00:02]B');
  assert.equal(items[0].tracks[0].lyricsDisabled,false);
});

test('Importar respaldo sin letra no asocia accidentalmente LRC heredada',async () => {
  const snapshots=[];
  const importer=await makeImporter({importBatch:async (...args)=>{snapshots.push(args);return {added:1};}});
  await importer({playlists:[{collectionType:'classical',title:'Bach',tracks:[base]}],collection:'classical'});
  assert.equal(snapshots[0][1][0].tracks[0].lyricsDisabled,true);
  assert.equal(snapshots[0][2].length,0);
});

test('ZIP local elimina claves privadas y URLs de Convex sin red', async () => {
  const a=lyrics.newLyricsStorageKey(), b=lyrics.newLyricsStorageKey();
  const items=[{title:'Pop',collectionType:'playlist',tracks:[{
    ...base,lyricsKey:a,lyricsFileName:'one.lrc',lyricsStorageId:'convex-id',lyricsUri:'https://convex.invalid'
  }]},{title:'Bach',collectionType:'classical',tracks:[{
    ...base,lyricsKey:b,lyricsFileName:'two.lrc'
  }]}];
  const records = new Map([[a,{text:'[00:01]A',fileName:'one.lrc'}],[b,{text:'[00:01]B',fileName:'two.lrc'}]]);
  const backup=await (await makeBackup(async track=>records.get(track.lyricsKey) || null))(items,typeName);
  assert.equal(backup.lyricsEntries,2);
  const [first,second]=backup.playlists.map(p=>p.tracks[0]);
  assert.equal(first.lyricsKey,undefined);
  assert.equal(second.lyricsKey,undefined);
  assert.equal(first.lyricsStorageId,undefined);
  assert.equal(first.lyricsUri,undefined);
  assert.equal(first.lyricsBackup.text,'[00:01]A');
  assert.equal(second.lyricsBackup.text,'[00:01]B');
});

test('Contrato estático: consulta reactiva Convex de playlists desactivada en modo local',async () => {
  const screen=await readFile(new URL('screens/playlist/PlayListScreen.js', root),'utf8');
  const source=await readFile(new URL('services/playlistSource.js', root),'utf8');
  const exportSrc=await readFile(new URL('services/exportUtilityJson.js', root),'utf8');
  assert.match(screen,/const localMode = !isTutorialStyle && Platform\.OS === "web"/);
  assert.match(screen,/clientId && !localMode/);
  assert.match(screen,/await localRepo\.saveWithLyrics\(editingId, localItem, pendingLyrics\)/);
  assert.match(source,/Platform\.OS === 'web' \? 'local' : 'convex'/);
  assert.match(exportSrc,/getPlaylistSource\(type\) === "local"/);
});

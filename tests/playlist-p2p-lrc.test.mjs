import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const srcRoot = new URL('../src/', import.meta.url);
const read = file => readFile(new URL(file, srcRoot),'utf8');
const noImports = source => source.replace(/^import\s+[^;]+;\s*$/gm,'')
  .replace(/export\s+(?=(?:async\s+)?function|const|let)/g,'');
const urlSrc=(await read('services/urlSafety.js')).replace(/export\s+default\s+\{[\s\S]*?\};/g,'');
const parseYouTubeUrl=new Function(noImports(urlSrc)+'\nreturn parseYouTubeUrl;')();
const validSource = noImports(await read('services/playlistImportV2.js'));
const validatePlaylistBackupV2=new Function('parseYouTubeUrl','getLocalLyrics','saveLocalLyrics',
  validSource+'\nreturn validatePlaylistBackupV2;')(parseYouTubeUrl,()=>null,()=>{});
const backupSrc=noImports(await read('services/playlistBackupV2.js'));
const makeBackup = getLocalLyrics => new Function('getLocalLyrics', backupSrc+'\nreturn makePlaylistBackupV2;')(getLocalLyrics);
const transferSrc=noImports(await read('services/playlistP2PTransfer.js'));
const load = (lyrics, importer=async()=>({added:1,skipped:0,lyricsRestored:1})) =>
  new Function('makePlaylistBackupV2','validatePlaylistBackupV2','importPlaylistsLocally',
    transferSrc+'\nreturn { createPortableP2PPlaylist, splitPortableP2PPlaylist, validatePortableP2PPlaylist, restorePortableP2PPlaylist, receivePortableP2PMessage, sendPortableP2PPlaylist, assertTransferLength, P2P_PLAYLIST_CHUNK_CHARS };')
  (makeBackup(async track => lyrics.get(track.lyricsKey) || null),validatePlaylistBackupV2,importer);

const base=(type='playlist')=>({ title: type==='playlist'?'Pop':'Bach',collectionType:type,shareable:true,
  _id:'local-secret',clientId:'private-user',ownerId:'private-owner', composer:'Bach', performer:'Glenn Gould',
  tracks:[{kind:'single',videoId:'ABCDEFGHIJK',title:'Pieza',url:'https://www.youtube.com/watch?v=ABCDEFGHIJK',
    lyricsKey:'@shopping/playlist-lyrics/track:test-private',lyricsFileName:'pieza.lrc',lyricsSize:28,
    lyricsStorageId:'convex-secret',lyricsUri:'https://example.invalid/remote-lyrics'}]});
const local = new Map([['@shopping/playlist-lyrics/track:test-private', {text:'[00:03.50]¡Hola! 🎵',fileName:'pieza.lrc'}]]);

async function sendIntoInbox(api, p) {
  const frames=[];
  await api.sendPortableP2PPlaylist({readyState:'open',bufferedAmount:0},p,(_channel,data)=>frames.push(data));
  const inbox=new Map(); let restored=null;
  for(const frame of frames){ const result=api.receivePortableP2PMessage(inbox,frame); assert.equal(result.handled,true); if(result.payload) restored=result.payload; }
  assert.equal(inbox.size,0);
  return { frames, restored };
}

test('P2P v2 exporta letra LRC local y nunca solicita Convex ni red',async()=>{
  let fetchCount=0;const old=globalThis.fetch;globalThis.fetch=async()=>{fetchCount++;throw Error('NO NETWORK');};
  try{
    const api=load(local);
    const portable=await api.createPortableP2PPlaylist(base());
    assert.equal(portable.version,2);
    assert.equal(portable.type,'shopp-youtube-playlist');
    assert.equal(portable.lyricsEntries,1);
    assert.equal(portable.tracks[0].lyricsBackup.text,'[00:03.50]¡Hola! 🎵');
    const json=JSON.stringify(portable);
    for(const secret of ['local-secret','private-user','private-owner','convex-secret','track:test-private','example.invalid']){
      assert.equal(json.includes(secret),false,secret);
    }
    assert.equal(fetchCount,0);
  }finally{globalThis.fetch=old;}
});

test('LRC Classical llega completa y se restaura solo en Classical, privada por defecto',async()=>{
  const calls=[];const api=load(local,async args=>{calls.push(args);return {added:1,lyricsRestored:1};});
  const {frames,restored}=await sendIntoInbox(api,base('classical'));
  assert.ok(frames.some(f=>f.type==='PLAYLIST_V2_CHUNK'));
  assert.equal(restored.type,'shopp-classical-playlist');
  assert.equal(restored.tracks[0].lyricsBackup.text,'[00:03.50]¡Hola! 🎵');
  assert.equal(restored.composer,'Bach');
  const saved=await api.restorePortableP2PPlaylist(restored);
  assert.equal(saved.collection,'classical');
  assert.equal(saved.result.added,1);
  assert.equal(calls[0].collection,'classical');
  assert.equal(calls[0].replace,false);
  assert.equal(calls[0].playlists[0].shareable,false);
  assert.equal(calls[0].playlists[0].tracks[0].lyricsBackup.text,'[00:03.50]¡Hola! 🎵');
});

test('P2P Music se importa en Music, incluso si el mismo vídeo existe en Classical',async()=>{
  const calls=[];const api=load(local,async opts=>{calls.push(opts);return {added:1,lyricsRestored:1};});
  const {restored}=await sendIntoInbox(api,base('playlist'));
  const result=await api.restorePortableP2PPlaylist(restored);
  assert.equal(result.collection,'playlist');
  assert.equal(calls[0].collection,'playlist');
});

test('Transferencia con fragmentos intercalados de Unicode conserva los emojis de LRC',async()=>{
  const api=load(new Map([['@shopping/playlist-lyrics/track:test-private',
    {text:'[00:01]'+ 'a'.repeat(apiLength()) + '🎵' + 'b'.repeat(12300)+'♬',fileName:'pieza.lrc'}]]));
  function apiLength(){return 12000;}
  const {frames,restored}=await sendIntoInbox(api,base());
  assert.ok(frames.filter(f=>f.type==='PLAYLIST_V2_CHUNK').length>2);
  assert.match(restored.tracks[0].lyricsBackup.text,/🎵/);
  assert.match(restored.tracks[0].lyricsBackup.text,/♬/);
});

test('Transferencia incompleta y fragmento duplicado abortan sin restaurar nada',async()=>{
  let imports=0;const api=load(local,async()=>{imports++;return {added:1};});
  const p=await api.createPortableP2PPlaylist(base());
  const chunks=api.splitPortableP2PPlaylist(p);
  const inbox=new Map();const id='test-123';
  api.receivePortableP2PMessage(inbox,{type:'PLAYLIST_V2_START',transferId:id,totalChunks:chunks.length+1});
  api.receivePortableP2PMessage(inbox,{type:'PLAYLIST_V2_CHUNK',transferId:id,index:0,chunk:chunks[0]});
  assert.throws(()=>api.receivePortableP2PMessage(inbox,{type:'PLAYLIST_V2_CHUNK',transferId:id,index:0,chunk:chunks[0]}),/repetido/);
  assert.equal(inbox.size,0);
  api.receivePortableP2PMessage(inbox,{type:'PLAYLIST_V2_START',transferId:id,totalChunks:2});
  api.receivePortableP2PMessage(inbox,{type:'PLAYLIST_V2_CHUNK',transferId:id,index:0,chunk:chunks[0]});
  assert.throws(()=>api.receivePortableP2PMessage(inbox,{type:'PLAYLIST_V2_END',transferId:id}),/incompleta/);
  assert.equal(imports,0);
});

test('LRC de referencia remota sin contenido local no se envía ni descarga',async()=>{
  const api=load(new Map());
  let fetchCount=0;const old=globalThis.fetch;globalThis.fetch=async()=>{fetchCount++;throw Error('No');};
  try{await assert.rejects(()=>api.createPortableP2PPlaylist(base()),/Falta el contenido LRC/);assert.equal(fetchCount,0);}
  finally{globalThis.fetch=old;}
});

test('Valida URLs y no admite formatos P2P 1 en el nuevo importador',async()=>{
  const api=load(local);const p=await api.createPortableP2PPlaylist(base());
  assert.throws(()=>api.validatePortableP2PPlaylist({...p,version:1}),/Formato de playlist P2P/);
  assert.throws(()=>api.validatePortableP2PPlaylist({...p,tracks:[{...p.tracks[0],url:'https://evil.invalid'}]}),/URL no válida/);
  assert.throws(()=>api.validatePortableP2PPlaylist({...p,lyricsEntries:0}),/declara/);
});

test('Impide sobrecarga de canal con un archivo P2P superior a 8 MB',async()=>{
  const api=load(local);
  assert.throws(()=>api.assertTransferLength('a'.repeat(8*1024*1024+1)),/máximo de 8 MB/);
  assert.throws(()=>api.receivePortableP2PMessage(new Map(),{type:'PLAYLIST_V2_START',transferId:'a',totalChunks:701}),/demasiado grande/);
});

test('Cancelar una transferencia elimina su estado e impide almacenar fragmentos atrasados',async()=>{
  const api=load(local), inbox=new Map(), id='cancel-1';
  api.receivePortableP2PMessage(inbox,{type:'PLAYLIST_V2_START',transferId:id,totalChunks:2});
  assert.equal(inbox.size,1);
  const result=api.receivePortableP2PMessage(inbox,{type:'PLAYLIST_V2_CANCEL',transferId:id});
  assert.equal(result.handled,true);
  assert.equal(inbox.size,0);
  assert.throws(()=>api.receivePortableP2PMessage(inbox,{type:'PLAYLIST_V2_CHUNK',transferId:id,index:0,chunk:'a'}),/sin transferencia/);
});

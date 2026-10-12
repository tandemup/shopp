// Simulated asynchronous IndexedDB requests, without a real browser. This
// verifies transaction scoping / rollback paths, not Safari/Chrome behavior.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const copy = value => value === undefined ? undefined : structuredClone(value);
function makeDatabase() {
  const data = new Map(['playlists', 'entries', 'playlist-migrations'].map(name => [name, new Map()]));
  const ops = [];
  let readWrites = 0;
  function transaction(names, mode) {
    if (mode === 'readwrite') readWrites += 1;
    const snapshots = new Map([...data].map(([name, store]) => [name, new Map([...store].map(([k, v]) => [k, copy(v)]))]));
    const tx = {pending:0, aborted:false, finished:false, oncomplete:null, onabort:null, error:null};
    const request = (storeName, label, fn) => {
      const r={onsuccess:null,onerror:null,result:undefined,error:null};
      tx.pending += 1;
      queueMicrotask(() => {
        if (tx.aborted) return;
        try { r.result=copy(fn()); ops.push(`${mode}:${storeName}:${label}`);r.onsuccess?.(); }
        catch(error){r.error=error;tx.error=error;tx.abort();r.onerror?.();}
        tx.pending-=1;
        queueMicrotask(() => {if(!tx.pending && !tx.aborted && !tx.finished){tx.finished=true;tx.oncomplete?.();}});
      });
      return r;
    };
    const store = name => ({
      get:(key)=>request(name,'get',()=>data.get(name).get(key)),
      getAll:()=>request(name,'getAll',()=>[...data.get(name).values()]),
      getAllKeys:()=>request(name,'getAllKeys',()=>[...data.get(name).keys()]),
      add:(record,key)=>request(name,'add',()=>{
        const id=key??record.id;
        if(data.get(name).has(id))throw Error(`duplicate ${id}`);
        data.get(name).set(id,copy(record));return id;
      }),
      put:(record,key)=>request(name,'put',()=>{
        const id=key??record.id;data.get(name).set(id,copy(record));return id;
      }),
      delete:(key)=>request(name,'delete',()=>data.get(name).delete(key)),
      index:(index)=>({getAll:(type)=>request(name,'by_collection.getAll',()=>
        [...data.get(name).values()].filter(p=>p.collectionType===type))}),
    });
    tx.objectStore=name=>{if(!names.includes(name)) throw Error(`store ${name} missing`);return store(name);};
    tx.abort=()=>{
      if(tx.aborted)return;tx.aborted=true;
      for(const [name,snapshot] of snapshots) data.set(name,snapshot);
      queueMicrotask(()=>tx.onabort?.());
    };
    return tx;
  }
  const db={transaction,close(){},objectStoreNames:{contains:name=>data.has(name)}};
  const indexedDB={open:()=>{
    const r={result:db,onsuccess:null,onerror:null,onupgradeneeded:null};
    queueMicrotask(()=>r.onsuccess?.()); return r;
  }};
  return {indexedDB,data,ops,get readWrites(){return readWrites;}};
}

const source = (await readFile(new URL('../src/storage/playlists/playlistRepository.web.js',import.meta.url),'utf8'))
  .replace(/export\s+(?=(?:async\s+)?function|const|let)/g,'');
function loadRepo(fake) {
  return new Function('indexedDB','TextEncoder', `${source};return {list,get,create,remove,replaceAll,saveWithLyrics,importBatch,update,auditLocalPlaylists};`)(fake.indexedDB,TextEncoder);
}
const media={kind:'single',videoId:'ABCDEFGHIJK',title:'Same video'};
const key='@shopping/playlist-lyrics/track:key-one', other='@shopping/playlist-lyrics/track:key-two';
const lyric=text=>({text,fileName:'lyrics.lrc'});

test('Guardar, sustituir y borrar son atómicos y no cruzan Music y Classical',async () => {
 const db=makeDatabase(), repo=loadRepo(db);
 const musicId=await repo.saveWithLyrics(null,{collectionType:'playlist',title:'Music',tracks:[{...media,lyricsKey:key}]},[{key,record:lyric('MUSIC')}]);
 const classicalId=await repo.saveWithLyrics(null,{collectionType:'classical',title:'Classical',tracks:[{...media,lyricsKey:other}]},[{key:other,record:lyric('CLASSICAL')}]);
 assert.equal((await repo.list('playlist')).length,1);
 assert.equal((await repo.list('classical')).length,1);
 assert.equal(db.data.get('entries').get(key).text,'MUSIC');
 assert.equal(db.data.get('entries').get(other).text,'CLASSICAL');
 assert.equal((await repo.get(musicId)).tracks[0].lyricsKey,key);
 await repo.replaceAll('playlist',[{title:'New Music',collectionType:'playlist',tracks:[{...media,lyricsDisabled:true}]}]);
 assert.equal(db.data.get('entries').has(key),false);
 assert.equal(db.data.get('entries').get(other).text,'CLASSICAL');
 assert.equal((await repo.list('classical')).length,1);
 await repo.remove(classicalId);
 assert.equal(db.data.get('entries').has(other),false);
 assert.equal((await repo.list('classical')).length,0);
 assert.ok(db.readWrites>=4);
});

test('No se permite actualizar un ID inexistente ni reescribir clave compartida antigua',async () => {
 const db=makeDatabase(), repo=loadRepo(db);
 await assert.rejects(()=>repo.saveWithLyrics('missing',{collectionType:'playlist',tracks:[media]},[{key,record:lyric('FAIL')}]),/Transacción|cancelada/);
 assert.equal(db.data.get('entries').size,0);
 await assert.rejects(()=>repo.saveWithLyrics(null,{collectionType:'playlist',tracks:[media]},[
   {key:'@shopping/playlist-lyrics/video:ABCDEFGHIJK',record:lyric('INVALID')}
 ]),/Clave LRC individual/);
 assert.equal(db.data.get('entries').size,0);
 assert.equal(db.data.get('playlists').size,0);
});

test('Importar omite letras de playlists duplicadas y no afecta a otra colección',async () => {
 const db=makeDatabase(),repo=loadRepo(db);
 await repo.create({collectionType:'classical',title:'Clásica',tracks:[media]});
 const items=[{collectionType:'playlist',title:'A',tracks:[{...media,lyricsKey:key}]}];
 const r1=await repo.importBatch('playlist',items,[{key,record:lyric('A')}]);
 assert.equal(r1.added,1); assert.equal(r1.lyricsRestored,1);
 const otherKey='@shopping/playlist-lyrics/track:skip';
 const r2=await repo.importBatch('playlist',[{...items[0],tracks:[{...media,lyricsKey:otherKey}]}],[{key:otherKey,record:lyric('SKIP')}]);
 assert.equal(r2.skipped,1);
 assert.equal(db.data.get('entries').has(otherKey),false);
 assert.equal((await repo.list('classical')).length,1);
});


test('Diagnóstico IndexedDB es de solo lectura y detecta LRC faltantes sin cruzar colecciones', async () => {
 const db=makeDatabase(),repo=loadRepo(db);
 await repo.saveWithLyrics(null,{collectionType:'playlist',title:'Music',tracks:[
   {...media,lyricsKey:key,lyricsFileName:'music.lrc'},
   {...media,lyricsKey:'@shopping/playlist-lyrics/track:missing-key',lyricsFileName:'missing.lrc'},
   {...media,lyricsDisabled:true,lyricsFileName:'detached.lrc'},
 ]},[{key,record:lyric('[00:01.00]Music')}]);
 await repo.saveWithLyrics(null,{collectionType:'classical',title:'Bach',tracks:[
   {...media,lyricsKey:other,lyricsFileName:'bach.lrc'},
 ]},[{key:other,record:lyric('[00:01.00]Bach')}]);
 db.data.get('entries').set('@shopping/playlist-lyrics/track:orphan',{text:'',fileName:'old.lrc'});
 db.data.get('entries').set('@unrelated/item',{text:'whatever'});
 const writesBefore=db.readWrites;
 const music=await repo.auditLocalPlaylists('playlist');
 const classical=await repo.auditLocalPlaylists('classical');
 assert.deepEqual({playlists:music.playlists,tracks:music.tracks,
   lyricsReferenced:music.lyricsReferenced,lyricsFound:music.lyricsFound,
   lyricsMissing:music.lyricsMissing,orphanedScopedKeys:music.orphanedScopedKeys},
   {playlists:1,tracks:3,lyricsReferenced:2,lyricsFound:1,lyricsMissing:1,orphanedScopedKeys:1});
 assert.deepEqual(music.missing,[{playlist:'Music',track:2}]);
 assert.equal(classical.lyricsMissing,0);
 assert.equal(classical.lyricsFound,1);
 assert.equal(classical.orphanedScopedKeys,1);
 assert.equal(db.readWrites,writesBefore);
});

test('Importación de respaldo v1 usa un lote transaccional y evita duplicados', async () => {
 const db=makeDatabase(),repo=loadRepo(db);
 const old=await repo.create({collectionType:'classical',title:'Bach',tracks:[media]});
 const imported=[
   {collectionType:'playlist',title:'Jazz',tracks:[{...media,lyricsDisabled:true}]},
   {collectionType:'playlist',title:'Jazz',tracks:[{...media,lyricsDisabled:true}]},
   {collectionType:'playlist',title:'Rock',tracks:[{...media,lyricsDisabled:true}]},
 ];
 const writesBefore=db.readWrites;
 const result=await repo.importBatch('playlist',imported,[],{replace:false});
 assert.deepEqual({added:result.added,skipped:result.skipped},{added:2,skipped:1});
 assert.equal(db.readWrites,writesBefore+1);
 assert.equal((await repo.list('playlist')).length,2);
 assert.equal((await repo.get(old)).title,'Bach');
 const replacement=await repo.importBatch('playlist',[imported[0]],[],{replace:true});
 assert.equal(replacement.replaced,2);
 assert.equal((await repo.list('playlist')).length,1);
 assert.equal((await repo.list('classical')).length,1);
});

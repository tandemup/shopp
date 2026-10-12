// Testeable sin instalar dependencias: ejecuta Chromium/Chrome en modo headless.
// node tests/indexeddb-playlists-browser.mjs
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoSource = (await readFile(path.join(root,'src/storage/playlists/playlistRepository.web.js'),'utf8')).replace(/export\s+(?=(?:async\s+)?function|const|let)/g,'');
const lyricsSource = (await readFile(path.join(root,'src/storage/lyricsStorage.web.js'),'utf8')).replace(/export\s+(?=(?:async\s+)?function|const|let)/g,'');
const backupSource = (await readFile(path.join(root,'src/services/playlistBackupV2.js'),'utf8'))
 .replace(/import\s+\{\s*getLocalLyrics\s*\}[^;]*;/,'')
 .replace(/export\s+(?=(?:async\s+)?function|const|let)/g,'');
const quote = s => JSON.stringify(s).replace(/<\//g,'<\\/');
const code = `
const repo = (new Function(${quote(repoSource+';return {list,get,create,update,remove,replaceAll,importBatch,saveWithLyrics};') }))();
const lyric = (new Function(${quote(lyricsSource+';return {getLocalLyrics,saveLocalLyrics,removeLocalLyrics,getLyricsStorageKey};')}))();
const makeBackup = (new Function('getLocalLyrics', ${quote(backupSource+';return makePlaylistBackupV2;')}))(lyric.getLocalLyrics);
const ok = (v, message) => { if (!v) throw new Error(message); };
const eq = (a,b,msg) => { if (JSON.stringify(a)!==JSON.stringify(b)) throw new Error(msg+': '+JSON.stringify([a,b])); };
const musicTrack = {kind:'single',videoId:'ABCDEFGHIJK',title:'Canción A'};
const lrcTrack = {kind:'single',videoId:'LMNOPQRSTUV',title:'Canción B'};
const keyA = '@shopping/playlist-lyrics/track:unique-a';
const keyB = '@shopping/playlist-lyrics/track:unique-b';
async function run() {
  // Simula una instalación anterior con entradas existentes (esquema v2).
  await new Promise((resolve,reject)=>{
    const req=indexedDB.open('shopp-local-storage',2);
    req.onupgradeneeded=()=>req.result.createObjectStore('entries');
    req.onsuccess=()=>{
      const db=req.result;
      const tx=db.transaction('entries','readwrite');
      tx.objectStore('entries').put({text:'[00:01.00]Original',fileName:'legacy.lrc'},'@shopping/playlist-lyrics/video:ABCDEFGHIJK');
      tx.oncomplete=()=>{db.close();resolve();};
      tx.onerror=()=>reject(tx.error);
    };
    req.onerror=()=>reject(req.error);
  });
  eq((await lyric.getLocalLyrics(musicTrack)).text,'[00:01.00]Original','No conserva LRC v2');
  const empty=await repo.list('playlist'); eq(empty,[],'Music no empieza vacía');
  // Ambos tipos se aíslan y sus operaciones CRUD persisten.
  const id=await repo.create({collectionType:'playlist',title:'Pop',tracks:[musicTrack]});
  const classic=await repo.create({collectionType:'classical',title:'Bach',composer:'Bach',tracks:[lrcTrack]});
  eq((await repo.list('playlist')).length,1,'Music no se crea');
  eq((await repo.list('classical'))[0].composer,'Bach','Classic no preserva metadatos');
  await repo.update(id,{title:'Pop editada',tracks:[musicTrack,lrcTrack]});
  eq((await repo.get(id)).tracks.length,2,'No se conserva reordenación/edición');
  // Guardado playlist + LRC atómico y exportación LOCAL, sin fetch remoto.
  await repo.saveWithLyrics(id,{collectionType:'playlist',title:'Pop LRC',tracks:[{...musicTrack,lyricsKey:keyA}]},[
    {key:keyA,record:{text:'[00:02.00]Nueva',fileName:'song.lrc'}}]);
  eq((await lyric.getLocalLyrics({...musicTrack,lyricsKey:keyA})).text,'[00:02.00]Nueva','LRC no guardada');
  eq((await lyric.getLocalLyrics(musicTrack)).text,'[00:01.00]Original','Una LRC nueva sobrescribió la antigua compartida');
  await repo.saveWithLyrics(classic,{collectionType:'classical',title:'Bach',tracks:[{...musicTrack,lyricsKey:keyB}]},[
    {key:keyB,record:{text:'[00:03.00]Clásica',fileName:'bach.lrc'}}]);
  eq((await lyric.getLocalLyrics({...musicTrack,lyricsKey:keyB})).text,'[00:03.00]Clásica','La letra Classical no se aisló');
  let calls=0;
  globalThis.fetch=async()=>{calls++;throw new Error('No se permite fetch en exportación local');};
  const payload=await makeBackup(await repo.list('playlist'),'shopp-youtube-playlists');
  eq(payload.lyricsEntries,1,'Respaldo sin LRC');
  eq(payload.playlists[0].tracks[0].lyricsBackup.text,'[00:02.00]Nueva','Respaldo inválido');
  eq(calls,0,'La exportación local accedió a red');
  // Una actualización de playlist inexistente debe abortar también la escritura LRC.
  let rejected=false;
  try { await repo.saveWithLyrics('no-existe',{collectionType:'playlist',title:'Inexistente',tracks:[musicTrack]},[
    {key:keyA,record:{text:'CAMBIADA',fileName:'fail.lrc'}}]); } catch {rejected=true;}
  ok(rejected,'No se abortó la transacción fallida');
  eq((await lyric.getLocalLyrics({...musicTrack,lyricsKey:keyA})).text,'[00:02.00]Nueva','Transacción parcial escrita');
  await repo.importBatch('playlist',[{collectionType:'playlist',title:'Otra',tracks:[lrcTrack]}],[],{replace:true});
  eq((await repo.list('playlist')).length,1,'Reemplazar Music falla');
  eq((await repo.list('classical')).length,1,'Reemplazar Music borró Classical');
  // Reemplazar Music libera su LRC, sin borrar la de Classical.
  eq(await lyric.getLocalLyrics({...musicTrack,lyricsKey:keyA}),null,'Reemplazo no limpió LRC huérfana Music');
  eq((await lyric.getLocalLyrics({...musicTrack,lyricsKey:keyB})).text,'[00:03.00]Clásica','Reemplazar Music borró LRC Classical');
  await repo.remove(classic);
  eq((await repo.list('classical')).length,0,'Borrar Classic falla');
  eq(await lyric.getLocalLyrics({...musicTrack,lyricsKey:keyB}),null,'Borrar Classic dejó LRC huérfana');
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('shopp-local-storage',3);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  ok(['entries','playlists','playlist-migrations'].every(n=>db.objectStoreNames.contains(n)),'Esquema IndexedDB incompleto');
  db.close();
}
run().then(()=>document.body.textContent='PASS: IndexedDB migración, CRUD, aislamiento, LRC, transacciones y exportación local')
.catch(e=>{document.body.textContent='FAIL: '+e.message;});
`;
const tmp=await mkdtemp(path.join(os.tmpdir(),'shopp-idb-'));
try {
 const html=path.join(tmp,'test.html'); await writeFile(html,`<!DOCTYPE html><meta charset="utf-8"><body>RUNNING</body><script>${code.replace(/<\/script/gi,'<\\/script')}</script>`);
 const browser=process.env.CHROMIUM || ['chromium','google-chrome','chromium-browser'].find(b=>!spawnSync('which',[b]).error && spawnSync('which',[b]).status===0);
 if(!browser) throw new Error('No se ha encontrado Chromium/Chrome (usa CHROMIUM=/ruta/chrome)');
 const result=spawnSync(browser,['--headless','--disable-gpu','--no-sandbox',`--user-data-dir=${path.join(tmp,'profile')}`,'--disable-dev-shm-usage','--virtual-time-budget=9000','--dump-dom',`file://${html}`],{encoding:'utf8',timeout:30000});
 assert.equal(result.status,0,`Chromium ha fallado: ${result.stderr?.slice(-500)}`);
 const line=result.stdout.match(/(?:PASS|FAIL):[^<]*/)?.[0];
 if (!line) throw new Error('Prueba no finalizada: '+result.stdout.slice(-500));
 console.log(line);
 assert.ok(line.startsWith('PASS:'),line);
} finally { await rm(tmp,{recursive:true,force:true}); }

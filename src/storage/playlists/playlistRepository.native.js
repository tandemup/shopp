// Native fallback. Storage is serialized under a versioned key to avoid collisions.
import AsyncStorage from '@react-native-async-storage/async-storage';
const KEY='@shopp/local-playlists/v2';
const assertType=t=>{ if(!['playlist','classical'].includes(t)) throw new Error('Colección inválida'); };
const uid=()=>`local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const read=async()=>JSON.parse((await AsyncStorage.getItem(KEY)) || '{"items":[],"migrations":[]}');
const write=async data=>AsyncStorage.setItem(KEY,JSON.stringify(data));
// A serialized queue avoids lost updates from simultaneous writes within this JS runtime.
let queue=Promise.resolve();
const modify=(fn, afterWrite)=>{ const next=queue.then(async()=>{ const data=await read(); const result=await fn(data); await write(data); await afterWrite?.(); return result; }); queue=next.catch(()=>{}); return next; };
export async function list(type){assertType(type); return (await read()).items.filter(x=>x.collectionType===type).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));}
export async function get(id){return (await read()).items.find(x=>x.id===id)||null;}
export async function create(item){assertType(item.collectionType); return modify(data=>{const id=item.id||uid(),now=Date.now();if(data.items.some(x=>x.id===id))throw new Error('ID duplicado');data.items.push({...item,id,_id:id,createdAt:item.createdAt||now,updatedAt:item.updatedAt||now});return id;});}
export async function update(id,changes){return modify(data=>{const i=data.items.findIndex(x=>x.id===id);if(i<0)throw new Error('Playlist inexistente');const old=data.items[i];data.items[i]={...old,...changes,id,_id:id,collectionType:old.collectionType,updatedAt:Date.now()};return data.items[i];});}
// Native equivalent of the web transaction API. LRC values stay in
// AsyncStorage and playlist metadata retains the same shape as IndexedDB.
export async function saveWithLyrics(id,item,lyricsChanges=[],{ preserveTimestamps = false } = {}){
  assertType(item.collectionType);
  if(!Array.isArray(item.tracks)||!Array.isArray(lyricsChanges))throw new Error('Datos de playlist inválidos');
  const scopedKey = /^@shopping\/playlist-lyrics\/track:[A-Za-z0-9_-]+$/;
  const obsoleteKeys = new Set();
  return modify(async data=>{
    const index=id?data.items.findIndex(x=>x.id===id):-1;
    if(id&&index<0)throw new Error('Playlist inexistente');
    const old=index>=0?data.items[index]:null;
    if(old&&old.collectionType!==item.collectionType)throw new Error('Colección incorrecta');
    const nextId=id||item.id||uid(), now=Date.now();
    const record={...old,...item,id:nextId,_id:nextId,collectionType:item.collectionType,
      createdAt:(preserveTimestamps && item.createdAt) || old?.createdAt || now,
      updatedAt:preserveTimestamps ? item.updatedAt : now};
    const other=data.items.filter(x=>x.id!==nextId);
    const inUse=new Set([...other,...[record]].flatMap(p=>(p.tracks||[]).filter(t=>!t.lyricsDisabled&&typeof t.lyricsKey==='string').map(t=>t.lyricsKey)));
    for(const change of lyricsChanges){
      if(typeof change?.key!=='string'||!scopedKey.test(change.key))throw new Error('Clave LRC individual no válida');
      if(change.remove){if(!inUse.has(change.key))obsoleteKeys.add(change.key);continue;}
      if(typeof change?.record?.text!=='string'||new TextEncoder().encode(change.record.text).length>512*1024||!String(change.record.fileName||'').toLowerCase().endsWith('.lrc'))throw new Error('Contenido LRC inválido');
      await AsyncStorage.setItem(change.key,JSON.stringify(change.record));
    }
    if(old){data.items[index]=record;}else{data.items.push(record);}
    if(old)for(const track of old.tracks||[]){
      if(scopedKey.test(track.lyricsKey)&&!inUse.has(track.lyricsKey))obsoleteKeys.add(track.lyricsKey);
    }
    return nextId;
  }, async () => {
    // A failed playlist write must leave the old lyrics attached and readable.
    for (const key of obsoleteKeys) await AsyncStorage.removeItem(key).catch(() => {});
  });
}
export async function remove(id){return modify(async data=>{const removed=data.items.find(x=>x.id===id);if(!removed)return false;data.items=data.items.filter(x=>x.id!==id);const inUse=new Set(data.items.flatMap(p=>(p.tracks||[]).filter(t=>!t.lyricsDisabled&&typeof t.lyricsKey==='string').map(t=>t.lyricsKey)));for(const track of removed.tracks||[])if(track.lyricsKey&&!inUse.has(track.lyricsKey))await AsyncStorage.removeItem(track.lyricsKey);return true;});}
export async function replaceAll(type,items){assertType(type);if(!Array.isArray(items)||items.some(x=>x.collectionType!==type))throw new Error('Colección incorrecta');return modify(data=>{data.items=[...data.items.filter(x=>x.collectionType!==type),...items.map(x=>({...x,id:x.id||uid()}))];return items.length;});}
export async function stageBackup(type,items,lyrics,migrationId){assertType(type);if(!Array.isArray(items)||items.some(x=>x.collectionType!==type))throw new Error('Migración inválida');if(lyrics.length) throw new Error('Migración nativa de letras LRC no habilitada: utiliza PWA para importar este respaldo completo.');return modify(data=>{if(data.items.some(x=>x.collectionType===type))throw new Error('Ya existen playlists locales: se ha cancelado la migración');data.items.push(...items);data.migrations.push({id:migrationId,type,count:items.length,status:'staged',at:Date.now()});return {count:items.length,lyrics:0,migrationId,warning:'LRC no migrados en esta fase nativa'};});}

const signature=item=>`${String(item.title||'').trim().toLowerCase()}|${(item.tracks||[]).map(track=>track.videoId||track.playlistId||'').join(',')}`;
export async function importBatch(type,items,lyrics,{replace=false}={}){
  assertType(type);
  if(!Array.isArray(items)||items.some(item=>item.collectionType!==type)||!Array.isArray(lyrics))throw new Error('Datos de importación no válidos');
  if(lyrics.some(entry=>typeof entry?.key!=='string'||!/^@shopping\/playlist-lyrics\/track:[A-Za-z0-9_-]+$/.test(entry.key)||typeof entry?.record?.text!=='string'||new TextEncoder().encode(entry.record.text).length>512*1024||!String(entry.record.fileName||'').toLowerCase().endsWith('.lrc')))throw new Error('LRC de importación inválido');
  return modify(async data=>{
    const existing=data.items.filter(item=>item.collectionType===type);
    const known=new Set(replace?[]:existing.map(signature));
    if(replace)data.items=data.items.filter(item=>item.collectionType!==type);
    const result={added:0,skipped:0,lyricsRestored:0,conflicts:0,replaced:replace?existing.length:0};
    const added=[];
    for(const item of items){
      const sig=signature(item);
      if(known.has(sig)){result.skipped++;continue;}
      const now=Date.now(),id=uid();
      const record={...item,id,_id:id,createdAt:now,updatedAt:now};
      added.push(record);known.add(sig);result.added++;
    }
    const retained=[...data.items,...added];
    const referenced=new Set(retained.flatMap(playlist=>(playlist.tracks||[]).filter(track=>!track.lyricsDisabled&&typeof track.lyricsKey==='string').map(track=>track.lyricsKey)));
    for(const {key,record} of lyrics){
      if(!referenced.has(key))continue;
      const raw=await AsyncStorage.getItem(key);
      if(raw){try{const prior=JSON.parse(raw);if(String(prior?.text||'').trim()){if(prior.text!==record.text)result.conflicts++;continue;}}catch{}}
      await AsyncStorage.setItem(key,JSON.stringify(record));result.lyricsRestored++;
    }
    data.items.push(...added);
    if(replace){
      const stillUsed=new Set(data.items.flatMap(playlist=>(playlist.tracks||[]).filter(track=>!track.lyricsDisabled&&typeof track.lyricsKey==='string').map(track=>track.lyricsKey)));
      for(const playlist of existing)for(const track of playlist.tracks||[])if(track.lyricsKey&&!stillUsed.has(track.lyricsKey))await AsyncStorage.removeItem(track.lyricsKey);
    }
    return result;
  });
}

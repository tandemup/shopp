// Native fallback. Storage is serialized under a versioned key to avoid collisions.
import AsyncStorage from '@react-native-async-storage/async-storage';
const KEY='@shopp/local-playlists/v2';
const assertType=t=>{ if(!['playlist','classical'].includes(t)) throw new Error('Colección inválida'); };
const uid=()=>`local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const read=async()=>JSON.parse((await AsyncStorage.getItem(KEY)) || '{"items":[],"migrations":[]}');
const write=async data=>AsyncStorage.setItem(KEY,JSON.stringify(data));
// A serialized queue avoids lost updates from simultaneous writes within this JS runtime.
let queue=Promise.resolve();
const modify=fn=>{ const next=queue.then(async()=>{ const data=await read(); const result=await fn(data); await write(data); return result; }); queue=next.catch(()=>{}); return next; };
export async function list(type){assertType(type); return (await read()).items.filter(x=>x.collectionType===type).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));}
export async function get(id){return (await read()).items.find(x=>x.id===id)||null;}
export async function create(item){assertType(item.collectionType); return modify(data=>{const id=item.id||uid(),now=Date.now();if(data.items.some(x=>x.id===id))throw new Error('ID duplicado');data.items.push({...item,id,_id:id,createdAt:item.createdAt||now,updatedAt:item.updatedAt||now});return id;});}
export async function update(id,changes){return modify(data=>{const i=data.items.findIndex(x=>x.id===id);if(i<0)throw new Error('Playlist inexistente');const old=data.items[i];data.items[i]={...old,...changes,id,_id:id,collectionType:old.collectionType,updatedAt:Date.now()};return data.items[i];});}
export async function remove(id){return modify(data=>{data.items=data.items.filter(x=>x.id!==id);});}
export async function replaceAll(type,items){assertType(type);if(!Array.isArray(items)||items.some(x=>x.collectionType!==type))throw new Error('Colección incorrecta');return modify(data=>{data.items=[...data.items.filter(x=>x.collectionType!==type),...items.map(x=>({...x,id:x.id||uid()}))];return items.length;});}
export async function stageBackup(type,items,lyrics,migrationId){assertType(type);if(!Array.isArray(items)||items.some(x=>x.collectionType!==type))throw new Error('Migración inválida');if(lyrics.length) throw new Error('Migración nativa de letras LRC no habilitada: utiliza PWA para importar este respaldo completo.');return modify(data=>{if(data.items.some(x=>x.collectionType===type))throw new Error('Ya existen playlists locales: se ha cancelado la migración');data.items.push(...items);data.migrations.push({id:migrationId,type,count:items.length,status:'staged',at:Date.now()});return {count:items.length,lyrics:0,migrationId,warning:'LRC no migrados en esta fase nativa'};});}

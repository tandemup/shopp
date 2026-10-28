/** Separate IndexedDB database: preserves existing Shopp playlist schema unchanged.
 * A backup is stored durably before any future write coordinator may proceed.
 * No playlist is modified by any function here.
 */
import { assertBackupRoundTrip } from './applyGuards';
const DB='shopp-music-sync-recovery';
const STORE='snapshots';
const clone=x=>JSON.parse(JSON.stringify(x));
function open(){
  if(typeof indexedDB==='undefined') return Promise.reject(Error('IndexedDB no disponible'));
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB,1);
    req.onupgradeneeded=()=>req.result.createObjectStore(STORE,{keyPath:'id'});
    req.onerror=()=>reject(req.error||Error('No se puede abrir recovery vault'));
    req.onblocked=()=>reject(Error('Cierra otras pestañas de Shopp'));
    req.onsuccess=()=>{req.result.onversionchange=()=>req.result.close();resolve(req.result);};
  });
}
function transact(mode, fn){return open().then(db=>new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,mode);let result;
  tx.oncomplete=()=>{db.close();resolve(result);};
  tx.onabort=()=>{db.close();reject(tx.error||Error('No se pudo completar la transacción'))};
  try {fn(tx.objectStore(STORE),v=>result=v)}catch(e){tx.abort();reject(e)}
}));}
function validate(identity, snapshot, lyrics){
  if(!identity?.accountId || !identity?.playlistId || !['playlist','classical'].includes(identity?.collectionType))throw Error('Identidad inválida');
  if(snapshot?.id!==identity.playlistId || snapshot?.collectionType!==identity.collectionType || !Array.isArray(snapshot.tracks) || !Array.isArray(lyrics))throw Error('Copia incompleta');
}
export async function createRecoverySnapshot({identity,snapshot,lyrics,revision}){
  validate(identity,snapshot,lyrics);
  if(!Number.isSafeInteger(revision)||revision<0)throw Error('Revisión inválida');
  const id=`${Date.now()}-${typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2)}`;
  const record=clone({id,identity,snapshot,lyrics,revision,createdAt:Date.now()});
  await transact('readwrite',(s,done)=>{s.add(record);done(id)});
  const verified=await readRecoverySnapshot(id);
  assertBackupRoundTrip(record,verified);
  return {id,createdAt:record.createdAt,revision};
}
export async function readRecoverySnapshot(id){
  if(typeof id!=='string'||!id)throw Error('ID inválido');
  return transact('readonly',(s,done)=>{const r=s.get(id);r.onsuccess=()=>done(r.result?clone(r.result):null)});
}
export async function listRecoverySnapshots(identity){
  if(!identity?.accountId||!identity?.playlistId||!identity?.collectionType)throw Error('Identidad inválida');
  return transact('readonly',(s,done)=>{const r=s.getAll();r.onsuccess=()=>done(r.result.filter(x=>x.identity.accountId===identity.accountId&&x.identity.playlistId===identity.playlistId&&x.identity.collectionType===identity.collectionType).map(x=>({id:x.id,createdAt:x.createdAt,revision:x.revision})).sort((a,b)=>b.createdAt-a.createdAt))});
}
/** Read-only restore preview. Actual restore requires an independently tested, guarded repository transaction. */
export async function previewRecoverySnapshot(id,identity){
  const saved=await readRecoverySnapshot(id);
  if(!saved)throw Error('Copia inexistente');
  if(saved.identity.accountId!==identity?.accountId||saved.identity.collectionType!==identity?.collectionType||saved.identity.playlistId!==identity?.playlistId)throw Error('La copia pertenece a otra cuenta o playlist');
  validate(saved.identity,saved.snapshot,saved.lyrics);
  return saved;
}

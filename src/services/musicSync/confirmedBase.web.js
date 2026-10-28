/**
 * Immutable baseline registry for music synchronization (web-only).
 * A baseline is a confirmed shared revision, NEVER a local snapshot inferred
 * just because a playlist has the same id on two devices.
 * Account-scoped to prevent reuse after a login change.
 */
const NAME = 'shopp-music-sync-checkpoints';
const STORE = 'confirmed-bases';
const VERSION = 1;
function checkIdentity({accountId, collectionType, playlistId}) {
  if (typeof accountId !== 'string' || !accountId.trim()) throw new Error('Falta identidad autenticada');
  if (!['playlist', 'classical'].includes(collectionType)) throw new Error('Colección inválida');
  if (typeof playlistId !== 'string' || !playlistId.trim()) throw new Error('Playlist inválida');
}
function keyOf(identity) { checkIdentity(identity); return JSON.stringify([identity.accountId, identity.collectionType, identity.playlistId]); }
function copy(x) {return JSON.parse(JSON.stringify(x));}
function valid(record) {
  if (!record || !Number.isSafeInteger(record.revision) || record.revision < 1 ||
      record.snapshot?.id !== record.playlistId || record.snapshot?.collectionType !== record.collectionType ||
      !Array.isArray(record.snapshot?.tracks) || !Array.isArray(record.lyrics))
    throw new Error('Base sincronizada inválida');
}
function open() {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB no disponible; no se habilita la fusión'));
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(NAME,VERSION);
    request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE,{keyPath:'key'});};
    request.onsuccess=()=>{request.result.onversionchange=()=>request.result.close(); resolve(request.result);};
    request.onerror=()=>reject(request.error||new Error('No se pudo abrir el registro de bases'));
    request.onblocked=()=>reject(new Error('Cierra otras pestañas de Shopp antes de continuar'));
  });
}
function transaction(mode,task){return open().then(db=>new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,mode);let result;
  tx.oncomplete=()=>{db.close();resolve(result);};
  tx.onabort=()=>{db.close();reject(tx.error||new Error('Transacción cancelada'));};
  try {task(tx.objectStore(STORE),value=>{result=value;});}catch(error){tx.abort();reject(error);}
}));}
/** Read a confirmed base. A missing base is normal and MUST block three-way merge. */
export async function readConfirmedBase(identity){const key=keyOf(identity);
  return transaction('readonly',(store,done)=>{const req=store.get(key);req.onsuccess=()=>{if(req.result){try{valid(req.result);done(copy(req.result));}catch(_error){store.transaction.abort();}}else done(null);};});
}
/**
 * Only call AFTER independently checking: authenticated owner, matching
 * Convex revision, complete local install and durable backup. Never call from
 * preview/comparison or simply because an upload completed.
 * expectedPreviousRevision rejects stale overwrites of local checkpoint.
 */
export async function saveConfirmedBase({accountId,collectionType,playlistId,revision,snapshot,lyrics=[],expectedPreviousRevision=0}){
  const key=keyOf({accountId,collectionType,playlistId});
  const record=copy({key,accountId,collectionType,playlistId,revision,snapshot,lyrics,confirmedAt:Date.now()});valid(record);
  if (!Number.isSafeInteger(expectedPreviousRevision)||expectedPreviousRevision<0) throw new Error('Revisión anterior inválida');
  return transaction('readwrite',(store,done)=>{
    const req=store.get(key);req.onsuccess=()=>{
      const old=req.result?.revision||0;
      if(old!==expectedPreviousRevision || record.revision<=old){store.transaction.abort();return;}
      store.put(record);done(copy(record));
    };
  });
}
export async function clearConfirmedBase(identity){const key=keyOf(identity);return transaction('readwrite',(store,done)=>{store.delete(key);done(true);});}

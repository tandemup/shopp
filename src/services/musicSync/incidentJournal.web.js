/** Durable incident journal. Separate database, no edits to Shopp playlists. */
const NAME='shopp-music-sync-incidents', STORE='incidents';
const clone=x=>JSON.parse(JSON.stringify(x));
function open(){return new Promise((resolve,reject)=>{
  if(typeof indexedDB==='undefined'){reject(Error('IndexedDB no disponible'));return;}
  const req=indexedDB.open(NAME,1);
  req.onupgradeneeded=()=>req.result.createObjectStore(STORE,{keyPath:'id'});
  req.onerror=()=>reject(req.error||Error('Error abriendo incidencias'));
  req.onblocked=()=>reject(Error('Base bloqueada por otra pestaña'));
  req.onsuccess=()=>{req.result.onversionchange=()=>req.result.close();resolve(req.result)};
})}
function tx(mode, fn){return open().then(db=>new Promise((resolve,reject)=>{
 const tr=db.transaction(STORE,mode);let result;
 tr.oncomplete=()=>{db.close();resolve(result)};
 tr.onabort=()=>{db.close();reject(tr.error||Error('Transacción cancelada'))};
 tr.onerror=()=>{};
 try{fn(tr.objectStore(STORE),v=>result=v)}catch(e){try{tr.abort()}catch{}reject(e)}
}))}
const validIdentity=i=>i && typeof i.accountId==='string'&&i.accountId.length>0&&typeof i.playlistId==='string'&&i.playlistId.length>0&&['playlist','classical'].includes(i.collectionType);
/** The caller MUST have already created and read-back-verified the backup. */
export async function registerSyncIncident({identity,backupId,proposal,expectedRemoteRevision,status}){
 if(!validIdentity(identity)||!backupId||!proposal?.snapshot||!Array.isArray(proposal.lyrics)||!Number.isSafeInteger(expectedRemoteRevision)||expectedRemoteRevision<0||typeof status!=='string')throw Error('Incidencia incompleta');
 const id=`${Date.now()}-${globalThis.crypto?.randomUUID?.()??Math.random().toString(36).slice(2)}`;
 const value=clone({id,identity,backupId,proposal,expectedRemoteRevision,status,createdAt:Date.now()});
 await tx('readwrite',(s,done)=>{s.add(value);done(id)});
 const found=await readSyncIncident(id,identity);
 if(JSON.stringify(found)!==JSON.stringify(value))throw Error('Incidencia no verificable');
 return {id,status};
}
export async function readSyncIncident(id,identity){if(!id||!validIdentity(identity))throw Error('Parámetros inválidos');
 return tx('readonly',(s,done)=>{const req=s.get(id);req.onsuccess=()=>{const item=req.result;if(item && (item.identity.accountId!==identity.accountId||item.identity.playlistId!==identity.playlistId||item.identity.collectionType!==identity.collectionType)){s.transaction.abort();return}done(item?clone(item):null)}})
}
export async function listSyncIncidents(identity){if(!validIdentity(identity))throw Error('Identidad inválida');
 return tx('readonly',(s,done)=>{const req=s.getAll();req.onsuccess=()=>done(req.result.filter(item=>item.identity.accountId===identity.accountId&&item.identity.playlistId===identity.playlistId&&item.identity.collectionType===identity.collectionType).map(({id,status,createdAt,backupId})=>({id,status,createdAt,backupId})).sort((a,b)=>b.createdAt-a.createdAt))})
}

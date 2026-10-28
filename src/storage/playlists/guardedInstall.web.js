/** Atomic compare-and-swap for existing playlists and scoped LRC.
 * Operates on Shopp's existing IndexedDB v3; never changes the schema.
 */
const DB='shopp-local-storage', STORE='playlists', LRC='entries';
const scoped=k=>typeof k==='string'&&/^@shopping\/playlist-lyrics\/track:[A-Za-z0-9_-]+$/.test(k);
const stable=x=>JSON.stringify(x,(_k,v)=>v&&!Array.isArray(v)&&typeof v==='object'?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
export async function installMergedExistingCAS({identity,expected,proposal}) {
  if (!identity?.playlistId || expected?.snapshot?.id!==identity.playlistId || proposal?.snapshot?.id!==identity.playlistId ||
    expected.snapshot.collectionType!==identity.collectionType || proposal.snapshot.collectionType!==identity.collectionType ||
    !Array.isArray(proposal.snapshot.tracks) || !Array.isArray(proposal.lyrics) || !Array.isArray(expected.lyrics)) throw Error('Paquete inválido');
  const used=new Set(), nextLyrics=new Map();
  for(const t of proposal.snapshot.tracks){if(t.lyricsKey){if(!scoped(t.lyricsKey) || used.has(t.lyricsKey))throw Error('Claves LRC inseguras');used.add(t.lyricsKey);}}
  for(const entry of proposal.lyrics){if(!scoped(entry.key)||!used.has(entry.key)||nextLyrics.has(entry.key)||typeof entry.record?.text!=='string')throw Error('LRC inválida');nextLyrics.set(entry.key,entry.record);}
  if([...used].some(k=>!nextLyrics.has(k)))throw Error('LRC incompleta');
  if (proposal.snapshot.tracks.some(t=>/^(blob:|file:|content:)/i.test(t.artworkUrl||'')))throw Error('Carátula local no transferible');
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB,3);
    req.onupgradeneeded=()=>{req.transaction.abort();}; // Never initialize a missing DB implicitly.
    req.onerror=()=>reject(req.error||Error('IndexedDB no disponible'));
    req.onblocked=()=>reject(Error('IndexedDB bloqueada'));
    req.onsuccess=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains(STORE)||!db.objectStoreNames.contains(LRC)){db.close();reject(Error('Almacenamiento local no preparado'));return;}
      const tx=db.transaction([STORE,LRC],'readwrite');
      const fail=()=>{try{tx.abort();}catch(_e){}};
      tx.oncomplete=()=>{db.close();resolve({status:'installed'})};
      tx.onabort=()=>{db.close();reject(tx.error||Error('Conflicto local o transacción cancelada'))};
      const ps=tx.objectStore(STORE), ls=tx.objectStore(LRC);
      const current=ps.get(identity.playlistId);
      current.onsuccess=()=>{
        if(!current.result || stable(current.result)!==stable(expected.snapshot)){fail();return;}
        const old=new Map(expected.lyrics.map(x=>[x.key,x.record]));
        const keys=new Set([...old.keys(),...nextLyrics.keys()]);
        const check=[...keys].map(key=>new Promise((res)=>{const r=ls.get(key);r.onsuccess=()=>res({key,actual:r.result});r.onerror=()=>res({key,error:true})}));
        // No await inside IndexedDB transactions: callbacks keep the transaction alive.
        let remaining=check.length, checked=[];
        const commit=()=>{
          if(checked.some(({key,actual,error})=>error||stable(actual??null)!==stable(old.get(key)??null))){fail();return;}
          ps.put({...proposal.snapshot,id:identity.playlistId,_id:identity.playlistId});
          for(const [key,record] of nextLyrics)ls.put(record,key);
          // Do not delete obsolete LRC keys: other playlists may reference them.
        };
        if(!remaining){commit();return;}
        for(const p of check)p.then(v=>{checked.push(v);if(!--remaining)commit();});
      };
    };
  });
}

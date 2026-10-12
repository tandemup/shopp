// IndexedDB v2: retains the existing "entries" object store for LRC.
const DB = 'shopp-local-storage';
const VERSION = 3;
const STORE = 'playlists';
const LRC = 'entries';
const JOURNAL = 'playlist-migrations';
function open() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB no disponible'));
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(LRC)) db.createObjectStore(LRC);
      const playlists = db.objectStoreNames.contains(STORE)
        ? req.transaction.objectStore(STORE)
        : db.createObjectStore(STORE, { keyPath: 'id' });
      if (!playlists.indexNames.contains('by_collection'))
        playlists.createIndex('by_collection', 'collectionType', { unique: false });
      if (!db.objectStoreNames.contains(JOURNAL)) db.createObjectStore(JOURNAL, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Error al abrir IndexedDB'));
    req.onblocked = () => reject(new Error('Cierra las otras pestañas de Shopp para actualizar IndexedDB'));
  });
}
function transaction(names, mode, fn) {
  return open().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(names, mode);
    let value;
    tx.oncomplete = () => { db.close(); resolve(value); };
    tx.onabort = () => { db.close(); reject(tx.error || new Error('Transacción cancelada')); };
    tx.onerror = () => {};
    try { fn(tx, v => { value = v; }); } catch (error) { tx.abort(); reject(error); }
  }));
}
const assertType = type => { if (!['playlist', 'classical'].includes(type)) throw new Error('Colección inválida'); };
const makeId = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export async function list(type) {
  assertType(type);
  return transaction([STORE], 'readonly', (tx, done) => {
    const req = tx.objectStore(STORE).index('by_collection').getAll(type);
    req.onsuccess = () => done(req.result.sort((a,b) => (b.updatedAt || 0) - (a.updatedAt || 0)));
  });
}
export async function get(id) {
  return transaction([STORE], 'readonly', (tx, done) => { const r=tx.objectStore(STORE).get(id); r.onsuccess=()=>done(r.result || null); });
}
export async function create(item) {
  assertType(item.collectionType);
  const now = Date.now(); const id = item.id || makeId();
  const record = { ...item, id, _id: id, createdAt: item.createdAt || now, updatedAt: item.updatedAt || now };
  await transaction([STORE], 'readwrite', tx => tx.objectStore(STORE).add(record));
  return id;
}
export async function update(id, changes) {
  return transaction([STORE], 'readwrite', (tx, done) => {
    const store=tx.objectStore(STORE), r=store.get(id);
    r.onsuccess=()=>{
      if (!r.result) { tx.abort(); return; }
      const next={...r.result,...changes,id,_id:id,collectionType:r.result.collectionType,updatedAt:Date.now()};
      store.put(next); done(next);
    };
  });
}
export async function remove(id) { return transaction([STORE], 'readwrite', tx => tx.objectStore(STORE).delete(id)); }
export async function replaceAll(type, items) {
  assertType(type);
  if (!Array.isArray(items) || items.some(x=>x.collectionType!==type)) throw new Error('Colección incorrecta');
  return transaction([STORE], 'readwrite', (tx, done) => {
    const store=tx.objectStore(STORE), index=store.index('by_collection'), req=index.openCursor(IDBKeyRange.only(type));
    req.onsuccess=()=>{ const cursor=req.result; if(cursor){ cursor.delete(); cursor.continue(); } else {
      items.forEach(item => { const id=item.id || makeId(); store.put({...item,id,_id:id}); }); done(items.length);
    }};
  });
}
// Atomic staging: do not overwrite existing music/classical records, and preserve the old LRC store.
export async function stageBackup(type, items, lyrics, migrationId) {
  assertType(type);
  if (!Array.isArray(items) || items.some(p=>p.collectionType!==type) || !Array.isArray(lyrics)) throw new Error('Migración inválida');
  return transaction([STORE,LRC,JOURNAL], 'readwrite', (tx, done) => {
    const playlists=tx.objectStore(STORE), lrc=tx.objectStore(LRC), journal=tx.objectStore(JOURNAL);
    const existing=playlists.index('by_collection').count(type);
    existing.onsuccess=()=>{
      if(existing.result>0){ tx.abort(); return; }
      items.forEach(item=>playlists.add(item));
      // Shared LRC already on device wins; never overwrite a user's edited local lyrics.
      lyrics.forEach(({key,record})=>{
        const request=lrc.get(key);
        request.onsuccess=()=>{ if(request.result===undefined) lrc.put(record,key); };
      });
      journal.put({id:migrationId,collectionType:type,count:items.length,at:Date.now(),status:'staged'});
      done({count:items.length,lyrics:lyrics.length,migrationId});
    };
  });
}


// Merge or replace a whole collection and its LRC in ONE IndexedDB transaction.
// Music and classical share the database, but never replace one another.
const playlistSignature = p => `${String(p.title || "").trim().toLowerCase()}|${(p.tracks || []).map(t => t.videoId || t.playlistId || "").join(",")}`;
export async function importBatch(type, items, lyrics, { replace = false } = {}) {
  assertType(type);
  if (!Array.isArray(items) || items.some(p => p.collectionType !== type) || !Array.isArray(lyrics)) {
    throw new Error('Datos de importación no válidos');
  }
  return transaction([STORE, LRC], 'readwrite', (tx, done) => {
    const store = tx.objectStore(STORE);
    const lrc = tx.objectStore(LRC);
    const request = store.index('by_collection').getAll(type);
    request.onsuccess = () => {
      const current = request.result || [];
      const known = new Set(replace ? [] : current.map(playlistSignature));
      if (replace) current.forEach(p => store.delete(p.id));
      const result = { added: 0, skipped: 0, lyricsRestored: 0, conflicts: 0, replaced: replace ? current.length : 0 };
      for (const item of items) {
        const signature = playlistSignature(item);
        if (known.has(signature)) { result.skipped++; continue; }
        const now = Date.now();
        const id = makeId();
        store.add({ ...item, id, _id: id, createdAt: now, updatedAt: now });
        known.add(signature);
        result.added++;
      }
      // Existing local lyrics win, including for playlists that are duplicates.
      // Read and write requests are queued while this transaction is active.
      for (const { key, record } of lyrics) {
        const req = lrc.get(key);
        req.onsuccess = () => {
          const existing = req.result;
          if (existing && String(existing.text || '').trim()) {
            if (existing.text !== record.text) result.conflicts++;
          } else {
            lrc.put(record, key);
            result.lyricsRestored++;
          }
        };
      }
      done(result);
    };
  });
}

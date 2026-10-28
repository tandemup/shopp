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
    let blocked = false;
    req.onsuccess = () => {
      // Another tab may have blocked the upgrade. Never leak the connection
      // from a request whose promise was already rejected.
      if (blocked) { req.result.close(); return; }
      req.result.onversionchange = () => req.result.close();
      resolve(req.result);
    };
    req.onerror = () => reject(req.error || new Error('Error al abrir IndexedDB'));
    req.onblocked = () => {
      blocked = true;
      reject(new Error('Cierra las otras pestañas de Shopp para actualizar IndexedDB'));
    };
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
const isScopedLyricsKey = key =>
  typeof key === 'string' && /^@shopping\/playlist-lyrics\/track:[A-Za-z0-9_-]+$/.test(key);
const referencedLyrics = records => new Set(records.flatMap(p =>
  (p.tracks || []).filter(t => !t.lyricsDisabled && isScopedLyricsKey(t.lyricsKey)).map(t => t.lyricsKey)));
const oldLyrics = playlist => new Set((playlist?.tracks || []).map(t => t.lyricsKey).filter(isScopedLyricsKey));

// An LRC is reclaimed only when no remaining playlist (Music or Classical)
// refers to it. This is atomic with deletion of the playlist itself.
export async function remove(id) {
  return transaction([STORE, LRC], 'readwrite', (tx, done) => {
    const store = tx.objectStore(STORE), lrc = tx.objectStore(LRC);
    const request = store.getAll();
    request.onsuccess = () => {
      const existing = request.result || [];
      const target = existing.find(p => p.id === id);
      if (!target) { tx.abort(); return; }
      store.delete(id);
      const inUse = referencedLyrics(existing.filter(p => p.id !== id));
      for (const key of oldLyrics(target)) if (!inUse.has(key)) lrc.delete(key);
      done(true);
    };
  });
}
export async function replaceAll(type, items) {
  assertType(type);
  if (!Array.isArray(items) || items.some(x=>x.collectionType!==type)) throw new Error('Colección incorrecta');
  return transaction([STORE, LRC], 'readwrite', (tx, done) => {
    const store = tx.objectStore(STORE), lrc = tx.objectStore(LRC);
    const req = store.getAll();
    req.onsuccess = () => {
      const all = req.result || [], former = all.filter(p => p.collectionType === type);
      former.forEach(p => store.delete(p.id));
      const next = items.map(item => { const id = item.id || makeId();
        return { ...item, id, _id: id }; });
      next.forEach(item => store.put(item));
      const inUse = referencedLyrics([...all.filter(p => p.collectionType !== type), ...next]);
      for (const p of former) for (const key of oldLyrics(p)) {
        if (!inUse.has(key)) lrc.delete(key);
      }
      done(items.length);
    };
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
  if (lyrics.some(entry => !isScopedLyricsKey(entry?.key) ||
    typeof entry?.record?.text !== 'string' ||
    new TextEncoder().encode(entry.record.text).length > 512 * 1024 ||
    !String(entry.record.fileName || '').toLowerCase().endsWith('.lrc'))) {
    throw new Error('LRC de importación inválida');
  }
  return transaction([STORE, LRC], 'readwrite', (tx, done) => {
    const store = tx.objectStore(STORE), lrc = tx.objectStore(LRC);
    const request = store.getAll();
    request.onsuccess = () => {
      const all = request.result || [];
      const current = all.filter(p => p.collectionType === type);
      const known = new Set(replace ? [] : current.map(playlistSignature));
      if (replace) current.forEach(p => store.delete(p.id));
      const result = { added: 0, skipped: 0, lyricsRestored: 0, conflicts: 0,
        replaced: replace ? current.length : 0 };
      const added = [];
      for (const item of items) {
        const signature = playlistSignature(item);
        if (known.has(signature)) { result.skipped++; continue; }
        const now = Date.now(), id = makeId();
        const record = { ...item, id, _id: id, createdAt: now, updatedAt: now };
        store.add(record);
        added.push(record);
        known.add(signature);
        result.added++;
      }
      const retained = [...all.filter(p => !replace || p.collectionType !== type), ...added];
      const inUse = referencedLyrics(retained);
      for (const { key, record } of lyrics) {
        // Do not write orphan LRC data from skipped duplicate playlists.
        if (!inUse.has(key)) continue;
        const get = lrc.get(key);
        get.onsuccess = () => {
          const existing = get.result;
          if (existing && String(existing.text || '').trim()) {
            if (existing.text !== record.text) result.conflicts++;
          } else {
            lrc.put(record, key);
            result.lyricsRestored++;
          }
        };
      }
      if (replace) {
        for (const old of current) for (const key of oldLyrics(old)) {
          if (!inUse.has(key)) lrc.delete(key);
        }
      }
      done(result);
    };
  });
}

// Persistir una colección y sus cambios LRC en la MISMA transacción.
// No se aplica ningún cambio si la playlist no existe o falla una escritura.
export async function saveWithLyrics(id, item, lyricsChanges = []) {
  assertType(item.collectionType);
  if (!Array.isArray(item.tracks) || !Array.isArray(lyricsChanges)) throw new Error('Datos de playlist inválidos');
  const prepared = lyricsChanges.map(change => {
    // New writes are per-track. Legacy video-wide keys are read-only to
    // prevent editing one playlist from altering another playlist's lyrics.
    const key = change.key;
    if (typeof key !== 'string' || !/^@shopping\/playlist-lyrics\/track:[A-Za-z0-9_-]+$/.test(key)) {
      throw new Error('Clave LRC individual no válida');
    }
    if (change.remove) return {key, remove:true};
    const record = change.record;
    if (!record || typeof record.text !== 'string' ||
      new TextEncoder().encode(record.text).length > 512*1024 ||
      !String(record.fileName || '').toLowerCase().endsWith('.lrc')) {
      throw new Error('Contenido LRC inválido');
    }
    return {key, record};
  });
  const distinct = new Map();
  for (const change of prepared) {
    const prior = distinct.get(change.key);
    if (prior && (prior.remove !== change.remove ||
      (!change.remove && (prior.record.text !== change.record.text || prior.record.fileName !== change.record.fileName)))) {
      throw new Error('Dos pistas usan la misma clave LRC con cambios distintos');
    }
    distinct.set(change.key, change);
  }
  const now = Date.now();
  const nextId = id || item.id || makeId();
  return transaction([STORE, LRC], 'readwrite', (tx, done) => {
    const store = tx.objectStore(STORE), lrc = tx.objectStore(LRC);
    const request = store.getAll();
    request.onsuccess = () => {
      const all = request.result || [];
      const existing = id ? all.find(p => p.id === id) : null;
      if (id && !existing) { tx.abort(); return; }
      if (existing && existing.collectionType !== item.collectionType) { tx.abort(); return; }
      const record = { ...existing, ...item, id: nextId, _id: nextId,
        collectionType: item.collectionType,
        createdAt: existing?.createdAt || now, updatedAt: now };
      // Include ALL collections and the new state of this playlist before
      // deleting any scoped key. Shared/legacy video keys are never removed.
      const inUse = referencedLyrics([...all.filter(p => p.id !== nextId), record]);
      store.put(record);
      for (const change of distinct.values()) {
        if (change.remove) {
          if (!inUse.has(change.key)) lrc.delete(change.key);
        } else {
          lrc.put(change.record, change.key);
        }
      }
      for (const key of oldLyrics(existing)) {
        if (!inUse.has(key)) lrc.delete(key);
      }
      done(nextId);
    };
  });
}

// Diagnóstico de solo lectura. No descarga LRC, no escribe datos ni consulta
// Convex; comprueba ambos tipos de colección antes de marcar claves huérfanas.
export async function auditLocalPlaylists(type) {
  assertType(type);
  return transaction([STORE, LRC], 'readonly', (tx, done) => {
    const recordsReq = tx.objectStore(STORE).getAll();
    const keysReq = tx.objectStore(LRC).getAllKeys();
    let records, keys;
    const inspect = () => {
      if (!records || !keys) return;
      const all = records;
      const selected = all.filter(p => p.collectionType === type);
      const stored = new Set(keys.filter(k => typeof k === 'string'));
      const referenced = referencedLyrics(all);
      const orphanedScopedKeys = [...stored].filter(k => isScopedLyricsKey(k) && !referenced.has(k)).length;
      let tracks = 0, lyricsReferenced = 0, lyricsFound = 0;
      const missing = [];
      for (const playlist of selected) {
        for (const [index, track] of (playlist.tracks || []).entries()) {
          tracks++;
          if (track.lyricsDisabled === true) continue;
          const hasDeclaredLyrics = Boolean(track.lyricsKey || track.lyricsFileName ||
            track.lyricsStorageId || track.lyricsSize || track.lyricsMimeType);
          if (!hasDeclaredLyrics) continue;
          lyricsReferenced++;
          const key = isScopedLyricsKey(track.lyricsKey)
            ? track.lyricsKey
            : track.videoId ? `@shopping/playlist-lyrics/video:${track.videoId}`
            : track.playlistId ? `@shopping/playlist-lyrics/playlist:${track.playlistId}`
            : null;
          if (key && stored.has(key)) lyricsFound++;
          else if (missing.length < 10) missing.push({
            playlist: String(playlist.title || 'Sin título'), track: index + 1,
          });
        }
      }
      done({ collection: type, playlists: selected.length, tracks,
        lyricsReferenced, lyricsFound, lyricsMissing: lyricsReferenced - lyricsFound,
        orphanedScopedKeys, missing });
    };
    recordsReq.onsuccess = () => { records = recordsReq.result; inspect(); };
    keysReq.onsuccess = () => { keys = keysReq.result; inspect(); };
  });
}

// Importación segura de UNA playlist nueva junto con sus letras en una única transacción.
// Rechaza IDs preexistentes y letras incompatibles, sin sobrescribir nunca datos locales.
export async function importSyncedNew(item, lyrics = []) {
  assertType(item?.collectionType);
  if (!item?.id || !Array.isArray(item.tracks) || item.tracks.length > 300 || !Array.isArray(lyrics))
    throw new Error('Paquete de sincronización inválido');
  const keys=new Set(item.tracks.map(t=>t.lyricsKey).filter(Boolean));
  if (item.tracks.some(t=>t.lyricsKey && !isScopedLyricsKey(t.lyricsKey)))
    throw new Error('Clave LRC heredada: importación no permitida');
  if (lyrics.some(l=>!isScopedLyricsKey(l?.key) || !keys.has(l.key) ||
      typeof l.record?.text !== 'string' || !String(l.record.fileName||'').endsWith('.lrc')))
    throw new Error('Letras LRC inválidas');
  if ([...keys].some(key=>!lyrics.some(l=>l.key===key)))
    throw new Error('LRC incompletas');
  return transaction([STORE,LRC], 'readwrite', (tx,done)=>{
    const playlists=tx.objectStore(STORE),entries=tx.objectStore(LRC);
    const exists=playlists.get(item.id);
    exists.onsuccess=()=>{
      if(exists.result){tx.abort();return;}
      // Avoid corrupting unrelated playlists which happen to reference same lyric keys.
      const all=playlists.getAll();
      all.onsuccess=()=>{
        const used=referencedLyrics(all.result||[]);
        if(lyrics.some(l=>used.has(l.key))){tx.abort();return;}
        playlists.add({...item,_id:item.id});
        for(const l of lyrics) entries.add(l.record,l.key); // abort on any collision
        done({status:'imported',id:item.id,lyrics:lyrics.length});
      };
    };
  });
}

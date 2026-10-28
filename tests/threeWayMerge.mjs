/**
 * Shopp music three-way merge planner (pure, read-only).
 * A confirmed, previously synchronized base is REQUIRED. Never infer a base
 * from local or remote data. The result is a proposal, NOT a write operation.
 */
const clone = x => x === undefined ? undefined : JSON.parse(JSON.stringify(x));
const canonical = x => Array.isArray(x) ? x.map(canonical) : x && typeof x === 'object'
  ? Object.fromEntries(Object.keys(x).sort().filter(k => !['sync','updatedAt','syncedAt','revision'].includes(k)).map(k => [k,canonical(x[k])])) : x;
const eq = (a,b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const isObj = x => x && typeof x === 'object' && !Array.isArray(x);
const trackId = t => t?.id || t?.videoId;
function uniqueIndex(tracks, name) {
  if (!Array.isArray(tracks)) throw new Error(`${name}: lista de pistas inválida`);
  const map = new Map();
  for (const track of tracks) {
    const id = trackId(track);
    if (typeof id !== 'string' || !id || map.has(id)) throw new Error(`${name}: pistas sin identificador estable o duplicadas`);
    map.set(id,track);
  }
  return map;
}
const lyricMap = (items,name) => {
  if (!Array.isArray(items)) throw new Error(`${name}: letras inválidas`);
  const map = new Map();
  for (const item of items) {
    if (typeof item?.key !== 'string' || map.has(item.key)) throw new Error(`${name}: clave LRC inválida o duplicada`);
    map.set(item.key,item);
  }
  return map;
};
function mergeValue(base,local,remote,path,conflicts) {
  if (eq(local,remote)) return clone(local);
  if (eq(local,base)) return clone(remote);
  if (eq(remote,base)) return clone(local);
  // Recursively combine independent metadata or track field edits.
  if (isObj(base) && isObj(local) && isObj(remote)) {
    const result = {};
    for (const key of new Set([...Object.keys(base),...Object.keys(local),...Object.keys(remote)])) {
      if (['sync','updatedAt','syncedAt','revision'].includes(key)) continue;
      const value = mergeValue(base[key],local[key],remote[key],`${path}.${key}`,conflicts);
      if (value !== undefined) result[key] = value;
    }
    return result;
  }
  conflicts.push({path,reason:base===undefined?'concurrent-add':'concurrent-edit-or-delete',base:clone(base),local:clone(local),remote:clone(remote)});
  return clone(base); // placeholder ONLY; unusable while unresolved conflicts exist
}
function mergeMap(base, local, remote, label, conflicts) {
  const combined = new Map();
  for (const id of new Set([...base.keys(),...local.keys(),...remote.keys()])) {
    const value=mergeValue(base.get(id),local.get(id),remote.get(id),`${label}.${id}`,conflicts);
    if (value !== undefined) combined.set(id,value);
  }
  return combined;
}
function sequence(base,local,remote,ids,conflicts) {
  const b=base.filter(id=>ids.has(id)), l=local.filter(id=>ids.has(id)), r=remote.filter(id=>ids.has(id));
  if (eq(l,r)) return l;
  if (eq(l,b)) return r;
  if (eq(r,b)) return l;
  // Simultaneous additions/reorders require explicit user choice.
  conflicts.push({path:'tracks.order',reason:'concurrent-order-change',base:b,local:l,remote:r});
  return b;
}
/** @param {{base:{snapshot:object,lyrics?:Array},local:{snapshot:object,lyrics?:Array},remote:{snapshot:object,lyrics?:Array}}} versions */
export function planThreeWayMusicMerge({base,local,remote}) {
  if (![base,local,remote].every(v=>v?.snapshot && Array.isArray(v.snapshot.tracks)))
    throw new Error('Se requieren versiones base, local y remota completas; no se permite una fusión sin base.');
  const snapshots=[base.snapshot,local.snapshot,remote.snapshot];
  if (snapshots.some(x=>x.id!==snapshots[0].id || x.collectionType!==snapshots[0].collectionType))
    throw new Error('Las tres versiones deben pertenecer a la misma playlist y colección');
  const [bt,lt,rt]=snapshots.map((v,i)=>uniqueIndex(v.tracks,['Base','Local','Remota'][i]));
  const [bl,ll,rl]=[base,local,remote].map((v,i)=>lyricMap(v.lyrics||[],['Base','Local','Remota'][i]));
  const conflicts=[];
  const tracks=mergeMap(bt,lt,rt,'tracks',conflicts);
  const lyrics=mergeMap(bl,ll,rl,'lyrics',conflicts);
  const order=sequence([...bt.keys()],[...lt.keys()],[...rt.keys()],new Set(tracks.keys()),conflicts);
  const strip=v=>Object.fromEntries(Object.entries(v).filter(([k])=>!['tracks','sync','updatedAt','syncedAt','revision'].includes(k)));
  const metadata=mergeValue(strip(snapshots[0]),strip(snapshots[1]),strip(snapshots[2]),'playlist',conflicts);
  const merged={snapshot:{...metadata,tracks:order.map(id=>tracks.get(id))},lyrics:[...lyrics.values()]};
  // Missing lyrics and nonportable artwork must be resolved before any future apply API.
  for (const t of merged.snapshot.tracks) {
    if (t.lyricsKey && !lyrics.has(t.lyricsKey)) conflicts.push({path:`tracks.${trackId(t)}.lyricsKey`,reason:'missing-lyrics'});
    if (/^(file:|blob:|content:)/i.test(t.artworkUrl||'')) conflicts.push({path:`tracks.${trackId(t)}.artworkUrl`,reason:'nonportable-artwork'});
  }
  return {playlistId:snapshots[0].id, collectionType:snapshots[0].collectionType,
    canApply:false, // deliberate: no write or apply pipeline in phase 6
    canPropose:conflicts.length===0, conflicts, proposal:merged,
    notice:'Vista previa sin escritura. Aplicación pendiente de copia base persistida, CAS y confirmación explícita.'};
}

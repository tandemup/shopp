// Read-only comparison. This module never writes to the local repository or Convex.
const normalize = value => JSON.stringify(canonical(value));
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().filter(k => !['sync','updatedAt','syncedAt','revision'].includes(k)).map(k => [k,canonical(value[k])]));
  return value;
}
const keyFor = (track, index) => String(track?.id || track?.videoId || `position:${index}`);
const summary = t => t?.title || t?.name || t?.videoId || t?.id || 'Sin título';
export function comparePlaylistVersions(local, remote, localLyrics = [], remoteLyrics = []) {
  if (!local || !remote) throw new Error('Se requieren ambas versiones');
  if (local.id !== remote.id || local.collectionType !== remote.collectionType) throw new Error('No coinciden los identificadores o colecciones');
  const a = Array.isArray(local.tracks) ? local.tracks : [];
  const b = Array.isArray(remote.tracks) ? remote.tracks : [];
  const amap = new Map(a.map((t,i) => [keyFor(t,i),{track:t,index:i}]));
  const bmap = new Map(b.map((t,i) => [keyFor(t,i),{track:t,index:i}]));
  const onlyLocal = [...amap].filter(([id])=>!bmap.has(id)).map(([id,{track}])=>({id,title:summary(track)}));
  const onlyRemote = [...bmap].filter(([id])=>!amap.has(id)).map(([id,{track}])=>({id,title:summary(track)}));
  const modified = [...amap].filter(([id])=>bmap.has(id)).filter(([id,{track}])=>normalize(track)!==normalize(bmap.get(id).track)).map(([id,{track}])=>({id,title:summary(track)}));
  const reordered = a.length===b.length && a.every((t,i)=>bmap.has(keyFor(t,i))) && a.some((t,i)=>bmap.get(keyFor(t,i)).index!==i);
  const core = v => {const {tracks, sync, updatedAt, syncedAt, revision, ...rest}=v;return rest;};
  const metadataChanged = normalize(core(local)) !== normalize(core(remote));
  const lyricSignature = arr => normalize((arr || []).map(e=>({key:e.key,text:e.record?.text,fileName:e.record?.fileName})).sort((x,y)=>String(x.key).localeCompare(String(y.key))));
  const lyricsChanged = lyricSignature(localLyrics)!==lyricSignature(remoteLyrics);
  const differences = onlyLocal.length+onlyRemote.length+modified.length+(reordered?1:0)+(metadataChanged?1:0)+(lyricsChanged?1:0);
  return {id:local.id, title:local.title || local.name || local.id, localCount:a.length, remoteCount:b.length,
    onlyLocal,onlyRemote,modified,reordered,metadataChanged,lyricsChanged,differences,
    equal:differences===0,
    caution:'Comparación informativa. No fusiona, reemplaza ni sube ninguna playlist.'};
}

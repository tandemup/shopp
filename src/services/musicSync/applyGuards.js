/** Pure, fail-closed preflight checks. Never treats a preview as permission to write. */
const copy = x => JSON.parse(JSON.stringify(x));
const stable = x => JSON.stringify(x, (_key, value) => value && !Array.isArray(value) && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b))) : value);
const validId = x => typeof x === 'string' && x.trim().length > 0;
export function assertApplyPreflight({identity,base,local,remote,proposal,expectedRemoteRevision,conflicts,confirmed}) {
  if (!confirmed) throw Error('Es necesaria la confirmación explícita del usuario');
  if (!validId(identity?.accountId) || !validId(identity?.playlistId) || !['playlist','classical'].includes(identity?.collectionType)) throw Error('Identidad inválida');
  if (!Number.isSafeInteger(expectedRemoteRevision) || expectedRemoteRevision < 1 || remote?.revision !== expectedRemoteRevision) throw Error('La revisión remota ha cambiado');
  if (!base || base.accountId!==identity.accountId || base.playlistId!==identity.playlistId || base.collectionType!==identity.collectionType || !Number.isSafeInteger(base.revision) || base.revision < 1 || base.revision > remote.revision) throw Error('Base confirmada inválida');
  if (!Array.isArray(conflicts) || conflicts.length) throw Error('Existen conflictos no resueltos');
  for (const [name, value] of Object.entries({local,remote,proposal})) {
    if (value?.snapshot?.id!==identity.playlistId || value?.snapshot?.collectionType!==identity.collectionType || !Array.isArray(value?.snapshot?.tracks) || !Array.isArray(value?.lyrics)) throw Error(`${name}: paquete incompleto o ajeno`);
  }
  if (!Array.isArray(base.snapshot?.tracks) || !Array.isArray(base.lyrics)) throw Error('Base incompleta');
  for (const track of proposal.snapshot.tracks) {
    if (track.lyricsKey && !proposal.lyrics.some(x=>x.key===track.lyricsKey)) throw Error('LRC incompleta');
    if (/^(blob:|file:|content:)/i.test(String(track.artworkUrl||''))) throw Error('Carátula no transferible');
  }
  return Object.freeze({identity:copy(identity),expectedRemoteRevision,proposal:copy(proposal),local:copy(local),remote:copy(remote),base:copy(base),status:'PREPARED_ONLY'});
}
export function assertBackupRoundTrip(original, restored) {
  if(stable(original)!==stable(restored)) throw Error('La copia de seguridad no coincide con el origen');
  return true;
}

/** Pure fail-closed recovery assessment. Never performs a write. */
export function assessSyncIncident({identity, backup, local, remote, incident}) {
  if (!identity?.accountId || !identity?.playlistId || !['playlist','classical'].includes(identity.collectionType)) throw Error('Identidad inválida');
  if (!incident || incident.identity?.accountId !== identity.accountId || incident.identity?.playlistId !== identity.playlistId || incident.identity?.collectionType !== identity.collectionType) throw Error('Incidencia de otra cuenta o playlist');
  if (!backup || backup.identity?.accountId !== identity.accountId || backup.identity?.playlistId !== identity.playlistId || backup.identity?.collectionType !== identity.collectionType) throw Error('Copia de recuperación ausente o ajena');
  if (!Number.isSafeInteger(incident.expectedRemoteRevision) || incident.expectedRemoteRevision < 0) throw Error('Revisión original inválida');
  const eq=(a,b)=>canonical(a)===canonical(b);
  const revision = remote?.revision;
  if (!Number.isSafeInteger(revision) || revision < 1 || !remote?.snapshot || !local?.snapshot) return {action:'BLOCKED_UNAVAILABLE',reason:'Faltan snapshots completos o una revisión remota verificable'};
  if (!Array.isArray(remote.lyrics) || !Array.isArray(local.lyrics)) return {action:'BLOCKED_INCOMPLETE_LRC',reason:'No es posible verificar todas las letras LRC'};
  const proposed=incident.proposal;
  if (!proposed?.snapshot || !Array.isArray(proposed.lyrics)) return {action:'BLOCKED_NO_PROPOSAL',reason:'No hay propuesta validada'};
  const remoteProposed=eq(remote.snapshot,proposed.snapshot)&&eq(remote.lyrics,proposed.lyrics);
  const localProposed=eq(local.snapshot,proposed.snapshot)&&eq(local.lyrics,proposed.lyrics);
  const oldLocal=eq(local.snapshot,backup.snapshot)&&eq(local.lyrics,backup.lyrics);
  if (remoteProposed && localProposed && revision===incident.expectedRemoteRevision+1)
    return {action:'READY_FOR_CONFIRMATION_REVIEW',reason:'Ambos contenidos coinciden; comprobar checkpoint previo antes de confirmarlo',revision};
  if (revision!==incident.expectedRemoteRevision && revision!==incident.expectedRemoteRevision+1)
    return {action:'BLOCKED_NEW_REMOTE_REVISION',reason:'El remoto ha avanzado; volver a comparar sin restaurar',revision};
  if (revision===incident.expectedRemoteRevision && localProposed)
    return {action:'MANUAL_REMOTE_RETRY',reason:'Local modificado, remoto previo; requiere nuevo CAS con confirmación explícita',revision};
  if (revision===incident.expectedRemoteRevision+1 && remoteProposed && oldLocal)
    return {action:'MANUAL_LOCAL_REPAIR',reason:'Remoto actualizado y local anterior; requiere instalación local CAS con confirmación',revision};
  return {action:'BLOCKED_DIVERGENCE',reason:'Se detectaron cambios incompatibles; conservar todas las versiones y resolver manualmente',revision};
}
function canonical(value){if(value===undefined)return 'undefined';return JSON.stringify(value,(_key,v)=>v&&!Array.isArray(v)&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);}

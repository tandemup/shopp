/** Explicit opt-in sync. Local is committed first, server CAS second.
 * Failures leave a durable recovery snapshot, never silently rollback.
 * Injected IO makes the safety protocol testable without Convex/browser.
 */
export async function applyManualMerge({prepared, io, confirm}) {
  if (confirm !== true || prepared?.status !== 'PREPARED_ONLY') throw Error('Fusión sin confirmación o preparación');
  const {identity,local,proposal,expectedRemoteRevision} = prepared;
  if (!identity?.accountId || !identity?.playlistId || !Number.isSafeInteger(expectedRemoteRevision)) throw Error('Identidad o revisión inválidas');
  if (!io || !['backup','readLocal','applyLocalCAS','uploadCAS','readRemote','saveBase'].every(k=>typeof io[k]==='function')) throw Error('Adaptador incompleto');
  const previous = await io.readLocal(identity);
  if (!previous || JSON.stringify(previous) !== JSON.stringify(local)) throw Error('La playlist local ha cambiado; vuelve a comparar');
  const backup = await io.backup(identity,previous,expectedRemoteRevision);
  if (!backup?.id) throw Error('No se ha confirmado la copia de recuperación');
  await io.applyLocalCAS(identity,local,proposal);
  let remoteResult;
  try {
    remoteResult = await io.uploadCAS(identity,proposal,expectedRemoteRevision);
  } catch(error) {
    return {status:'PARTIAL_REMOTE_ERROR',backupId:backup.id,details:String(error?.message||error)};
  }
  if (remoteResult?.status !== 'uploaded' || remoteResult.revision !== expectedRemoteRevision+1) {
    return {status:'PARTIAL_REMOTE_CONFLICT',backupId:backup.id,remoteRevision:remoteResult?.serverRevision??null};
  }
  try {
    const remote = await io.readRemote(identity);
    if (remote?.revision !== remoteResult.revision || JSON.stringify(remote?.snapshot)!==JSON.stringify(proposal.snapshot) || JSON.stringify(remote?.lyrics)!==JSON.stringify(proposal.lyrics)) {
      return {status:'PENDING_VERIFICATION',backupId:backup.id,remoteRevision:remoteResult.revision};
    }
    const installed = await io.readLocal(identity);
    if (JSON.stringify(installed)!==JSON.stringify(proposal)) {
      return {status:'PENDING_LOCAL_VERIFICATION',backupId:backup.id,remoteRevision:remoteResult.revision};
    }
    await io.saveBase(identity,proposal,remoteResult.revision);
    return {status:'CONFIRMED',revision:remoteResult.revision,backupId:backup.id};
  } catch(error) {
    return {status:'PENDING_RECOVERY',backupId:backup.id,remoteRevision:remoteResult.revision,details:String(error?.message||error)};
  }
}

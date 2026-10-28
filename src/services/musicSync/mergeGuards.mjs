/** Guard before a three-way merge. No writes are performed here. */
export function requireMergeBaseline({identity,base,remote}) {
  if(!identity?.accountId || !identity?.playlistId || !['playlist','classical'].includes(identity.collectionType))throw new Error('Cuenta o playlist inválida');
  if(!base) throw new Error('No existe una base confirmada: requiere reconciliación inicial');
  if(base.accountId!==identity.accountId || base.playlistId!==identity.playlistId || base.collectionType!==identity.collectionType)
    throw new Error('La base no pertenece a esta cuenta y playlist');
  if(!Number.isSafeInteger(base.revision) || base.revision<1 || !Array.isArray(base.snapshot?.tracks) || !Array.isArray(base.lyrics))
    throw new Error('Base incompleta');
  if(base.snapshot.id!==identity.playlistId || base.snapshot.collectionType!==identity.collectionType)throw new Error('Identidad de base incoherente');
  if(!remote || !Number.isSafeInteger(remote.revision) || remote.revision<base.revision || remote.snapshot?.id!==identity.playlistId || remote.snapshot?.collectionType!==identity.collectionType || !Array.isArray(remote.lyrics))
    throw new Error('Instantánea remota incompatible o anticuada');
  return {base:{snapshot:base.snapshot,lyrics:base.lyrics}, expectedRemoteRevision:remote.revision};
}
/** Must re-read Convex before a write; a stale preview cannot authorize an update. */
export function requireUnchangedRevision(expected,current) {
  if (!Number.isSafeInteger(expected)|| expected<1 || current!==expected) throw new Error('Convex ha cambiado: vuelve a comparar antes de aplicar');
  return true;
}

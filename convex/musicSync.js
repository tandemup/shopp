// Manual, opt-in synchronization protocol. Does not touch legacy youtubePlaylists.
import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';
import { query, mutation } from './_generated/server';

const kind = v.union(v.literal('playlist'), v.literal('classical'));
const MAX_SNAPSHOT = 350_000; // JSON UTF-8 bytes; exclude binary artworks.

async function requireAccount(ctx) {
  const ownerId = await getAuthUserId(ctx);
  if (!ownerId) throw new Error('Inicia sesión para sincronizar playlists.');
  const user = await ctx.db.get(ownerId);
  if (!user || user.isAnonymous || user.status === 'blocked') throw new Error('Cuenta sin permiso para sincronizar.');
  return ownerId;
}

export const inventory = query({
  args: {},
  handler: async ctx => {
    const ownerId = await requireAccount(ctx);
    const records = await ctx.db.query('musicSyncPlaylists')
      .withIndex('by_owner_updatedAt', q => q.eq('ownerId', ownerId)).collect();
    return records.map(({localId, collectionType, revision, updatedAt, deletedAt}) =>
      ({localId, collectionType, revision, updatedAt, deletedAt: deletedAt ?? null}));
  },
});

// Explicitly requested manual write; uses compare-and-swap to avoid silent overwrites.
// expectedRevision=0 only creates a record; update requires exact server revision.
export const uploadManual = mutation({
  args: {
    localId: v.string(), collectionType: kind,
    expectedRevision: v.number(), snapshot: v.any(),
  },
  handler: async (ctx, args) => {
    const ownerId = await requireAccount(ctx);
    if (!/^[A-Za-z0-9_-]{1,160}$/.test(args.localId)) throw new Error('ID inválido');
    if (!Number.isSafeInteger(args.expectedRevision) || args.expectedRevision < 0) throw new Error('Revisión inválida');
    const data = args.snapshot;
    if (!data || typeof data !== 'object' || Array.isArray(data) ||
        data.id !== args.localId || data.collectionType !== args.collectionType ||
        !Array.isArray(data.tracks) || data.tracks.length > 300) throw new Error('Playlist inválida');
    const bytes = new TextEncoder().encode(JSON.stringify(data)).length;
    if (bytes > MAX_SNAPSHOT) throw new Error('Playlist demasiado grande para este protocolo');
    // Never trust a client-supplied owner field.
    const existing = await ctx.db.query('musicSyncPlaylists')
      .withIndex('by_owner_localId', q => q.eq('ownerId', ownerId).eq('localId', args.localId)).unique();
    const serverRevision = existing?.revision ?? 0;
    if (existing && existing.collectionType !== args.collectionType) throw new Error('Conflicto de colección');
    if (serverRevision !== args.expectedRevision) return {status:'conflict', serverRevision};
    const revision = serverRevision + 1;
    const clean = {...data};
    delete clean.ownerId;
    const updatedAt = Date.now();
    if (existing) await ctx.db.patch(existing._id, {snapshot:clean, revision, updatedAt, deletedAt:undefined});
    else await ctx.db.insert('musicSyncPlaylists', {
      ownerId, localId:args.localId, collectionType:args.collectionType,
      revision, snapshot:clean, updatedAt,
    });
    return {status:'uploaded', revision};
  },
});

// Preview only. Never automatically overwrites IndexedDB or native AsyncStorage.
export const readSnapshot = query({
  args: {localId:v.string()},
  handler: async (ctx, {localId}) => {
    const ownerId = await requireAccount(ctx);
    const record = await ctx.db.query('musicSyncPlaylists')
      .withIndex('by_owner_localId', q => q.eq('ownerId', ownerId).eq('localId', localId)).unique();
    if (!record || record.deletedAt) return null;
    return {revision:record.revision, snapshot:record.snapshot};
  },
});

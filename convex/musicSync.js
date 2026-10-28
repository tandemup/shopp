// Manual, opt-in synchronization protocol. Does not touch legacy youtubePlaylists.
import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';
import { query, mutation } from './_generated/server';
import { assertMusicSyncPackage } from '../src/services/musicSync/packageValidation.mjs';

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
    expectedRevision: v.number(), snapshot: v.any(), lyrics: v.optional(v.array(v.object({key:v.string(),record:v.any()}))),
  },
  handler: async (ctx, args) => {
    const ownerId = await requireAccount(ctx);
    if (!Number.isSafeInteger(args.expectedRevision) || args.expectedRevision < 0) throw new Error('Revisión inválida');
    const data = args.snapshot;
    const lyrics = args.lyrics || [];
    assertMusicSyncPackage({localId:args.localId, collectionType:args.collectionType, snapshot:data, lyrics});
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
    if (existing) await ctx.db.patch(existing._id, {snapshot:clean, lyrics, revision, updatedAt, deletedAt:undefined});
    else await ctx.db.insert('musicSyncPlaylists', {
      ownerId, localId:args.localId, collectionType:args.collectionType,
      revision, snapshot:clean, lyrics, updatedAt,
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
    const lyrics = record.lyrics || [];
    assertMusicSyncPackage({localId, collectionType:record.collectionType, snapshot:record.snapshot, lyrics});
    return {revision:record.revision, snapshot:record.snapshot, lyrics};
  },
});

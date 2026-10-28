// Phase 1: read-only inventory; no writes to server or device playlists.
import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { query } from "./_generated/server";

async function requireAccount(ctx) {
  const id = await getAuthUserId(ctx);
  if (!id) throw new Error("Inicia sesión para sincronizar playlists.");
  const user = await ctx.db.get(id);
  if (!user || user.isAnonymous) throw new Error("La cuenta Invitado no puede sincronizar playlists privadas.");
  return id;
}

export const inventory = query({
  args: {},
  handler: async (ctx) => {
    const ownerId = await requireAccount(ctx);
    const rows = await ctx.db.query("musicSyncPlaylists")
      .withIndex("by_owner_updatedAt", q => q.eq("ownerId", ownerId)).collect();
    // Avoid sending entire snapshots just to display inventory.
    return rows.map(({localId, collectionType, revision, updatedAt, deletedAt}) =>
      ({ localId, collectionType, revision, updatedAt, deletedAt: deletedAt ?? null }));
  },
});

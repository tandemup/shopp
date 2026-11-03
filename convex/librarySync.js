import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireFeature } from "./lib/auth";

const MAX_CHUNK_CHARS = 220_000;

export const getManifest = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireFeature(ctx, "library");
    return await ctx.db
      .query("libraryCloudManifests")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .first();
  },
});

export const getChunk = query({
  args: {
    snapshotId: v.string(),
    index: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireFeature(ctx, "library");
    const chunk = await ctx.db
      .query("libraryCloudSnapshots")
      .withIndex("by_owner_snapshot_index", (q) =>
        q
          .eq("ownerId", user._id)
          .eq("snapshotId", args.snapshotId)
          .eq("index", args.index),
      )
      .first();
    return chunk?.payload ?? null;
  },
});

export const putChunk = mutation({
  args: {
    snapshotId: v.string(),
    index: v.number(),
    payload: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireFeature(ctx, "library");
    if (!args.snapshotId || args.snapshotId.length > 100) {
      throw new Error("Identificador de sincronización no válido.");
    }
    if (!Number.isInteger(args.index) || args.index < 0) {
      throw new Error("Número de bloque no válido.");
    }
    if (args.payload.length > MAX_CHUNK_CHARS) {
      throw new Error("El bloque supera el tamaño permitido.");
    }

    const existing = await ctx.db
      .query("libraryCloudSnapshots")
      .withIndex("by_owner_snapshot_index", (q) =>
        q
          .eq("ownerId", user._id)
          .eq("snapshotId", args.snapshotId)
          .eq("index", args.index),
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        payload: args.payload,
        createdAt: Date.now(),
      });
    } else {
      await ctx.db.insert("libraryCloudSnapshots", {
        ownerId: user._id,
        snapshotId: args.snapshotId,
        index: args.index,
        payload: args.payload,
        createdAt: Date.now(),
      });
    }
    return { ok: true };
  },
});

export const commitSnapshot = mutation({
  args: {
    snapshotId: v.string(),
    chunkCount: v.number(),
    expectedSnapshotId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireFeature(ctx, "library");
    if (!Number.isInteger(args.chunkCount) || args.chunkCount < 1 || args.chunkCount > 500) {
      throw new Error("Número de bloques de Biblioteca no válido.");
    }

    const manifest = await ctx.db
      .query("libraryCloudManifests")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .first();
    if ((manifest?.snapshotId ?? undefined) !== args.expectedSnapshotId) {
      return { ok: false, conflict: true };
    }

    for (let index = 0; index < args.chunkCount; index += 1) {
      const chunk = await ctx.db
        .query("libraryCloudSnapshots")
        .withIndex("by_owner_snapshot_index", (q) =>
          q
            .eq("ownerId", user._id)
            .eq("snapshotId", args.snapshotId)
            .eq("index", index),
        )
        .first();
      if (!chunk) throw new Error(`Falta el bloque ${index + 1} de Biblioteca.`);
    }

    const nextManifest = {
      ownerId: user._id,
      snapshotId: args.snapshotId,
      chunkCount: args.chunkCount,
      updatedAt: Date.now(),
    };
    if (manifest) await ctx.db.patch(manifest._id, nextManifest);
    else await ctx.db.insert("libraryCloudManifests", nextManifest);

    // Retira las versiones antiguas y los intentos interrumpidos para que el
    // almacenamiento de la cuenta no crezca con cada sincronización.
    const oldChunks = await ctx.db
      .query("libraryCloudSnapshots")
      .withIndex("by_owner_snapshot_index", (q) => q.eq("ownerId", user._id))
      .collect();
    for (const chunk of oldChunks) {
      if (chunk.snapshotId !== args.snapshotId) await ctx.db.delete(chunk._id);
    }

    return { ok: true, manifest: nextManifest };
  },
});

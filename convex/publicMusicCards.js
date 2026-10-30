import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const publicIdPattern = /^card-[a-z0-9-]{12,70}$/;
const youtubeIdPattern = /^[A-Za-z0-9_-]{11}$/;
const clean = (s, limit) => String(s || "").trim().slice(0, limit);
const sourceIdOK = s => typeof s === "string" && s.length > 0 && s.length <= 180;

async function requireOwner(ctx) {
  const ownerId = await getAuthUserId(ctx);
  if (!ownerId) throw new Error("Debes iniciar sesión para gestionar tus tarjetas.");
  const user = await ctx.db.get(ownerId);
  if (!user || user.status === "blocked") throw new Error("Cuenta no autorizada.");
  return ownerId;
}

async function getBySource(ctx, ownerId, sourcePlaylistId, sourceTrackKey) {
  return ctx.db.query("publicMusicCards").withIndex("by_owner_source", q =>
    q.eq("ownerId", ownerId).eq("sourcePlaylistId", sourcePlaylistId).eq("sourceTrackKey", sourceTrackKey)
  ).first();
}

export const publishSingle = mutation({
  args: {
    id: v.string(),
    title: v.string(),
    author: v.string(),
    videoId: v.string(),
    lyrics: v.optional(v.string()),
    sourcePlaylistId: v.optional(v.string()),
    sourceTrackKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const ownerId = await requireOwner(ctx);
    if (!publicIdPattern.test(args.id) || !youtubeIdPattern.test(args.videoId)) throw new Error("Identificador no válido.");
    if (!args.title.trim() || args.title.length > 120 || args.author.length > 100) throw new Error("Datos de canción no válidos.");
    if (args.lyrics != null && args.lyrics.length > 90000) throw new Error("La letra LRC supera 90 KB.");
    const hasSource = args.sourcePlaylistId !== undefined || args.sourceTrackKey !== undefined;
    if (hasSource && (!sourceIdOK(args.sourcePlaylistId) || args.sourceTrackKey !== "single")) throw new Error("Origen de tarjeta no válido.");
    if (hasSource) {
      const current = await getBySource(ctx, ownerId, args.sourcePlaylistId, args.sourceTrackKey);
      if (current) return { id: current.publicId, reused: true }; // never overwrite an issued QR
    }
    const existingId = await ctx.db.query("publicMusicCards").withIndex("by_public_id", q => q.eq("publicId", args.id)).unique();
    if (existingId) throw new Error("El identificador de tarjeta ya existe.");
    await ctx.db.insert("publicMusicCards", {
      publicId: args.id,
      ownerId,
      title: clean(args.title, 120),
      author: clean(args.author, 100),
      videoId: args.videoId,
      ...(args.lyrics ? { lyrics: args.lyrics } : {}),
      ...(hasSource ? { sourcePlaylistId: args.sourcePlaylistId, sourceTrackKey: args.sourceTrackKey } : {}),
      createdAt: Date.now(),
    });
    return { id: args.id, reused: false };
  },
});

// Explicit migration for existing cards. Requires owner AND the previous video to match.
// Never guess a source by title or YouTube ID alone.
export const linkExisting = mutation({
  args: { id: v.string(), sourcePlaylistId: v.string(), sourceTrackKey: v.string(), expectedVideoId: v.string() },
  handler: async (ctx, args) => {
    const ownerId = await requireOwner(ctx);
    if (!publicIdPattern.test(args.id) || !sourceIdOK(args.sourcePlaylistId) || args.sourceTrackKey !== "single") throw new Error("Vinculación inválida.");
    const card = await ctx.db.query("publicMusicCards").withIndex("by_public_id", q => q.eq("publicId", args.id)).unique();
    if (!card || card.ownerId !== ownerId) throw new Error("Tarjeta no encontrada o sin permiso.");
    if (card.videoId !== args.expectedVideoId) throw new Error("El vídeo publicado no coincide; vinculación cancelada.");
    if (card.sourcePlaylistId || card.sourceTrackKey) {
      if (card.sourcePlaylistId === args.sourcePlaylistId && card.sourceTrackKey === args.sourceTrackKey) return { id: card.publicId, reused: true };
      throw new Error("Esta tarjeta ya está vinculada a otra playlist.");
    }
    const current = await getBySource(ctx, ownerId, args.sourcePlaylistId, args.sourceTrackKey);
    if (current) throw new Error("Esta canción ya tiene otra tarjeta asociada. No se han modificado las fichas.");
    await ctx.db.patch(card._id, { sourcePlaylistId: args.sourcePlaylistId, sourceTrackKey: args.sourceTrackKey });
    return { id: card.publicId, reused: true };
  },
});

export const getPublic = query({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    if (!publicIdPattern.test(id)) return null;
    const card = await ctx.db.query("publicMusicCards").withIndex("by_public_id", q => q.eq("publicId", id)).unique();
    if (!card) return null;
    return { id: card.publicId, title: card.title, author: card.author, videoId: card.videoId, lyrics: card.lyrics || null };
  },
});

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const ownerId = await getAuthUserId(ctx);
    if (!ownerId) return [];
    return (await ctx.db.query("publicMusicCards").withIndex("by_owner", q => q.eq("ownerId", ownerId)).collect())
      .map(c => ({ id: c.publicId, title: c.title, author: c.author, videoId: c.videoId, createdAt: c.createdAt,
        sourcePlaylistId: c.sourcePlaylistId || null, sourceTrackKey: c.sourceTrackKey || null }));
  },
});

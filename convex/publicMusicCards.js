import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Fase 1: instantáneas inmutables. No se edita una ficha al cambiar la playlist local.
const publicId = /^card-[a-z0-9-]{12,70}$/;
const youtubeId = /^[A-Za-z0-9_-]{11}$/;
const clean = (s, limit) => String(s || "").trim().slice(0, limit);

export const publishSingle = mutation({
  args: {
    id: v.string(),
    title: v.string(),
    author: v.string(),
    videoId: v.string(),
    lyrics: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const ownerId = await getAuthUserId(ctx);
    if (!ownerId) throw new Error("Debes iniciar sesión para publicar.");
    const owner = await ctx.db.get(ownerId);
    if (!owner || owner.status === "blocked") throw new Error("Cuenta no autorizada.");
    if (!publicId.test(args.id) || !youtubeId.test(args.videoId)) throw new Error("Identificador no válido.");
    if (!args.title.trim() || args.title.length > 120 || args.author.length > 100) throw new Error("Datos de canción no válidos.");
    if (args.lyrics != null && args.lyrics.length > 90000) throw new Error("La letra LRC supera 90 KB. No publicada.");
    const exists = await ctx.db.query("publicMusicCards").withIndex("by_public_id", q => q.eq("publicId", args.id)).unique();
    if (exists) throw new Error("Este identificador ya está publicado. No se sobrescriben tarjetas impresas.");
    await ctx.db.insert("publicMusicCards", {
      publicId: args.id,
      ownerId,
      title: clean(args.title, 120),
      author: clean(args.author, 100),
      videoId: args.videoId,
      ...(args.lyrics ? { lyrics: args.lyrics } : {}),
      createdAt: Date.now(),
    });
    return { id: args.id };
  },
});

// Consulta pública: devuelve solo los datos necesarios para reproducir la tarjeta.
export const getPublic = query({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    if (!publicId.test(id)) return null;
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
      .map(c => ({ id: c.publicId, title: c.title, author: c.author, createdAt: c.createdAt }));
  },
});

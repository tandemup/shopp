import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const PLAYLIST_ID = /^[A-Za-z0-9_-]{10,80}$/;
const trackValidator = v.object({
  kind: v.union(v.literal("single"), v.literal("album")),
  videoId: v.optional(v.string()),
  playlistId: v.optional(v.string()),
  title: v.string(),
  lyricsStorageId: v.optional(v.id("_storage")),
  lyricsFileName: v.optional(v.string()),
  lyricsMimeType: v.optional(v.string()),
  lyricsSize: v.optional(v.number()),
});

function cleanClientId(value) {
  const result = String(value || "")
    .trim()
    .slice(0, 120);
  return result || null;
}

async function getOwnerId(ctx, clientId) {
  const authUserId = await getAuthUserId(ctx);
  if (authUserId) return String(authUserId);
  const cleanId = cleanClientId(clientId);
  if (!cleanId) throw new Error("No se pudo identificar este dispositivo.");
  return `client:${cleanId}`;
}

function normalizeTutorial(titleValue, trackValues) {
  const title = String(titleValue || "")
    .trim()
    .slice(0, 120);
  if (!title) throw new Error("Escribe el nombre del tutorial.");
  if (
    !Array.isArray(trackValues) ||
    trackValues.length < 1 ||
    trackValues.length > 20
  ) {
    throw new Error("El tutorial debe contener entre 1 y 20 vídeos o series.");
  }
  const seen = new Set();
  const tracks = trackValues.map((track, index) => {
    const kind = track.kind === "album" ? "album" : "single";
    const videoId = String(track.videoId || "").trim();
    const playlistId = String(track.playlistId || "").trim();
    const mediaId = kind === "album" ? playlistId : videoId;
    if (
      (kind === "single" && !VIDEO_ID.test(videoId)) ||
      (kind === "album" && !PLAYLIST_ID.test(playlistId))
    ) {
      throw new Error(`El vídeo o serie ${index + 1} no es válido.`);
    }
    if (seen.has(`${kind}:${mediaId}`))
      throw new Error(`El elemento ${index + 1} está repetido.`);
    seen.add(`${kind}:${mediaId}`);
    return {
      kind,
      videoId: videoId || undefined,
      playlistId: playlistId || undefined,
      url:
        kind === "album"
          ? `https://www.youtube.com/playlist?list=${playlistId}`
          : `https://www.youtube.com/watch?v=${videoId}`,
      title:
        String(track.title || "")
          .trim()
          .slice(0, 120) ||
        `${kind === "album" ? "Serie" : "Vídeo"} ${index + 1}`,
      lyricsStorageId: track.lyricsStorageId,
      lyricsFileName: track.lyricsFileName?.slice(0, 160),
      lyricsMimeType: track.lyricsMimeType,
      lyricsSize: track.lyricsSize,
    };
  });
  return { title, tracks };
}

async function getTutorials(ctx, clientId) {
  const ownerId = await getOwnerId(ctx, clientId);
  return await ctx.db
    .query("youtubeTutorials")
    .withIndex("by_owner_updatedAt", (q) => q.eq("ownerId", ownerId))
    .order("desc")
    .collect();
}

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => await ctx.storage.generateUploadUrl(),
});

export const listMine = query({
  args: { clientId: v.optional(v.string()) },
  handler: async (ctx, args) => await getTutorials(ctx, args.clientId),
});

export const create = mutation({
  args: {
    clientId: v.optional(v.string()),
    title: v.string(),
    tracks: v.array(trackValidator),
  },
  handler: async (ctx, args) => {
    const ownerId = await getOwnerId(ctx, args.clientId);
    const tutorial = normalizeTutorial(args.title, args.tracks);
    const now = Date.now();
    return await ctx.db.insert("youtubeTutorials", {
      ownerId,
      ...tutorial,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    playlistId: v.id("youtubeTutorials"),
    clientId: v.optional(v.string()),
    title: v.string(),
    tracks: v.array(trackValidator),
  },
  handler: async (ctx, args) => {
    const ownerId = await getOwnerId(ctx, args.clientId);
    const current = await ctx.db.get(args.playlistId);
    if (!current || current.ownerId !== ownerId)
      throw new Error("No puedes editar este tutorial.");
    await ctx.db.patch(args.playlistId, {
      ...normalizeTutorial(args.title, args.tracks),
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: {
    playlistId: v.id("youtubeTutorials"),
    clientId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const ownerId = await getOwnerId(ctx, args.clientId);
    const current = await ctx.db.get(args.playlistId);
    if (!current || current.ownerId !== ownerId)
      throw new Error("No puedes borrar este tutorial.");
    await ctx.db.delete(args.playlistId);
  },
});

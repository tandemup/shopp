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
  const result = String(value || "").trim().slice(0, 120);
  return result || null;
}

async function getOwnerId(ctx, clientId) {
  const authUserId = await getAuthUserId(ctx);
  if (authUserId) return String(authUserId);
  const cleanId = cleanClientId(clientId);
  if (!cleanId) throw new Error("No se pudo identificar este dispositivo.");
  return `client:${cleanId}`;
}

function normalizePlaylist(titleValue, trackValues) {
  const title = String(titleValue || "").trim().slice(0, 120);
  if (!title) throw new Error("Escribe el nombre de la playlist.");
  if (!Array.isArray(trackValues) || trackValues.length < 2 || trackValues.length > 20) {
    throw new Error("La playlist debe contener entre 2 y 20 elementos.");
  }
  const seen = new Set();
  const tracks = trackValues.map((track, index) => {
    const kind = track.kind === "album" ? "album" : "single";
    const videoId = String(track.videoId || "").trim();
    const playlistId = String(track.playlistId || "").trim();
    const mediaId = kind === "album" ? playlistId : videoId;
    if ((kind === "single" && !VIDEO_ID.test(videoId)) ||
        (kind === "album" && !PLAYLIST_ID.test(playlistId))) {
      throw new Error(`El ${kind === "album" ? "álbum" : "vídeo"} ${index + 1} no es válido.`);
    }
    if (seen.has(`${kind}:${mediaId}`)) throw new Error(`El elemento ${index + 1} está repetido.`);
    seen.add(`${kind}:${mediaId}`);
    if (track.lyricsStorageId && !String(track.lyricsFileName || "").toLowerCase().endsWith(".lrc")) {
      throw new Error(`Las letras del elemento ${index + 1} deben ser .lrc.`);
    }
    if ((track.lyricsSize || 0) > 512 * 1024) {
      throw new Error(`El archivo LRC del elemento ${index + 1} supera 512 KB.`);
    }
    return {
      kind,
      videoId: videoId || undefined,
      playlistId: playlistId || undefined,
      url: kind === "album"
        ? `https://www.youtube.com/playlist?list=${playlistId}`
        : `https://www.youtube.com/watch?v=${videoId}`,
      title: String(track.title || "").trim().slice(0, 120) || `${kind === "album" ? "Álbum" : "Single"} ${index + 1}`,
      lyricsStorageId: track.lyricsStorageId,
      lyricsFileName: track.lyricsFileName?.slice(0, 160),
      lyricsMimeType: track.lyricsMimeType,
      lyricsSize: track.lyricsSize,
    };
  });
  return { title, tracks };
}

async function decoratePlaylist(ctx, playlist) {
  return {
    ...playlist,
    tracks: await Promise.all(playlist.tracks.map(async (track) => ({
      ...track,
      lyricsUri: track.lyricsStorageId ? await ctx.storage.getUrl(track.lyricsStorageId) : undefined,
    }))),
  };
}

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => await ctx.storage.generateUploadUrl(),
});

export const listMine = query({
  args: { clientId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const ownerId = await getOwnerId(ctx, args.clientId);
    const items = await ctx.db.query("youtubePlaylists")
      .withIndex("by_owner_updatedAt", (q) => q.eq("ownerId", ownerId))
      .order("desc").collect();
    return await Promise.all(items.map((item) => decoratePlaylist(ctx, item)));
  },
});

export const create = mutation({
  args: { clientId: v.optional(v.string()), title: v.string(), tracks: v.array(trackValidator) },
  handler: async (ctx, args) => {
    const ownerId = await getOwnerId(ctx, args.clientId);
    const playlist = normalizePlaylist(args.title, args.tracks);
    const now = Date.now();
    return await ctx.db.insert("youtubePlaylists", { ownerId, ...playlist, createdAt: now, updatedAt: now });
  },
});

export const update = mutation({
  args: { playlistId: v.id("youtubePlaylists"), clientId: v.optional(v.string()), title: v.string(), tracks: v.array(trackValidator) },
  handler: async (ctx, args) => {
    const ownerId = await getOwnerId(ctx, args.clientId);
    const current = await ctx.db.get(args.playlistId);
    if (!current || current.ownerId !== ownerId) throw new Error("No puedes editar esta playlist.");
    const playlist = normalizePlaylist(args.title, args.tracks);
    const nextIds = new Set(playlist.tracks.map((track) => track.lyricsStorageId).filter(Boolean));
    await ctx.db.patch(args.playlistId, { ...playlist, updatedAt: Date.now() });
    for (const oldTrack of current.tracks) {
      if (oldTrack.lyricsStorageId && !nextIds.has(oldTrack.lyricsStorageId)) {
        try { await ctx.storage.delete(oldTrack.lyricsStorageId); } catch (error) {
          console.warn("[playlists.update] No se pudo borrar un LRC anterior", error);
        }
      }
    }
  },
});

export const remove = mutation({
  args: { playlistId: v.id("youtubePlaylists"), clientId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const ownerId = await getOwnerId(ctx, args.clientId);
    const current = await ctx.db.get(args.playlistId);
    if (!current || current.ownerId !== ownerId) throw new Error("No puedes borrar esta playlist.");
    await ctx.db.delete(args.playlistId);
    for (const track of current.tracks) {
      if (track.lyricsStorageId) {
        try { await ctx.storage.delete(track.lyricsStorageId); } catch (error) {
          console.warn("[playlists.remove] No se pudo borrar un LRC", error);
        }
      }
    }
  },
});

import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";

import {
  MAX_TUTORIAL_ITEMS,
  mergeTutorialItems,
  tutorialItemKey,
} from "./lib/tutorialItems";

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const PLAYLIST_ID = /^[A-Za-z0-9_-]{10,80}$/;

function extractYouTubePublishedAt(html) {
  const match = String(html || "").match(
    /["'](?:publishDate|uploadDate)["']\s*:\s*["'](\d{4}-\d{2}-\d{2})(?:T[^"']*)?["']/i,
  );
  if (!match?.[1]) return null;
  const timestamp = Date.parse(`${match[1]}T00:00:00Z`);
  return Number.isFinite(timestamp) ? timestamp : null;
}

async function fetchYouTubePublishedAt(videoId) {
  const response = await fetch(
    `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`,
    {
      headers: {
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent": "Mozilla/5.0 (compatible; Shopp/1.0)",
      },
    },
  );
  if (!response.ok) return null;
  return extractYouTubePublishedAt(await response.text());
}
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

const contentTypeValidator = v.optional(
  v.union(v.literal("tutorial"), v.literal("news")),
);

function normalizeContentType(value) {
  return value === "news" ? "news" : "tutorial";
}

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
    trackValues.length > MAX_TUTORIAL_ITEMS
  ) {
    throw new Error(
      `El tutorial debe contener entre 1 y ${MAX_TUTORIAL_ITEMS} vídeos o series.`,
    );
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

async function getTutorials(ctx, clientId, contentType) {
  const ownerId = await getOwnerId(ctx, clientId);
  const expectedContentType = normalizeContentType(contentType);
  const tutorials = await ctx.db
    .query("youtubeTutorials")
    .withIndex("by_owner_updatedAt", (q) => q.eq("ownerId", ownerId))
    .order("desc")
    .collect();
  const matchingTutorials = tutorials.filter(
    (tutorial) =>
      normalizeContentType(tutorial.contentType) === expectedContentType,
  );
  if (expectedContentType !== "news") return matchingTutorials;
  return matchingTutorials.sort(
    (left, right) =>
      Number(right.youtubePublishedAt || 0) -
        Number(left.youtubePublishedAt || 0) ||
      Number(right.updatedAt || 0) - Number(left.updatedAt || 0),
  );
}

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => await ctx.storage.generateUploadUrl(),
});

export const listMine = query({
  args: { clientId: v.optional(v.string()), contentType: contentTypeValidator },
  handler: async (ctx, args) =>
    await getTutorials(ctx, args.clientId, args.contentType),
});

export const create = mutation({
  args: {
    clientId: v.optional(v.string()),
    contentType: contentTypeValidator,
    title: v.string(),
    tracks: v.array(trackValidator),
  },
  handler: async (ctx, args) => {
    const ownerId = await getOwnerId(ctx, args.clientId);
    const tutorial = normalizeTutorial(args.title, args.tracks);
    const now = Date.now();
    return await ctx.db.insert("youtubeTutorials", {
      ownerId,
      contentType: normalizeContentType(args.contentType),
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
    contentType: contentTypeValidator,
    title: v.string(),
    tracks: v.array(trackValidator),
  },
  handler: async (ctx, args) => {
    const ownerId = await getOwnerId(ctx, args.clientId);
    const current = await ctx.db.get(args.playlistId);
    if (
      !current ||
      current.ownerId !== ownerId ||
      normalizeContentType(current.contentType) !==
        normalizeContentType(args.contentType)
    )
      throw new Error("No puedes editar este tutorial.");
    const tutorial = normalizeTutorial(args.title, args.tracks);
    const hasChangedNewsVideo =
      normalizeContentType(args.contentType) === "news" &&
      tutorial.tracks[0]?.videoId !== current.tracks[0]?.videoId;
    await ctx.db.patch(args.playlistId, {
      ...tutorial,
      ...(hasChangedNewsVideo
        ? {
            youtubePublishedAt: undefined,
            youtubePublishedCheckedAt: undefined,
          }
        : {}),
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: {
    playlistId: v.id("youtubeTutorials"),
    clientId: v.optional(v.string()),
    contentType: contentTypeValidator,
  },
  handler: async (ctx, args) => {
    const ownerId = await getOwnerId(ctx, args.clientId);
    const current = await ctx.db.get(args.playlistId);
    if (
      !current ||
      current.ownerId !== ownerId ||
      normalizeContentType(current.contentType) !==
        normalizeContentType(args.contentType)
    )
      throw new Error("No puedes borrar este tutorial.");
    await ctx.db.delete(args.playlistId);
  },
});

export const getNewsMissingYouTubePublishedDates = internalQuery({
  args: { ownerId: v.string() },
  handler: async (ctx, args) =>
    (
      await ctx.db
        .query("youtubeTutorials")
        .withIndex("by_owner_updatedAt", (q) => q.eq("ownerId", args.ownerId))
        .order("desc")
        .collect()
    )
      .filter(
        (item) =>
          normalizeContentType(item.contentType) === "news" &&
          !item.youtubePublishedCheckedAt &&
          Boolean(item.tracks?.[0]?.videoId),
      )
      .slice(0, 12)
      .map((item) => ({
        playlistId: item._id,
        videoId: item.tracks[0].videoId,
      })),
});

export const setNewsYouTubePublishedDate = internalMutation({
  args: {
    playlistId: v.id("youtubeTutorials"),
    ownerId: v.string(),
    publishedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.playlistId);
    if (
      !item ||
      item.ownerId !== args.ownerId ||
      normalizeContentType(item.contentType) !== "news"
    )
      return;
    await ctx.db.patch(args.playlistId, {
      ...(args.publishedAt ? { youtubePublishedAt: args.publishedAt } : {}),
      youtubePublishedCheckedAt: Date.now(),
    });
  },
});

// Consulta la fecha de publicación en lotes pequeños para no repetir llamadas
// ni cargar el navegador. No requiere una clave de YouTube Data API.
export const refreshNewsYouTubePublishedDates = action({
  args: { clientId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const ownerId = await getOwnerId(ctx, args.clientId);
    const missing = await ctx.runQuery(
      internal.tutorials.getNewsMissingYouTubePublishedDates,
      { ownerId },
    );
    let updated = 0;
    await Promise.all(
      missing.map(async ({ playlistId, videoId }) => {
        let publishedAt = null;
        try {
          publishedAt = await fetchYouTubePublishedAt(videoId);
          if (publishedAt) updated += 1;
        } catch (error) {
          console.warn(
            "[tutorials.refreshNewsYouTubePublishedDates] metadata fetch failed",
            error,
          );
        }
        await ctx.runMutation(internal.tutorials.setNewsYouTubePublishedDate, {
          playlistId,
          ownerId,
          publishedAt: publishedAt || undefined,
        });
      }),
    );
    return { checked: missing.length, updated };
  },
});

// Read both lists and append in one transaction, preserving concurrent changes.
export const copyItems = mutation({
  args: {
    clientId: v.optional(v.string()),
    contentType: contentTypeValidator,
    sourceId: v.id("youtubeTutorials"),
    destinationId: v.id("youtubeTutorials"),
    itemKeys: v.array(v.string()),
    mode: v.optional(v.union(v.literal("copy"), v.literal("cut"))),
  },
  handler: async (ctx, args) => {
    const ownerId = await getOwnerId(ctx, args.clientId);
    if (args.sourceId === args.destinationId)
      throw new Error("Elige dos listas diferentes.");
    const source = await ctx.db.get(args.sourceId);
    const destination = await ctx.db.get(args.destinationId);
    if (
      !source ||
      !destination ||
      source.ownerId !== ownerId ||
      destination.ownerId !== ownerId ||
      normalizeContentType(source.contentType) !==
        normalizeContentType(args.contentType) ||
      normalizeContentType(destination.contentType) !==
        normalizeContentType(args.contentType)
    )
      throw new Error(
        "No puedes copiar entre estas listas. Comprueba que ambas siguen disponibles.",
      );
    const result = mergeTutorialItems(
      source.tracks,
      destination.tracks,
      args.itemKeys,
    );
    const cutting = args.mode === "cut";
    const selected = new Set(args.itemKeys);
    const remaining = cutting
      ? source.tracks.filter((track) => !selected.has(tutorialItemKey(track)))
      : source.tracks;
    if (cutting && remaining.length < 1)
      throw new Error(
        "La lista de origen debe conservar al menos un elemento. Reduce la selección o usa Copiar.",
      );
    // Validate both resulting lists before writing. Convex commits both patches
    // atomically, so a failed paste never removes the originals.
    const destinationUpdate =
      result.copied > 0
        ? normalizeTutorial(destination.title, result.tracks)
        : null;
    const sourceUpdate = cutting
      ? normalizeTutorial(source.title, remaining)
      : null;
    const now = Date.now();
    if (destinationUpdate) {
      await ctx.db.patch(args.destinationId, {
        ...destinationUpdate,
        updatedAt: now,
      });
    }
    if (sourceUpdate) {
      await ctx.db.patch(args.sourceId, { ...sourceUpdate, updatedAt: now });
    }
    return {
      copied: result.copied,
      skipped: result.skipped,
      total: result.tracks.length,
      moved: cutting ? source.tracks.length - remaining.length : 0,
    };
  },
});

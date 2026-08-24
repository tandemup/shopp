// convex/chat.js
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

const DEFAULT_ROOM = "compras";
const DEFAULT_USERNAME = "anonymous";
const MAX_MESSAGE_LENGTH = 280;
const MAX_YOUTUBE_MESSAGE_LENGTH = 2048;
const MAX_USERNAME_LENGTH = 40;
const MESSAGE_TTL_MS = 24 * 60 * 60 * 1000;

function cleanRoom(value) {
  return (
    String(value || "")
      .trim()
      .toLowerCase()
      .slice(0, 50) || DEFAULT_ROOM
  );
}
function cleanUsername(value) {
  return (
    String(value || "")
      .trim()
      .slice(0, MAX_USERNAME_LENGTH) || DEFAULT_USERNAME
  );
}

const WEB_URL_REGEX = /https?:\/\/[^\s<>"']+/gi;

function normalizeComputerLink(value) {
  try {
    const rawUrl = String(value || "").replace(/[.,!?;:]+$/, "");
    const url = new URL(rawUrl);
    if (!/^https?:$/.test(url.protocol) || !url.hostname) return null;
    url.hash = "";
    return {
      rawUrl,
      normalizedUrl: url.toString(),
      hostname: url.hostname.replace(/^www\./, "").toLowerCase(),
    };
  } catch {
    return null;
  }
}
function cleanText(value) {
  return String(value || "").trim();
}
function cleanClientId(value) {
  const clientId = String(value || "")
    .trim()
    .slice(0, 120);
  return clientId || null;
}

function extractYouTubeVideoId(text) {
  const match = String(text || "").match(
    /(?:youtube\.com\/(?:watch\?(?:[^\s#]*&)?v=|shorts\/|live\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/i,
  );
  return match?.[1] || null;
}

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
        "User-Agent":
          "Mozilla/5.0 (compatible; Shopp/1.0; +https://shopp-pwa.netlify.app)",
      },
    },
  );
  if (!response.ok) return null;
  return extractYouTubePublishedAt(await response.text());
}

async function getViewer(ctx, clientId) {
  const authUserId = await getAuthUserId(ctx);
  if (authUserId) {
    const user = await ctx.db.get(authUserId);
    return { ownerId: String(authUserId), isAdmin: user?.role === "admin" };
  }
  const cleanId = cleanClientId(clientId);
  return { ownerId: cleanId ? `client:${cleanId}` : null, isAdmin: false };
}

function isOwnedBy(message, ownerId) {
  return Boolean(ownerId && message?.userId && message.userId === ownerId);
}

async function withImageUrls(ctx, message) {
  return {
    ...message,
    images: message.images
      ? await Promise.all(
          message.images.map(async (image) => ({
            ...image,
            uri: await ctx.storage.getUrl(image.storageId),
          })),
        )
      : undefined,
    youtubeAlbum: message.youtubeAlbum
      ? {
          ...message.youtubeAlbum,
          thumbnailUri: message.youtubeAlbum.thumbnailStorageId
            ? await ctx.storage.getUrl(
                message.youtubeAlbum.thumbnailStorageId,
              )
            : undefined,
          lyricsUri: message.youtubeAlbum.lyricsStorageId
            ? await ctx.storage.getUrl(message.youtubeAlbum.lyricsStorageId)
            : undefined,
        }
      : undefined,
  };
}

export const listMessages = query({
  args: {
    room: v.optional(v.string()),
    limit: v.optional(v.number()),
    clientId: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const room = cleanRoom(args.room);
    const limit = Math.min(Math.max(args.limit ?? 100, 1), 200);
    const now = Date.now();
    const viewer = await getViewer(ctx, args.clientId);

    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_room_createdAt", (q) => q.eq("room", room))
      .order("desc")
      .take(limit);

    const visibleMessages = messages
      .filter((message) => {
        if (message.expiresAt && message.expiresAt <= now) return false;
        if (message.status === "blocked") return false;
        if (message.status === "hidden" && !viewer.isAdmin) return false;
        return true;
      })
      .reverse();

    return await Promise.all(
      visibleMessages.map(async (message) => {
        const decorated = await withImageUrls(ctx, message);
        const own = isOwnedBy(message, viewer.ownerId);
        const deletedByUser = message.status === "hidden";
        return {
          ...decorated,
          isOwnMessage: own,
          canDelete: viewer.isAdmin || (own && !deletedByUser),
          canEditYouTubeAlbum: viewer.isAdmin || (own && !deletedByUser),
          isAdminViewer: viewer.isAdmin,
          isDeletedByUser: deletedByUser,
        };
      }),
    );
  },
});

export const generateImageUploadUrl = mutation({
  args: {},
  handler: async (ctx) => await ctx.storage.generateUploadUrl(),
});

export const sendMessage = mutation({
  args: {
    room: v.optional(v.string()),
    username: v.optional(v.string()),
    text: v.string(),
    clientId: v.optional(v.string()),
    keepIndefinitely: v.optional(v.boolean()),
    images: v.optional(
      v.array(
        v.object({
          storageId: v.id("_storage"),
          mimeType: v.string(),
          width: v.number(),
          height: v.number(),
          size: v.number(),
        }),
      ),
    ),
    product: v.optional(
      v.object({
        barcode: v.string(),
        name: v.string(),
        brand: v.optional(v.string()),
        price: v.number(),
        currency: v.string(),
      }),
    ),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const room = cleanRoom(args.room);
    const username = cleanUsername(args.username);
    const text = cleanText(args.text);
    const images = Array.isArray(args.images) ? args.images : [];
    const messageLengthLimit =
      room === "youtube" ? MAX_YOUTUBE_MESSAGE_LENGTH : MAX_MESSAGE_LENGTH;

    if (!text && images.length === 0)
      throw new Error("El mensaje no puede estar vacío.");
    if (text.length > messageLengthLimit) {
      throw new Error(
        `El mensaje no puede superar ${messageLengthLimit} caracteres.`,
      );
    }

    const viewer = await getViewer(ctx, args.clientId);
    if (!viewer.ownerId)
      throw new Error("No se pudo identificar este dispositivo.");

    const now = Date.now();
    const messageId = await ctx.db.insert("chatMessages", {
      userId: viewer.ownerId,
      room,
      username,
      text,
      images: images.length > 0 ? images : undefined,
      product: args.product,
      createdAt: now,
      expiresAt: args.keepIndefinitely ? undefined : now + MESSAGE_TTL_MS,
      status: "visible",
      messageStatus: "clean",
    });

    if (room === "informatica") {
      for (const rawUrl of text.match(WEB_URL_REGEX) || []) {
        const link = normalizeComputerLink(rawUrl);
        if (!link) continue;
        const existing = await ctx.db
          .query("computerLinks")
          .withIndex("by_normalizedUrl", (q) =>
            q.eq("normalizedUrl", link.normalizedUrl),
          )
          .first();
        if (!existing) {
          await ctx.db.insert("computerLinks", {
            messageId,
            url: link.rawUrl,
            normalizedUrl: link.normalizedUrl,
            hostname: link.hostname,
            username,
            createdBy: viewer.ownerId,
            favorite: false,
            status: "pending",
            createdAt: now,
            updatedAt: now,
          });
        }
      }
    }

    const youtubeVideoId = room === "noticias" ? extractYouTubeVideoId(text) : null;
    if (youtubeVideoId) {
      await ctx.scheduler.runAfter(
        0,
        internal.chat.enrichYouTubePublishedAt,
        { messageId, videoId: youtubeVideoId },
      );
    }
    return { ok: true, messageId };
  },
});

export const enrichYouTubePublishedAt = internalAction({
  args: {
    messageId: v.id("chatMessages"),
    videoId: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const publishedAt = await fetchYouTubePublishedAt(args.videoId);
      if (!publishedAt) return;

      await ctx.runMutation(internal.chat.setYouTubePublishedAt, {
        messageId: args.messageId,
        videoId: args.videoId,
        publishedAt,
      });
    } catch (error) {
      console.warn("[chat.enrichYouTubePublishedAt] metadata fetch failed", error);
    }
  },
});

export const getNewsMessagesMissingYouTubeDate = internalQuery({
  args: {},
  handler: async (ctx) => {
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_room_createdAt", (q) => q.eq("room", "noticias"))
      .order("desc")
      .take(100);

    return messages
      .filter((message) => !message.youtubePublishedAt)
      .map((message) => ({
        messageId: message._id,
        videoId: extractYouTubeVideoId(message.text),
      }))
      .filter((message) => Boolean(message.videoId))
      .slice(0, 20);
  },
});

export const refreshNewsYouTubePublishedDates = action({
  args: {},
  handler: async (ctx) => {
    const messages = await ctx.runQuery(
      internal.chat.getNewsMessagesMissingYouTubeDate,
      {},
    );

    await Promise.all(
      messages.map(async ({ messageId, videoId }) => {
        try {
          const publishedAt = await fetchYouTubePublishedAt(videoId);
          if (!publishedAt) return;
          await ctx.runMutation(internal.chat.setYouTubePublishedAt, {
            messageId,
            videoId,
            publishedAt,
          });
        } catch (error) {
          console.warn(
            "[chat.refreshNewsYouTubePublishedDates] metadata fetch failed",
            error,
          );
        }
      }),
    );

    return { ok: true, checked: messages.length };
  },
});

export const setYouTubePublishedAt = internalMutation({
  args: {
    messageId: v.id("chatMessages"),
    videoId: v.string(),
    publishedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message || message.room !== "noticias") return;
    await ctx.db.patch(args.messageId, {
      youtubeVideoId: args.videoId,
      youtubePublishedAt: args.publishedAt,
    });
  },
});

export const updateYouTubeAlbum = mutation({
  args: {
    messageId: v.id("chatMessages"),
    clientId: v.optional(v.string()),
    title: v.string(),
    thumbnail: v.optional(
      v.object({
        storageId: v.id("_storage"),
        mimeType: v.string(),
        width: v.number(),
        height: v.number(),
        size: v.number(),
      }),
    ),
    lyrics: v.optional(
      v.object({
        storageId: v.id("_storage"),
        fileName: v.string(),
        mimeType: v.string(),
        size: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) throw new Error("La publicación ya no existe.");

    const viewer = await getViewer(ctx, args.clientId);
    const ownMessage = isOwnedBy(message, viewer.ownerId);
    if (!ownMessage && !viewer.isAdmin) {
      throw new Error(
        "Solo el autor o un administrador puede editar el álbum.",
      );
    }
    if (message.status === "hidden" || message.status === "blocked") {
      throw new Error("No se puede editar una publicación oculta.");
    }

    const title = String(args.title || "")
      .trim()
      .slice(0, 120);
    if (!title) throw new Error("Escribe el nombre del álbum.");

    const previous = message.youtubeAlbum;
    const thumbnail = args.thumbnail;
    const lyrics = args.lyrics;
    if (lyrics) {
      if (!lyrics.fileName.toLowerCase().endsWith(".lrc")) {
        throw new Error("El fichero de letras debe tener extensión .lrc.");
      }
      if (lyrics.size > 512 * 1024) {
        throw new Error("El fichero LRC no puede superar 512 KB.");
      }
    }
    const nextAlbum = thumbnail
      ? {
          ...previous,
          title,
          thumbnailStorageId: thumbnail.storageId,
          mimeType: thumbnail.mimeType,
          width: thumbnail.width,
          height: thumbnail.height,
          size: thumbnail.size,
        }
      : { ...previous, title };
    if (lyrics) {
      nextAlbum.lyricsStorageId = lyrics.storageId;
      nextAlbum.lyricsFileName = lyrics.fileName.slice(0, 160);
      nextAlbum.lyricsMimeType = lyrics.mimeType;
      nextAlbum.lyricsSize = lyrics.size;
    }
    await ctx.db.patch(args.messageId, { youtubeAlbum: nextAlbum });

    if (
      thumbnail &&
      previous?.thumbnailStorageId &&
      previous.thumbnailStorageId !== thumbnail.storageId
    ) {
      try {
        await ctx.storage.delete(previous.thumbnailStorageId);
      } catch (error) {
        console.warn(
          "[chat.updateYouTubeAlbum] old thumbnail delete failed",
          error,
        );
      }
    }
    if (
      lyrics &&
      previous?.lyricsStorageId &&
      previous.lyricsStorageId !== lyrics.storageId
    ) {
      try {
        await ctx.storage.delete(previous.lyricsStorageId);
      } catch (error) {
        console.warn(
          "[chat.updateYouTubeAlbum] old lyrics delete failed",
          error,
        );
      }
    }
    return { ok: true };
  },
});

export const deleteMessage = mutation({
  args: {
    messageId: v.id("chatMessages"),
    clientId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) return { ok: true, hidden: false };

    const viewer = await getViewer(ctx, args.clientId);
    const ownMessage = isOwnedBy(message, viewer.ownerId);
    if (!ownMessage && !viewer.isAdmin) {
      throw new Error("Solo el autor puede borrar esta publicación.");
    }

    if (viewer.isAdmin) {
      // El administrador realiza un borrado definitivo, también de los adjuntos.
      if (Array.isArray(message.images)) {
        for (const image of message.images) {
          try {
            await ctx.storage.delete(image.storageId);
          } catch (error) {
            console.warn("[chat.deleteMessage] storage delete failed", error);
          }
        }
      }
      if (message.youtubeAlbum?.thumbnailStorageId) {
        try {
          await ctx.storage.delete(message.youtubeAlbum.thumbnailStorageId);
        } catch (error) {
          console.warn(
            "[chat.deleteMessage] album thumbnail delete failed",
            error,
          );
        }
      }
      if (message.youtubeAlbum?.lyricsStorageId) {
        try {
          await ctx.storage.delete(message.youtubeAlbum.lyricsStorageId);
        } catch (error) {
          console.warn("[chat.deleteMessage] lyrics delete failed", error);
        }
      }
      await ctx.db.delete(args.messageId);
      return { ok: true, hidden: false, deleted: true };
    }

    if (message.status !== "hidden") {
      // Borrado lógico: se conserva el registro y las imágenes para el administrador.
      await ctx.db.patch(args.messageId, { status: "hidden" });
    }
    return { ok: true, hidden: true };
  },
});

export const deleteExpiredMessages = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const expired = await ctx.db
      .query("chatMessages")
      .withIndex("by_expiresAt", (q) => q.lte("expiresAt", now))
      .collect();

    for (const message of expired) {
      if (Array.isArray(message.images)) {
        for (const image of message.images) {
          try {
            await ctx.storage.delete(image.storageId);
          } catch (error) {
            console.warn(
              "[chat.deleteExpiredMessages] storage delete failed",
              error,
            );
          }
        }
      }
      if (message.youtubeAlbum?.thumbnailStorageId) {
        try {
          await ctx.storage.delete(message.youtubeAlbum.thumbnailStorageId);
        } catch (error) {
          console.warn(
            "[chat.deleteExpiredMessages] album thumbnail delete failed",
            error,
          );
        }
      }
      if (message.youtubeAlbum?.lyricsStorageId) {
        try {
          await ctx.storage.delete(message.youtubeAlbum.lyricsStorageId);
        } catch (error) {
          console.warn(
            "[chat.deleteExpiredMessages] lyrics delete failed",
            error,
          );
        }
      }
      await ctx.db.delete(message._id);
    }
    return { ok: true, deleted: expired.length };
  },
});

// convex/chat.js
import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

const DEFAULT_ROOM = "compras";
const DEFAULT_USERNAME = "anonymous";
const MAX_MESSAGE_LENGTH = 280;
const MAX_YOUTUBE_MESSAGE_LENGTH = 2048;
const MAX_USERNAME_LENGTH = 40;
const MESSAGE_TTL_MS = 24 * 60 * 60 * 1000;

function cleanRoom(value) {
  return String(value || "").trim().toLowerCase().slice(0, 50) || DEFAULT_ROOM;
}
function cleanUsername(value) {
  return String(value || "").trim().slice(0, MAX_USERNAME_LENGTH) || DEFAULT_USERNAME;
}
function cleanText(value) {
  return String(value || "").trim();
}
function cleanClientId(value) {
  const clientId = String(value || "").trim().slice(0, 120);
  return clientId || null;
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
    images: v.optional(v.array(v.object({
      storageId: v.id("_storage"),
      mimeType: v.string(),
      width: v.number(),
      height: v.number(),
      size: v.number(),
    }))),
    product: v.optional(v.object({
      barcode: v.string(),
      name: v.string(),
      brand: v.optional(v.string()),
      price: v.number(),
      currency: v.string(),
    })),
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

    if (!text && images.length === 0) throw new Error("El mensaje no puede estar vacío.");
    if (text.length > messageLengthLimit) {
      throw new Error(
        `El mensaje no puede superar ${messageLengthLimit} caracteres.`,
      );
    }

    const viewer = await getViewer(ctx, args.clientId);
    if (!viewer.ownerId) throw new Error("No se pudo identificar este dispositivo.");

    const now = Date.now();
    const messageId = await ctx.db.insert("chatMessages", {
      userId: viewer.ownerId,
      room,
      username,
      text,
      images: images.length > 0 ? images : undefined,
      product: args.product,
      createdAt: now,
      expiresAt: now + MESSAGE_TTL_MS,
      status: "visible",
      messageStatus: "clean",
    });
    return { ok: true, messageId };
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
            console.warn("[chat.deleteExpiredMessages] storage delete failed", error);
          }
        }
      }
      await ctx.db.delete(message._id);
    }
    return { ok: true, deleted: expired.length };
  },
});

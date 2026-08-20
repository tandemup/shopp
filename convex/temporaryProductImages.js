import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";

const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

function normalizeBarcode(value) {
  return String(value || "").replace(/\D/g, "");
}

async function requireUserId(ctx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Debes iniciar sesión para sincronizar imágenes.");
  return String(userId);
}

async function findImage(ctx, userId, barcode) {
  return await ctx.db
    .query("temporaryProductImages")
    .withIndex("by_user_barcode", (q) =>
      q.eq("userId", userId).eq("barcode", barcode),
    )
    .unique();
}

async function deleteStoredPair(ctx, image) {
  if (!image) return;
  await Promise.all([
    ctx.storage.delete(image.detailStorageId),
    ctx.storage.delete(image.thumbnailStorageId),
  ]);
}

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUserId(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const saveMyProductImages = mutation({
  args: {
    barcode: v.string(),
    detailStorageId: v.id("_storage"),
    thumbnailStorageId: v.id("_storage"),
    detailMimeType: v.string(),
    thumbnailMimeType: v.string(),
    detailBytes: v.float64(),
    thumbnailBytes: v.float64(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const barcode = normalizeBarcode(args.barcode);
    if (!barcode) throw new Error("El código de barras es obligatorio.");

    const now = Date.now();
    const existing = await findImage(ctx, userId, barcode);
    const values = {
      userId,
      barcode,
      detailStorageId: args.detailStorageId,
      thumbnailStorageId: args.thumbnailStorageId,
      detailMimeType: args.detailMimeType,
      thumbnailMimeType: args.thumbnailMimeType,
      detailBytes: args.detailBytes,
      thumbnailBytes: args.thumbnailBytes,
      updatedAt: now,
      expiresAt: now + RETENTION_MS,
    };

    if (existing) {
      await ctx.db.patch(existing._id, values);
      await deleteStoredPair(ctx, existing);
      return await ctx.db.get(existing._id);
    }

    const id = await ctx.db.insert("temporaryProductImages", {
      ...values,
      createdAt: now,
    });
    return await ctx.db.get(id);
  },
});

export const getMyProductImages = query({
  args: { barcode: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const barcode = normalizeBarcode(args.barcode);
    if (!barcode) return null;

    const image = await findImage(ctx, userId, barcode);
    if (!image || image.expiresAt <= Date.now()) return null;

    const [detailUrl, thumbnailUrl] = await Promise.all([
      ctx.storage.getUrl(image.detailStorageId),
      ctx.storage.getUrl(image.thumbnailStorageId),
    ]);
    if (!detailUrl || !thumbnailUrl) return null;

    return {
      detailUrl,
      thumbnailUrl,
      detailMimeType: image.detailMimeType,
      thumbnailMimeType: image.thumbnailMimeType,
      detailBytes: image.detailBytes,
      thumbnailBytes: image.thumbnailBytes,
      expiresAt: image.expiresAt,
    };
  },
});

export const removeMyProductImages = mutation({
  args: { barcode: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const barcode = normalizeBarcode(args.barcode);
    const image = barcode ? await findImage(ctx, userId, barcode) : null;
    if (!image) return { deleted: false };

    await deleteStoredPair(ctx, image);
    await ctx.db.delete(image._id);
    return { deleted: true };
  },
});

export const cleanupExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const expired = await ctx.db
      .query("temporaryProductImages")
      .withIndex("by_expiresAt", (q) => q.lt("expiresAt", Date.now()))
      .take(100);

    for (const image of expired) {
      await deleteStoredPair(ctx, image);
      await ctx.db.delete(image._id);
    }
    return { deleted: expired.length };
  },
});

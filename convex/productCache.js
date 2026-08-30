import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

const NEGATIVE_CACHE_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

function normalizeBarcode(value) {
  return String(value || "").replace(/\D/g, "");
}

function validateBarcode(barcode) {
  if (!barcode) {
    throw new Error("El código de barras no puede estar vacío.");
  }

  if (!/^\d{8,14}$/.test(barcode)) {
    throw new Error("El código de barras debe contener entre 8 y 14 dígitos.");
  }
}

function normalizeOptionalString(value) {
  const normalized = String(value || "").trim();
  return normalized || undefined;
}

function normalizeDetails(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const entries = Object.entries(value)
    .map(([key, item]) => [key, normalizeOptionalString(item)])
    .filter(([, item]) => Boolean(item));

  return entries.length ? Object.fromEntries(entries) : undefined;
}

function normalizeProductType(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (normalized.includes("libro") || normalized.includes("book")) {
    return "Libros";
  }

  if (normalized.includes("music") || normalized.includes("musica")) {
    return "Música";
  }

  if (normalized.includes("cd") || normalized.includes("dvd") || normalized.includes("blu-ray") || normalized.includes("bluray")) {
    return "Música";
  }

  if (normalized.includes("aliment") || normalized.includes("food")) {
    return "Alimentos";
  }

  if (normalized.includes("supermerc")) {
    return "Supermercado";
  }

  return undefined;
}

function canonicalProductType(productType, category) {
  const explicit = normalizeProductType(productType);

  if (explicit) {
    return explicit;
  }

  const legacy = normalizeProductType(category);

  return ["Alimentos", "Supermercado", "Libros", "Música"].includes(legacy)
    ? legacy
    : undefined;
}

function hasUsefulProductData(data) {
  return Boolean(
    normalizeOptionalString(data.name) ||
    normalizeOptionalString(data.brand) ||
    normalizeOptionalString(data.productType) ||
    normalizeOptionalString(data.category) ||
    normalizeOptionalString(data.subcategory) ||
    normalizeOptionalString(data.imageUrl) ||
    normalizeOptionalString(data.thumbnailUri) ||
    normalizeOptionalString(data.productUrl) ||
    normalizeOptionalString(data.notes) ||
    Boolean(data.details && Object.keys(data.details).length),
  );
}

export const registerAccess = mutation({
  args: { barcode: v.string() },

  handler: async (ctx, args) => {
    const barcode = normalizeBarcode(args.barcode);
    validateBarcode(barcode);

    const now = Date.now();
    const existingProduct = await ctx.db
      .query("productCache")
      .withIndex("by_barcode", (q) => q.eq("barcode", barcode))
      .unique();

    if (existingProduct) {
      const accessCount = (existingProduct.accessCount || 0) + 1;

      await ctx.db.patch(existingProduct._id, {
        accessCount,
        lastAccessedAt: now,
        updatedAt: now,
      });

      return {
        created: false,
        product: {
          ...existingProduct,
          accessCount,
          lastAccessedAt: now,
          updatedAt: now,
        },
      };
    }

    const productId = await ctx.db.insert("productCache", {
      barcode,
      accessCount: 1,
      status: "pending",
      source: "scanner",
      lookupFailureCount: 0,
      createdAt: now,
      updatedAt: now,
      lastAccessedAt: now,
    });

    return { created: true, product: await ctx.db.get(productId) };
  },
});

export const getByBarcode = query({
  args: { barcode: v.string() },

  handler: async (ctx, args) => {
    const barcode = normalizeBarcode(args.barcode);

    if (!barcode) return null;

    return await ctx.db
      .query("productCache")
      .withIndex("by_barcode", (q) => q.eq("barcode", barcode))
      .unique();
  },
});

export const deleteProductByBarcode = mutation({
  args: { barcode: v.string() },

  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      throw new Error("Debes iniciar sesión para eliminar productos.");
    }

    const user = await ctx.db.get(userId);
    const isAdmin = user?.isAdmin === true || user?.role === "admin";

    if (!isAdmin) {
      throw new Error("Solo un administrador puede eliminar la ficha global.");
    }

    const barcode = normalizeBarcode(args.barcode);
    validateBarcode(barcode);

    const existingProduct = await ctx.db
      .query("productCache")
      .withIndex("by_barcode", (q) => q.eq("barcode", barcode))
      .unique();

    if (!existingProduct) {
      return { deleted: false, barcode };
    }

    await ctx.db.delete(existingProduct._id);
    return { deleted: true, barcode };
  },
});

export const saveProductData = mutation({
  args: {
    barcode: v.string(),
    name: v.optional(v.string()),
    brand: v.optional(v.string()),
    productType: v.optional(v.string()),
    category: v.optional(v.string()),
    subcategory: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    thumbnailUri: v.optional(v.string()),
    productUrl: v.optional(v.string()),
    details: v.optional(v.any()),
    notes: v.optional(v.string()),
    source: v.optional(
      v.union(
        v.literal("convex"),
        v.literal("internet"),
        v.literal("manual"),
        v.literal("scanner"),
      ),
    ),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("complete"),
        v.literal("not_found"),
      ),
    ),
  },

  handler: async (ctx, args) => {
    const barcode = normalizeBarcode(args.barcode);
    validateBarcode(barcode);

    const now = Date.now();
    const data = {
      name: normalizeOptionalString(args.name),
      brand: normalizeOptionalString(args.brand),
      productType: canonicalProductType(args.productType, args.category),
      category: normalizeOptionalString(args.category),
      subcategory: normalizeOptionalString(args.subcategory),
      imageUrl: normalizeOptionalString(args.imageUrl),
      thumbnailUri: normalizeOptionalString(args.thumbnailUri),
      productUrl: normalizeOptionalString(args.productUrl),
      details: normalizeDetails(args.details),
      notes: normalizeOptionalString(args.notes),
    };
    const status =
      args.status || (hasUsefulProductData(data) ? "complete" : "pending");

    const patch = {
      ...data,
      source: args.source || "manual",
      status,
      updatedAt: now,
      ...(status === "complete"
        ? {
            lastExternalLookupAt: args.source === "internet" ? now : undefined,
            nextExternalLookupAt: undefined,
            lookupFailureCount: 0,
          }
        : {}),
    };

    const existingProduct = await ctx.db
      .query("productCache")
      .withIndex("by_barcode", (q) => q.eq("barcode", barcode))
      .unique();

    if (existingProduct) {
      await ctx.db.patch(existingProduct._id, patch);
      return await ctx.db.get(existingProduct._id);
    }

    const productId = await ctx.db.insert("productCache", {
      barcode,
      ...patch,
      accessCount: 1,
      lookupFailureCount: 0,
      createdAt: now,
      lastAccessedAt: now,
    });

    return await ctx.db.get(productId);
  },
});

export const submitProductReview = mutation({
  args: {
    barcode: v.string(),
    name: v.string(),
    brand: v.optional(v.string()),
    productType: v.optional(v.string()),
    category: v.optional(v.string()),
    subcategory: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    thumbnailUri: v.optional(v.string()),
    productUrl: v.optional(v.string()),
    details: v.optional(v.any()),
    notes: v.optional(v.string()),
    source: v.optional(
      v.union(
        v.literal("user_review"),
        v.literal("manual"),
        v.literal("scanner"),
        v.literal("internet"),
      ),
    ),
    status: v.optional(v.literal("pending_review")),
  },

  handler: async (ctx, args) => {
    const submittedBy = await getAuthUserId(ctx);

    if (!submittedBy) {
      throw new Error("Debes iniciar sesión para enviar productos a revisión.");
    }

    const barcode = normalizeBarcode(args.barcode);
    validateBarcode(barcode);
    const name = normalizeOptionalString(args.name);

    if (!name) {
      throw new Error("El nombre del producto no puede estar vacío.");
    }

    const now = Date.now();
    const identity = await ctx.auth.getUserIdentity();
    const patch = {
      barcode,
      name,
      brand: normalizeOptionalString(args.brand),
      productType: canonicalProductType(args.productType, args.category),
      category: normalizeOptionalString(args.category),
      subcategory: normalizeOptionalString(args.subcategory),
      imageUrl: normalizeOptionalString(args.imageUrl),
      thumbnailUri: normalizeOptionalString(args.thumbnailUri),
      productUrl: normalizeOptionalString(args.productUrl),
      details: normalizeDetails(args.details),
      notes: normalizeOptionalString(args.notes),
      source: args.source || "user_review",
      status: "pending_review",
      submittedBy,
      submitterEmail: normalizeOptionalString(identity?.email),
      updatedAt: now,
    };

    const existingSubmission = await ctx.db
      .query("productReviewSubmissions")
      .withIndex("by_submittedBy_barcode_status", (q) =>
        q
          .eq("submittedBy", submittedBy)
          .eq("barcode", barcode)
          .eq("status", "pending_review"),
      )
      .unique();

    if (existingSubmission) {
      await ctx.db.patch(existingSubmission._id, patch);
      return await ctx.db.get(existingSubmission._id);
    }

    const submissionId = await ctx.db.insert("productReviewSubmissions", {
      ...patch,
      createdAt: now,
    });

    return await ctx.db.get(submissionId);
  },
});

export const listPendingProductReviews = query({
  args: { limit: v.optional(v.number()) },

  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const user = await ctx.db.get(userId);
    if (user?.role !== "admin") return [];

    return await ctx.db
      .query("productReviewSubmissions")
      .withIndex("by_status_createdAt", (q) => q.eq("status", "pending_review"))
      .order("desc")
      .take(args.limit || 50);
  },
});

export const markAsNotFound = mutation({
  args: { barcode: v.string() },

  handler: async (ctx, args) => {
    const barcode = normalizeBarcode(args.barcode);
    validateBarcode(barcode);
    const now = Date.now();

    const existingProduct = await ctx.db
      .query("productCache")
      .withIndex("by_barcode", (q) => q.eq("barcode", barcode))
      .unique();

    if (existingProduct) {
      await ctx.db.patch(existingProduct._id, {
        status: "not_found",
        source: "internet",
        lastExternalLookupAt: now,
        nextExternalLookupAt: now + NEGATIVE_CACHE_DURATION_MS,
        lookupFailureCount: (existingProduct.lookupFailureCount || 0) + 1,
        updatedAt: now,
        lastAccessedAt: now,
      });

      return await ctx.db.get(existingProduct._id);
    }

    const productId = await ctx.db.insert("productCache", {
      barcode,
      accessCount: 1,
      status: "not_found",
      source: "internet",
      lastExternalLookupAt: now,
      nextExternalLookupAt: now + NEGATIVE_CACHE_DURATION_MS,
      lookupFailureCount: 1,
      createdAt: now,
      updatedAt: now,
      lastAccessedAt: now,
    });

    return await ctx.db.get(productId);
  },
});

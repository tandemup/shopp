import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireAdmin } from "./lib/auth";

const statusValidator = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
);

function clean(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

export const create = mutation({
  args: {
    submissionType: v.union(v.literal("shopper"), v.literal("owner")),
    storeId: v.string(),
    productName: v.string(),
    barcode: v.optional(v.string()),
    offerText: v.string(),
    startsAt: v.optional(v.float64()),
    endsAt: v.optional(v.float64()),
    contactName: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Debes iniciar sesión.");

    const storeId = clean(args.storeId, 120);
    const productName = clean(args.productName, 180);
    const offerText = clean(args.offerText, 500);
    if (!storeId || !productName || !offerText) {
      throw new Error("Supermercado, producto y oferta son obligatorios.");
    }

    const store = await ctx.db
      .query("stores")
      .withIndex("by_storeId", (q) => q.eq("id", storeId))
      .unique();
    if (!store) throw new Error("El supermercado seleccionado no existe.");

    const now = Date.now();
    return await ctx.db.insert("storeOfferSubmissions", {
      submittedBy: String(userId),
      submissionType: args.submissionType,
      storeId,
      productName,
      offerText,
      ...(clean(args.barcode, 32) ? { barcode: clean(args.barcode, 32) } : {}),
      ...(Number.isFinite(args.startsAt) ? { startsAt: args.startsAt } : {}),
      ...(Number.isFinite(args.endsAt) ? { endsAt: args.endsAt } : {}),
      ...(clean(args.contactName, 120) ? { contactName: clean(args.contactName, 120) } : {}),
      ...(clean(args.contactEmail, 180) ? { contactEmail: clean(args.contactEmail, 180) } : {}),
      ...(clean(args.notes, 1000) ? { notes: clean(args.notes, 1000) } : {}),
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const listForAdmin = query({
  args: { status: v.optional(statusValidator) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    if (args.status) {
      return await ctx.db
        .query("storeOfferSubmissions")
        .withIndex("by_status_createdAt", (q) => q.eq("status", args.status))
        .order("desc")
        .collect();
    }
    return await ctx.db.query("storeOfferSubmissions").order("desc").collect();
  },
});

export const listApproved = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(Math.trunc(args.limit || 100), 200));
    return await ctx.db
      .query("storeOfferSubmissions")
      .withIndex("by_status_createdAt", (q) => q.eq("status", "approved"))
      .order("desc")
      .take(limit);
  },
});

export const updateStatusForAdmin = mutation({
  args: { submissionId: v.id("storeOfferSubmissions"), status: statusValidator },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.submissionId, { status: args.status, updatedAt: Date.now() });
    return { ok: true };
  },
});

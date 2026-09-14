import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireAdmin } from "./lib/auth";

const requestStatus = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
);

function cleanText(value, maxLength) {
  return String(value || "").trim().slice(0, maxLength);
}

function normalizeKey(value) {
  return cleanText(value, 250)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export const create = mutation({
  args: {
    name: v.string(),
    chain: v.optional(v.string()),
    address: v.string(),
    city: v.string(),
    provincia: v.optional(v.string()),
    zipcode: v.optional(v.string()),
    notes: v.optional(v.string()),
    lat: v.optional(v.float64()),
    lng: v.optional(v.float64()),
  },

  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      throw new Error("Debes iniciar sesión para enviar una petición.");
    }

    const name = cleanText(args.name, 120);
    const address = cleanText(args.address, 200);
    const city = cleanText(args.city, 100);

    if (!name || !address || !city) {
      throw new Error("Nombre, dirección y ciudad son obligatorios.");
    }

    const now = Date.now();
    const chain = cleanText(args.chain, 120);
    const provincia = cleanText(args.provincia, 100);
    const zipcode = cleanText(args.zipcode, 12);
    const notes = cleanText(args.notes, 1000);
    const requestId = await ctx.db.insert("storeCreationRequests", {
      submittedBy: String(userId),
      name,
      ...(chain ? { chain } : {}),
      address,
      city,
      ...(provincia ? { provincia } : {}),
      ...(zipcode ? { zipcode } : {}),
      ...(notes ? { notes } : {}),
      ...(Number.isFinite(args.lat) ? { lat: args.lat } : {}),
      ...(Number.isFinite(args.lng) ? { lng: args.lng } : {}),
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });

    return { ok: true, requestId };
  },
});

export const listForAdmin = query({
  args: { status: v.optional(requestStatus) },

  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    if (args.status) {
      return await ctx.db
        .query("storeCreationRequests")
        .withIndex("by_status_createdAt", (q) =>
          q.eq("status", args.status),
        )
        .order("desc")
        .collect();
    }

    return await ctx.db
      .query("storeCreationRequests")
      .order("desc")
      .collect();
  },
});

export const updateStatusForAdmin = mutation({
  args: {
    requestId: v.id("storeCreationRequests"),
    status: requestStatus,
  },

  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const request = await ctx.db.get(args.requestId);
    if (!request) {
      throw new Error("La petición ya no existe.");
    }

    let approvedStoreId = request.approvedStoreId;

    if (args.status === "approved" && !approvedStoreId) {
      if (!Number.isFinite(request.lat) || !Number.isFinite(request.lng)) {
        throw new Error(
          "La petición necesita coordenadas antes de crear el supermercado.",
        );
      }

      const stores = await ctx.db.query("stores").collect();
      const addressKey = normalizeKey(request.address);
      const cityKey = normalizeKey(request.city);
      const duplicate = stores.find(
        (store) =>
          normalizeKey(store.address) === addressKey &&
          normalizeKey(store.city) === cityKey,
      );

      if (duplicate) {
        approvedStoreId = duplicate.id;
      } else {
        const baseId = [
          normalizeKey(request.chain || request.name),
          normalizeKey(request.city),
          normalizeKey(request.zipcode),
        ]
          .filter(Boolean)
          .join("-");
        approvedStoreId = `${baseId || "supermercado"}-${Date.now().toString(36)}`;

        await ctx.db.insert("stores", {
          id: approvedStoreId,
          name: request.name,
          type: "supermarket",
          ...(request.chain ? { chain: request.chain } : {}),
          address: request.address,
          city: request.city,
          ...(request.provincia ? { provincia: request.provincia } : {}),
          ...(request.zipcode ? { zipcode: request.zipcode } : {}),
          location: {
            lat: request.lat,
            lng: request.lng,
            source: "user_proposal",
          },
          status: "active",
          submittedBy: request.submittedBy,
          favorite: false,
        });
      }
    }

    await ctx.db.patch(args.requestId, {
      status: args.status,
      ...(approvedStoreId ? { approvedStoreId } : {}),
      updatedAt: Date.now(),
    });

    return { ok: true, requestId: args.requestId, status: args.status };
  },
});

export const updateLocationForAdmin = mutation({
  args: {
    requestId: v.id("storeCreationRequests"),
    lat: v.float64(),
    lng: v.float64(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    if (args.lat < -90 || args.lat > 90 || args.lng < -180 || args.lng > 180) {
      throw new Error("Las coordenadas no son válidas.");
    }
    await ctx.db.patch(args.requestId, {
      lat: args.lat,
      lng: args.lng,
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

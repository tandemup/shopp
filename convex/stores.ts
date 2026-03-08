import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("stores").collect();
  },
});

export const listFavorites = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("stores")
      .withIndex("by_favorite", (q) => q.eq("favorite", true))
      .collect();
  },
});

export const getById = query({
  args: {
    id: v.id("stores"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    city: v.optional(v.string()),
    provincia: v.optional(v.string()),
    address: v.string(),
    zipcode: v.optional(v.union(v.string(), v.number())),
    location: v.optional(
      v.object({
        lat: v.number(),
        lng: v.number(),
        source: v.optional(v.string()),
      }),
    ),
    favorite: v.optional(v.boolean()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    return await ctx.db.insert("stores", {
      name: args.name,
      city: args.city,
      provincia: args.provincia,
      address: args.address,
      zipcode: args.zipcode,
      location: args.location,
      favorite: args.favorite ?? false,
      isActive: args.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const toggleFavorite = mutation({
  args: {
    id: v.id("stores"),
  },
  handler: async (ctx, args) => {
    const store = await ctx.db.get(args.id);
    if (!store) throw new Error("Store not found");

    await ctx.db.patch(args.id, {
      favorite: !store.favorite,
      updatedAt: Date.now(),
    });
  },
});

export const seedDefaults = mutation({
  args: {
    stores: v.array(
      v.object({
        name: v.string(),
        city: v.optional(v.string()),
        provincia: v.optional(v.string()),
        address: v.string(),
        zipcode: v.optional(v.union(v.string(), v.number())),
        location: v.optional(
          v.object({
            lat: v.number(),
            lng: v.number(),
            source: v.optional(v.string()),
          }),
        ),
        favorite: v.optional(v.boolean()),
        isActive: v.optional(v.boolean()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("stores").collect();
    if (existing.length > 0) {
      return { inserted: 0, skipped: true };
    }

    const now = Date.now();
    let inserted = 0;

    for (const store of args.stores) {
      await ctx.db.insert("stores", {
        name: store.name,
        city: store.city,
        provincia: store.provincia,
        address: store.address,
        zipcode: store.zipcode,
        location: store.location,
        favorite: store.favorite ?? false,
        isActive: store.isActive ?? true,
        createdAt: now,
        updatedAt: now,
      });
      inserted += 1;
    }

    return { inserted, skipped: false };
  },
});

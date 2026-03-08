import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listActive = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("lists")
      .withIndex("by_archived", (q) => q.eq("archived", false))
      .collect();
  },
});

export const listArchived = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("lists")
      .withIndex("by_archived", (q) => q.eq("archived", true))
      .collect();
  },
});

export const getById = query({
  args: {
    id: v.id("lists"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    currency: v.optional(v.string()),
    storeId: v.optional(v.id("stores")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    return await ctx.db.insert("lists", {
      name: args.name,
      currency: args.currency ?? "EUR",
      storeId: args.storeId,
      archived: false,
      archivedAt: undefined,
      createdAt: now,
      updatedAt: now,
      totalItems: 0,
      checkedItems: 0,
    });
  },
});

export const rename = mutation({
  args: {
    id: v.id("lists"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const list = await ctx.db.get(args.id);
    if (!list) throw new Error("List not found");

    await ctx.db.patch(args.id, {
      name: args.name,
      updatedAt: Date.now(),
    });
  },
});

export const archive = mutation({
  args: {
    id: v.id("lists"),
  },
  handler: async (ctx, args) => {
    const list = await ctx.db.get(args.id);
    if (!list) throw new Error("List not found");

    await ctx.db.patch(args.id, {
      archived: true,
      archivedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const unarchive = mutation({
  args: {
    id: v.id("lists"),
  },
  handler: async (ctx, args) => {
    const list = await ctx.db.get(args.id);
    if (!list) throw new Error("List not found");

    await ctx.db.patch(args.id, {
      archived: false,
      archivedAt: undefined,
      updatedAt: Date.now(),
    });
  },
});

export const setStore = mutation({
  args: {
    id: v.id("lists"),
    storeId: v.optional(v.id("stores")),
  },
  handler: async (ctx, args) => {
    const list = await ctx.db.get(args.id);
    if (!list) throw new Error("List not found");

    await ctx.db.patch(args.id, {
      storeId: args.storeId,
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: {
    id: v.id("lists"),
  },
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query("listItems")
      .withIndex("by_list", (q) => q.eq("listId", args.id))
      .collect();

    for (const item of items) {
      await ctx.db.delete(item._id);
    }

    await ctx.db.delete(args.id);
  },
});

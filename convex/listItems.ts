import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const priceInfoValidator = v.object({
  qty: v.number(),
  unit: v.string(),
  unitPrice: v.number(),
  currency: v.string(),
  promo: v.string(),
  promoLabel: v.string(),
  subtotal: v.number(),
  total: v.number(),
  savings: v.number(),
  summary: v.string(),
  warning: v.optional(v.union(v.string(), v.null())),
});

function normalizeProductName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

async function refreshListCounters(ctx: any, listId: any) {
  const items = await ctx.db
    .query("listItems")
    .withIndex("by_list", (q: any) => q.eq("listId", listId))
    .collect();

  const totalItems = items.length;
  const checkedItems = items.filter((item: any) => item.checked).length;

  await ctx.db.patch(listId, {
    totalItems,
    checkedItems,
    updatedAt: Date.now(),
  });
}

export const byList = query({
  args: {
    listId: v.id("lists"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("listItems")
      .withIndex("by_list", (q) => q.eq("listId", args.listId))
      .collect();
  },
});

export const add = mutation({
  args: {
    listId: v.id("lists"),
    name: v.string(),
    quantity: v.optional(v.number()),
    unit: v.optional(v.string()),
    unitPrice: v.optional(v.number()),
    checked: v.optional(v.boolean()),
    promo: v.optional(v.string()),
    barcode: v.optional(v.string()),
    category: v.optional(v.string()),
    note: v.optional(v.string()),
    priceInfo: v.optional(priceInfoValidator),
  },
  handler: async (ctx, args) => {
    const list = await ctx.db.get(args.listId);
    if (!list) throw new Error("List not found");

    const now = Date.now();

    const id = await ctx.db.insert("listItems", {
      listId: args.listId,
      name: args.name,
      normalizedName: normalizeProductName(args.name),
      quantity: args.quantity ?? 1,
      unit: args.unit,
      unitPrice: args.unitPrice ?? 0,
      checked: args.checked ?? false,
      promo: args.promo,
      barcode: args.barcode,
      category: args.category,
      note: args.note,
      priceInfo: args.priceInfo,
      createdAt: now,
      updatedAt: now,
    });

    await refreshListCounters(ctx, args.listId);
    return id;
  },
});

export const toggleChecked = mutation({
  args: {
    id: v.id("listItems"),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.id);
    if (!item) throw new Error("Item not found");

    await ctx.db.patch(args.id, {
      checked: !item.checked,
      updatedAt: Date.now(),
    });

    await refreshListCounters(ctx, item.listId);
  },
});

export const update = mutation({
  args: {
    id: v.id("listItems"),
    name: v.optional(v.string()),
    quantity: v.optional(v.number()),
    unit: v.optional(v.string()),
    unitPrice: v.optional(v.number()),
    checked: v.optional(v.boolean()),
    promo: v.optional(v.string()),
    barcode: v.optional(v.string()),
    category: v.optional(v.string()),
    note: v.optional(v.string()),
    priceInfo: v.optional(priceInfoValidator),
  },
  handler: async (ctx, args) => {
    const { id, ...rest } = args;

    const item = await ctx.db.get(id);
    if (!item) throw new Error("Item not found");

    const patch: Record<string, unknown> = {
      ...rest,
      updatedAt: Date.now(),
    };

    if (typeof rest.name === "string") {
      patch.normalizedName = normalizeProductName(rest.name);
    }

    await ctx.db.patch(id, patch);
    await refreshListCounters(ctx, item.listId);
  },
});

export const remove = mutation({
  args: {
    id: v.id("listItems"),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.id);
    if (!item) throw new Error("Item not found");

    const listId = item.listId;

    await ctx.db.delete(args.id);
    await refreshListCounters(ctx, listId);
  },
});

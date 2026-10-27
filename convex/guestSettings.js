import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./lib/auth";

const SETTINGS_KEY = "guestFeatures";
const DEFAULTS = { compras: true, alimentos: true, musica: true };
const validator = v.object({ compras: v.boolean(), alimentos: v.boolean(), musica: v.boolean() });

// Consulta pública: solo expone las opciones de interfaz, nunca datos privados.
export const get = query({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db.query("publicGuestSettings").withIndex("by_key", q => q.eq("key", SETTINGS_KEY)).unique();
    return row?.features ?? DEFAULTS;
  },
});

export const set = mutation({
  args: { features: validator },
  handler: async (ctx, { features }) => {
    await requireAdmin(ctx);
    const row = await ctx.db.query("publicGuestSettings").withIndex("by_key", q => q.eq("key", SETTINGS_KEY)).unique();
    if (row) await ctx.db.patch(row._id, { features });
    else await ctx.db.insert("publicGuestSettings", { key: SETTINGS_KEY, features });
    return { ok: true };
  },
});

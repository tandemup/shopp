import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireAdmin } from "./lib/auth";

const clean = (value, max) => String(value || "").trim().slice(0, max);

function optionalUrl(value) {
  const candidate = clean(value, 2048);
  if (!candidate) return undefined;
  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error("La URL no es válida.");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("La URL debe comenzar por https://");
  }
  return parsed.toString();
}

async function requireUser(ctx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Usuario no autenticado.");
  return userId;
}

export const listChannels = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    const channels = await ctx.db.query("liveChannels").collect();
    return channels.sort((a, b) => {
      if (a.status !== b.status) return a.status === "live" ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    });
  },
});

export const createChannel = mutation({
  args: {
    title: v.string(),
    category: v.optional(v.string()),
    description: v.optional(v.string()),
    playbackUrl: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const title = clean(args.title, 80);
    if (!title) throw new Error("Escribe el título del canal.");
    const now = Date.now();
    return await ctx.db.insert("liveChannels", {
      ownerId: admin._id,
      title,
      category: clean(args.category, 50) || undefined,
      description: clean(args.description, 500) || undefined,
      playbackUrl: optionalUrl(args.playbackUrl),
      thumbnailUrl: optionalUrl(args.thumbnailUrl),
      status: "offline",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateChannel = mutation({
  args: {
    channelId: v.id("liveChannels"),
    title: v.string(),
    category: v.optional(v.string()),
    description: v.optional(v.string()),
    playbackUrl: v.optional(v.string()),
    thumbnailUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const channel = await ctx.db.get(args.channelId);
    if (!channel) throw new Error("Canal no encontrado.");
    const title = clean(args.title, 80);
    if (!title) throw new Error("Escribe el título del canal.");
    await ctx.db.patch(args.channelId, {
      title,
      category: clean(args.category, 50) || undefined,
      description: clean(args.description, 500) || undefined,
      playbackUrl: optionalUrl(args.playbackUrl),
      thumbnailUrl: optionalUrl(args.thumbnailUrl),
      updatedAt: Date.now(),
    });
  },
});

export const setLiveStatus = mutation({
  args: {
    channelId: v.id("liveChannels"),
    status: v.union(v.literal("offline"), v.literal("live")),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const channel = await ctx.db.get(args.channelId);
    if (!channel) throw new Error("Canal no encontrado.");
    if (args.status === "live" && !channel.playbackUrl) {
      throw new Error("Añade primero una URL de reproducción.");
    }
    const now = Date.now();
    await ctx.db.patch(args.channelId, {
      status: args.status,
      startedAt: args.status === "live" ? now : channel.startedAt,
      endedAt: args.status === "offline" ? now : undefined,
      updatedAt: now,
    });
  },
});

export const listMessages = query({
  args: { channelId: v.id("liveChannels") },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    return await ctx.db
      .query("liveMessages")
      .withIndex("by_channel_createdAt", (q) => q.eq("channelId", args.channelId))
      .order("desc")
      .take(100)
      .then((items) => items.reverse());
  },
});

export const sendMessage = mutation({
  args: { channelId: v.id("liveChannels"), text: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const channel = await ctx.db.get(args.channelId);
    if (!channel) throw new Error("Canal no encontrado.");
    const text = clean(args.text, 280);
    if (!text) return;
    const user = await ctx.db.get(userId);
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", String(userId)))
      .first();
    await ctx.db.insert("liveMessages", {
      channelId: args.channelId,
      userId,
      username: clean(profile?.alias || user?.name || user?.email || "Usuario", 40),
      text,
      createdAt: Date.now(),
    });
  },
});

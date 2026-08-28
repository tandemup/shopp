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
      broadcastMode: "external",
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

export const deleteChannel = mutation({
  args: { channelId: v.id("liveChannels") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const channel = await ctx.db.get(args.channelId);
    if (!channel) throw new Error("Canal no encontrado.");

    const messages = await ctx.db
      .query("liveMessages")
      .withIndex("by_channel_createdAt", (q) => q.eq("channelId", args.channelId))
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }
    const sessions = await ctx.db
      .query("liveViewerSessions")
      .filter((q) => q.eq(q.field("channelId"), args.channelId))
      .collect();
    for (const session of sessions) {
      const candidates = await ctx.db
        .query("liveIceCandidates")
        .filter((q) => q.eq(q.field("sessionId"), session._id))
        .collect();
      for (const candidate of candidates) await ctx.db.delete(candidate._id);
      await ctx.db.delete(session._id);
    }
    await ctx.db.delete(args.channelId);
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
      broadcastMode: args.status === "live" ? "external" : channel.broadcastMode,
      cameraBroadcasterId: undefined,
      startedAt: args.status === "live" ? now : channel.startedAt,
      endedAt: args.status === "offline" ? now : undefined,
      updatedAt: now,
    });
  },
});

export const startCameraBroadcast = mutation({
  args: { channelId: v.id("liveChannels"), broadcasterId: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const channel = await ctx.db.get(args.channelId);
    if (!channel) throw new Error("Canal no encontrado.");
    const now = Date.now();
    await ctx.db.patch(args.channelId, {
      status: "live",
      broadcastMode: "camera",
      cameraBroadcasterId: clean(args.broadcasterId, 100),
      startedAt: now,
      endedAt: undefined,
      updatedAt: now,
    });
  },
});

export const stopCameraBroadcast = mutation({
  args: { channelId: v.id("liveChannels") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const channel = await ctx.db.get(args.channelId);
    if (!channel) throw new Error("Canal no encontrado.");
    const sessions = await ctx.db
      .query("liveViewerSessions")
      .filter((q) => q.eq(q.field("channelId"), args.channelId))
      .collect();
    for (const session of sessions) {
      await ctx.db.patch(session._id, { status: "ended", updatedAt: Date.now() });
    }
    await ctx.db.patch(args.channelId, {
      status: "offline",
      cameraBroadcasterId: undefined,
      endedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const listCameraSessions = query({
  args: { channelId: v.id("liveChannels") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const cutoff = Date.now() - 30000;
    return await ctx.db
      .query("liveViewerSessions")
      .filter((q) =>
        q.and(
          q.eq(q.field("channelId"), args.channelId),
          q.neq(q.field("status"), "ended"),
          q.gte(q.field("updatedAt"), cutoff),
        ),
      )
      .collect();
  },
});

export const createCameraSession = mutation({
  args: {
    channelId: v.id("liveChannels"),
    clientId: v.string(),
    offer: v.string(),
  },
  handler: async (ctx, args) => {
    const viewerId = await requireUser(ctx);
    const channel = await ctx.db.get(args.channelId);
    if (!channel || channel.status !== "live" || channel.broadcastMode !== "camera") {
      throw new Error("La cámara del canal no está emitiendo.");
    }
    const sessions = await ctx.db
      .query("liveViewerSessions")
      .filter((q) => q.eq(q.field("channelId"), args.channelId))
      .collect();
    const cutoff = Date.now() - 30000;
    const active = sessions.filter(
      (session) => session.status !== "ended" && session.updatedAt >= cutoff,
    );
    for (const stale of sessions.filter((session) => session.updatedAt < cutoff)) {
      const candidates = await ctx.db
        .query("liveIceCandidates")
        .filter((q) => q.eq(q.field("sessionId"), stale._id))
        .collect();
      for (const candidate of candidates) await ctx.db.delete(candidate._id);
      await ctx.db.delete(stale._id);
    }
    if (active.length >= 4) throw new Error("El canal ya tiene cuatro espectadores.");
    return await ctx.db.insert("liveViewerSessions", {
      channelId: args.channelId,
      viewerId,
      clientId: clean(args.clientId, 100),
      offer: clean(args.offer, 20000),
      status: "pending",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const answerCameraSession = mutation({
  args: { sessionId: v.id("liveViewerSessions"), answer: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Conexión no encontrada.");
    await ctx.db.patch(args.sessionId, {
      answer: clean(args.answer, 20000),
      status: "connected",
      updatedAt: Date.now(),
    });
  },
});

export const heartbeatCameraSession = mutation({
  args: { sessionId: v.id("liveViewerSessions") },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.viewerId !== userId || session.status === "ended") return;
    await ctx.db.patch(args.sessionId, { updatedAt: Date.now() });
  },
});

export const getCameraSession = query({
  args: { sessionId: v.id("liveViewerSessions") },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const session = await ctx.db.get(args.sessionId);
    if (!session || session.viewerId !== userId) return null;
    return session;
  },
});

export const addCameraIceCandidate = mutation({
  args: {
    sessionId: v.id("liveViewerSessions"),
    side: v.union(v.literal("viewer"), v.literal("broadcaster")),
    candidate: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Conexión no encontrada.");
    if (args.side === "viewer" && session.viewerId !== userId) {
      throw new Error("No puedes modificar esta conexión.");
    }
    if (args.side === "broadcaster") await requireAdmin(ctx);
    await ctx.db.insert("liveIceCandidates", {
      sessionId: args.sessionId,
      side: args.side,
      candidate: clean(args.candidate, 4000),
      createdAt: Date.now(),
    });
  },
});

export const listCameraIceCandidates = query({
  args: {
    sessionId: v.id("liveViewerSessions"),
    side: v.union(v.literal("viewer"), v.literal("broadcaster")),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    return await ctx.db
      .query("liveIceCandidates")
      .withIndex("by_session_side", (q) =>
        q.eq("sessionId", args.sessionId).eq("side", args.side),
      )
      .collect();
  },
});

export const leaveCameraSession = mutation({
  args: { sessionId: v.id("liveViewerSessions") },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const session = await ctx.db.get(args.sessionId);
    if (!session) return;
    const user = await ctx.db.get(userId);
    if (session.viewerId !== userId && !user?.isAdmin) {
      throw new Error("No puedes cerrar esta conexión.");
    }
    const candidates = await ctx.db
      .query("liveIceCandidates")
      .filter((q) => q.eq(q.field("sessionId"), args.sessionId))
      .collect();
    for (const candidate of candidates) await ctx.db.delete(candidate._id);
    await ctx.db.delete(args.sessionId);
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

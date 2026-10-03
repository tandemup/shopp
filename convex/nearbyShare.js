import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireFeature } from "./lib/auth";

const P2P_PLAYLIST_EXCHANGE = "p2pPlaylistExchange";
const PRESENCE_MS = 2 * 60 * 1000;
const PAIRING_MS = 5 * 60 * 1000;
const INVITATION_MS = 60 * 1000;
const MAX_SIGNAL_LENGTH = 20000;
const clean = (value, max) => String(value || "").trim().slice(0, max);
const cleanDeviceId = (value) => clean(value, 80);

async function getP2PViewer(ctx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;
  const user = await ctx.db.get(userId);
  if (!user || user.status === "blocked") return null;
  const allowed =
    user.role === "admin" ||
    user.isAdmin === true ||
    user.permissions?.[P2P_PLAYLIST_EXCHANGE] === true;
  return allowed ? user : null;
}

async function deleteExpired(ctx) {
  const now = Date.now();
  const presences = await ctx.db.query("nearbySharePresence").withIndex("by_expiresAt", (q) => q.lt("expiresAt", now)).take(100);
  for (const item of presences) await ctx.db.delete(item._id);
  const signals = await ctx.db.query("nearbyShareSignals").withIndex("by_expiresAt", (q) => q.lt("expiresAt", now)).take(100);
  for (const item of signals) await ctx.db.delete(item._id);
  const pairings = await ctx.db.query("nearbySharePairings").withIndex("by_expiresAt", (q) => q.lt("expiresAt", now)).take(100);
  for (const pairing of pairings) await ctx.db.delete(pairing._id);
}

async function getPairingForDevice(ctx, pairingId, userId, deviceId) {
  const pairing = await ctx.db.get(pairingId);
  if (!pairing || pairing.expiresAt <= Date.now()) throw new Error("La invitación ha caducado.");
  const isInitiator = pairing.initiatorId === userId && pairing.initiatorDeviceId === deviceId;
  const isRecipient = pairing.recipientId === userId && pairing.recipientDeviceId === deviceId;
  if (!isInitiator && !isRecipient) throw new Error("No puedes usar esta invitación desde este dispositivo.");
  return pairing;
}

export const enablePresence = mutation({
  args: { displayName: v.string(), deviceId: v.string(), channels: v.optional(v.array(v.string())) },
  handler: async (ctx, args) => {
    const user = await requireFeature(ctx, P2P_PLAYLIST_EXCHANGE);
    await deleteExpired(ctx);
    const displayName = clean(args.displayName, 30);
    const deviceId = cleanDeviceId(args.deviceId);
    if (!displayName) throw new Error("Escribe un alias para la prueba.");
    if (!deviceId) throw new Error("No se pudo identificar este dispositivo.");
    const now = Date.now();
    const existing = await ctx.db.query("nearbySharePresence").withIndex("by_user_device", (q) => q.eq("userId", user._id).eq("deviceId", deviceId)).first();
    const channels = (args.channels || []).map((item) => clean(item, 40).replace(/^#/, "").toLowerCase()).filter(Boolean).slice(0, 20);
    const data = { deviceId, displayName, channels, expiresAt: now + PRESENCE_MS, updatedAt: now };
    if (existing) {
      await ctx.db.patch(existing._id, data);
      return existing._id;
    }
    return await ctx.db.insert("nearbySharePresence", { userId: user._id, createdAt: now, ...data });
  },
});

export const disablePresence = mutation({
  args: { deviceId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireFeature(ctx, P2P_PLAYLIST_EXCHANGE);
    const deviceId = cleanDeviceId(args.deviceId);
    const rows = await ctx.db.query("nearbySharePresence").withIndex("by_user_device", (q) => q.eq("userId", user._id).eq("deviceId", deviceId)).collect();
    for (const row of rows) await ctx.db.delete(row._id);
  },
});

export const getMyPresence = query({
  args: { deviceId: v.string() },
  handler: async (ctx, args) => {
    const user = await getP2PViewer(ctx);
    if (!user) return null;
    const deviceId = cleanDeviceId(args.deviceId);
    const item = await ctx.db.query("nearbySharePresence").withIndex("by_user_device", (q) => q.eq("userId", user._id).eq("deviceId", deviceId)).first();
    return item && item.expiresAt > Date.now() ? item : null;
  },
});

export const listVisiblePeers = query({
  args: { deviceId: v.string() },
  handler: async (ctx, args) => {
    const user = await getP2PViewer(ctx);
    if (!user) return [];
    const now = Date.now();
    const deviceId = cleanDeviceId(args.deviceId);
    const rows = await ctx.db.query("nearbySharePresence").withIndex("by_expiresAt", (q) => q.gt("expiresAt", now)).take(50);
    return rows
      .filter((item) => item.deviceId && !(item.userId === user._id && item.deviceId === deviceId) && item.expiresAt > now)
      .map((item) => ({
        presenceId: item._id,
        userId: item.userId,
        deviceId: item.deviceId,
        displayName: item.displayName,
        channels: item.channels || [],
        sameUser: item.userId === user._id,
        expiresAt: item.expiresAt,
      }));
  },
});

export const requestPairing = mutation({
  args: { recipientPresenceId: v.id("nearbySharePresence"), confirmCode: v.string(), deviceId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireFeature(ctx, P2P_PLAYLIST_EXCHANGE);
    await deleteExpired(ctx);
    const deviceId = cleanDeviceId(args.deviceId);
    const recipientPresence = await ctx.db.get(args.recipientPresenceId);
    const ownPresence = await ctx.db.query("nearbySharePresence").withIndex("by_user_device", (q) => q.eq("userId", user._id).eq("deviceId", deviceId)).first();
    if (!recipientPresence || !recipientPresence.deviceId || recipientPresence.expiresAt <= Date.now()) throw new Error("Ese dispositivo ya no está disponible.");
    if (!ownPresence || ownPresence.expiresAt <= Date.now()) throw new Error("Activa primero tu visibilidad temporal.");
    if (recipientPresence.userId === user._id && recipientPresence.deviceId === deviceId) throw new Error("Elige otro dispositivo.");
    const confirmCode = clean(args.confirmCode, 12);
    if (!/^[A-Z0-9]{4,12}$/.test(confirmCode)) throw new Error("El código de confirmación no es válido.");
    const now = Date.now();
    return await ctx.db.insert("nearbySharePairings", {
      initiatorId: user._id,
      recipientId: recipientPresence.userId,
      initiatorDeviceId: deviceId,
      recipientDeviceId: recipientPresence.deviceId,
      initiatorName: ownPresence.displayName,
      recipientName: recipientPresence.displayName,
      confirmCode,
      status: "pending",
      expiresAt: now + INVITATION_MS,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const respondToPairing = mutation({
  args: { pairingId: v.id("nearbySharePairings"), accept: v.boolean(), deviceId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireFeature(ctx, P2P_PLAYLIST_EXCHANGE);
    const deviceId = cleanDeviceId(args.deviceId);
    const pairing = await getPairingForDevice(ctx, args.pairingId, user._id, deviceId);
    if (pairing.recipientId !== user._id || pairing.recipientDeviceId !== deviceId || pairing.status !== "pending") throw new Error("Esta solicitud ya no se puede responder.");
    await ctx.db.patch(pairing._id, { status: args.accept ? "accepted" : "rejected", updatedAt: Date.now(), expiresAt: Date.now() + (args.accept ? PAIRING_MS : 30000) });
  },
});

export const listPairings = query({
  args: { deviceId: v.string() },
  handler: async (ctx, args) => {
    const user = await getP2PViewer(ctx);
    if (!user) return [];
    const now = Date.now();
    const deviceId = cleanDeviceId(args.deviceId);
    const [outgoing, incoming] = await Promise.all([
      ctx.db.query("nearbySharePairings").withIndex("by_initiator_updatedAt", (q) => q.eq("initiatorId", user._id)).collect(),
      ctx.db.query("nearbySharePairings").withIndex("by_recipient_updatedAt", (q) => q.eq("recipientId", user._id)).collect(),
    ]);
    const unique = new Map([...outgoing, ...incoming].map((item) => [String(item._id), item]));
    return [...unique.values()]
      .filter((item) => item.expiresAt > now && ((item.initiatorId === user._id && item.initiatorDeviceId === deviceId) || (item.recipientId === user._id && item.recipientDeviceId === deviceId)))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((item) => ({ ...item, sameUser: item.initiatorId === item.recipientId, isInitiator: item.initiatorId === user._id && item.initiatorDeviceId === deviceId, friendName: item.initiatorId === user._id && item.initiatorDeviceId === deviceId ? item.recipientName : item.initiatorName }));
  },
});

export const sendSignal = mutation({
  args: { pairingId: v.id("nearbySharePairings"), deviceId: v.string(), type: v.union(v.literal("offer"), v.literal("answer"), v.literal("ice")), payload: v.string() },
  handler: async (ctx, args) => {
    const user = await requireFeature(ctx, P2P_PLAYLIST_EXCHANGE);
    const deviceId = cleanDeviceId(args.deviceId);
    const pairing = await getPairingForDevice(ctx, args.pairingId, user._id, deviceId);
    if (pairing.status !== "accepted") throw new Error("Falta aceptar la invitación.");
    const payload = clean(args.payload, MAX_SIGNAL_LENGTH);
    if (!payload) throw new Error("La señal WebRTC está vacía.");
    return await ctx.db.insert("nearbyShareSignals", { pairingId: pairing._id, senderId: user._id, senderDeviceId: deviceId, type: args.type, payload, expiresAt: pairing.expiresAt, createdAt: Date.now() });
  },
});

export const listSignals = query({
  args: { pairingId: v.id("nearbySharePairings"), deviceId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireFeature(ctx, P2P_PLAYLIST_EXCHANGE);
    const deviceId = cleanDeviceId(args.deviceId);
    await getPairingForDevice(ctx, args.pairingId, user._id, deviceId);
    const signals = await ctx.db.query("nearbyShareSignals").withIndex("by_pairing_createdAt", (q) => q.eq("pairingId", args.pairingId)).collect();
    return signals.filter((signal) => signal.senderDeviceId !== deviceId);
  },
});

export const closePairing = mutation({
  args: { pairingId: v.id("nearbySharePairings"), deviceId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireFeature(ctx, P2P_PLAYLIST_EXCHANGE);
    const deviceId = cleanDeviceId(args.deviceId);
    const pairing = await getPairingForDevice(ctx, args.pairingId, user._id, deviceId);
    const signals = await ctx.db.query("nearbyShareSignals").withIndex("by_pairing_createdAt", (q) => q.eq("pairingId", pairing._id)).collect();
    for (const signal of signals) await ctx.db.delete(signal._id);
    await ctx.db.delete(pairing._id);
  },
});

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireFeature } from "./lib/auth";

const P2P_PLAYLIST_EXCHANGE = "p2pPlaylistExchange";

const PRESENCE_MS = 2 * 60 * 1000;
const PAIRING_MS = 5 * 60 * 1000;
const MAX_SIGNAL_LENGTH = 20000;

const clean = (value, max) => String(value || "").trim().slice(0, max);

// Las consultas se montan al abrir la pantalla. Si una sesión antigua apunta
// a un usuario ya eliminado (o el perfil todavía se está creando), una query
// nunca debe romper la pantalla. Las mutaciones sí mantienen requireFeature,
// que es la autorización definitiva.
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
  const presences = await ctx.db
    .query("nearbySharePresence")
    .withIndex("by_expiresAt", (q) => q.lt("expiresAt", now))
    .take(100);
  for (const item of presences) await ctx.db.delete(item._id);

  const signals = await ctx.db
    .query("nearbyShareSignals")
    .withIndex("by_expiresAt", (q) => q.lt("expiresAt", now))
    .take(100);
  for (const item of signals) await ctx.db.delete(item._id);

  const pairings = await ctx.db
    .query("nearbySharePairings")
    .withIndex("by_expiresAt", (q) => q.lt("expiresAt", now))
    .take(100);
  for (const pairing of pairings) await ctx.db.delete(pairing._id);
}

async function getPairingForUser(ctx, pairingId, userId) {
  const pairing = await ctx.db.get(pairingId);
  if (!pairing || pairing.expiresAt <= Date.now()) {
    throw new Error("La invitación ha caducado.");
  }
  if (pairing.initiatorId !== userId && pairing.recipientId !== userId) {
    throw new Error("No puedes usar esta invitación.");
  }
  return pairing;
}

export const enablePresence = mutation({
  args: { displayName: v.string() },
  handler: async (ctx, args) => {
    const user = await requireFeature(ctx, P2P_PLAYLIST_EXCHANGE);
    await deleteExpired(ctx);
    const displayName = clean(args.displayName, 30);
    if (!displayName) throw new Error("Escribe un alias para la prueba.");
    const now = Date.now();
    const existing = await ctx.db
      .query("nearbySharePresence")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    const data = {
      displayName,
      expiresAt: now + PRESENCE_MS,
      updatedAt: now,
    };
    if (existing) {
      await ctx.db.patch(existing._id, data);
      return existing._id;
    }
    return await ctx.db.insert("nearbySharePresence", {
      userId: user._id,
      createdAt: now,
      ...data,
    });
  },
});

export const disablePresence = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireFeature(ctx, P2P_PLAYLIST_EXCHANGE);
    const rows = await ctx.db
      .query("nearbySharePresence")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    for (const row of rows) await ctx.db.delete(row._id);
  },
});

export const getMyPresence = query({
  args: {},
  handler: async (ctx) => {
    const user = await getP2PViewer(ctx);
    if (!user) return null;
    const item = await ctx.db
      .query("nearbySharePresence")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    return item && item.expiresAt > Date.now() ? item : null;
  },
});

export const listVisiblePeers = query({
  args: {},
  handler: async (ctx) => {
    const user = await getP2PViewer(ctx);
    if (!user) return [];
    const now = Date.now();
    const rows = await ctx.db
      .query("nearbySharePresence")
      .withIndex("by_expiresAt", (q) => q.gt("expiresAt", now))
      .take(50);
    return rows
      .filter((item) => item.userId !== user._id && item.expiresAt > now)
      .map((item) => ({
        userId: item.userId,
        displayName: item.displayName,
        expiresAt: item.expiresAt,
      }));
  },
});

export const requestPairing = mutation({
  args: { recipientId: v.id("users"), confirmCode: v.string() },
  handler: async (ctx, args) => {
    const user = await requireFeature(ctx, P2P_PLAYLIST_EXCHANGE);
    await deleteExpired(ctx);
    if (args.recipientId === user._id) throw new Error("Elige otro dispositivo.");
    const recipientPresence = await ctx.db
      .query("nearbySharePresence")
      .withIndex("by_user", (q) => q.eq("userId", args.recipientId))
      .first();
    const ownPresence = await ctx.db
      .query("nearbySharePresence")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .first();
    if (!recipientPresence || recipientPresence.expiresAt <= Date.now()) {
      throw new Error("Ese amigo ya no está disponible.");
    }
    if (!ownPresence || ownPresence.expiresAt <= Date.now()) {
      throw new Error("Activa primero tu visibilidad temporal.");
    }
    const confirmCode = clean(args.confirmCode, 12);
    if (!/^[A-Z0-9]{4,12}$/.test(confirmCode)) {
      throw new Error("El código de confirmación no es válido.");
    }
    const now = Date.now();
    return await ctx.db.insert("nearbySharePairings", {
      initiatorId: user._id,
      recipientId: args.recipientId,
      initiatorName: ownPresence.displayName,
      recipientName: recipientPresence.displayName,
      confirmCode,
      status: "pending",
      expiresAt: now + PAIRING_MS,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const respondToPairing = mutation({
  args: { pairingId: v.id("nearbySharePairings"), accept: v.boolean() },
  handler: async (ctx, args) => {
    const user = await requireFeature(ctx, P2P_PLAYLIST_EXCHANGE);
    const pairing = await getPairingForUser(ctx, args.pairingId, user._id);
    if (pairing.recipientId !== user._id || pairing.status !== "pending") {
      throw new Error("Esta solicitud ya no se puede responder.");
    }
    await ctx.db.patch(pairing._id, {
      status: args.accept ? "accepted" : "rejected",
      updatedAt: Date.now(),
      expiresAt: Date.now() + (args.accept ? PAIRING_MS : 30000),
    });
  },
});

export const listPairings = query({
  args: {},
  handler: async (ctx) => {
    const user = await getP2PViewer(ctx);
    if (!user) return [];
    const now = Date.now();
    const [outgoing, incoming] = await Promise.all([
      ctx.db
        .query("nearbySharePairings")
        .withIndex("by_initiator_updatedAt", (q) => q.eq("initiatorId", user._id))
        .collect(),
      ctx.db
        .query("nearbySharePairings")
        .withIndex("by_recipient_updatedAt", (q) => q.eq("recipientId", user._id))
        .collect(),
    ]);
    return [...outgoing, ...incoming]
      .filter((item) => item.expiresAt > now)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((item) => ({
        ...item,
        isInitiator: item.initiatorId === user._id,
        friendName: item.initiatorId === user._id ? item.recipientName : item.initiatorName,
      }));
  },
});

export const sendSignal = mutation({
  args: {
    pairingId: v.id("nearbySharePairings"),
    type: v.union(v.literal("offer"), v.literal("answer"), v.literal("ice")),
    payload: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireFeature(ctx, P2P_PLAYLIST_EXCHANGE);
    const pairing = await getPairingForUser(ctx, args.pairingId, user._id);
    if (pairing.status !== "accepted") throw new Error("Falta aceptar la invitación.");
    const payload = clean(args.payload, MAX_SIGNAL_LENGTH);
    if (!payload) throw new Error("La señal WebRTC está vacía.");
    return await ctx.db.insert("nearbyShareSignals", {
      pairingId: pairing._id,
      senderId: user._id,
      type: args.type,
      payload,
      expiresAt: pairing.expiresAt,
      createdAt: Date.now(),
    });
  },
});

export const listSignals = query({
  args: { pairingId: v.id("nearbySharePairings") },
  handler: async (ctx, args) => {
    const user = await requireFeature(ctx, P2P_PLAYLIST_EXCHANGE);
    await getPairingForUser(ctx, args.pairingId, user._id);
    const signals = await ctx.db
      .query("nearbyShareSignals")
      .withIndex("by_pairing_createdAt", (q) => q.eq("pairingId", args.pairingId))
      .collect();
    return signals.filter((signal) => signal.senderId !== user._id);
  },
});

export const closePairing = mutation({
  args: { pairingId: v.id("nearbySharePairings") },
  handler: async (ctx, args) => {
    const user = await requireFeature(ctx, P2P_PLAYLIST_EXCHANGE);
    const pairing = await getPairingForUser(ctx, args.pairingId, user._id);
    const signals = await ctx.db
      .query("nearbyShareSignals")
      .withIndex("by_pairing_createdAt", (q) => q.eq("pairingId", pairing._id))
      .collect();
    for (const signal of signals) await ctx.db.delete(signal._id);
    await ctx.db.delete(pairing._id);
  },
});

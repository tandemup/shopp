import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

function cleanText(value, maxLength = 80) {
  const text = String(value || "").trim();
  return text ? text.slice(0, maxLength) : "";
}

async function requireAuthUser(ctx) {
  const userId = await getAuthUserId(ctx);

  if (!userId) {
    throw new Error("Usuario no autenticado.");
  }

  const user = await ctx.db.get(userId);

  if (!user) {
    throw new Error("Usuario no encontrado.");
  }

  return { userId, user };
}

async function requireAdmin(ctx) {
  const { userId, user } = await requireAuthUser(ctx);

  if (user.role !== "admin") {
    throw new Error("Se requiere el rol de administrador.");
  }

  return { userId, user };
}

async function getProfile(ctx, userId) {
  return await ctx.db
    .query("userProfiles")
    .withIndex("by_userId", (q) => q.eq("userId", String(userId)))
    .first();
}

async function serializeAlarm(ctx, alarm) {
  return {
    ...alarm,
    snapshotUrl: alarm.snapshotStorageId
      ? await ctx.storage.getUrl(alarm.snapshotStorageId)
      : null,
  };
}

export const generateSnapshotUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAuthUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const create = mutation({
  args: {
    advisorId: v.string(),
    advisorLabel: v.string(),
    snapshotStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const { userId, user } = await requireAuthUser(ctx);
    const now = Date.now();
    const profile = await getProfile(ctx, userId);

    const advisorId = cleanText(args.advisorId, 40);
    const advisorLabel = cleanText(args.advisorLabel, 80);

    if (!advisorId || !advisorLabel) {
      throw new Error("El destinatario de la alarma no es válido.");
    }

    const alarmId = await ctx.db.insert("fireAlarms", {
      createdBy: userId,
      createdByAlias:
        cleanText(profile?.alias, 40) ||
        cleanText(user.name, 40) ||
        cleanText(user.email, 80) ||
        "Usuario",
      advisorId,
      advisorLabel,
      status: "pending",
      snapshotStorageId: args.snapshotStorageId,
      createdAt: now,
      updatedAt: now,
    });

    return { ok: true, alarmId };
  },
});

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireAuthUser(ctx);

    const alarms = await ctx.db
      .query("fireAlarms")
      .withIndex("by_createdBy_createdAt", (q) => q.eq("createdBy", userId))
      .order("desc")
      .take(20);

    return await Promise.all(alarms.map((alarm) => serializeAlarm(ctx, alarm)));
  },
});

export const listActiveForAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const alarms = await ctx.db
      .query("fireAlarms")
      .withIndex("by_createdAt")
      .order("desc")
      .take(100);

    const active = alarms.filter(
      (alarm) => alarm.status === "pending" || alarm.status === "acknowledged",
    );

    return await Promise.all(active.map((alarm) => serializeAlarm(ctx, alarm)));
  },
});

export const acknowledge = mutation({
  args: { alarmId: v.id("fireAlarms") },
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx);
    const alarm = await ctx.db.get(args.alarmId);

    if (!alarm) {
      throw new Error("Alarma no encontrada.");
    }

    if (alarm.status !== "pending") {
      return { ok: true, unchanged: true };
    }

    const now = Date.now();
    await ctx.db.patch(args.alarmId, {
      status: "acknowledged",
      acknowledgedBy: userId,
      acknowledgedAt: now,
      updatedAt: now,
    });

    return { ok: true };
  },
});

export const resolve = mutation({
  args: { alarmId: v.id("fireAlarms") },
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx);
    const alarm = await ctx.db.get(args.alarmId);

    if (!alarm) {
      throw new Error("Alarma no encontrada.");
    }

    const now = Date.now();
    await ctx.db.patch(args.alarmId, {
      status: "resolved",
      acknowledgedBy: alarm.acknowledgedBy ?? userId,
      acknowledgedAt: alarm.acknowledgedAt ?? now,
      resolvedAt: now,
      updatedAt: now,
    });

    return { ok: true };
  },
});

export const cancelMine = mutation({
  args: { alarmId: v.id("fireAlarms") },
  handler: async (ctx, args) => {
    const { userId, user } = await requireAuthUser(ctx);
    const alarm = await ctx.db.get(args.alarmId);

    if (!alarm) {
      throw new Error("Alarma no encontrada.");
    }

    const isOwner = String(alarm.createdBy) === String(userId);
    const isAdmin = user.role === "admin";

    if (!isOwner && !isAdmin) {
      throw new Error("No tienes permiso para cancelar esta alarma.");
    }

    if (alarm.status === "resolved" || alarm.status === "cancelled") {
      return { ok: true, unchanged: true };
    }

    await ctx.db.patch(args.alarmId, {
      status: "cancelled",
      updatedAt: Date.now(),
    });

    return { ok: true };
  },
});

async function requireAlarmAccess(ctx, alarmId) {
  const { userId, user } = await requireAuthUser(ctx);
  const alarm = await ctx.db.get(alarmId);

  if (!alarm) {
    throw new Error("Alarma no encontrada.");
  }

  const isOwner = String(alarm.createdBy) === String(userId);
  const isAdmin = user.role === "admin";

  if (!isOwner && !isAdmin) {
    throw new Error("No tienes permiso para acceder a esta sesión WebRTC.");
  }

  return { userId, user, alarm, isOwner, isAdmin };
}

export const sendRtcSignal = mutation({
  args: {
    alarmId: v.id("fireAlarms"),
    type: v.union(v.literal("offer"), v.literal("answer"), v.literal("ice")),
    payload: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId, isOwner, isAdmin } = await requireAlarmAccess(
      ctx,
      args.alarmId,
    );

    if (args.type === "offer" && !isOwner) {
      throw new Error(
        "Solo la cámara que creó la alarma puede enviar la oferta.",
      );
    }

    if (args.type === "answer" && !isAdmin) {
      throw new Error("Solo un administrador puede responder a la sesión.");
    }

    const payload = String(args.payload || "");
    if (!payload || payload.length > 20000) {
      throw new Error("La señal WebRTC no es válida.");
    }

    const signalId = await ctx.db.insert("fireAlarmSignals", {
      alarmId: args.alarmId,
      senderId: userId,
      senderRole: isAdmin ? "admin" : "camera",
      type: args.type,
      payload,
      createdAt: Date.now(),
    });

    return { ok: true, signalId };
  },
});

export const listRtcSignals = query({
  args: { alarmId: v.id("fireAlarms") },
  handler: async (ctx, args) => {
    await requireAlarmAccess(ctx, args.alarmId);

    return await ctx.db
      .query("fireAlarmSignals")
      .withIndex("by_alarmId_createdAt", (q) => q.eq("alarmId", args.alarmId))
      .order("asc")
      .take(200);
  },
});

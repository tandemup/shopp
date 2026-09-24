import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireAdmin } from "./lib/auth";

const PERMISSION_FIELDS = [
  "scanner", "stores", "chat", "parking", "englishTutor", "library",
  "musicPlaylist", "classicalMusic", "tutorials", "news", "shoppLive",
  "fireAlarm", "investments",
];

const permissionsValidator = v.object({
  scanner: v.optional(v.boolean()),
  stores: v.optional(v.boolean()),
  chat: v.optional(v.boolean()),
  parking: v.optional(v.boolean()),
  englishTutor: v.optional(v.boolean()),
  library: v.optional(v.boolean()),
  musicPlaylist: v.optional(v.boolean()),
  classicalMusic: v.optional(v.boolean()),
  tutorials: v.optional(v.boolean()),
  news: v.optional(v.boolean()),
  shoppLive: v.optional(v.boolean()),
  fireAlarm: v.optional(v.boolean()),
  investments: v.optional(v.boolean()),
});

function normalizePermissions(permissions = {}) {
  return Object.fromEntries(
    PERMISSION_FIELDS.map((feature) => [feature, permissions[feature] === true]),
  );
}

function cleanText(value) {
  return String(value || "").trim();
}

function cleanAlias(value) {
  const alias = cleanText(value);
  return alias ? alias.slice(0, 40) : "anonymous";
}

function cleanPhone(value) {
  const phone = cleanText(value);
  return phone ? phone.slice(0, 30) : undefined;
}

async function requireAuthUserId(ctx) {
  const userId = await getAuthUserId(ctx);

  if (!userId) {
    throw new Error("Usuario no autenticado.");
  }

  const user = await ctx.db.get(userId);
  if (!user || user.status === "blocked") {
    throw new Error("Usuario no disponible.");
  }

  return String(userId);
}

async function getProfileByUserId(ctx, userId) {
  return await ctx.db
    .query("userProfiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .first();
}

async function deleteStorageIfExists(ctx, storageId) {
  if (!storageId) return;

  const metadata = await ctx.storage.getMetadata(storageId);
  if (metadata) {
    await ctx.storage.delete(storageId);
  }
}

export const current = query({
  args: {},
  handler: async (ctx) => {
    const authUserId = await getAuthUserId(ctx);

    if (authUserId === null) {
      return null;
    }

    const user = await ctx.db.get(authUserId);

    if (!user) {
      return null;
    }

    const userId = String(authUserId);
    const profile = await getProfileByUserId(ctx, userId);

    return {
      _id: user._id,
      _creationTime: user._creationTime,

      name: user.name ?? null,
      email: user.email ?? null,
      image: user.image ?? null,

      emailVerificationTime: user.emailVerificationTime ?? null,
      phone: profile?.phone ?? user.phone ?? null,
      phoneVerificationTime: user.phoneVerificationTime ?? null,
      isAnonymous: user.isAnonymous ?? false,
      role: user.role ?? "user",
      isAdmin: user.role === "admin" || user.isAdmin === true,
      status: user.status ?? "active",
      permissions: normalizePermissions(user.permissions),

      profile: profile
        ? {
            _id: profile._id,
            alias: profile.alias,
            avatarStorageId: profile.avatarStorageId ?? null,
            avatarUrl: profile.avatarStorageId
              ? await ctx.storage.getUrl(profile.avatarStorageId)
              : null,
            phone: profile.phone ?? null,
            phoneVisible: profile.phoneVisible ?? false,
            scanHistorySyncEnabled: profile.scanHistorySyncEnabled === true,
            createdAt: profile.createdAt,
            updatedAt: profile.updatedAt,
          }
        : null,
    };
  },
});

export const listForAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const users = await ctx.db.query("users").collect();

    return users
      .map((user) => ({
        _id: user._id,
        _creationTime: user._creationTime,
        name: user.name ?? null,
        email: user.email ?? null,
        role: user.role ?? "user",
        isAnonymous: user.isAnonymous ?? false,
        status: user.status ?? "active",
        permissions: normalizePermissions(user.permissions),
        blockedAt: user.blockedAt ?? null,
        blockReason: user.blockReason ?? null,
      }))
      .sort((a, b) => {
        const aLabel = a.email || a.name || String(a._id);
        const bLabel = b.email || b.name || String(b._id);
        return aLabel.localeCompare(bLabel);
      });
  },
});

export const setRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.union(v.literal("user"), v.literal("admin")),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    if (admin._id === args.userId && args.role !== "admin") {
      throw new Error("No puedes retirar tu propio rol de administrador.");
    }

    const targetUser = await ctx.db.get(args.userId);

    if (!targetUser) {
      throw new Error("Usuario no encontrado.");
    }

    await ctx.db.patch(args.userId, { role: args.role });

    return { ok: true };
  },
});

export const setBlocked = mutation({
  args: {
    userId: v.id("users"),
    blocked: v.boolean(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { userId, blocked, reason }) => {
    const admin = await requireAdmin(ctx);
    if (admin._id === userId) {
      throw new Error("No puedes bloquear tu propia cuenta.");
    }
    const target = await ctx.db.get(userId);
    if (!target) throw new Error("Usuario no encontrado.");
    if (target.status === (blocked ? "blocked" : "active")) return { ok: true };
    const normalizedReason = String(reason ?? "").trim().slice(0, 300);
    await ctx.db.patch(userId, blocked
      ? { status: "blocked", blockedAt: Date.now(), blockedBy: admin._id, blockReason: normalizedReason || undefined }
      : { status: "active", blockedAt: undefined, blockedBy: undefined, blockReason: undefined });
    return { ok: true };
  },
});

export const setPermissions = mutation({
  args: {
    userId: v.id("users"),
    permissions: permissionsValidator,
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) throw new Error("Usuario no encontrado.");

    if (targetUser.role === "admin" || targetUser.isAdmin === true) {
      throw new Error("Los administradores ya tienen acceso a todas las utilidades.");
    }

    await ctx.db.patch(args.userId, {
      permissions: normalizePermissions(args.permissions),
    });

    return { ok: true };
  },
});

export const getMyProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      return null;
    }

    const profile = await getProfileByUserId(ctx, String(userId));

    if (!profile) {
      return null;
    }

    return {
      _id: profile._id,
      alias: profile.alias,
      avatarStorageId: profile.avatarStorageId ?? null,
      avatarUrl: profile.avatarStorageId
        ? await ctx.storage.getUrl(profile.avatarStorageId)
        : null,
      phone: profile.phone ?? null,
      phoneVisible: profile.phoneVisible ?? false,
      scanHistorySyncEnabled: profile.scanHistorySyncEnabled === true,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  },
});

export const upsertMyProfile = mutation({
  args: {
    alias: v.string(),
    phone: v.optional(v.string()),
    phoneVisible: v.optional(v.boolean()),
    scanHistorySyncEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const now = Date.now();

    const alias = cleanAlias(args.alias);
    const phone = cleanPhone(args.phone);
    const phoneVisible = args.phoneVisible === true;
    const scanHistorySyncEnabled = args.scanHistorySyncEnabled === true;

    const existingProfile = await getProfileByUserId(ctx, userId);

    if (existingProfile) {
      await ctx.db.patch(existingProfile._id, {
        alias,
        phone,
        phoneVisible,
        scanHistorySyncEnabled,
        updatedAt: now,
      });

      return {
        ok: true,
        profileId: existingProfile._id,
      };
    }

    const profileId = await ctx.db.insert("userProfiles", {
      userId,
      alias,
      phone,
      phoneVisible,
      scanHistorySyncEnabled,
      createdAt: now,
      updatedAt: now,
    });

    return {
      ok: true,
      profileId,
    };
  },
});

export const generateAvatarUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAuthUserId(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const setMyAvatar = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    const profile = await getProfileByUserId(ctx, userId);

    if (!profile) {
      throw new Error("Completa primero tu perfil con un alias.");
    }

    if (profile.avatarStorageId && profile.avatarStorageId !== args.storageId) {
      await deleteStorageIfExists(ctx, profile.avatarStorageId);
    }

    await ctx.db.patch(profile._id, {
      avatarStorageId: args.storageId,
      updatedAt: Date.now(),
    });

    return { ok: true };
  },
});

export const removeMyAvatar = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    const profile = await getProfileByUserId(ctx, userId);

    if (!profile) return { ok: true };

    if (profile.avatarStorageId) {
      await deleteStorageIfExists(ctx, profile.avatarStorageId);
    }

    await ctx.db.patch(profile._id, {
      avatarStorageId: undefined,
      updatedAt: Date.now(),
    });

    return { ok: true };
  },
});

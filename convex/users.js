import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireAdmin } from "./lib/auth";

const PERMISSION_FIELDS = [
  "scanner", "stores", "chat", "parking", "englishTutor", "library",
  "musicPlaylist", "classicalMusic", "tutorials", "news", "shoppLive",
  "p2pPlaylistExchange", "fireAlarm", "investments",
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
  p2pPlaylistExchange: v.optional(v.boolean()),
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


const DEFAULT_TESTER_PERMISSIONS = Object.freeze({
  scanner: true, stores: true, musicPlaylist: true, classicalMusic: true,
  tutorials: true, p2pPlaylistExchange: true,
});

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

// Solo administradores pueden autorizar un correo para acceder como tester.
export const inviteTester = mutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const admin = await requireAdmin(ctx);
    const normalized = normalizeEmail(email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      throw new Error("Introduce un correo electrónico válido.");
    }
    const existing = await ctx.db.query("testerInvitations")
      .withIndex("by_email", q => q.eq("email", normalized)).collect();
    const now = Date.now();
    if (existing.some(i => !i.revokedAt && !i.acceptedAt && i.expiresAt > now)) {
      throw new Error("Este correo ya tiene una invitación vigente.");
    }
    // Si el usuario existe, el administrador puede asignarle tester desde Gestión de usuarios.
    const id = await ctx.db.insert("testerInvitations", {
      email: normalized, createdBy: admin._id, createdAt: now,
      expiresAt: now + 7 * 24 * 60 * 60 * 1000,
      permissions: DEFAULT_TESTER_PERMISSIONS,
    });
    return { id, email: normalized };
  },
});

export const listTesterInvitations = query({
  args: {},
  handler: async ctx => {
    await requireAdmin(ctx);
    return await ctx.db.query("testerInvitations").order("desc").take(100);
  },
});

export const revokeTesterInvitation = mutation({
  args: { invitationId: v.id("testerInvitations") },
  handler: async (ctx, { invitationId }) => {
    await requireAdmin(ctx);
    const invitation = await ctx.db.get(invitationId);
    if (!invitation) throw new Error("Invitación no encontrada.");
    if (invitation.acceptedAt) throw new Error("Esta invitación ya se utilizó.");
    await ctx.db.patch(invitationId, { revokedAt: Date.now() });
    return { ok: true };
  },
});

// Se ejecuta después de la verificación de Convex Auth: nunca confía en un
// parámetro de navegación ni en una dirección proporcionada por el cliente.
export const activateTesterRole = mutation({
  args: {},
  handler: async ctx => {
    const userId = await requireAuthUserId(ctx);
    const user = await ctx.db.get(userId);
    if (!user?.email || !user.emailVerificationTime) {
      throw new Error("Verifica tu correo electrónico para activar la invitación.");
    }
    if (user.role === "admin" || user.isAdmin === true) return { ok: true, role: "admin" };
    const email = normalizeEmail(user.email);
    const invitations = await ctx.db.query("testerInvitations")
      .withIndex("by_email", q => q.eq("email", email)).collect();
    const invitation = invitations.find(i => !i.revokedAt && !i.acceptedAt && i.expiresAt > Date.now());
    if (!invitation) throw new Error("No existe una invitación vigente para este correo.");
    await ctx.db.patch(userId, {
      role: "tester", permissions: normalizePermissions(invitation.permissions || DEFAULT_TESTER_PERMISSIONS),
    });
    await ctx.db.patch(invitation._id, { acceptedAt: Date.now(), acceptedBy: user._id });
    return { ok: true, role: "tester" };
  },
});

export const setRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.union(v.literal("user"), v.literal("tester"), v.literal("admin")),
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

    await ctx.db.patch(args.userId, {
      role: args.role,
      ...(args.role === "tester" && !targetUser.permissions
        ? { permissions: normalizePermissions(DEFAULT_TESTER_PERMISSIONS) } : {}),
    });

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

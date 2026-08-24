import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const DEFAULT_FOLDERS = [
  ["Desarrollo web", "globe-outline", "#2563eb"],
  ["JavaScript", "logo-javascript", "#eab308"],
  ["React / React Native", "logo-react", "#0891b2"],
  ["Expo", "phone-portrait-outline", "#111827"],
  ["CSS y diseño", "color-palette-outline", "#7c3aed"],
  ["Backend y Convex", "server-outline", "#dc2626"],
  ["Bases de datos", "layers-outline", "#059669"],
  ["Inteligencia artificial", "sparkles-outline", "#db2777"],
  ["Seguridad", "shield-checkmark-outline", "#ea580c"],
  ["Herramientas", "build-outline", "#475569"],
  ["Documentación", "document-text-outline", "#4f46e5"],
];

const URL_REGEX = /https?:\/\/[^\s<>"']+/gi;
const TRAILING_PUNCTUATION = /[.,!?;:]+$/;

function cleanClientId(value) {
  return String(value || "").trim().slice(0, 120);
}

async function getOwnerId(ctx, clientId) {
  const authUserId = await getAuthUserId(ctx);
  if (authUserId) return String(authUserId);
  const cleanId = cleanClientId(clientId);
  return cleanId ? `client:${cleanId}` : null;
}

function normalizeLink(value) {
  try {
    const url = new URL(String(value || "").replace(TRAILING_PUNCTUATION, ""));
    if (!/^https?:$/.test(url.protocol) || !url.hostname) return null;
    url.hash = "";
    return {
      url: url.toString(),
      hostname: url.hostname.replace(/^www\./, "").toLowerCase(),
    };
  } catch {
    return null;
  }
}

async function insertLinkIfMissing(ctx, message, rawUrl) {
  const normalized = normalizeLink(rawUrl);
  if (!normalized) return false;
  const existing = await ctx.db
    .query("computerLinks")
    .withIndex("by_normalizedUrl", (q) => q.eq("normalizedUrl", normalized.url))
    .first();
  if (existing) return false;

  const createdAt = message.createdAt || message._creationTime || Date.now();
  await ctx.db.insert("computerLinks", {
    messageId: message._id,
    url: rawUrl,
    normalizedUrl: normalized.url,
    hostname: normalized.hostname,
    username: message.username || "anonymous",
    createdBy: message.userId || "unknown",
    favorite: false,
    status: "pending",
    createdAt,
    updatedAt: createdAt,
  });
  return true;
}

export const ensureDefaultFolders = mutation({
  args: { clientId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const ownerId = await getOwnerId(ctx, args.clientId);
    const now = Date.now();
    let created = 0;
    for (let index = 0; index < DEFAULT_FOLDERS.length; index += 1) {
      const [name, icon, color] = DEFAULT_FOLDERS[index];
      const existing = await ctx.db
        .query("computerLinkFolders")
        .withIndex("by_name", (q) => q.eq("name", name))
        .first();
      if (existing) continue;
      await ctx.db.insert("computerLinkFolders", {
        name,
        icon,
        color,
        order: index,
        createdBy: ownerId || undefined,
        createdAt: now,
      });
      created += 1;
    }
    return { created };
  },
});

export const syncFromChat = mutation({
  args: { clientId: v.optional(v.string()) },
  handler: async (ctx) => {
    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_room_createdAt", (q) => q.eq("room", "informatica"))
      .collect();
    let created = 0;
    for (const message of messages) {
      for (const rawUrl of String(message.text || "").match(URL_REGEX) || []) {
        if (await insertLinkIfMissing(ctx, message, rawUrl)) created += 1;
      }
    }
    return { created };
  },
});

export const listFolders = query({
  args: {},
  handler: async (ctx) =>
    await ctx.db.query("computerLinkFolders").withIndex("by_order").collect(),
});

export const list = query({
  args: {
    search: v.optional(v.string()),
    folderId: v.optional(v.id("computerLinkFolders")),
    onlyFavorites: v.optional(v.boolean()),
    onlyUnclassified: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const search = String(args.search || "").trim().toLowerCase();
    const links = await ctx.db
      .query("computerLinks")
      .withIndex("by_updatedAt")
      .order("desc")
      .take(300);
    return links.filter((link) => {
      if (link.status === "archived") return false;
      if (args.folderId && link.folderId !== args.folderId) return false;
      if (args.onlyFavorites && !link.favorite) return false;
      if (args.onlyUnclassified && link.folderId) return false;
      if (!search) return true;
      return [link.normalizedUrl, link.hostname, link.username, link.notes]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search));
    });
  },
});

export const toggleFavorite = mutation({
  args: { linkId: v.id("computerLinks") },
  handler: async (ctx, args) => {
    const link = await ctx.db.get(args.linkId);
    if (!link) throw new Error("El enlace ya no existe.");
    await ctx.db.patch(args.linkId, {
      favorite: !link.favorite,
      updatedAt: Date.now(),
    });
    return { favorite: !link.favorite };
  },
});

export const moveToFolder = mutation({
  args: {
    linkId: v.id("computerLinks"),
    folderId: v.optional(v.id("computerLinkFolders")),
  },
  handler: async (ctx, args) => {
    if (args.folderId && !(await ctx.db.get(args.folderId))) {
      throw new Error("La carpeta ya no existe.");
    }
    await ctx.db.patch(args.linkId, {
      folderId: args.folderId,
      status: args.folderId ? "reviewed" : "pending",
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

export const remove = mutation({
  args: { linkId: v.id("computerLinks") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.linkId, {
      status: "archived",
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

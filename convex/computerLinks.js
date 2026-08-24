import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const DEFAULT_FOLDERS = [
  ["Noticias", "newspaper-outline", "#dc2626"],
  ["Informática", "laptop-outline", "#2563eb"],
  ["Política", "business-outline", "#7c3aed"],
  ["Ingeniería", "construct-outline", "#ea580c"],
  ["Música", "musical-notes-outline", "#db2777"],
];

const LEGACY_DEFAULT_FOLDER_NAMES = [
  "Desarrollo web",
  "JavaScript",
  "React / React Native",
  "Expo",
  "CSS y diseño",
  "Backend y Convex",
  "Bases de datos",
  "Inteligencia artificial",
  "Seguridad",
  "Herramientas",
  "Documentación",
];

const NEWS_DEFAULT_FOLDERS = [
  ["Nacional", "flag-outline", "#dc2626"],
  ["Internacional", "globe-outline", "#2563eb"],
  ["Economía", "stats-chart-outline", "#059669"],
  ["Sociedad", "people-outline", "#7c3aed"],
  ["Ciencia y tecnología", "flask-outline", "#0891b2"],
  ["Deportes", "football-outline", "#ea580c"],
  ["Cultura", "color-palette-outline", "#db2777"],
  ["Opinión", "chatbox-ellipses-outline", "#475569"],
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
      if (existing) {
        await ctx.db.patch(existing._id, {
          parentFolderId: undefined,
          icon,
          color,
          order: index,
        });
        continue;
      }
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

    const computerFolder = await ctx.db
      .query("computerLinkFolders")
      .withIndex("by_name", (q) => q.eq("name", "Informática"))
      .first();
    const newsFolder = await ctx.db
      .query("computerLinkFolders")
      .withIndex("by_name", (q) => q.eq("name", "Noticias"))
      .first();

    for (let index = 0; index < LEGACY_DEFAULT_FOLDER_NAMES.length; index += 1) {
      const name = LEGACY_DEFAULT_FOLDER_NAMES[index];
      const legacyFolder = await ctx.db
        .query("computerLinkFolders")
        .withIndex("by_name", (q) => q.eq("name", name))
        .first();
      if (legacyFolder) {
        await ctx.db.patch(legacyFolder._id, {
          parentFolderId: computerFolder?._id,
          order: index,
        });
      } else if (computerFolder) {
        await ctx.db.insert("computerLinkFolders", {
          name,
          parentFolderId: computerFolder._id,
          icon: "folder-outline",
          color: "#2563eb",
          order: index,
          createdBy: ownerId || undefined,
          createdAt: now,
        });
        created += 1;
      }
    }

    if (newsFolder) {
      for (let index = 0; index < NEWS_DEFAULT_FOLDERS.length; index += 1) {
        const [name, icon, color] = NEWS_DEFAULT_FOLDERS[index];
        const matches = await ctx.db
          .query("computerLinkFolders")
          .withIndex("by_name", (q) => q.eq("name", name))
          .collect();
        const existing = matches.find(
          (folder) =>
            String(folder.parentFolderId || "") === String(newsFolder._id),
        );
        if (existing) {
          await ctx.db.patch(existing._id, { icon, color, order: index });
        } else {
          await ctx.db.insert("computerLinkFolders", {
            name,
            parentFolderId: newsFolder._id,
            icon,
            color,
            order: index,
            createdBy: ownerId || undefined,
            createdAt: now,
          });
          created += 1;
        }
      }
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

export const createFolder = mutation({
  args: {
    name: v.string(),
    clientId: v.optional(v.string()),
    parentFolderId: v.optional(v.id("computerLinkFolders")),
  },
  handler: async (ctx, args) => {
    const name = args.name.trim().slice(0, 50);
    if (!name) throw new Error("Escribe un nombre para la categoría.");
    if (args.parentFolderId && !(await ctx.db.get(args.parentFolderId))) {
      throw new Error("La categoría principal ya no existe.");
    }
    const existing = await ctx.db
      .query("computerLinkFolders")
      .withIndex("by_name", (q) => q.eq("name", name))
      .first();
    if (
      existing &&
      String(existing.parentFolderId || "") ===
        String(args.parentFolderId || "")
    ) {
      return { folderId: existing._id, existing: true };
    }
    const folders = args.parentFolderId
      ? await ctx.db
          .query("computerLinkFolders")
          .withIndex("by_parent_order", (q) =>
            q.eq("parentFolderId", args.parentFolderId),
          )
          .collect()
      : await ctx.db
          .query("computerLinkFolders")
          .withIndex("by_parent_order", (q) =>
            q.eq("parentFolderId", undefined),
          )
          .collect();
    const ownerId = await getOwnerId(ctx, args.clientId);
    const folderId = await ctx.db.insert("computerLinkFolders", {
      name,
      parentFolderId: args.parentFolderId,
      icon: "folder-outline",
      color: "#2563eb",
      order: folders.length,
      createdBy: ownerId || undefined,
      createdAt: Date.now(),
    });
    return { folderId, existing: false };
  },
});

export const updateFolder = mutation({
  args: {
    folderId: v.id("computerLinkFolders"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const folder = await ctx.db.get(args.folderId);
    if (!folder) throw new Error("La subcategoría ya no existe.");
    if (!folder.parentFolderId) {
      throw new Error("Las categorías generales no se editan desde aquí.");
    }
    const name = args.name.trim().slice(0, 50);
    if (!name) throw new Error("Escribe un nombre para la subcategoría.");
    const siblings = await ctx.db
      .query("computerLinkFolders")
      .withIndex("by_parent_order", (q) =>
        q.eq("parentFolderId", folder.parentFolderId),
      )
      .collect();
    if (
      siblings.some(
        (item) =>
          item._id !== args.folderId &&
          item.name.trim().toLowerCase() === name.toLowerCase(),
      )
    ) {
      throw new Error("Ya existe una subcategoría con ese nombre.");
    }
    await ctx.db.patch(args.folderId, { name });
    return { name };
  },
});

export const removeFolder = mutation({
  args: { folderId: v.id("computerLinkFolders") },
  handler: async (ctx, args) => {
    const folder = await ctx.db.get(args.folderId);
    if (!folder) return { movedLinks: 0 };
    if (!folder.parentFolderId) {
      throw new Error("No se puede eliminar una categoría general.");
    }
    const children = await ctx.db
      .query("computerLinkFolders")
      .withIndex("by_parent_order", (q) => q.eq("parentFolderId", args.folderId))
      .first();
    if (children) throw new Error("Elimina primero sus subcategorías internas.");

    const links = await ctx.db
      .query("computerLinks")
      .withIndex("by_folder_updatedAt", (q) => q.eq("folderId", args.folderId))
      .collect();
    const now = Date.now();
    for (const link of links) {
      await ctx.db.patch(link._id, {
        folderId: folder.parentFolderId,
        status: "reviewed",
        updatedAt: now,
      });
    }
    await ctx.db.delete(args.folderId);
    return { movedLinks: links.length };
  },
});

export const addUrl = mutation({
  args: {
    url: v.string(),
    username: v.optional(v.string()),
    clientId: v.optional(v.string()),
    folderId: v.optional(v.id("computerLinkFolders")),
    linkType: v.optional(
      v.union(
        v.literal("general"),
        v.literal("newsSource"),
        v.literal("newsArticle"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    let normalized = normalizeLink(args.url);
    if (!normalized) throw new Error("Introduce una URL http o https válida.");
    if (args.linkType === "newsSource") {
      const sourceUrl = new URL(normalized.url);
      sourceUrl.pathname = "/";
      sourceUrl.search = "";
      normalized = normalizeLink(sourceUrl.toString());
    }
    if (args.folderId && !(await ctx.db.get(args.folderId))) {
      throw new Error("La categoría ya no existe.");
    }
    const existing = await ctx.db
      .query("computerLinks")
      .withIndex("by_normalizedUrl", (q) => q.eq("normalizedUrl", normalized.url))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        folderId: args.folderId || existing.folderId,
        linkType: args.linkType || existing.linkType,
        sourceDomain: args.linkType?.startsWith("news")
          ? normalized.hostname
          : existing.sourceDomain,
        status: args.folderId || existing.folderId ? "reviewed" : "pending",
        updatedAt: Date.now(),
      });
      return { linkId: existing._id, existing: true };
    }
    const ownerId = await getOwnerId(ctx, args.clientId);
    if (!ownerId) throw new Error("No se pudo identificar este dispositivo.");
    const now = Date.now();
    const linkId = await ctx.db.insert("computerLinks", {
      url: normalized.url,
      normalizedUrl: normalized.url,
      hostname: normalized.hostname,
      username: String(args.username || "Biblioteca").trim().slice(0, 40),
      createdBy: ownerId,
      folderId: args.folderId,
      linkType: args.linkType || "general",
      sourceDomain: args.linkType?.startsWith("news")
        ? normalized.hostname
        : undefined,
      favorite: false,
      status: args.folderId ? "reviewed" : "pending",
      createdAt: now,
      updatedAt: now,
    });
    return { linkId, existing: false };
  },
});

export const list = query({
  args: {
    search: v.optional(v.string()),
    folderId: v.optional(v.id("computerLinkFolders")),
    onlyFavorites: v.optional(v.boolean()),
    onlyUnclassified: v.optional(v.boolean()),
    includeChildFolders: v.optional(v.boolean()),
    linkType: v.optional(
      v.union(v.literal("newsSource"), v.literal("newsArticle")),
    ),
  },
  handler: async (ctx, args) => {
    const search = String(args.search || "").trim().toLowerCase();
    const links = await ctx.db
      .query("computerLinks")
      .withIndex("by_updatedAt")
      .order("desc")
      .take(300);
    const childFolderIds = args.folderId && args.includeChildFolders
      ? new Set(
          (
            await ctx.db
              .query("computerLinkFolders")
              .withIndex("by_parent_order", (q) =>
                q.eq("parentFolderId", args.folderId),
              )
              .collect()
          ).map((folder) => String(folder._id)),
        )
      : null;
    return links.filter((link) => {
      if (link.status === "archived") return false;
      if (
        args.folderId &&
        link.folderId !== args.folderId &&
        !childFolderIds?.has(String(link.folderId || ""))
      ) return false;
      if (args.onlyFavorites && !link.favorite) return false;
      if (args.onlyUnclassified && link.folderId) return false;
      if (args.linkType === "newsSource" && link.linkType !== "newsSource") {
        return false;
      }
      if (
        args.linkType === "newsArticle" &&
        link.linkType !== "newsArticle" &&
        link.linkType !== undefined
      ) {
        return false;
      }
      if (!search) return true;
      return [
        link.normalizedUrl,
        link.hostname,
        link.username,
        link.notes,
        ...(link.hashtags || []),
      ]
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

export const updateMetadata = mutation({
  args: {
    linkId: v.id("computerLinks"),
    notes: v.optional(v.string()),
    hashtags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const link = await ctx.db.get(args.linkId);
    if (!link) throw new Error("El enlace ya no existe.");
    if (link.linkType === "newsSource") {
      throw new Error("Los comentarios y hashtags pertenecen a las noticias.");
    }

    const notes = String(args.notes || "").trim().slice(0, 1000);
    const hashtags = Array.from(
      new Set(
        (args.hashtags || [])
          .map((tag) =>
            String(tag || "")
              .trim()
              .replace(/^#+/, "")
              .toLowerCase()
              .replace(/\s+/g, "-"),
          )
          .filter(Boolean)
          .map((tag) => tag.slice(0, 40)),
      ),
    ).slice(0, 20);

    await ctx.db.patch(args.linkId, {
      notes: notes || undefined,
      hashtags: hashtags.length ? hashtags : undefined,
      updatedAt: Date.now(),
    });
    return { notes, hashtags };
  },
});

export const updateNewsSource = mutation({
  args: {
    linkId: v.id("computerLinks"),
    url: v.string(),
    customTitle: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const link = await ctx.db.get(args.linkId);
    if (!link || link.linkType !== "newsSource") {
      throw new Error("El periódico ya no existe.");
    }
    let normalized = normalizeLink(args.url);
    if (!normalized) throw new Error("Introduce una URL http o https válida.");
    const sourceUrl = new URL(normalized.url);
    sourceUrl.pathname = "/";
    sourceUrl.search = "";
    normalized = normalizeLink(sourceUrl.toString());

    const duplicate = await ctx.db
      .query("computerLinks")
      .withIndex("by_normalizedUrl", (q) => q.eq("normalizedUrl", normalized.url))
      .first();
    if (duplicate && duplicate._id !== args.linkId) {
      throw new Error("Ese periódico ya existe en el catálogo.");
    }
    const customTitle = String(args.customTitle || "").trim().slice(0, 80);
    await ctx.db.patch(args.linkId, {
      url: normalized.url,
      normalizedUrl: normalized.url,
      hostname: normalized.hostname,
      sourceDomain: normalized.hostname,
      customTitle: customTitle || undefined,
      notes: undefined,
      hashtags: undefined,
      updatedAt: Date.now(),
    });
    return { url: normalized.url, customTitle };
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

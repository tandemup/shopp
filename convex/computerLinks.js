import { getAuthUserId } from "@convex-dev/auth/server";
import { internalMutation, mutation, query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";

const DEFAULT_FOLDERS = [
  ["Noticias", "newspaper-outline", "#dc2626"],
  ["Libros", "book-outline", "#7c3aed"],
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
const UNCLASSIFIED_IMPORT_KEY = "__unclassified__";
const LIBRARY_LIST_LIMIT = 1000;
const TRACKING_QUERY_KEYS = new Set([
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
  "redir_esc",
  "si",
]);
const NEWS_ARTICLE_DOMAINS = new Set(["elcomercio.es"]);

function cleanClientId(value) {
  return String(value || "")
    .trim()
    .slice(0, 120);
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
    url.hostname = url.hostname.replace(/^www\./i, "").toLowerCase();
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      const normalizedKey = key.toLowerCase();
      if (
        normalizedKey.startsWith("utm_") ||
        TRACKING_QUERY_KEYS.has(normalizedKey)
      ) {
        url.searchParams.delete(key);
      }
    }
    if (url.pathname.length > 1) {
      url.pathname = url.pathname.replace(/\/+$/, "");
    }
    const sortedParams = [...url.searchParams.entries()].sort(
      ([keyA, valueA], [keyB, valueB]) =>
        keyA.localeCompare(keyB) || valueA.localeCompare(valueB),
    );
    url.search = new URLSearchParams(sortedParams).toString();
    return {
      url: url.toString(),
      hostname: url.hostname,
    };
  } catch {
    return null;
  }
}

function classifyLinkType(linkType, hostname) {
  if (
    (linkType === "general" || linkType === undefined) &&
    NEWS_ARTICLE_DOMAINS.has(String(hostname || "").toLowerCase())
  ) {
    return "newsArticle";
  }
  return linkType || "general";
}

function isDomainHomepage(value) {
  try {
    const url = new URL(String(value || ""));
    return (
      /^https?:$/.test(url.protocol) &&
      Boolean(url.hostname) &&
      (url.pathname === "" || url.pathname === "/") &&
      !url.search
    );
  } catch {
    return false;
  }
}

function normalizeNewsDomain(value) {
  try {
    const candidate = String(value || "").trim();
    if (!candidate) return null;
    const url = new URL(
      /^[a-z][a-z0-9+.-]*:\/\//i.test(candidate)
        ? candidate
        : `https://${candidate}`,
    );
    return url.hostname.replace(/^www\./i, "").toLowerCase() || null;
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
    const booksFolder = await ctx.db
      .query("computerLinkFolders")
      .withIndex("by_name", (q) => q.eq("name", "Libros"))
      .first();
    let migratedBooks = 0;

    if (booksFolder) {
      const legacyBookLinks = await ctx.db.query("computerLinks").collect();

      for (const link of legacyBookLinks) {
        if (
          String(link.folderId || "") === String(booksFolder._id) &&
          (link.linkType === "general" || link.linkType === undefined)
        ) {
          await ctx.db.patch(link._id, {
            linkType: "bookLink",
            sourceDomain: link.sourceDomain || link.hostname,
            status: "reviewed",
            updatedAt: now,
          });
          migratedBooks += 1;
        }
      }
    }

    for (
      let index = 0;
      index < LEGACY_DEFAULT_FOLDER_NAMES.length;
      index += 1
    ) {
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
    return { created, migratedBooks };
  },
});

export const syncFromChat = mutation({
  args: { clientId: v.optional(v.string()) },
  handler: async (ctx, args) => {
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

export const normalizeAndDeduplicate = mutation({
  args: {},
  handler: async (ctx) => {
    const links = await ctx.db.query("computerLinks").collect();
    const canonicalLinks = new Map();
    let normalizedCount = 0;
    let duplicatesRemoved = 0;

    for (const link of links) {
      const normalized = normalizeLink(link.normalizedUrl || link.url);
      if (!normalized) continue;

      const classifiedLinkType = classifyLinkType(
        link.linkType,
        normalized.hostname,
      );

      const canonical = normalized.url;
      const existing = canonicalLinks.get(canonical);
      if (!existing) {
        canonicalLinks.set(canonical, link);
        if (
          link.normalizedUrl !== canonical ||
          link.url !== canonical ||
          link.hostname !== normalized.hostname ||
          link.linkType !== classifiedLinkType
        ) {
          await ctx.db.patch(link._id, {
            url: canonical,
            normalizedUrl: canonical,
            hostname: normalized.hostname,
            linkType: classifiedLinkType,
            sourceDomain:
              classifiedLinkType === "newsArticle"
                ? normalized.hostname
                : link.sourceDomain,
            updatedAt: Date.now(),
          });
          normalizedCount += 1;
        }
        continue;
      }

      const existingHasFolder = Boolean(existing.folderId);
      const duplicateHasFolder = Boolean(link.folderId);
      const existingScore =
        Number(existing.favorite) * 4 +
        Number(Boolean(existing.notes)) * 2 +
        Number(Boolean(existing.hashtags?.length)) * 2 +
        Number(existingHasFolder);
      const duplicateScore =
        Number(link.favorite) * 4 +
        Number(Boolean(link.notes)) * 2 +
        Number(Boolean(link.hashtags?.length)) * 2 +
        Number(duplicateHasFolder);
      const primary = duplicateScore > existingScore ? link : existing;
      const duplicate = primary._id === link._id ? existing : link;

      if (primary._id === link._id) {
        canonicalLinks.set(canonical, link);
      }
      if (
        primary.normalizedUrl !== canonical ||
        primary.url !== canonical ||
        primary.hostname !== normalized.hostname ||
        primary.linkType !==
          classifyLinkType(primary.linkType, normalized.hostname)
      ) {
        const primaryLinkType = classifyLinkType(
          primary.linkType,
          normalized.hostname,
        );
        await ctx.db.patch(primary._id, {
          url: canonical,
          normalizedUrl: canonical,
          hostname: normalized.hostname,
          linkType: primaryLinkType,
          sourceDomain:
            primaryLinkType === "newsArticle"
              ? normalized.hostname
              : primary.sourceDomain,
          updatedAt: Date.now(),
        });
      }
      await ctx.db.delete(duplicate._id);
      duplicatesRemoved += 1;
    }

    return { normalizedCount, duplicatesRemoved };
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
      .withIndex("by_parent_order", (q) =>
        q.eq("parentFolderId", args.folderId),
      )
      .first();
    if (children)
      throw new Error("Elimina primero sus subcategorías internas.");

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
        v.literal("bookStore"),
        v.literal("bookLink"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    let normalized = normalizeLink(args.url);
    if (!normalized) throw new Error("Introduce una URL http o https válida.");
    if (["newsSource", "bookStore"].includes(args.linkType)) {
      const sourceUrl = new URL(normalized.url);
      sourceUrl.pathname = "/";
      sourceUrl.search = "";
      normalized = normalizeLink(sourceUrl.toString());
    }
    const requestedLinkType = args.linkType || "general";
    const classifiedLinkType = classifyLinkType(
      requestedLinkType,
      normalized.hostname,
    );
    if (args.folderId && !(await ctx.db.get(args.folderId))) {
      throw new Error("La categoría ya no existe.");
    }
    const existing = await ctx.db
      .query("computerLinks")
      .withIndex("by_normalizedUrl", (q) =>
        q.eq("normalizedUrl", normalized.url),
      )
      .first();
    if (existing) {
      const linkType =
        requestedLinkType === "general" &&
        existing.linkType &&
        existing.linkType !== "general"
          ? existing.linkType
          : classifiedLinkType;
      await ctx.db.patch(existing._id, {
        folderId: args.folderId || existing.folderId,
        linkType,
        sourceDomain: [
          "newsSource",
          "newsArticle",
          "bookStore",
          "bookLink",
        ].includes(linkType)
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
      username: String(args.username || "Biblioteca")
        .trim()
        .slice(0, 40),
      createdBy: ownerId,
      folderId: args.folderId,
      linkType: classifiedLinkType,
      sourceDomain: [
        "newsSource",
        "newsArticle",
        "bookStore",
        "bookLink",
      ].includes(classifiedLinkType)
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
    excludeNewsSources: v.optional(v.boolean()),
    includeChildFolders: v.optional(v.boolean()),
    linkType: v.optional(
      v.union(
        v.literal("newsSource"),
        v.literal("newsArticle"),
        v.literal("bookStore"),
        v.literal("bookLink"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const search = String(args.search || "")
      .trim()
      .toLowerCase();
    const childFolderIds = args.folderId
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
    const selectedFolderIds = args.folderId
      ? [args.folderId, ...(childFolderIds || [])]
      : [];
    let links;
    if (!args.folderId) {
      links = await ctx.db
        .query("computerLinks")
        .withIndex("by_updatedAt")
        .order("desc")
        .take(LIBRARY_LIST_LIMIT);
    } else {
      const linkPages = await Promise.all(
        selectedFolderIds.map((folderId) =>
          ctx.db
            .query("computerLinks")
            .withIndex("by_folder_updatedAt", (q) => q.eq("folderId", folderId))
            .order("desc")
            .take(LIBRARY_LIST_LIMIT),
        ),
      );
      links = linkPages.flat();
    }
    return links.filter((link) => {
      if (link.status === "archived") return false;
      if (
        args.folderId &&
        link.folderId !== args.folderId &&
        !childFolderIds.has(String(link.folderId || ""))
      )
        return false;
      if (args.onlyFavorites && !link.favorite) return false;
      if (args.onlyUnclassified && link.folderId) return false;
      if (args.excludeNewsSources && link.linkType === "newsSource") {
        return false;
      }
      if (args.excludeNewsSources && link.linkType === "bookStore")
        return false;
      if (args.linkType === "newsSource" && link.linkType !== "newsSource") {
        return false;
      }
      if (
        args.linkType === "newsArticle" &&
        ![undefined, "general", "newsArticle"].includes(link.linkType)
      ) {
        return false;
      }
      if (args.linkType === "bookStore" && link.linkType !== "bookStore")
        return false;
      if (
        args.linkType === "bookLink" &&
        ![undefined, "general", "bookLink"].includes(link.linkType)
      )
        return false;
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

export const exportBackup = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const folders = await ctx.db.query("computerLinkFolders").collect();
    const folderById = new Map(
      folders.map((folder) => [String(folder._id), folder]),
    );
    const keyCache = new Map();

    const folderKey = (folder) => {
      if (!folder) return null;
      const id = String(folder._id);
      if (keyCache.has(id)) return keyCache.get(id);
      const parent = folder.parentFolderId
        ? folderById.get(String(folder.parentFolderId))
        : null;
      const parentKey = parent ? folderKey(parent) : null;
      const segment = encodeURIComponent(folder.name);
      const key = parentKey ? `${parentKey}/${segment}` : segment;
      keyCache.set(id, key);
      return key;
    };

    const linksPage = await ctx.db
      .query("computerLinks")
      .withIndex("by_updatedAt")
      .order("desc")
      .filter((q) => q.neq(q.field("status"), "archived"))
      .paginate(args.paginationOpts);

    return {
      ...linksPage,
      page: linksPage.page
        .map((link) => ({
          url: link.url,
          normalizedUrl: link.normalizedUrl,
          hostname: link.hostname,
          username: link.username,
          folderKey: link.folderId
            ? folderKey(folderById.get(String(link.folderId)))
            : null,
          linkType: link.linkType || "general",
          sourceDomain: link.sourceDomain || null,
          customTitle: link.customTitle || null,
          favorite: Boolean(link.favorite),
          notes: link.notes || null,
          hashtags: Array.isArray(link.hashtags) ? link.hashtags : [],
          createdAt: Number(link.createdAt || 0),
        }))
        .sort((a, b) => a.normalizedUrl.localeCompare(b.normalizedUrl)),
    };
  },
});

export const ensureNewsSources = mutation({
  args: {
    clientId: v.optional(v.string()),
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const ownerId = await getOwnerId(ctx, args.clientId);
    if (!ownerId) throw new Error("No se pudo identificar este dispositivo.");

    const newsFolder = await ctx.db
      .query("computerLinkFolders")
      .withIndex("by_name", (q) => q.eq("name", "Noticias"))
      .first();
    if (!newsFolder) {
      return { isDone: true, continueCursor: null, processed: 0, created: 0 };
    }

    const existingSources = await ctx.db
      .query("computerLinks")
      .withIndex("by_folder_linkType_updatedAt", (q) =>
        q.eq("folderId", newsFolder._id).eq("linkType", "newsSource"),
      )
      .collect();
    const sourceByUrl = new Map(
      existingSources.map((link) => [String(link.normalizedUrl), link]),
    );
    const checkedDomains = new Set();
    const page = await ctx.db
      .query("computerLinks")
      .withIndex("by_folder_linkType_updatedAt", (q) =>
        q.eq("folderId", newsFolder._id).eq("linkType", "newsArticle"),
      )
      .order("asc")
      .paginate({
        numItems: Math.min(Math.max(Number(args.batchSize) || 1000, 1), 2000),
        cursor: args.cursor ?? null,
      });

    let created = 0;
    let processed = 0;
    for (const article of page.page) {
      processed += 1;
      const domain = normalizeNewsDomain(
        article.sourceDomain || article.hostname || article.url,
      );
      if (!domain || checkedDomains.has(domain)) continue;
      checkedDomains.add(domain);

      const homepage = normalizeLink(`https://${domain}/`);
      if (!homepage || sourceByUrl.has(homepage.url)) continue;

      const candidates = await ctx.db
        .query("computerLinks")
        .withIndex("by_normalizedUrl", (q) =>
          q.eq("normalizedUrl", homepage.url),
        )
        .collect();
      const existing = candidates.find(
        (link) => link.folderId === newsFolder._id,
      );

      if (existing) {
        await ctx.db.patch(existing._id, {
          folderId: newsFolder._id,
          linkType: "newsSource",
          sourceDomain: domain,
          status: "reviewed",
          updatedAt: Date.now(),
        });
        sourceByUrl.set(homepage.url, { ...existing, linkType: "newsSource" });
        continue;
      }

      const now = Date.now();
      const sourceId = await ctx.db.insert("computerLinks", {
        url: homepage.url,
        normalizedUrl: homepage.url,
        hostname: homepage.hostname,
        username: "Biblioteca",
        createdBy: ownerId,
        folderId: newsFolder._id,
        linkType: "newsSource",
        sourceDomain: domain,
        favorite: false,
        status: "reviewed",
        createdAt: now,
        updatedAt: now,
      });
      sourceByUrl.set(homepage.url, { _id: sourceId });
      created += 1;
    }

    return {
      isDone: page.isDone,
      continueCursor: page.isDone ? null : page.continueCursor,
      processed,
      created,
    };
  },
});

export const importBackup = mutation({
  args: {
    clientId: v.optional(v.string()),
    backup: v.any(),
    categoryKeys: v.optional(v.array(v.string())),
    replaceExisting: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const backup = args.backup;
    if (
      !backup ||
      backup.format !== "shopp-library-backup" ||
      Number(backup.version) !== 1 ||
      !backup.data ||
      !Array.isArray(backup.data.folders) ||
      !Array.isArray(backup.data.links)
    ) {
      throw new Error("La copia de Biblioteca no es compatible.");
    }

    const ownerId = await getOwnerId(ctx, args.clientId);
    if (!ownerId) throw new Error("No se pudo identificar este dispositivo.");
    const now = Date.now();
    const folderIdByKey = new Map();
    let foldersCreated = 0;
    let linksCreated = 0;
    let linksUpdated = 0;
    let foldersDeleted = 0;
    let linksDeleted = 0;
    const existingByNormalizedUrl = new Map();

    if (args.replaceExisting === true) {
      while (true) {
        const existingLinks = await ctx.db.query("computerLinks").take(1000);
        if (existingLinks.length === 0) break;
        for (const link of existingLinks) {
          await ctx.db.delete(link._id);
          linksDeleted += 1;
        }
      }
      const existingFolders = await ctx.db
        .query("computerLinkFolders")
        .collect();
      for (const folder of existingFolders) {
        await ctx.db.delete(folder._id);
        foldersDeleted += 1;
      }
    }
    const selectedCategoryKeys = Array.isArray(args.categoryKeys)
      ? new Set(
          args.categoryKeys.map((key) => String(key).trim()).filter(Boolean),
        )
      : null;

    const backupFolders = backup.data.folders
      .filter(
        (folder) =>
          folder &&
          typeof folder.key === "string" &&
          typeof folder.name === "string" &&
          folder.key.trim() &&
          folder.name.trim(),
      )
      .sort(
        (a, b) =>
          a.key.split("/").length - b.key.split("/").length ||
          String(a.key).localeCompare(String(b.key)),
      );

    const backupFolderByKey = new Map(
      backupFolders.map((folder) => [String(folder.key), folder]),
    );

    const getBackupRootFolderKey = (folderKey) => {
      let folder = backupFolderByKey.get(String(folderKey || ""));
      let remainingDepth = 20;

      while (folder?.parentKey && remainingDepth > 0) {
        folder = backupFolderByKey.get(String(folder.parentKey));
        remainingDepth -= 1;
      }

      return folder?.key ? String(folder.key) : null;
    };

    const isBackupFolderSelected = (folderKey) => {
      if (!selectedCategoryKeys) return true;
      const rootKey = getBackupRootFolderKey(folderKey);
      return Boolean(rootKey && selectedCategoryKeys.has(rootKey));
    };

    const foldersToImport = selectedCategoryKeys
      ? backupFolders.filter((folder) => isBackupFolderSelected(folder.key))
      : backupFolders;

    const getBackupRootFolderName = (folderKey) => {
      let folder = backupFolderByKey.get(String(folderKey || ""));
      let remainingDepth = 20;

      while (folder?.parentKey && remainingDepth > 0) {
        folder = backupFolderByKey.get(String(folder.parentKey));
        remainingDepth -= 1;
      }

      return String(folder?.name || "")
        .trim()
        .toLowerCase();
    };

    for (const item of foldersToImport) {
      const key = String(item.key).trim().slice(0, 300);
      const name = String(item.name).trim().slice(0, 50);
      const parentKey = item.parentKey
        ? String(item.parentKey).trim().slice(0, 300)
        : null;
      const parentFolderId = parentKey
        ? folderIdByKey.get(parentKey)
        : undefined;
      if (parentKey && !parentFolderId) continue;

      const candidates = await ctx.db
        .query("computerLinkFolders")
        .withIndex("by_name", (q) => q.eq("name", name))
        .collect();
      let existing = candidates.find(
        (folder) =>
          String(folder.parentFolderId || "") === String(parentFolderId || ""),
      );

      if (!existing) {
        const folderId = await ctx.db.insert("computerLinkFolders", {
          name,
          parentFolderId,
          icon:
            typeof item.icon === "string" && item.icon.trim()
              ? item.icon.trim().slice(0, 80)
              : "folder-outline",
          color:
            typeof item.color === "string" && item.color.trim()
              ? item.color.trim().slice(0, 30)
              : "#2563eb",
          order: Number.isFinite(Number(item.order)) ? Number(item.order) : 0,
          createdBy: ownerId,
          createdAt: now,
        });
        existing = await ctx.db.get(folderId);
        foldersCreated += 1;
      }
      if (existing) folderIdByKey.set(key, existing._id);
    }

    for (const item of backup.data.links) {
      if (!item || typeof item.url !== "string") continue;
      if (selectedCategoryKeys) {
        const hasFolderKey =
          typeof item.folderKey === "string" && item.folderKey.trim();
        if (hasFolderKey) {
          if (!isBackupFolderSelected(item.folderKey)) continue;
        } else if (!selectedCategoryKeys.has(UNCLASSIFIED_IMPORT_KEY)) {
          continue;
        }
      }
      const normalized = normalizeLink(item.normalizedUrl || item.url);
      if (!normalized) continue;
      const folderId = item.folderKey
        ? folderIdByKey.get(String(item.folderKey))
        : undefined;
      let linkType = [
        "general",
        "newsSource",
        "newsArticle",
        "bookStore",
        "bookLink",
      ].includes(item.linkType)
        ? item.linkType
        : "general";

      // Las copias anteriores a bookLink guardaban las fichas de libros como
      // enlaces generales. Al importarlas, las promovemos según su carpeta.
      if (
        linkType === "general" &&
        getBackupRootFolderName(item.folderKey) === "libros"
      ) {
        linkType = "bookLink";
      }
      if (linkType === "newsArticle" && isDomainHomepage(normalized.url)) {
        linkType = "newsSource";
      }
      const hashtags = Array.from(
        new Set(
          (Array.isArray(item.hashtags) ? item.hashtags : [])
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
      const notes = String(item.notes || "")
        .trim()
        .slice(0, 1000);
      const customTitle = String(item.customTitle || "")
        .trim()
        .slice(0, 80);
      const sourceDomain = String(item.sourceDomain || normalized.hostname)
        .trim()
        .slice(0, 160);
      const username = String(item.username || "Biblioteca")
        .trim()
        .slice(0, 40);
      const createdAt = Number(item.createdAt);

      let existing;
      if (existingByNormalizedUrl.has(normalized.url)) {
        existing = existingByNormalizedUrl.get(normalized.url);
      } else {
        existing = await ctx.db
          .query("computerLinks")
          .withIndex("by_normalizedUrl", (q) =>
            q.eq("normalizedUrl", normalized.url),
          )
          .first();
        existingByNormalizedUrl.set(normalized.url, existing || null);
      }

      const patch = {
        url: normalized.url,
        normalizedUrl: normalized.url,
        hostname: normalized.hostname,
        username,
        folderId,
        linkType,
        sourceDomain: [
          "newsSource",
          "newsArticle",
          "bookStore",
          "bookLink",
        ].includes(linkType)
          ? sourceDomain
          : undefined,
        customTitle: customTitle || undefined,
        favorite: Boolean(item.favorite),
        status: folderId ? "reviewed" : "pending",
        notes: ["newsSource", "bookStore"].includes(linkType)
          ? undefined
          : notes || undefined,
        hashtags:
          ["newsSource", "bookStore"].includes(linkType) || !hashtags.length
            ? undefined
            : hashtags,
        updatedAt: now,
      };

      if (existing) {
        await ctx.db.patch(existing._id, patch);
        existingByNormalizedUrl.set(normalized.url, { ...existing, ...patch });
        linksUpdated += 1;
      } else {
        const linkId = await ctx.db.insert("computerLinks", {
          ...patch,
          createdBy: ownerId,
          createdAt:
            Number.isFinite(createdAt) && createdAt > 0 ? createdAt : now,
        });
        existingByNormalizedUrl.set(normalized.url, { ...patch, _id: linkId });
        linksCreated += 1;
      }
    }

    return {
      foldersCreated,
      linksCreated,
      linksUpdated,
      foldersDeleted,
      linksDeleted,
    };
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
    if (["newsSource", "bookStore"].includes(link.linkType)) {
      throw new Error(
        "Los comentarios y hashtags pertenecen a los enlaces guardados, no al catálogo.",
      );
    }

    const notes = String(args.notes || "")
      .trim()
      .slice(0, 1000);
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
    if (!link || !["newsSource", "bookStore"].includes(link.linkType)) {
      throw new Error("La fuente ya no existe.");
    }
    let normalized = normalizeLink(args.url);
    if (!normalized) throw new Error("Introduce una URL http o https válida.");
    const sourceUrl = new URL(normalized.url);
    sourceUrl.pathname = "/";
    sourceUrl.search = "";
    normalized = normalizeLink(sourceUrl.toString());

    const duplicate = await ctx.db
      .query("computerLinks")
      .withIndex("by_normalizedUrl", (q) =>
        q.eq("normalizedUrl", normalized.url),
      )
      .first();
    if (duplicate && duplicate._id !== args.linkId) {
      throw new Error("Esa fuente ya existe en el catálogo.");
    }
    const customTitle = String(args.customTitle || "")
      .trim()
      .slice(0, 80);
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

// Archiva el periódico y todas sus noticias asociadas.
export const removeNewsSource = mutation({
  args: { linkId: v.id("computerLinks") },
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.linkId);
    if (!source || !["newsSource", "bookStore"].includes(source.linkType)) {
      throw new Error("La fuente ya no existe.");
    }
    const domain = String(source.sourceDomain || source.hostname || "")
      .trim()
      .toLowerCase()
      .replace(/^www\./, "");
    const links = await ctx.db.query("computerLinks").collect();
    let archivedArticles = 0;
    const now = Date.now();
    for (const link of links) {
      const linkDomain = String(link.sourceDomain || link.hostname || "")
        .trim()
        .toLowerCase()
        .replace(/^www\./, "");
      const relatedType =
        source.linkType === "bookStore" ? "bookLink" : "newsArticle";
      if (
        link._id === source._id ||
        (link.linkType === relatedType && linkDomain === domain)
      ) {
        await ctx.db.patch(link._id, { status: "archived", updatedAt: now });
        if (link._id !== source._id) archivedArticles += 1;
      }
    }
    return { archivedArticles };
  },
});

// Operación de mantenimiento: solo puede ejecutarse desde Convex CLI/Dashboard.
// Conserva la categoría Noticias y sus subcategorías para poder reutilizarlas.
export const purgeNewsData = internalMutation({
  args: {
    confirmation: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (args.confirmation !== "BORRAR NOTICIAS Y PERIODICOS") {
      throw new Error(
        'Confirmación incorrecta. Escribe exactamente "BORRAR NOTICIAS Y PERIODICOS".',
      );
    }

    const requestedLimit = Math.floor(args.limit || 500);
    const limit = Math.max(1, Math.min(requestedLimit, 500));
    const folders = await ctx.db.query("computerLinkFolders").collect();
    const newsFolder = folders.find(
      (folder) => !folder.parentFolderId && folder.name === "Noticias",
    );
    const newsFolderIds = new Set(
      folders
        .filter(
          (folder) =>
            folder._id === newsFolder?._id ||
            folder.parentFolderId === newsFolder?._id,
        )
        .map((folder) => String(folder._id)),
    );

    const candidates = await ctx.db.query("computerLinks").collect();
    const newsLinks = candidates.filter(
      (link) =>
        link.linkType === "newsArticle" ||
        link.linkType === "newsSource" ||
        newsFolderIds.has(String(link.folderId || "")),
    );
    const batch = newsLinks.slice(0, limit);
    let articlesDeleted = 0;
    let sourcesDeleted = 0;
    let legacyDeleted = 0;

    for (const link of batch) {
      if (link.linkType === "newsArticle") articlesDeleted += 1;
      else if (link.linkType === "newsSource") sourcesDeleted += 1;
      else legacyDeleted += 1;
      await ctx.db.delete(link._id);
    }

    return {
      deleted: batch.length,
      articlesDeleted,
      sourcesDeleted,
      legacyDeleted,
      remaining: Math.max(0, newsLinks.length - batch.length),
      foldersPreserved: newsFolderIds.size,
    };
  },
});

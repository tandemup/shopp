import { storage } from "@/src/storage/storage";

const STORAGE_KEY = "@shopping/library-json-v1";
const FORMAT = "shopp-library-backup";
const VERSION = 1;

const DEFAULT_FOLDERS = [
  ["Noticias", "newspaper-outline", "#dc2626"],
  ["Libros", "book-outline", "#7c3aed"],
  ["Informática", "laptop-outline", "#2563eb"],
  ["Política", "business-outline", "#7c3aed"],
  ["Ingeniería", "construct-outline", "#ea580c"],
  ["Música", "musical-notes-outline", "#db2777"],
  ["Instagram", "logo-instagram", "#E1306C"],
];

const listeners = new Set();
let writeQueue = Promise.resolve();

const NON_NEWS_DOMAINS = new Set([
  "editor.pascal.app",
  "ejoish.co",
  "englishuniversity.eu",
  "fgbueno.es",
  "github.com",
  "legacy.reactjs.org",
  "peerjs.com",
  "r3f.docs.pmnd.rs",
  "react.dev",
  "rork.com",
  "starpulsify.net",
]);

const TECHNICAL_DOMAIN_SUFFIXES = [
  "github.com",
  "react.dev",
  "reactjs.org",
  "peerjs.com",
  "docs.pmnd.rs",
  "pascal.app",
  "rork.com",
];

function cleanDomain(value) {
  return String(value || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split(/[/?#]/)[0]
    .toLowerCase();
}

function domainMatches(domain, suffix) {
  return domain === suffix || domain.endsWith(`.${suffix}`);
}

function isKnownNonNewsDomain(value) {
  const domain = cleanDomain(value);
  return [...NON_NEWS_DOMAINS].some((suffix) =>
    domainMatches(domain, suffix),
  );
}

function isTechnicalDomain(value) {
  const domain = cleanDomain(value);
  return TECHNICAL_DOMAIN_SUFFIXES.some((suffix) =>
    domainMatches(domain, suffix),
  );
}

function id(prefix) {
  const random = globalThis.crypto?.randomUUID?.();
  return `${prefix}_${random || `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
}

function normalizeUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    if (!["http:", "https:"].includes(url.protocol)) return null;
    url.hostname = url.hostname.replace(/^www\./i, "").toLowerCase();
    url.hash = "";
    [...url.searchParams.keys()].forEach((key) => {
      const lower = key.toLowerCase();
      const parameterValue = url.searchParams.get(key);
      let selfReference = false;
      if (["ref", "referer", "redirect", "url"].includes(lower)) {
        try {
          const referenced = new URL(parameterValue);
          const referencedHost = referenced.hostname
            .replace(/^www\./i, "")
            .toLowerCase();
          const referencedPath =
            referenced.pathname.length > 1
              ? referenced.pathname.replace(/\/+$/, "")
              : referenced.pathname;
          const currentPath =
            url.pathname.length > 1
              ? url.pathname.replace(/\/+$/, "")
              : url.pathname;
          selfReference =
            referencedHost === url.hostname && referencedPath === currentPath;
        } catch {
          selfReference = false;
        }
      }
      if (
        lower.startsWith("utm_") ||
        ["fbclid", "gclid", "si"].includes(lower) ||
        selfReference
      ) {
        url.searchParams.delete(key);
      }
    });
    if (url.pathname.length > 1)
      url.pathname = url.pathname.replace(/\/+$/, "");
    return { normalizedUrl: url.toString(), hostname: url.hostname };
  } catch {
    return null;
  }
}

const MOJIBAKE_REPAIRS = [
  [/ÃƒÂ¡|Ã¡|A¡/g, "á"],
  [/ÃƒÂ©|Ã©|A©/g, "é"],
  [/ÃƒÂ­|Ã­|A­/g, "í"],
  [/ÃƒÂ³|Ã³|A³/g, "ó"],
  [/ÃƒÂº|Ãº|Aº/g, "ú"],
  [/ÃƒÂ±|Ã±|A±/g, "ñ"],
  [/ÃƒÂ|Ã/g, "Á"],
  [/ÃƒÂ‰|Ã‰/g, "É"],
  [/ÃƒÂ|Ã/g, "Í"],
  [/ÃƒÂ“|Ã“/g, "Ó"],
  [/ÃƒÂš|Ãš/g, "Ú"],
  [/ÃƒÂ‘|Ã‘/g, "Ñ"],
];

function repairText(value) {
  let result = String(value ?? "");
  for (const [pattern, replacement] of MOJIBAKE_REPAIRS)
    result = result.replace(pattern, replacement);
  return result;
}

function decodeFolderKey(value) {
  let result = String(value || "").trim();
  for (let pass = 0; pass < 3 && /%[0-9a-f]{2}/i.test(result); pass += 1) {
    try {
      result = decodeURIComponent(result);
    } catch {
      break;
    }
  }
  return repairText(result)
    .split("/")
    .map((part) =>
      part
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[\\/]+/g, " ")
        .trim()
        .replace(/\s+/g, "_"),
    )
    .filter(Boolean)
    .join("/");
}

function folderSegment(name) {
  return decodeFolderKey(String(name || "Sin_nombre"));
}

function emptyDatabase() {
  const now = Date.now();
  return {
    format: FORMAT,
    version: VERSION,
    updatedAt: now,
    folders: DEFAULT_FOLDERS.map(([name, icon, color], order) => ({
      _id: id("folder"),
      key: folderSegment(name),
      name,
      icon,
      color,
      order,
      createdAt: now,
    })),
    links: [],
  };
}

function sanitizeDatabase(value) {
  const source =
    value?.data && Array.isArray(value.data.links) ? value.data : value;
  const database = emptyDatabase();
  if (Array.isArray(source?.folders)) {
    const drafts = source.folders.map((folder, order) => ({
      _id: String(folder._id || folder.id || id("folder")),
      key: decodeFolderKey(folder.key || folder._key || folder.name),
      parentKey: folder.parentKey
        ? decodeFolderKey(folder.parentKey)
        : undefined,
      originalParentFolderId: folder.parentFolderId
        ? String(folder.parentFolderId)
        : undefined,
      name: repairText(folder.name || "Sin nombre").slice(0, 50),
      icon: folder.icon || "folder-outline",
      color: folder.color || "#2563eb",
      order: Number.isFinite(folder.order) ? folder.order : order,
      createdAt: Number(folder.createdAt) || Date.now(),
    }));
    const byKey = new Map(drafts.map((folder) => [folder.key, folder]));
    const byId = new Map(drafts.map((folder) => [folder._id, folder]));
    database.folders = drafts.map(
      ({ parentKey, originalParentFolderId, ...folder }) => ({
        ...folder,
        parentFolderId: parentKey
          ? byKey.get(parentKey)?._id
          : originalParentFolderId && byId.has(originalParentFolderId)
            ? originalParentFolderId
            : undefined,
      }),
    );
  }
  const folderByKey = new Map(
    database.folders.map((folder) => [folder.key, folder._id]),
  );
  const folderIds = new Set(database.folders.map((folder) => folder._id));
  const seen = new Set();
  database.links = (Array.isArray(source?.links) ? source.links : []).flatMap(
    (link) => {
      const normalized = normalizeUrl(link.url || link.normalizedUrl);
      if (!normalized || seen.has(normalized.normalizedUrl)) return [];
      seen.add(normalized.normalizedUrl);
      return [
        {
          _id: String(link._id || link.id || id("link")),
          url: normalized.normalizedUrl,
          ...normalized,
          username: repairText(link.username || "Biblioteca").slice(0, 40),
          folderId:
            link.folderId && folderIds.has(String(link.folderId))
              ? String(link.folderId)
              : folderByKey.get(decodeFolderKey(link.folderKey)),
          linkType: link.linkType || "general",
          sourceDomain: link.sourceDomain || normalized.hostname,
          customTitle:
            repairText(link.customTitle || link.title || "") || undefined,
          favorite: Boolean(link.favorite),
          status:
            link.status === "archived"
              ? "archived"
              : link.folderId || link.folderKey
                ? "reviewed"
                : "pending",
          notes: link.notes ? repairText(link.notes) : undefined,
          hashtags: Array.isArray(link.hashtags)
            ? [...new Set(link.hashtags.map(repairText))].slice(0, 20)
            : [],
          publishedAt: Number(link.publishedAt) || undefined,
          createdAt: Number(link.createdAt) || Date.now(),
          updatedAt: Number(link.updatedAt) || Date.now(),
        },
      ];
    },
  );
  database.updatedAt = Date.now();
  return database;
}

async function read() {
  const stored = await storage.getJSON(STORAGE_KEY, null);
  if (!stored) {
    const initial = emptyDatabase();
    await storage.setJSON(STORAGE_KEY, initial);
    return initial;
  }
  return sanitizeDatabase(stored);
}

function emit(database) {
  listeners.forEach((listener) => listener(database));
}

function update(mutator) {
  const operation = writeQueue.then(async () => {
    const database = await read();
    const result = await mutator(database);
    database.updatedAt = Date.now();
    await storage.setJSON(STORAGE_KEY, database);
    emit(database);
    return result;
  });
  writeQueue = operation.catch(() => undefined);
  return operation;
}

function text(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export const libraryJsonApi = {
  storageKey: STORAGE_KEY,
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: read,
  ensureDefaultFolders() {
    return update((database) => {
      const [name, icon, color] = DEFAULT_FOLDERS.find(
        ([folderName]) => folderName === "Instagram",
      );
      const existing = database.folders.find(
        (folder) => text(folder.name) === text(name) && !folder.parentFolderId,
      );
      if (existing) {
        return { created: 0, duplicateMigrationPending: false, migratedBooks: 0 };
      }
      database.folders.push({
        _id: id("folder"),
        key: folderSegment(name),
        name,
        icon,
        color,
        order: database.folders.length,
        createdAt: Date.now(),
      });
      return { created: 1, duplicateMigrationPending: false, migratedBooks: 0 };
    });
  },
  async listFolders() {
    return (await read()).folders.sort((a, b) => a.order - b.order);
  },
  async list(options = {}) {
    const database = await read();
    const limit = Math.min(Math.max(Number(options.limit) || 80, 1), 600);
    const page = Math.max(0, Number(options.page) || 0);
    const search = text(options.search);
    let items = database.links.filter((link) => {
      if (link.status === "archived") return false;
      if (options.folderId && link.folderId !== String(options.folderId))
        return false;
      if (options.onlyFavorites && !link.favorite) return false;
      if (options.onlyUnclassified && link.folderId) return false;
      if (
        options.excludeNewsSources &&
        ["newsSource", "bookStore"].includes(link.linkType)
      )
        return false;
      if (
        options.linkType === "newsArticle" &&
        ![undefined, "general", "newsArticle"].includes(link.linkType)
      )
        return false;
      else if (
        options.linkType === "bookLink" &&
        ![undefined, "general", "bookLink"].includes(link.linkType)
      )
        return false;
      else if (
        options.linkType &&
        !["newsArticle", "bookLink"].includes(options.linkType) &&
        link.linkType !== options.linkType
      )
        return false;
      if (!search) return true;
      return [
        link.url,
        link.hostname,
        link.customTitle,
        link.notes,
        ...(link.hashtags || []),
      ].some((part) => text(part).includes(search));
    });
    const ascending = String(options.newsSort || "").endsWith("Asc");
    const useCreatedAt = String(options.newsSort || "").startsWith("created");
    items.sort((a, b) => {
      const av = Number(
        (useCreatedAt ? a.createdAt : a.publishedAt) || a.createdAt,
      );
      const bv = Number(
        (useCreatedAt ? b.createdAt : b.publishedAt) || b.createdAt,
      );
      return ascending ? av - bv : bv - av;
    });
    const total = items.length;
    const isDone = (page + 1) * limit >= total;
    return {
      items: items.slice(page * limit, (page + 1) * limit),
      page,
      pageSize: limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      isDone,
      continueCursor: isDone ? null : String(page + 1),
    };
  },
  createFolder({ name, parentFolderId }) {
    return update((database) => {
      const cleanName = String(name || "")
        .trim()
        .slice(0, 50);
      if (!cleanName) throw new Error("Escribe un nombre para la categoría.");
      const existing = database.folders.find(
        (folder) =>
          text(folder.name) === text(cleanName) &&
          String(folder.parentFolderId || "") === String(parentFolderId || ""),
      );
      if (existing) return { folderId: existing._id, existing: true };
      const folder = {
        _id: id("folder"),
        name: cleanName,
        parentFolderId,
        icon: "folder-outline",
        color: "#2563eb",
        order: database.folders.length,
        createdAt: Date.now(),
      };
      database.folders.push(folder);
      return { folderId: folder._id, existing: false };
    });
  },
  addUrl({ url, username, folderId, linkType = "general", customTitle }) {
    return update((database) => {
      const normalized = normalizeUrl(url);
      if (!normalized)
        throw new Error("Introduce una URL http o https válida.");
      const cleanCustomTitle = String(customTitle || "")
        .trim()
        .slice(0, 240);
      const existing = database.links.find(
        (link) => link.normalizedUrl === normalized.normalizedUrl,
      );
      if (existing) {
        if (cleanCustomTitle) {
          existing.customTitle = cleanCustomTitle;
          existing.updatedAt = Date.now();
        }
        return { linkId: existing._id, existing: true };
      }
      const now = Date.now();
      const link = {
        _id: id("link"),
        url: normalized.normalizedUrl,
        ...normalized,
        username: String(username || "Biblioteca").slice(0, 40),
        folderId,
        linkType,
        sourceDomain: normalized.hostname,
        customTitle: cleanCustomTitle || undefined,
        favorite: false,
        status: folderId ? "reviewed" : "pending",
        hashtags: [],
        createdAt: now,
        updatedAt: now,
      };
      database.links.push(link);
      return { linkId: link._id, existing: false };
    });
  },
  patchLink(linkId, patch) {
    return update((database) => {
      const link = database.links.find((item) => item._id === String(linkId));
      if (!link) throw new Error("El enlace ya no existe.");
      Object.assign(link, patch, { updatedAt: Date.now() });
      return link;
    });
  },
  updateMetadata({
    linkId,
    notes,
    hashtags,
    customTitle,
    publishedAt,
    previewImageUrl,
  }) {
    return this.patchLink(linkId, {
      ...(notes !== undefined ? { notes } : {}),
      ...(hashtags !== undefined ? { hashtags } : {}),
      ...(customTitle !== undefined ? { customTitle } : {}),
      ...(publishedAt !== undefined ? { publishedAt } : {}),
      ...(previewImageUrl !== undefined ? { previewImageUrl } : {}),
    });
  },
  updateNewsSource({ linkId, name, customTitle, url }) {
    const normalized = url ? normalizeUrl(url) : null;
    return this.patchLink(linkId, {
      ...(name !== undefined || customTitle !== undefined
        ? { customTitle: String(name ?? customTitle).trim() }
        : {}),
      ...(normalized
        ? {
            url: normalized.normalizedUrl,
            ...normalized,
            sourceDomain: normalized.hostname,
          }
        : {}),
    });
  },
  toggleFavorite({ linkId }) {
    return update((database) => {
      const link = database.links.find((item) => item._id === String(linkId));
      if (!link) throw new Error("El enlace ya no existe.");
      link.favorite = !link.favorite;
      link.updatedAt = Date.now();
      return { favorite: link.favorite };
    });
  },
  moveToFolder({ linkId, folderId }) {
    return this.patchLink(linkId, {
      folderId,
      status: folderId ? "reviewed" : "pending",
    });
  },
  remove({ linkId }) {
    return this.patchLink(linkId, { status: "archived" });
  },
  async exportBackup() {
    const database = await read();
    const folderById = new Map(
      database.folders.map((folder) => [String(folder._id), folder]),
    );
    const folders = database.folders.map((folder) => ({
      key: folder.key || folderSegment(folder.name),
      name: folder.name,
      parentKey: folder.parentFolderId
        ? folderById.get(String(folder.parentFolderId))?.key || null
        : null,
      icon: folder.icon || null,
      color: folder.color || null,
      order: Number(folder.order || 0),
    }));
    const links = database.links
      .filter((link) => link.status !== "archived")
      .map(({ folderId, status, ...link }) => ({
        ...link,
        folderKey: folderId ? folderById.get(String(folderId))?.key : undefined,
      }));
    return {
      format: FORMAT,
      version: VERSION,
      exportedAt: new Date().toISOString(),
      app: "Shopp",
      data: {
        folders,
        links,
      },
    };
  },
  importBatch({ links, folders, mode = "combine" }) {
    return this.importBackup(
      {
        format: FORMAT,
        version: VERSION,
        data: { folders: folders || [], links: links || [] },
      },
      { mode },
    );
  },
  async getLinksByIds(ids = []) {
    const wanted = new Set(ids.map(String));
    return (await read()).links.filter(
      (link) => wanted.has(String(link._id)) && link.status !== "archived",
    );
  },
  async getHashtagCatalog() {
    const database = await read();
    const counts = new Map();
    database.links
      .filter((link) => link.status !== "archived")
      .forEach((link) => {
        (link.hashtags || []).forEach((rawTag) => {
          const tag = String(rawTag || "")
            .trim()
            .replace(/^#+/, "")
            .toLowerCase();
          if (!tag) return;
          const entry = counts.get(tag) || { tag, count: 0, ids: [] };
          entry.count += 1;
          entry.ids.push(link._id);
          counts.set(tag, entry);
        });
      });
    return [...counts.values()].sort(
      (a, b) => b.count - a.count || a.tag.localeCompare(b.tag),
    );
  },
  importBackup(payload, { mode = "combine" } = {}) {
    return update((database) => {
      const incoming = sanitizeDatabase(payload);
      if (mode === "replace") {
        database.folders = incoming.folders;
        database.links = incoming.links;
        return {
          foldersCreated: incoming.folders.length,
          linksCreated: incoming.links.length,
          linksUpdated: 0,
          folders: incoming.folders.length,
          links: incoming.links.length,
          mode,
        };
      } else {
        const existingByKey = new Map(
          database.folders.map((folder) => [
            folder.key || folderSegment(folder.name),
            folder,
          ]),
        );
        const targetIdByIncomingId = new Map();
        let foldersCreated = 0;
        [...incoming.folders]
          .sort((a, b) => a.key.split("/").length - b.key.split("/").length)
          .forEach((folder) => {
            let target = existingByKey.get(folder.key);
            if (!target) {
              target = {
                ...folder,
                _id: id("folder"),
                parentFolderId: folder.parentFolderId
                  ? targetIdByIncomingId.get(folder.parentFolderId)
                  : undefined,
              };
              database.folders.push(target);
              existingByKey.set(folder.key, target);
              foldersCreated += 1;
            }
            targetIdByIncomingId.set(folder._id, target._id);
          });
        const linksByUrl = new Map(
          database.links.map((link) => [link.normalizedUrl, link]),
        );
        let linksCreated = 0;
        let linksUpdated = 0;
        incoming.links.forEach((link) => {
          const remapped = {
            ...link,
            folderId: link.folderId
              ? targetIdByIncomingId.get(link.folderId)
              : undefined,
          };
          const existing = linksByUrl.get(remapped.normalizedUrl);
          if (!existing) {
            database.links.push(remapped);
            linksByUrl.set(remapped.normalizedUrl, remapped);
            linksCreated += 1;
          } else {
            const patch = {};
            for (const field of [
              "folderId",
              "linkType",
              "sourceDomain",
              "customTitle",
              "notes",
              "publishedAt",
              "previewImageUrl",
            ]) {
              if ((!existing[field] || field === "folderId") && remapped[field])
                patch[field] = remapped[field];
            }
            if (remapped.favorite && !existing.favorite) patch.favorite = true;
            const tags = [
              ...new Set([
                ...(existing.hashtags || []),
                ...(remapped.hashtags || []),
              ]),
            ];
            if (tags.length !== (existing.hashtags || []).length)
              patch.hashtags = tags;
            if (Object.keys(patch).length) {
              Object.assign(existing, patch, { updatedAt: Date.now() });
              linksUpdated += 1;
            }
          }
        });
        return {
          foldersCreated,
          linksCreated,
          linksUpdated,
          folders: database.folders.length,
          links: database.links.length,
          mode,
        };
      }
    });
  },
  async keepNewsAndYoutubeCategories() {
    const isYoutubeLink = (link) => {
      const domain = String(link.hostname || link.sourceDomain || "")
        .replace(/^www\./i, "")
        .toLowerCase();
      return (
        domain === "youtu.be" ||
        domain === "youtube.com" ||
        domain.endsWith(".youtube.com")
      );
    };
    return update((database) => {
      const canonicalByName = new Map();
      const duplicateIds = new Map();
      const folders = [];
      database.folders
        .slice()
        .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
        .forEach((folder) => {
          const key = `${text(folder.name)}|${String(folder.parentFolderId || "")}`;
          const canonical = canonicalByName.get(key);
          if (canonical) {
            duplicateIds.set(folder._id, canonical._id);
            return;
          }
          canonicalByName.set(key, folder);
          folders.push(folder);
        });

      const ensureRootFolder = (name, icon, color) => {
        let folder = folders.find(
          (item) => text(item.name) === text(name) && !item.parentFolderId,
        );
        if (!folder) {
          folder = {
            _id: id("folder"),
            key: folderSegment(name),
            name,
            icon,
            color,
            order: folders.length,
            createdAt: Date.now(),
          };
          folders.push(folder);
        }
        return folder;
      };

      const newsFolder = ensureRootFolder(
        "Noticias",
        "newspaper-outline",
        "#dc2626",
      );
      const youtubeFolder = ensureRootFolder(
        "YouTube",
        "logo-youtube",
        "#ff0000",
      );
      let linksMoved = 0;
      let youtubeLinks = 0;
      database.links.forEach((link) => {
        if (duplicateIds.has(link.folderId)) {
          link.folderId = duplicateIds.get(link.folderId);
          linksMoved += 1;
        }
        const youtube = isYoutubeLink(link);
        if (youtube) {
          if (link.folderId !== youtubeFolder._id) linksMoved += 1;
          link.folderId = youtubeFolder._id;
          youtubeLinks += 1;
          link.linkType = "general";
          link.status = link.status === "archived" ? "archived" : "reviewed";
          link.updatedAt = Date.now();
        }
      });
      database.folders = folders.map((folder, order) => ({ ...folder, order }));
      return {
        changed: duplicateIds.size > 0 || linksMoved > 0,
        foldersRemoved: duplicateIds.size,
        linksMoved,
        youtubeLinks,
        newsFolderId: newsFolder._id,
      };
    });
  },
  repairIntegrity() {
    return update((database) => {
      const ensureFolder = (name, icon, color) => {
        let folder = database.folders.find(
          (item) => text(item.name) === text(name) && !item.parentFolderId,
        );
        if (!folder) {
          folder = {
            _id: id("folder"),
            key: folderSegment(name),
            name,
            icon,
            color,
            order: database.folders.length,
            createdAt: Date.now(),
          };
          database.folders.push(folder);
        }
        return folder;
      };
      const computerFolder = ensureFolder(
        "Informática",
        "laptop-outline",
        "#2563eb",
      );
      let correctedPosts = 0;
      database.links.forEach((link) => {
        // hostname/url son la identidad real del enlace. sourceDomain puede
        // contener un valor antiguo o incorrecto procedente de una importación.
        const domain = cleanDomain(link.hostname || link.url);
        if (
          !["newsArticle", "newsSource"].includes(link.linkType) ||
          !isKnownNonNewsDomain(domain)
        )
          return;
        link.linkType = "general";
        link.sourceDomain = undefined;
        link.folderId = isTechnicalDomain(domain)
          ? computerFolder._id
          : undefined;
        link.status = link.folderId ? "reviewed" : "pending";
        link.updatedAt = Date.now();
        correctedPosts += 1;
      });
      return { correctedPosts, created: 0, processed: database.links.length };
    });
  },
  reset() {
    return update((database) => {
      const fresh = emptyDatabase();
      database.folders = fresh.folders;
      database.links = [];
      return { ok: true };
    });
  },
};

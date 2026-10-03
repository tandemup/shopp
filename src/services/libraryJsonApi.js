import { storage } from "@/src/storage/storage";

const STORAGE_KEY = "@shopping/library-json-v1";
const LEGACY_MIGRATION_KEY = "shopp-library-convex-migration-v1";
const FORMAT = "shopp-library-backup";
const VERSION = 1;
// Guardamos los enlaces por bloques independientes. Esto evita reescribir
// una Biblioteca completa de 15.000 enlaces por cada lote importado.
const CHUNK_SIZE = 500;
const CHUNK_MANIFEST_KEY = `${STORAGE_KEY}:chunks:v1`;
const chunkKey = (index) => `${STORAGE_KEY}:chunk:${index}`;


const DEFAULT_FOLDERS = [
  ["Noticias", "newspaper-outline", "#dc2626"],
  ["Libros", "book-outline", "#7c3aed"],
  ["Informática", "laptop-outline", "#2563eb"],
  ["Política", "business-outline", "#7c3aed"],
  ["Ingeniería", "construct-outline", "#ea580c"],
  ["Música", "musical-notes-outline", "#db2777"],
  ["Ciencia", "flask-outline", "#0891b2"],
  ["Entrevistas", "mic-outline", "#9333ea"],
  ["Clásica", "musical-notes-outline", "#7c3aed"],
  ["Supermercados", "cart-outline", "#16a34a"],
  ["Tutoriales", "school-outline", "#0f766e"],
  ["Salud", "medkit-outline", "#dc2626"],
  ["Cine", "film-outline", "#b45309"],
  ["Covid", "medical-outline", "#64748b"],
  ["Derecho", "document-text-outline", "#1d4ed8"],
  ["Constitución", "reader-outline", "#475569"],
  ["Cursos", "library-outline", "#0369a1"],
  ["Conferencias", "people-outline", "#4f46e5"],
  ["Documentales", "videocam-outline", "#b45309"],
  ["Instagram", "logo-instagram", "#E1306C"],
];

const listeners = new Set();
let writeQueue = Promise.resolve();

const NON_NEWS_DOMAINS = new Set([
  "editor.pascal.app",
  "ejoish.co",
  "ejosh.co",
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
  "ejosh.co",
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

// Algunos enlaces de newsletters usan un host de seguimiento distinto del
// dominio editorial. Conservamos la URL real, pero agrupamos la fuente bajo
// el dominio canónico para no crear un "periódico" artificial por subdominio.
const NEWS_SOURCE_DOMAIN_ALIASES = new Map([
  ["messaging-custom-newsletters.nytimes.com", "nytimes.com"],
]);

function canonicalNewsSourceDomain(value) {
  const domain = cleanDomain(value);
  return NEWS_SOURCE_DOMAIN_ALIASES.get(domain) || domain;
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
            ? [
                ...new Set(
                  link.hashtags
                    .map((tag) => repairText(tag).trim().replace(/^#+/, ""))
                    .filter(Boolean),
                ),
              ].slice(0, 20)
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

// Cada bloque mantiene su contenido serializado para detectar cuáles han
// cambiado. Al importar 500 enlaces nuevos, normalmente solo se escribe un
// bloque (y el manifiesto), no los miles de enlaces anteriores.
async function loadChunked() {
  const manifest = await storage.getJSON(CHUNK_MANIFEST_KEY, null);
  if (!manifest || manifest.version !== 1 || !Number.isInteger(manifest.count)) {
    return null;
  }
  const chunks = [];
  for (let index = 0; index < manifest.count; index += 1) {
    const chunk = await storage.getJSON(chunkKey(index), null);
    if (!Array.isArray(chunk)) {
      throw new Error(`Falta el bloque ${index + 1} de Biblioteca. Restaura tu backup JSON.`);
    }
    chunks.push(chunk);
  }
  return {
    format: FORMAT,
    version: VERSION,
    updatedAt: manifest.updatedAt,
    folders: manifest.folders,
    links: chunks.flat(),
  };
}

async function read() {
  const chunked = await loadChunked();
  if (chunked) return chunked;

  // Compatibilidad sin pérdida: leemos el documento antiguo, pero no lo
  // borramos durante la migración. El manifiesto se escribe en último lugar.
  const stored = await storage.getJSON(STORAGE_KEY, null);
  return stored ? sanitizeDatabase(stored) : emptyDatabase();
}

async function persist(database) {
  const previous = await storage.getJSON(CHUNK_MANIFEST_KEY, null);
  const count = Math.ceil(database.links.length / CHUNK_SIZE);
  for (let index = 0; index < count; index += 1) {
    const nextChunk = database.links.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE);
    // Comparamos el bloque existente para no reescribir los que no cambian.
    const existing = previous && index < previous.count
      ? await storage.getJSON(chunkKey(index), null)
      : null;
    if (!existing || JSON.stringify(existing) !== JSON.stringify(nextChunk)) {
      await storage.setJSON(chunkKey(index), nextChunk);
    }
  }
  // Publicar el manifiesto al final hace que las nuevas importaciones sean
  // recuperables. Conservamos la clave antigua como copia de seguridad.
  await storage.setJSON(CHUNK_MANIFEST_KEY, {
    version: 1,
    count,
    folders: database.folders,
    updatedAt: database.updatedAt,
  });
  // Si se reduce el número de bloques, limpiamos los bloques huérfanos
  // después de publicar el manifiesto, nunca antes.
  if (previous?.count > count) {
    for (let index = count; index < previous.count; index += 1) {
      await storage.remove(chunkKey(index));
    }
  }
}

function emit(database) {
  listeners.forEach((listener) => listener(database));
}

function update(mutator) {
  const operation = writeQueue.then(async () => {
    const database = await read();
    const result = await mutator(database);
    database.updatedAt = Date.now();
    await persist(database);
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
  async getDiagnostics() {
    const manifest = await storage.getJSON(CHUNK_MANIFEST_KEY, null);
    if (manifest?.version === 1) {
      let links = 0;
      for (let index = 0; index < manifest.count; index += 1) {
        const chunk = await storage.getJSON(chunkKey(index), []);
        links += Array.isArray(chunk) ? chunk.length : 0;
      }
      return {
        storageKey: CHUNK_MANIFEST_KEY,
        found: true,
        format: FORMAT,
        folders: manifest.folders?.length || 0,
        links,
      };
    }
    const stored = await storage.getJSON(STORAGE_KEY, null);
    const source = stored?.data && Array.isArray(stored.data.links)
      ? stored.data
      : stored;
    return {
      storageKey: STORAGE_KEY,
      found: Boolean(stored),
      format: stored?.format || source?.format || null,
      folders: Array.isArray(source?.folders) ? source.folders.length : 0,
      links: Array.isArray(source?.links) ? source.links.length : 0,
    };
  },
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: read,
  async needsLegacyConvexMigration() {
    const marker = await storage.getJSON(LEGACY_MIGRATION_KEY, null);
    if (marker?.done === true) return false;
    const database = await read();
    return database.links.length === 0;
  },
  async markLegacyConvexMigrationDone(details = {}) {
    await storage.setJSON(LEGACY_MIGRATION_KEY, {
      done: true,
      migratedAt: Date.now(),
      ...details,
    });
  },
  ensureDefaultFolders() {
    return update((database) => {
      let created = 0;
      const now = Date.now();

      for (const [name, icon, color] of DEFAULT_FOLDERS) {
        const existing = database.folders.find(
          (folder) =>
            text(folder.name) === text(name) && !folder.parentFolderId,
        );
        if (existing) continue;

        database.folders.push({
          _id: id("folder"),
          key: folderSegment(name),
          name,
          icon,
          color,
          order: database.folders.length,
          createdAt: now,
        });
        created += 1;
      }

      return { created, duplicateMigrationPending: false, migratedBooks: 0 };
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
      ...(hashtags !== undefined
        ? {
            hashtags: [
              ...new Set(
                (Array.isArray(hashtags) ? hashtags : [])
                  .map((tag) => String(tag || "").trim().replace(/^#+/, ""))
                  .filter(Boolean),
              ),
            ].slice(0, 20),
          }
        : {}),
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
  async getSyncSnapshot() {
    const database = await read();
    const folderById = new Map(
      database.folders.map((folder) => [String(folder._id), folder]),
    );
    return {
      format: "shopp-library-p2p-sync",
      version: 1,
      createdAt: Date.now(),
      folders: database.folders.map((folder) => ({
        key: folder.key || folderSegment(folder.name),
        name: folder.name,
        parentKey: folder.parentFolderId
          ? folderById.get(String(folder.parentFolderId))?.key || null
          : null,
        icon: folder.icon || null,
        color: folder.color || null,
        order: Number(folder.order || 0),
        createdAt: Number(folder.createdAt) || 0,
      })),
      // A diferencia de exportBackup, aquí se incluyen los archivados. Son
      // tombstones: permiten propagar eliminaciones a los otros dispositivos.
      links: database.links.map(({ folderId, ...link }) => ({
        ...link,
        folderKey: folderId ? folderById.get(String(folderId))?.key : undefined,
      })),
    };
  },
  applySyncSnapshot(snapshot) {
    if (snapshot?.format !== "shopp-library-p2p-sync" || !Array.isArray(snapshot?.links)) {
      throw new Error("La Biblioteca recibida no tiene un formato P2P válido.");
    }
    return update((database) => {
      const folderByKey = new Map(
        database.folders.map((folder) => [
          folder.key || folderSegment(folder.name),
          folder,
        ]),
      );
      const incomingFolderIdByKey = new Map();
      let foldersCreated = 0;
      [...(snapshot.folders || [])]
        .sort((a, b) => String(a.key || "").split("/").length - String(b.key || "").split("/").length)
        .forEach((folder) => {
          const key = decodeFolderKey(folder.key || folder.name);
          if (!key) return;
          let target = folderByKey.get(key);
          if (!target) {
            target = {
              _id: id("folder"),
              key,
              name: repairText(folder.name || key).slice(0, 50),
              icon: folder.icon || "folder-outline",
              color: folder.color || "#2563eb",
              order: Number.isFinite(folder.order) ? folder.order : database.folders.length,
              createdAt: Number(folder.createdAt) || Date.now(),
            };
            if (folder.parentKey) {
              target.parentFolderId = incomingFolderIdByKey.get(decodeFolderKey(folder.parentKey));
            }
            database.folders.push(target);
            folderByKey.set(key, target);
            foldersCreated += 1;
          }
          incomingFolderIdByKey.set(key, target._id);
        });

      const linksByUrl = new Map(
        database.links.map((link) => [link.normalizedUrl, link]),
      );
      let linksCreated = 0;
      let linksUpdated = 0;
      let ignoredOlder = 0;
      let archivedApplied = 0;

      for (const raw of snapshot.links) {
        const normalized = normalizeUrl(raw?.url || raw?.normalizedUrl);
        if (!normalized) continue;
        const incomingUpdatedAt = Number(raw.updatedAt || raw.createdAt) || 0;
        const folderId = raw.folderKey
          ? incomingFolderIdByKey.get(decodeFolderKey(raw.folderKey)) || folderByKey.get(decodeFolderKey(raw.folderKey))?._id
          : undefined;
        const incoming = {
          ...raw,
          ...normalized,
          _id: String(raw._id || id("link")),
          folderId,
          status: raw.status === "archived" ? "archived" : raw.status || (folderId ? "reviewed" : "pending"),
          createdAt: Number(raw.createdAt) || Date.now(),
          updatedAt: incomingUpdatedAt || Date.now(),
        };
        delete incoming.folderKey;

        const existing = linksByUrl.get(normalized.normalizedUrl);
        if (!existing) {
          database.links.push(incoming);
          linksByUrl.set(normalized.normalizedUrl, incoming);
          linksCreated += 1;
          if (incoming.status === "archived") archivedApplied += 1;
          continue;
        }

        const existingUpdatedAt = Number(existing.updatedAt || existing.createdAt) || 0;
        if (incomingUpdatedAt > existingUpdatedAt) {
          const stableId = existing._id;
          Object.assign(existing, incoming, { _id: stableId });
          linksUpdated += 1;
          if (incoming.status === "archived") archivedApplied += 1;
        } else {
          ignoredOlder += 1;
        }
      }

      return {
        foldersCreated,
        linksCreated,
        linksUpdated,
        archivedApplied,
        ignoredOlder,
        totalLinks: database.links.length,
      };
    });
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
  async importBackup(payload, { mode = "combine" } = {}) {
    // Una restauración explícita nunca debe activar la migración histórica
    // aunque la Biblioteca se encuentre vacía durante el reemplazo.
    if (mode === "replace") {
      await this.markLegacyConvexMigrationDone({ source: "local-json-restore" });
    }
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
      const newsFolder = ensureFolder(
        "Noticias",
        "newspaper-outline",
        "#dc2626",
      );
      const computerFolder = ensureFolder(
        "Informática",
        "laptop-outline",
        "#2563eb",
      );

      let correctedPosts = 0;
      let created = 0;

      // 1) Reclasifica dominios que no son prensa y corrige aliases de prensa.
      database.links.forEach((link) => {
        const realDomain = cleanDomain(link.hostname || link.url);
        if (!realDomain) return;

        if (
          ["newsArticle", "newsSource"].includes(link.linkType) &&
          isKnownNonNewsDomain(realDomain)
        ) {
          link.linkType = "general";
          link.sourceDomain = undefined;
          link.folderId = isTechnicalDomain(realDomain)
            ? computerFolder._id
            : undefined;
          link.status = link.folderId ? "reviewed" : "pending";
          link.updatedAt = Date.now();
          correctedPosts += 1;
          return;
        }

        if (link.linkType === "newsArticle") {
          const canonicalDomain = canonicalNewsSourceDomain(
            link.sourceDomain || realDomain,
          );
          if (canonicalDomain && link.sourceDomain !== canonicalDomain) {
            link.sourceDomain = canonicalDomain;
            link.updatedAt = Date.now();
            correctedPosts += 1;
          }
        }
      });

      // 2) Crea una fuente para cada dominio editorial que tenga noticias.
      const sourceDomains = new Set(
        database.links
          .filter((link) => link.linkType === "newsSource")
          .map((link) => canonicalNewsSourceDomain(link.sourceDomain || link.hostname || link.url))
          .filter(Boolean),
      );
      const articleDomains = new Set(
        database.links
          .filter((link) => link.linkType === "newsArticle")
          .map((link) => canonicalNewsSourceDomain(link.sourceDomain || link.hostname || link.url))
          .filter((domain) => domain && !isKnownNonNewsDomain(domain)),
      );

      articleDomains.forEach((domain) => {
        if (sourceDomains.has(domain)) return;
        const homepage = normalizeUrl(`https://${domain}/`);
        if (!homepage) return;

        const existingHomepage = database.links.find(
          (link) => link.normalizedUrl === homepage.normalizedUrl || link.url === homepage.normalizedUrl,
        );
        if (existingHomepage) {
          existingHomepage.folderId = newsFolder._id;
          existingHomepage.linkType = "newsSource";
          existingHomepage.sourceDomain = domain;
          existingHomepage.status = "reviewed";
          existingHomepage.updatedAt = Date.now();
        } else {
          const now = Date.now();
          database.links.push({
            _id: id("link"),
            url: homepage.normalizedUrl,
            normalizedUrl: homepage.normalizedUrl,
            hostname: homepage.hostname,
            username: "Biblioteca",
            folderId: newsFolder._id,
            linkType: "newsSource",
            sourceDomain: domain,
            favorite: false,
            status: "reviewed",
            createdAt: now,
            updatedAt: now,
          });
          created += 1;
        }
        sourceDomains.add(domain);
      });

      return {
        correctedPosts,
        created,
        processed: database.links.length,
      };
    });
  },
  async reset() {
    // El importador por lotes llama a reset antes de importar desde USB.
    await this.markLegacyConvexMigrationDone({ source: "local-json-restore" });
    return update((database) => {
      const fresh = emptyDatabase();
      database.folders = fresh.folders;
      database.links = [];
      return { ok: true };
    });
  },
};

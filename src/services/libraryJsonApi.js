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
];

const listeners = new Set();
let writeQueue = Promise.resolve();

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
      if (lower.startsWith("utm_") || ["fbclid", "gclid", "si"].includes(lower)) {
        url.searchParams.delete(key);
      }
    });
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
    return { normalizedUrl: url.toString(), hostname: url.hostname };
  } catch {
    return null;
  }
}

function emptyDatabase() {
  const now = Date.now();
  return {
    format: FORMAT,
    version: VERSION,
    updatedAt: now,
    folders: DEFAULT_FOLDERS.map(([name, icon, color], order) => ({
      _id: id("folder"), name, icon, color, order, createdAt: now,
    })),
    links: [],
  };
}

function sanitizeDatabase(value) {
  const source = value?.data && Array.isArray(value.data.links) ? value.data : value;
  const database = emptyDatabase();
  if (Array.isArray(source?.folders)) {
    database.folders = source.folders.map((folder, order) => ({
      _id: String(folder._id || folder.id || id("folder")),
      name: String(folder.name || "Sin nombre").slice(0, 50),
      parentFolderId: folder.parentFolderId ? String(folder.parentFolderId) : undefined,
      icon: folder.icon || "folder-outline",
      color: folder.color || "#2563eb",
      order: Number.isFinite(folder.order) ? folder.order : order,
      createdAt: Number(folder.createdAt) || Date.now(),
    }));
  }
  const folderByKey = new Map(database.folders.map((folder) => [folder.key || folder.name, folder._id]));
  const seen = new Set();
  database.links = (Array.isArray(source?.links) ? source.links : []).flatMap((link) => {
    const normalized = normalizeUrl(link.url || link.normalizedUrl);
    if (!normalized || seen.has(normalized.normalizedUrl)) return [];
    seen.add(normalized.normalizedUrl);
    return [{
      _id: String(link._id || link.id || id("link")),
      url: normalized.normalizedUrl,
      ...normalized,
      username: String(link.username || "Biblioteca").slice(0, 40),
      folderId: link.folderId ? String(link.folderId) : folderByKey.get(link.folderKey),
      linkType: link.linkType || "general",
      sourceDomain: link.sourceDomain || normalized.hostname,
      customTitle: link.customTitle || link.title || undefined,
      favorite: Boolean(link.favorite),
      status: link.status === "archived" ? "archived" : (link.folderId || link.folderKey ? "reviewed" : "pending"),
      notes: link.notes || undefined,
      hashtags: Array.isArray(link.hashtags) ? [...new Set(link.hashtags.map(String))].slice(0, 20) : [],
      publishedAt: Number(link.publishedAt) || undefined,
      createdAt: Number(link.createdAt) || Date.now(),
      updatedAt: Number(link.updatedAt) || Date.now(),
    }];
  });
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
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export const libraryJsonApi = {
  storageKey: STORAGE_KEY,
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: read,
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
      if (options.folderId && link.folderId !== String(options.folderId)) return false;
      if (options.onlyFavorites && !link.favorite) return false;
      if (options.onlyUnclassified && link.folderId) return false;
      if (options.linkType && link.linkType !== options.linkType) return false;
      if (!search) return true;
      return [link.url, link.hostname, link.customTitle, link.notes, ...(link.hashtags || [])].some((part) => text(part).includes(search));
    });
    items.sort((a, b) => Number(b.publishedAt || b.createdAt) - Number(a.publishedAt || a.createdAt));
    const total = items.length;
    return { items: items.slice(page * limit, (page + 1) * limit), page, pageSize: limit, total, totalPages: Math.max(1, Math.ceil(total / limit)), isDone: (page + 1) * limit >= total };
  },
  createFolder({ name, parentFolderId }) {
    return update((database) => {
      const cleanName = String(name || "").trim().slice(0, 50);
      if (!cleanName) throw new Error("Escribe un nombre para la categoría.");
      const existing = database.folders.find((folder) => text(folder.name) === text(cleanName) && String(folder.parentFolderId || "") === String(parentFolderId || ""));
      if (existing) return { folderId: existing._id, existing: true };
      const folder = { _id: id("folder"), name: cleanName, parentFolderId, icon: "folder-outline", color: "#2563eb", order: database.folders.length, createdAt: Date.now() };
      database.folders.push(folder);
      return { folderId: folder._id, existing: false };
    });
  },
  addUrl({ url, username, folderId, linkType = "general" }) {
    return update((database) => {
      const normalized = normalizeUrl(url);
      if (!normalized) throw new Error("Introduce una URL http o https válida.");
      const existing = database.links.find((link) => link.normalizedUrl === normalized.normalizedUrl);
      if (existing) return { linkId: existing._id, existing: true };
      const now = Date.now();
      const link = { _id: id("link"), url: normalized.normalizedUrl, ...normalized, username: String(username || "Biblioteca").slice(0, 40), folderId, linkType, sourceDomain: normalized.hostname, favorite: false, status: folderId ? "reviewed" : "pending", hashtags: [], createdAt: now, updatedAt: now };
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
    return this.patchLink(linkId, { folderId, status: folderId ? "reviewed" : "pending" });
  },
  remove({ linkId }) {
    return this.patchLink(linkId, { status: "archived" });
  },
  async exportBackup() {
    const database = await read();
    return { format: FORMAT, version: VERSION, exportedAt: new Date().toISOString(), app: "Shopp", data: { folders: database.folders, links: database.links.filter((link) => link.status !== "archived") } };
  },
  importBackup(payload, { mode = "combine" } = {}) {
    return update((database) => {
      const incoming = sanitizeDatabase(payload);
      if (mode === "replace") {
        database.folders = incoming.folders;
        database.links = incoming.links;
      } else {
        const folderIds = new Set(database.folders.map((folder) => folder._id));
        incoming.folders.forEach((folder) => { if (!folderIds.has(folder._id)) database.folders.push(folder); });
        const urls = new Set(database.links.map((link) => link.normalizedUrl));
        incoming.links.forEach((link) => { if (!urls.has(link.normalizedUrl)) { database.links.push(link); urls.add(link.normalizedUrl); } });
      }
      return { folders: database.folders.length, links: database.links.length, mode };
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


import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Modal,
  Pressable,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import {
  useAction,
  useMutation,
  usePaginatedQuery,
  useQuery,
} from "convex/react";
import { api } from "@/convex/_generated/api";
import { I18nText as Text, I18nTextInput as TextInput } from "@/src/i18n";
import WebPreviewCard from "@/src/components/chat/WebPreviewCard";
import CachedLinkImage from "@/src/components/chat/CachedLinkImage";
import { safeAlert } from "@/src/components/ui/alert/safeAlert";

const CLIENT_ID_KEY = "shopp-chat-client-id";
const UNCLASSIFIED_IMPORT_KEY = "__unclassified__";
const CATALOG_SOURCES_IMPORT_KEY = "__catalog_sources__";
const IMPORT_BATCH_SIZE = 250;
const IMPORT_WRITE_BATCH_SIZE = 25;
const IMPORT_SOURCE_BATCH_SIZE = 25;
const IMPORT_CLEAR_BATCH_SIZE = 25;
const INTEGRITY_BATCH_SIZE = 100;
const IMPORT_ENRICH_LIMIT = 800;
const IMPORT_DB_NAME = "shopp-library-import-v1";
const IMPORT_DB_STORE = "payloads";
const IMPORT_PREVIEW_CONCURRENCY = 3;
const LIBRARY_VISIBLE_LINK_LIMIT = 80;
const LIBRARY_CATALOG_SOURCE_LIMIT = 600;
const LIBRARY_SEARCH_PAGE_SIZE = 40;
const HASHTAG_SCAN_PAGE_SIZE = 400;
const HASHTAG_RESULT_PAGE_SIZE = 40;
const PREVIEW_TITLE_CACHE = new Map();
const PREVIEW_TITLE_REQUESTS = new Map();
let previewTitleSaveDisabled = false;

const LOCAL_TRACKING_QUERY_KEYS = new Set([
  "_ga",
  "_gl",
  "fbclid",
  "gclid",
  "igshid",
  "mc_cid",
  "mc_eid",
  "redir_esc",
  "si",
]);

let importDbPromise = null;

function openImportDatabase() {
  if (
    Platform.OS !== "web" ||
    typeof window === "undefined" ||
    !window.indexedDB
  ) {
    return Promise.resolve(null);
  }
  if (importDbPromise) return importDbPromise;
  importDbPromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(IMPORT_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IMPORT_DB_STORE)) {
        db.createObjectStore(IMPORT_DB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB no disponible."));
  });
  return importDbPromise;
}

async function saveImportPayload(jobId, payload) {
  const key = String(jobId || "");
  if (!key) throw new Error("La importación no tiene identificador.");
  if (Platform.OS === "web") {
    const db = await openImportDatabase();
    if (!db) throw new Error("El navegador no permite guardar el estado de la importación.");
    await new Promise((resolve, reject) => {
      const tx = db.transaction(IMPORT_DB_STORE, "readwrite");
      tx.objectStore(IMPORT_DB_STORE).put(payload, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("No se pudo guardar la importación."));
      tx.onabort = () => reject(tx.error || new Error("No se pudo guardar la importación."));
    });
    return;
  }
  if (!FileSystem.documentDirectory) {
    throw new Error("No hay almacenamiento persistente disponible.");
  }
  const fileUri = `${FileSystem.documentDirectory}library-import-${encodeURIComponent(key)}.json`;
  await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(payload), {
    encoding: FileSystem.EncodingType.UTF8,
  });
}

async function loadImportPayload(jobId) {
  const key = String(jobId || "");
  if (!key) return null;
  if (Platform.OS === "web") {
    const db = await openImportDatabase();
    if (!db) return null;
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(IMPORT_DB_STORE, "readonly");
      const request = tx.objectStore(IMPORT_DB_STORE).get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error("No se pudo leer la importación."));
    });
  }
  if (!FileSystem.documentDirectory) return null;
  const fileUri = `${FileSystem.documentDirectory}library-import-${encodeURIComponent(key)}.json`;
  const info = await FileSystem.getInfoAsync(fileUri);
  if (!info.exists) return null;
  const json = await FileSystem.readAsStringAsync(fileUri, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  return JSON.parse(json);
}

async function deleteImportPayload(jobId) {
  const key = String(jobId || "");
  if (!key) return;
  if (Platform.OS === "web") {
    const db = await openImportDatabase();
    if (!db) return;
    await new Promise((resolve, reject) => {
      const tx = db.transaction(IMPORT_DB_STORE, "readwrite");
      tx.objectStore(IMPORT_DB_STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("No se pudo limpiar la importación."));
      tx.onabort = () => reject(tx.error || new Error("No se pudo limpiar la importación."));
    });
    return;
  }
  if (!FileSystem.documentDirectory) return;
  const fileUri = `${FileSystem.documentDirectory}library-import-${encodeURIComponent(key)}.json`;
  const info = await FileSystem.getInfoAsync(fileUri);
  if (info.exists) await FileSystem.deleteAsync(fileUri, { idempotent: true });
}

function collectImportNewsDomains(data) {
  return Array.from(
    new Set(
      (Array.isArray(data?.links) ? data.links : [])
        .filter((link) => link?.linkType === "newsArticle")
        .map((link) =>
          String(
            link?.sourceDomain ||
              link?.hostname ||
              getHostnameFromUrl(link?.normalizedUrl || link?.url || ""),
          )
            .replace(/^www\./i, "")
            .trim()
            .toLowerCase(),
        )
        .filter(Boolean),
    ),
  ).sort();
}

async function retryImportStep(operation, attempts = 3) {
  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt >= attempts - 1) break;
      const delayMs = Math.min(4000, 1000 * 2 ** attempt);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError || new Error("No se pudo completar el lote de importación.");
}

function buildImportFingerprint(fileName, data, importMode) {
  const links = Array.isArray(data?.links) ? data.links : [];
  const at = (index) => {
    const link = links[index];
    return String(link?.normalizedUrl || link?.url || "").slice(0, 180);
  };
  const middleIndex = links.length ? Math.floor(links.length / 2) : 0;
  return [
    String(fileName || "Biblioteca.json"),
    String(importMode || "combine"),
    links.length,
    at(0),
    at(middleIndex),
    at(Math.max(0, links.length - 1)),
  ]
    .join("|")
    .slice(0, 500);
}

const NEWS_SORT_OPTIONS = [
  {
    id: "publishedDesc",
    label: "Fecha de publicación: recientes",
    shortLabel: "Publicación ↓",
    description: "Muestra primero las noticias publicadas más recientemente.",
    icon: "calendar-outline",
  },
  {
    id: "publishedAsc",
    label: "Fecha de publicación: antiguas",
    shortLabel: "Publicación ↑",
    description: "Muestra primero las noticias publicadas hace más tiempo.",
    icon: "calendar-outline",
  },
  {
    id: "createdDesc",
    label: "Fecha de incorporación: recientes",
    shortLabel: "Añadidas ↓",
    description: "Ordena por el momento en que cada noticia se guardó en Biblioteca.",
    icon: "download-outline",
  },
  {
    id: "createdAsc",
    label: "Fecha de incorporación: antiguas",
    shortLabel: "Añadidas ↑",
    description: "Muestra primero las noticias guardadas hace más tiempo.",
    icon: "download-outline",
  },
];

function getDomainFaviconUrl(hostname) {
  const cleanHostname = String(hostname || "")
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split("/")[0]
    .trim()
    .toLowerCase();

  if (!cleanHostname) return "";
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(cleanHostname)}&sz=64`;
}

function DomainFavicon({ hostname }) {
  const [failed, setFailed] = useState(false);
  const faviconUrl = getDomainFaviconUrl(hostname);

  if (!faviconUrl || failed) {
    return (
      <View style={styles.sourceTileFaviconFallback}>
        <Ionicons name="newspaper-outline" size={24} color="#dc2626" />
      </View>
    );
  }

  return (
    <View style={styles.sourceTileFavicon}>
      <CachedLinkImage
        uri={faviconUrl}
        style={styles.sourceTileFaviconImage}
        resizeMode="contain"
        onError={() => setFailed(true)}
      />
    </View>
  );
}

function isValidHttpUrl(value) {
  const candidate = String(value || "").trim();
  if (!/^https?:\/\/\S+$/i.test(candidate)) return false;

  try {
    const parsed = new URL(candidate);
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      Boolean(parsed.hostname)
    );
  } catch {
    return false;
  }
}

function getLinkDomain(link) {
  return String(link?.sourceDomain || link?.hostname || "")
    .replace(/^www\./i, "")
    .trim()
    .toLowerCase();
}

function getHostnameFromUrl(value) {
  try {
    return new URL(value || "").hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

function isYouTubeDomain(domain) {
  return ["youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"].includes(
    String(domain || "").replace(/^www\./i, "").toLowerCase(),
  );
}

function isYouTubeLink(link) {
  return (
    isYouTubeDomain(getLinkDomain(link)) ||
    isYouTubeDomain(getHostnameFromUrl(link?.normalizedUrl || link?.url || ""))
  );
}

function normalizeLabel(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function isInformaticaFolder(folder) {
  return normalizeLabel(folder?.name) === "informatica";
}

function getFolderTabIcon(folder) {
  return normalizeLabel(folder?.name) === "youtube"
    ? "logo-youtube"
    : folder?.icon || "folder-outline";
}

function getFolderTabColor(folder) {
  return normalizeLabel(folder?.name) === "youtube"
    ? "#dc2626"
    : folder?.color || "#475569";
}

function sentenceCaseTitle(value) {
  const title = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  return title ? title.charAt(0).toUpperCase() + title.slice(1) : "";
}

function stripImportedDomainPrefix(value, domain) {
  const title = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  const compactDomain = String(domain || "")
    .replace(/^www\./i, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();
  const [firstToken, ...rest] = title.split(" ");
  const compactFirstToken = String(firstToken || "")
    .replace(/^#/, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();

  if (
    rest.length > 0 &&
    compactDomain &&
    [compactDomain, `www${compactDomain}`].includes(compactFirstToken)
  ) {
    return rest.join(" ").trim();
  }
  return title;
}

function cleanSlugTitle(value) {
  const slug = String(value || "")
    .replace(/\.(html?|php|aspx?)$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s+\d{5,}(?:\s+\d{1,4})?(?:\s+(?:nt|noticia|video))?$/i, "")
    .replace(/\s+(?:nt|noticia)$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return sentenceCaseTitle(slug);
}

function getUrlFallbackTitle(value) {
  try {
    const pathname = new URL(value || "").pathname;
    const slug = decodeURIComponent(pathname)
      .split("/")
      .filter(Boolean)
      .pop();
    return cleanSlugTitle(slug);
  } catch {
    return "";
  }
}

function formatLinkDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getDisplayedPostsDateRange(links) {
  const publishedDates = (Array.isArray(links) ? links : [])
    .filter((link) => link?.linkType === "newsArticle")
    .map((link) => Number(link?.publishedAt || 0))
    .filter((timestamp) => Number.isFinite(timestamp) && timestamp > 0);

  if (!publishedDates.length) return "";

  const firstDate = formatLinkDate(Math.min(...publishedDates));
  const lastDate = formatLinkDate(Math.max(...publishedDates));
  if (!firstDate || !lastDate) return "";
  return firstDate === lastDate
    ? `Publicada: ${firstDate}`
    : `Publicadas: ${firstDate} – ${lastDate}`;
}

function getNewsDisplayTitle(link) {
  const domain = getLinkDomain(link);
  const storedTitle = stripImportedDomainPrefix(
    link?.title || link?.pageTitle || link?.previewTitle || link?.name || "",
    domain,
  );
  const customTitle = stripImportedDomainPrefix(link?.customTitle || "", domain);
  if (storedTitle && storedTitle.toLowerCase() !== domain) {
    return sentenceCaseTitle(storedTitle);
  }
  if (customTitle && customTitle.toLowerCase() !== domain) {
    return sentenceCaseTitle(customTitle);
  }

  return (
    getUrlFallbackTitle(link?.normalizedUrl || link?.url) ||
    customTitle ||
    domain ||
    "Noticia"
  );
}

function getLinkDisplayTitle(link) {
  if (link?.linkType === "newsArticle") return getNewsDisplayTitle(link);

  const title = String(
    link?.title || link?.pageTitle || link?.previewTitle || link?.name || "",
  ).trim();
  const customTitle = String(link?.customTitle || "").trim();
  return (
    title ||
    customTitle ||
    getLinkDomain(link) ||
    link?.normalizedUrl ||
    "Enlace"
  );
}

function getStoredLinkTitle(link) {
  const domain = getLinkDomain(link);
  return stripImportedDomainPrefix(
    link?.title ||
      link?.pageTitle ||
      link?.previewTitle ||
      link?.name ||
      link?.customTitle ||
      "",
    domain,
  );
}

function getPreviewTitleCandidate(preview, domain, previewMode = "default") {
  const description = String(preview?.description || "").trim();
  const metadataTitle = preview?.fallback
    ? ""
    : String(preview?.title || "").trim();
  const isYouTube =
    ["youtube.com", "youtu.be"].includes(String(domain || "").toLowerCase()) ||
      String(preview?.siteName || "").toLowerCase() === "youtube";

  // Para noticias, el título debe proceder de <title>, Open Graph o JSON-LD.
  // La descripción suele ser un texto genérico del periódico (por ejemplo,
  // "Siga la actualidad política...") y no debe sustituir al titular.
  const rawTitle =
    isYouTube || previewMode === "document"
      ? metadataTitle || description
      : metadataTitle;
  const title = stripImportedDomainPrefix(rawTitle, domain);
  if (!title || title.toLowerCase() === domain) return "";
  return sentenceCaseTitle(title).slice(0, 240);
}

function getPreviewSubtitleCandidate(
  preview,
  domain,
  previewMode = "default",
  previewTitle = "",
) {
  const isYouTube =
    ["youtube.com", "youtu.be"].includes(String(domain || "").toLowerCase()) ||
    String(preview?.siteName || "").toLowerCase() === "youtube";
  if (!isYouTube && previewMode !== "document") return "";

  const subtitle = String(preview?.description || "")
    .replace(/\s+/g, " ")
    .trim();
  const normalizedSubtitle = subtitle.toLowerCase();
  if (
    !subtitle ||
    normalizedSubtitle === domain ||
    normalizedSubtitle === String(previewTitle || "").toLowerCase()
  ) {
    return "";
  }
  return subtitle.slice(0, previewMode === "document" ? 240 : 120);
}

function isMissingConvexFunctionError(error) {
  return /Could not find public function/i.test(
    String(error?.message || error || ""),
  );
}

async function loadPreviewTitleOnce(
  url,
  domain,
  getLinkPreview,
  previewMode = "default",
) {
  const cacheKey = `${previewMode}:${url}`;
  if (PREVIEW_TITLE_CACHE.has(cacheKey))
    return PREVIEW_TITLE_CACHE.get(cacheKey);
  if (PREVIEW_TITLE_REQUESTS.has(cacheKey))
    return PREVIEW_TITLE_REQUESTS.get(cacheKey);

  const request = getLinkPreview({ url })
    .then((preview) => {
      const title = getPreviewTitleCandidate(preview, domain, previewMode);
      const publishedAt = Number(preview?.publishedAt || 0) || null;
      const result = {
        title,
        publishedAt,
        subtitle: getPreviewSubtitleCandidate(
          preview,
          domain,
          previewMode,
          title,
        ),
      };
      PREVIEW_TITLE_CACHE.set(
        cacheKey,
        result.title || result.subtitle || result.publishedAt ? result : null,
      );
      return PREVIEW_TITLE_CACHE.get(cacheKey);
    })
    .catch((error) => {
      PREVIEW_TITLE_CACHE.set(cacheKey, null);
      throw error;
    })
    .finally(() => {
      PREVIEW_TITLE_REQUESTS.delete(cacheKey);
    });

  PREVIEW_TITLE_REQUESTS.set(cacheKey, request);
  return request;
}

function buildLibraryIntegrityReport(links, folders) {
  const safeLinks = Array.isArray(links) ? links : [];
  const folderById = new Map(
    (Array.isArray(folders) ? folders : []).map((folder) => [
      String(folder._id),
      folder,
    ]),
  );
  const newsArticles = safeLinks.filter(
    (link) => link?.linkType === "newsArticle",
  );
  const newsSources = safeLinks.filter(
    (link) => link?.linkType === "newsSource",
  );
  const sourceDomains = new Set(newsSources.map(getLinkDomain).filter(Boolean));
  const missingSourceDomains = [
    ...new Set(
      newsArticles
        .map(getLinkDomain)
        .filter((domain) => domain && !sourceDomains.has(domain)),
    ),
  ];
  const categoryCounts = new Map();
  safeLinks.forEach((link) => {
    const folderName = link?.folderId
      ? folderById.get(String(link.folderId))?.name
      : null;
    const category =
      link?.linkType === "newsArticle"
        ? `Noticia · ${getLinkDomain(link) || "sin dominio"}`
        : folderName || "Sin clasificar";
    categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
  });
  return {
    totalLinks: safeLinks.length,
    newsPosts: newsArticles.length,
    newsSources: newsSources.length,
    missingSourceDomains,
    categoryCounts: [...categoryCounts.entries()].sort((a, b) =>
      a[0].localeCompare(b[0]),
    ),
  };
}

function normalizeLocalBackupUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    if (!/^https?:$/.test(url.protocol) || !url.hostname) return null;
    // Para enlaces web ordinarios http y https representan el mismo destino.
    // Usamos https para que también se detecten las copias antiguas en http.
    url.protocol = "https:";
    url.hostname = url.hostname.replace(/^www\./i, "").toLowerCase();
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      const normalizedKey = key.toLowerCase();
      if (
        normalizedKey.startsWith("utm_") ||
        LOCAL_TRACKING_QUERY_KEYS.has(normalizedKey)
      ) {
        url.searchParams.delete(key);
      }
    }
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
    const params = [...url.searchParams.entries()].sort(
      ([keyA, valueA], [keyB, valueB]) =>
        keyA.localeCompare(keyB) || valueA.localeCompare(valueB),
    );
    url.search = new URLSearchParams(params).toString();
    return { url: url.toString(), hostname: url.hostname };
  } catch {
    return null;
  }
}

function isLocalDomainHomepage(value) {
  try {
    const url = new URL(String(value || ""));
    return (url.pathname === "" || url.pathname === "/") && !url.search;
  } catch {
    return false;
  }
}

function localBackupRootFolderName(folderKey, folderByKey) {
  let folder = folderByKey.get(String(folderKey || ""));
  let safety = 20;
  while (folder?.parentKey && safety > 0) {
    folder = folderByKey.get(String(folder.parentKey));
    safety -= 1;
  }
  return String(folder?.name || "").trim().toLowerCase();
}

function scoreLocalBackupLink(link) {
  return (
    Number(Boolean(link.favorite)) * 8 +
    Number(Boolean(String(link.notes || "").trim())) * 4 +
    Number(Array.isArray(link.hashtags) && link.hashtags.length > 0) * 3 +
    Number(Boolean(String(link.customTitle || "").trim())) * 2 +
    Number(Boolean(link.publishedAt)) +
    Number(Boolean(link.folderKey))
  );
}

function readableBackupFolderSegment(value) {
  let decoded = String(value || "");
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // Las copias anteriores pueden contener una clave ya legible o una
    // codificación incompleta. Conservamos el texto en vez de descartarlo.
  }
  return decoded
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\\/]+/g, " ")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_");
}

function readableBackupFolderKey(value) {
  return String(value || "")
    .split("/")
    .map(readableBackupFolderSegment)
    .filter(Boolean)
    .join("/");
}

function repairBackupLocally(backup) {
  const source = backup?.data;
  if (
    backup?.format !== "shopp-library-backup" ||
    Number(backup?.version) !== 1 ||
    !Array.isArray(source?.folders) ||
    !Array.isArray(source?.links)
  ) {
    throw new Error("El fichero no es una copia de Biblioteca compatible.");
  }

  const folderKeyMap = new Map();
  const folders = source.folders.map((folder) => {
    const originalKey = String(folder?.key || "");
    const key = readableBackupFolderKey(originalKey);
    if (originalKey && key) folderKeyMap.set(originalKey, key);
    return {
      ...folder,
      key: key || originalKey,
      parentKey: folder?.parentKey
        ? readableBackupFolderKey(folder.parentKey)
        : null,
    };
  });
  const folderByKey = new Map(
    folders
      .filter((folder) => folder?.key)
      .map((folder) => [String(folder.key), folder]),
  );
  const newsFolder = folders.find(
    (folder) => localBackupRootFolderName(folder?.key, folderByKey) === "noticias",
  );
  const newsFolderKey = newsFolder?.key || "Noticias";
  const bookFolder = folders.find(
    (folder) => localBackupRootFolderName(folder?.key, folderByKey) === "libros",
  );
  const bookFolderKey = bookFolder?.key || "Libros";
  const linksByCanonicalUrl = new Map();
  const summary = {
    normalizedUrls: 0,
    duplicatesRemoved: 0,
    invalidUrls: 0,
    typeCorrections: 0,
    sourcesAdded: 0,
  };

  for (const originalLink of source.links) {
    if (!originalLink || typeof originalLink.url !== "string") {
      summary.invalidUrls += 1;
      continue;
    }
    const normalized = normalizeLocalBackupUrl(
      originalLink.normalizedUrl || originalLink.url,
    );
    if (!normalized) {
      summary.invalidUrls += 1;
      continue;
    }
    const link = { ...originalLink };
    if (link.folderKey) {
      const originalFolderKey = String(link.folderKey);
      link.folderKey =
        folderKeyMap.get(originalFolderKey) ||
        readableBackupFolderKey(originalFolderKey) ||
        originalFolderKey;
    }
    if (link.url !== normalized.url || link.normalizedUrl !== normalized.url) {
      summary.normalizedUrls += 1;
    }
    link.url = normalized.url;
    link.normalizedUrl = normalized.url;
    link.hostname = normalized.hostname;

    const rootFolderName = localBackupRootFolderName(link.folderKey, folderByKey);
    let linkType = link.linkType || "general";
    if (linkType === "newsArticle" && isLocalDomainHomepage(link.url)) {
      linkType = "newsSource";
    } else if (linkType === "general" && rootFolderName === "libros") {
      linkType = "bookLink";
    } else if (linkType === "newsSource" && /^books\.google\./i.test(link.hostname)) {
      linkType = "bookStore";
      link.folderKey = bookFolderKey;
    } else if (
      linkType === "newsSource" &&
      /^(m\.)?youtube\.com$/i.test(link.hostname)
    ) {
      linkType = "general";
    }
    if (link.linkType !== linkType) summary.typeCorrections += 1;
    link.linkType = linkType;
    link.sourceDomain = ["newsSource", "newsArticle", "bookStore", "bookLink"].includes(linkType)
      ? normalized.hostname
      : undefined;

    const bucket = linksByCanonicalUrl.get(normalized.url) || [];
    bucket.push(link);
    linksByCanonicalUrl.set(normalized.url, bucket);
  }

  const repairedLinks = [];
  for (const candidates of linksByCanonicalUrl.values()) {
    // Una fuente de catálogo y una noticia concreta no se intercambian. Para
    // enlaces del mismo tipo conservamos el que contiene más metadatos.
    const byType = new Map();
    for (const candidate of candidates) {
      const typeCandidates = byType.get(candidate.linkType) || [];
      typeCandidates.push(candidate);
      byType.set(candidate.linkType, typeCandidates);
    }
    for (const typeCandidates of byType.values()) {
      const primary = typeCandidates.reduce((best, candidate) =>
        scoreLocalBackupLink(candidate) > scoreLocalBackupLink(best)
          ? candidate
          : best,
      );
      repairedLinks.push(primary);
      summary.duplicatesRemoved += typeCandidates.length - 1;
    }
  }

  const knownSourceDomains = new Set(
    repairedLinks
      .filter((link) => link.linkType === "newsSource")
      .map((link) => String(link.sourceDomain || link.hostname || "").toLowerCase())
      .filter(Boolean),
  );
  const articleDomains = new Set(
    repairedLinks
      .filter((link) => link.linkType === "newsArticle")
      .map((link) => String(link.sourceDomain || link.hostname || "").toLowerCase())
      .filter(Boolean),
  );
  for (const domain of articleDomains) {
    if (knownSourceDomains.has(domain)) continue;
    const homepage = normalizeLocalBackupUrl(`https://${domain}/`);
    if (!homepage) continue;
    repairedLinks.push({
      url: homepage.url,
      normalizedUrl: homepage.url,
      hostname: homepage.hostname,
      sourceDomain: homepage.hostname,
      linkType: "newsSource",
      folderKey: newsFolderKey,
      username: "Biblioteca",
      favorite: false,
      hashtags: [],
      createdAt: Date.now(),
    });
    knownSourceDomains.add(domain);
    summary.sourcesAdded += 1;
  }

  repairedLinks.sort((a, b) =>
    String(a.normalizedUrl || a.url).localeCompare(String(b.normalizedUrl || b.url)),
  );
  const repairedBackup = {
    ...backup,
    exportedAt: new Date().toISOString(),
    integrityRepair: {
      createdAt: new Date().toISOString(),
      mode: "local-json-only",
      ...summary,
    },
    data: { folders, links: repairedLinks },
  };
  return {
    repairedBackup,
    summary,
    before: buildLibraryIntegrityReport(source.links, source.folders),
    after: buildLibraryIntegrityReport(repairedLinks, folders),
  };
}

function localIntegrityFilename(fileName) {
  const base = String(fileName || "shopp-biblioteca")
    .replace(/\.json$/i, "")
    .replace(/[^a-z0-9áéíóúüñ._-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `${base || "shopp-biblioteca"}-reparado.json`;
}

function getAddUrlErrorMessage(error) {
  const message = String(error?.message || "");
  if (/url|http|https|válida|invalid/i.test(message)) {
    return "Introduce una dirección web completa que empiece por http:// o https://.";
  }
  return message || "No se pudo guardar el enlace.";
}

function defaultBackupFilename() {
  const day = new Date().toISOString().slice(0, 10);
  return `shopp-biblioteca-${day}.json`;
}

function normalizeBackupFilename(value) {
  const cleanName = String(value || "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ");

  if (!cleanName) return "";
  return cleanName.toLowerCase().endsWith(".json")
    ? cleanName
    : `${cleanName}.json`;
}

function buildBackupFolders(folders) {
  const folderById = new Map(
    (Array.isArray(folders) ? folders : []).map((folder) => [
      String(folder._id),
      folder,
    ]),
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
    const segment = readableBackupFolderSegment(folder.name);
    const key = parentKey ? `${parentKey}/${segment}` : segment;
    keyCache.set(id, key);
    return key;
  };

  return (Array.isArray(folders) ? folders : [])
    .map((folder) => ({
      key: folderKey(folder),
      name: folder.name,
      parentKey: folder.parentFolderId
        ? folderKey(folderById.get(String(folder.parentFolderId)))
        : null,
      icon: folder.icon || null,
      color: folder.color || null,
      order: Number(folder.order || 0),
    }))
    .filter((folder) => folder.key)
    .sort((a, b) => a.key.localeCompare(b.key));
}

function getBackupRootFolderKey(folderKey, folderByKey) {
  let folder = folderByKey.get(String(folderKey || ""));
  let remainingDepth = 20;

  while (folder?.parentKey && remainingDepth > 0) {
    folder = folderByKey.get(String(folder.parentKey));
    remainingDepth -= 1;
  }

  return folder?.key ? String(folder.key) : null;
}

function isCatalogSourceBackupLink(link) {
  return ["newsSource", "bookStore"].includes(link?.linkType);
}

function buildImportCategoryOptions(data) {
  const backupFolders = Array.isArray(data?.folders) ? data.folders : [];
  const backupLinks = Array.isArray(data?.links) ? data.links : [];
  const validFolders = backupFolders.filter(
    (folder) =>
      folder &&
      typeof folder.key === "string" &&
      typeof folder.name === "string" &&
      folder.key.trim() &&
      folder.name.trim(),
  );
  const folderByKey = new Map(
    validFolders.map((folder) => [String(folder.key), folder]),
  );
  const rootFolders = validFolders
    .filter((folder) => !folder.parentKey)
    .sort(
      (a, b) =>
        Number(a.order || 0) - Number(b.order || 0) ||
        String(a.name).localeCompare(String(b.name)),
    );
  const linkCounts = new Map(
    rootFolders.map((folder) => [String(folder.key), 0]),
  );
  let unclassifiedCount = 0;

  const catalogSourceCount = backupLinks.filter(isCatalogSourceBackupLink).length;

  backupLinks.forEach((link) => {
    if (isCatalogSourceBackupLink(link)) return;
    const rootKey = getBackupRootFolderKey(link?.folderKey, folderByKey);
    if (rootKey && linkCounts.has(rootKey)) {
      linkCounts.set(rootKey, linkCounts.get(rootKey) + 1);
    } else {
      unclassifiedCount += 1;
    }
  });

  const options = rootFolders.map((folder) => ({
    key: String(folder.key),
    name: String(folder.name).trim(),
    icon: folder.icon || "folder-outline",
    color: folder.color || "#475569",
    linkCount: linkCounts.get(String(folder.key)) || 0,
  }));

  if (catalogSourceCount > 0) {
    options.unshift({
      key: CATALOG_SOURCES_IMPORT_KEY,
      name: "Periódicos y tiendas de libros",
      icon: "newspaper-outline",
      color: "#dc2626",
      linkCount: catalogSourceCount,
      isCatalogSources: true,
    });
  }

  if (unclassifiedCount > 0) {
    options.push({
      key: UNCLASSIFIED_IMPORT_KEY,
      name: "Sin categoría",
      icon: "file-tray-outline",
      color: "#64748b",
      linkCount: unclassifiedCount,
    });
  }

  return options;
}

function filterBackupByCategories(data, selectedCategoryKeys) {
  const folders = Array.isArray(data?.folders) ? data.folders : [];
  const links = Array.isArray(data?.links) ? data.links : [];
  const selectedKeys = new Set(selectedCategoryKeys || []);
  const folderByKey = new Map(
    folders
      .filter((folder) => folder && typeof folder.key === "string")
      .map((folder) => [String(folder.key), folder]),
  );

  const isSelectedFolder = (folderKey) => {
    const rootKey = getBackupRootFolderKey(folderKey, folderByKey);
    return Boolean(rootKey && selectedKeys.has(rootKey));
  };

  const includeCatalogSources = selectedKeys.has(CATALOG_SOURCES_IMPORT_KEY);
  const selectedLinks = links.filter((link) => {
    if (isCatalogSourceBackupLink(link)) return includeCatalogSources;
    if (typeof link?.folderKey === "string" && link.folderKey.trim()) {
      return isSelectedFolder(link.folderKey);
    }
    return selectedKeys.has(UNCLASSIFIED_IMPORT_KEY);
  });
  const requiredFolderKeys = new Set();
  selectedLinks.forEach((link) => {
    let folder = folderByKey.get(String(link?.folderKey || ""));
    let remainingDepth = 20;
    while (folder?.key && remainingDepth > 0) {
      requiredFolderKeys.add(String(folder.key));
      folder = folder.parentKey
        ? folderByKey.get(String(folder.parentKey))
        : null;
      remainingDepth -= 1;
    }
  });

  return {
    ...data,
    folders: folders.filter(
      (folder) =>
        isSelectedFolder(folder?.key) ||
        requiredFolderKeys.has(String(folder?.key || "")),
    ),
    links: selectedLinks,
  };
}

function isNewsBackupLink(link, folderByKey) {
  if (!link || ["newsSource", "bookStore"].includes(link.linkType)) {
    return false;
  }
  if (link.linkType === "newsArticle") return true;

  const rootKey = getBackupRootFolderKey(link.folderKey, folderByKey);
  const rootFolder = folderByKey.get(String(rootKey || ""));
  return normalizeLabel(rootFolder?.name) === "noticias";
}

async function enrichImportedNewsMetadata(data, getLinkPreview, onProgress) {
  const folders = Array.isArray(data?.folders) ? data.folders : [];
  const links = Array.isArray(data?.links) ? data.links : [];
  const folderByKey = new Map(
    folders
      .filter((folder) => folder && typeof folder.key === "string")
      .map((folder) => [String(folder.key), folder]),
  );
  const enrichedLinks = [...links];
  const jobs = links
    .map((link, index) => ({ link, index }))
    .filter(({ link }) => isNewsBackupLink(link, folderByKey))
    .filter(({ link }) => isValidHttpUrl(link.normalizedUrl || link.url || ""));
  let nextJobIndex = 0;
  let updated = 0;
  let completed = 0;

  const worker = async () => {
    while (nextJobIndex < jobs.length) {
      const current = jobs[nextJobIndex];
      nextJobIndex += 1;
      const { link, index } = current;
      try {
        const url = link.normalizedUrl || link.url;
        const domain =
          String(link.sourceDomain || "").trim() || getHostnameFromUrl(url);
        const preview = await getLinkPreview({ url });
        const title = getPreviewTitleCandidate(preview, domain, "document");
        const publishedAt = Number(preview?.publishedAt || 0) || null;
        if (!title && !publishedAt) continue;

        enrichedLinks[index] = {
          ...link,
          linkType:
            link.linkType === "newsArticle" ? link.linkType : "newsArticle",
          sourceDomain: domain || link.sourceDomain,
          customTitle: title || link.customTitle,
          publishedAt: publishedAt || link.publishedAt,
        };
        updated += 1;
      } catch {
        // Si una web falla, conservamos el dato importado y seguimos.
      } finally {
        completed += 1;
        if (completed === jobs.length || completed % 20 === 0) {
          onProgress?.({ completed, total: jobs.length });
        }
      }
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(IMPORT_PREVIEW_CONCURRENCY, jobs.length) },
      () => worker(),
    ),
  );

  return {
    data: { ...data, links: enrichedLinks },
    summary: { checked: jobs.length, updated },
  };
}

function getHistoricalNewsCreatedAt(item) {
  const rawValue =
    item?._created_at?.$date ??
    item?._created_at ??
    item?.postDate?.$date ??
    item?.postDate ??
    null;

  if (rawValue === null || rawValue === undefined || rawValue === "") {
    return undefined;
  }
  if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
    return rawValue;
  }

  const timestamp = Date.parse(String(rawValue));
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

function getHistoricalNewsDomain(url) {
  try {
    return new URL(String(url || ""))
      .hostname.replace(/^www\./i, "")
      .trim()
      .toLowerCase();
  } catch {
    return "";
  }
}

function cleanHistoricalNewsTitle(value, domain) {
  const rawTitle = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!rawTitle) return "";

  const cleaned = stripImportedDomainPrefix(rawTitle, domain);
  if (cleaned !== rawTitle) return cleaned;

  const [firstToken, ...rest] = rawTitle.split(" ");
  const compactDomain = String(domain || "")
    .replace(/^www\./i, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();
  const compactFirstToken = String(firstToken || "")
    .replace(/^#/, "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();

  if (
    compactDomain &&
    [compactDomain, `www${compactDomain}`].includes(compactFirstToken)
  ) {
    return rest.join(" ").trim();
  }

  return rawTitle;
}

function buildHistoricalNewsBackup(items) {
  const newsFolder = {
    key: "Noticias",
    name: "Noticias",
    parentKey: null,
    icon: "newspaper-outline",
    color: "#dc2626",
    order: 0,
  };

  const links = (Array.isArray(items) ? items : [])
    .filter(
      (item) =>
        item && typeof item.url === "string" && isValidHttpUrl(item.url),
    )
    .map((item) => {
      const domain = getHistoricalNewsDomain(item.url);
      const createdAt = getHistoricalNewsCreatedAt(item);
      const customTitle = cleanHistoricalNewsTitle(item.title, domain);
      const notes = String(item.comments ?? item.comment ?? "")
        .trim()
        .slice(0, 1000);
      const hashtags = Array.isArray(item.hashtags)
        ? item.hashtags
            .map((tag) => String(tag || "").trim())
            .filter(Boolean)
        : [];

      return {
        url: item.url,
        username: "Biblioteca",
        folderKey: "Noticias",
        linkType: "newsArticle",
        sourceDomain: domain || undefined,
        customTitle: customTitle || undefined,
        notes: notes || undefined,
        hashtags,
        favorite: false,
        ...(createdAt ? { createdAt } : {}),
      };
    });

  return {
    format: "shopp-library-backup",
    version: 1,
    source: "legacy-news-array",
    importedAt: new Date().toISOString(),
    app: "Shopp",
    data: {
      folders: [newsFolder],
      links,
    },
  };
}

function ImportCheckbox({
  checked,
  label,
  detail,
  icon,
  color,
  onPress,
  disabled = false,
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      style={({ pressed }) => [
        styles.importOption,
        checked && styles.importOptionChecked,
        pressed && styles.importOptionPressed,
        disabled && styles.buttonDisabled,
      ]}
    >
      <View
        style={[styles.importCheckbox, checked && styles.importCheckboxChecked]}
      >
        {checked ? <Ionicons name="checkmark" size={15} color="#fff" /> : null}
      </View>
      <Ionicons name={icon || "folder-outline"} size={18} color={color} />
      <View style={styles.importOptionText}>
        <Text style={styles.importOptionLabel}>{label}</Text>
        {detail ? (
          <Text style={styles.importOptionDetail}>{detail}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function MinimalLinkTitle({ item, previewMode = "default" }) {
  const getLinkPreview = useAction(api.linkPreviews.get);
  const updatePreviewMetadata = useMutation(
    api.computerLinks.updatePreviewMetadata,
  );
  const fallbackTitle = getLinkDisplayTitle(item);
  const [previewTitle, setPreviewTitle] = useState("");
  const [previewSubtitle, setPreviewSubtitle] = useState("");
  const storedTitle = getStoredLinkTitle(item);
  const domain = getLinkDomain(item);
  const itemId = item?._id;
  const linkType = item?.linkType;
  const url = item?.normalizedUrl || item?.url || "";
  const hasUsefulStoredTitle =
    storedTitle &&
    storedTitle.toLowerCase() !== String(domain || "").toLowerCase();
  const shouldRefreshArticleMetadata = linkType === "newsArticle";
  const shouldLoadPreview =
    isYouTubeLink(item) || previewMode === "document" || shouldRefreshArticleMetadata;

  useEffect(() => {
    let cancelled = false;
    setPreviewTitle("");
    setPreviewSubtitle("");

    if (
      (hasUsefulStoredTitle &&
        previewMode !== "document" &&
        !shouldRefreshArticleMetadata) ||
      !itemId ||
      ["newsSource", "bookStore"].includes(linkType) ||
      !shouldLoadPreview ||
      !isValidHttpUrl(url)
    ) {
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      try {
        const preview = await loadPreviewTitleOnce(
          url,
          domain,
          getLinkPreview,
          previewMode,
        );
        if (cancelled) return;
        const nextTitle = preview?.title || "";
        const nextSubtitle = preview?.subtitle || "";
        const nextPublishedAt = Number(preview?.publishedAt || 0) || null;
        if (!nextTitle && !nextSubtitle && !nextPublishedAt) return;

        setPreviewTitle(nextTitle);
        setPreviewSubtitle(nextSubtitle);
        const shouldSaveTitle = !hasUsefulStoredTitle && nextTitle;
        const shouldSaveDate =
          nextPublishedAt && Number(item?.publishedAt || 0) !== nextPublishedAt;
        if (
          (shouldSaveTitle || shouldSaveDate) &&
          !previewTitleSaveDisabled
        ) {
          try {
            await updatePreviewMetadata({
              linkId: itemId,
              customTitle: shouldSaveTitle ? nextTitle : undefined,
              publishedAt: shouldSaveDate ? nextPublishedAt : undefined,
            });
          } catch (error) {
            if (isMissingConvexFunctionError(error)) {
              previewTitleSaveDisabled = true;
              return;
            }
            console.warn(
              "[LibraryScreen] preview metadata save failed",
              error,
            );
          }
        }
      } catch (error) {
        console.warn("[LibraryScreen] preview title load failed", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    domain,
    getLinkPreview,
    hasUsefulStoredTitle,
    itemId,
    linkType,
    previewMode,
    shouldLoadPreview,
    shouldRefreshArticleMetadata,
    storedTitle,
    updatePreviewMetadata,
    url,
  ]);

  return (
    <>
      <Text style={styles.minimalLinkTitle} numberOfLines={2}>
        {previewTitle || fallbackTitle}
      </Text>
      {previewSubtitle ? (
        <Text
          style={[
            styles.minimalLinkPreviewDetail,
            previewMode === "document" &&
              styles.minimalLinkPreviewDetailDocument,
          ]}
          numberOfLines={previewMode === "document" ? 2 : 1}
        >
          {previewSubtitle}
        </Text>
      ) : null}
    </>
  );
}

function getClientId() {
  if (typeof window !== "undefined") {
    const saved = window.localStorage?.getItem(CLIENT_ID_KEY);
    if (saved) return saved;
    const next = globalThis.crypto?.randomUUID?.() || `library-${Date.now()}`;
    window.localStorage?.setItem(CLIENT_ID_KEY, next);
    return next;
  }
  return `library-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function HashtagCatalogLoader({ onLoaded }) {
  const {
    results,
    status,
    loadMore,
  } = usePaginatedQuery(
    api.computerLinks.listHashtagPage,
    {},
    { initialNumItems: HASHTAG_SCAN_PAGE_SIZE },
  );

  const stats = useMemo(() => {
    const counts = new Map();
    (Array.isArray(results) ? results : []).forEach((entry) => {
      const linkId = entry?._id;
      const hashtags = Array.isArray(entry?.hashtags)
        ? entry.hashtags
        : Array.isArray(entry)
          ? entry
          : [];
      hashtags.forEach((tag) => {
        const normalizedTag = String(tag || "")
          .trim()
          .replace(/^#+/, "")
          .toLowerCase();
        if (!normalizedTag) return;
        const current = counts.get(normalizedTag) || { count: 0, ids: [] };
        current.count += 1;
        if (linkId) current.ids.push(linkId);
        counts.set(normalizedTag, current);
      });
    });
    return [...counts.entries()]
      .map(([tag, value]) => ({ tag, count: value.count, ids: value.ids }))
      .sort(
        (first, second) =>
          second.count - first.count || first.tag.localeCompare(second.tag),
      );
  }, [results]);

  useEffect(() => {
    if (status === "CanLoadMore") {
      loadMore(HASHTAG_SCAN_PAGE_SIZE);
    }
  }, [loadMore, status]);

  useEffect(() => {
    if (status === "Exhausted") {
      onLoaded(stats);
    }
  }, [onLoaded, stats, status]);

  return (
    <View style={styles.hashtagCatalogLoading}>
      <ActivityIndicator size="small" color="#2563eb" />
      <Text style={styles.hashtagCatalogLoadingTitle}>
        Cargando hashtags de noticias…
      </Text>
      <Text style={styles.hashtagCatalogLoadingText}>
        {Number(results?.length || 0).toLocaleString("es-ES")} enlaces analizados
      </Text>
    </View>
  );
}

export default function LibraryScreen({ navigation }) {
  const { width: screenWidth } = useWindowDimensions();
  const [clientId] = useState(getClientId);
  const [urlInput, setUrlInput] = useState("");
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [pendingSearchTerm, setPendingSearchTerm] = useState(null);
  const [folderFilter, setFolderFilter] = useState("all");
  const [newsView, setNewsView] = useState("articles");
  const [movingLink, setMovingLink] = useState(null);
  const [linkActions, setLinkActions] = useState(null);
  const [editingLink, setEditingLink] = useState(null);
  const [notesInput, setNotesInput] = useState("");
  const [hashtagsInput, setHashtagsInput] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [editingFolder, setEditingFolder] = useState(null);
  const [editingFolderName, setEditingFolderName] = useState("");
  const [editingSource, setEditingSource] = useState(null);
  const [sourceNameInput, setSourceNameInput] = useState("");
  const [sourceUrlInput, setSourceUrlInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [toolsExpanded, setToolsExpanded] = useState(false);
  const [toolsModalVisible, setToolsModalVisible] = useState(false);
  const [hashtagModalVisible, setHashtagModalVisible] = useState(false);
  const [globalHashtags, setGlobalHashtags] = useState(null);
  const [hashtagSearch, setHashtagSearch] = useState("");
  const [selectedHashtagFilter, setSelectedHashtagFilter] = useState(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupMode, setBackupMode] = useState(null);
  const [exportNameVisible, setExportNameVisible] = useState(false);
  const [exportFilename, setExportFilename] = useState("");
  const [exportReview, setExportReview] = useState(null);
  const [selectedExportCategoryKeys, setSelectedExportCategoryKeys] = useState(
    [],
  );
  const [importReview, setImportReview] = useState(null);
  const [selectedImportCategoryKeys, setSelectedImportCategoryKeys] = useState(
    [],
  );
  const [importMode, setImportMode] = useState("combine");
  const [enrichNewsOnImport, setEnrichNewsOnImport] = useState(true);
  const [integrityBusy, setIntegrityBusy] = useState(false);
  const [integrityReport, setIntegrityReport] = useState(null);
  const [integritySearch, setIntegritySearch] = useState("");
  const [libraryView, setLibraryView] = useState("minimal");
  const [newsSort, setNewsSort] = useState("publishedDesc");
  const [newsSortModalVisible, setNewsSortModalVisible] = useState(false);
  const [searchPage, setSearchPage] = useState(0);
  const [browsePage, setBrowsePage] = useState(0);
  const [browseCursors, setBrowseCursors] = useState([null]);
  const [slowTask, setSlowTask] = useState(null);
  const [resumeImportModalVisible, setResumeImportModalVisible] = useState(false);
  const importPauseRequestedRef = useRef(false);

  const folders = useQuery(api.computerLinks.listFolders) || [];
  const activeImportJob = useQuery(api.computerLinks.getActiveLibraryImportJob, {
    clientId,
  });
  const {
    results: exportedLinks,
    status: exportStatus,
    loadMore: loadMoreExportedLinks,
  } = usePaginatedQuery(
    api.computerLinks.exportBackup,
    backupMode ? {} : "skip",
    { initialNumItems: IMPORT_BATCH_SIZE },
  );
  const libraryBackup = useMemo(() => {
    if (exportStatus !== "Exhausted" || !Array.isArray(exportedLinks)) {
      return null;
    }
    return {
      folders: buildBackupFolders(folders),
      links: exportedLinks,
    };
  }, [exportStatus, exportedLinks, folders]);
  useEffect(() => {
    setSearchPage(0);
    setBrowsePage(0);
    setBrowseCursors([null]);
  }, [submittedSearch, selectedHashtagFilter, folderFilter, newsView, newsSort]);
  useEffect(() => {
    if (Platform.OS !== "web" || !slowTask || typeof window === "undefined") {
      return undefined;
    }
    const warnBeforeExit = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeExit);
    return () => window.removeEventListener("beforeunload", warnBeforeExit);
  }, [slowTask]);
  useEffect(() => {
    if (!activeImportJob || backupBusy || slowTask) return;
    setResumeImportModalVisible(true);
  }, [activeImportJob?._id, activeImportJob?.status, backupBusy, slowTask]);
  const selectedFolderId = !["all", "favorites", "unclassified"].includes(
    folderFilter,
  )
    ? folderFilter
    : undefined;
  const selectedFolder = folders.find(
    (folder) => String(folder._id) === String(selectedFolderId),
  );
  const isNewsFolder = selectedFolder?.name === "Noticias";
  const isBooksFolder = selectedFolder?.name === "Libros";
  const isCatalogFolder = isNewsFolder || isBooksFolder;
  const isSourceCatalog = isCatalogFolder && newsView === "sources";
  const isSourceCatalogCards = isSourceCatalog && libraryView === "cards";
  const isSourceCatalogMinimal = isSourceCatalog && libraryView === "minimal";
  const isNewsArticleList = isNewsFolder && newsView === "articles";
  const canSortCurrentList = isNewsArticleList || folderFilter === "all";
  const selectedNewsSort =
    NEWS_SORT_OPTIONS.find((option) => option.id === newsSort) ||
    NEWS_SORT_OPTIONS[0];
  const cardColumns = Math.max(
    1,
    Math.min(6, Math.floor((screenWidth - 20) / 270)),
  );
  const textLibraryResult = useQuery(
    api.computerLinks.list,
    selectedHashtagFilter
      ? "skip"
      : {
          search: submittedSearch || undefined,
          folderId: selectedFolderId,
          onlyFavorites: folderFilter === "favorites" || undefined,
          onlyUnclassified: folderFilter === "unclassified" || undefined,
          excludeNewsSources: folderFilter === "all" || undefined,
          linkType: isCatalogFolder
            ? newsView === "sources"
              ? isBooksFolder
                ? "bookStore"
                : "newsSource"
              : isBooksFolder
                ? "bookLink"
                : "newsArticle"
            : undefined,
          newsSort: canSortCurrentList ? newsSort : undefined,
          page: submittedSearch ? searchPage : undefined,
          cursor: submittedSearch
            ? undefined
            : browseCursors[browsePage] || undefined,
          paginate: !submittedSearch || undefined,
          limit: isSourceCatalog
            ? LIBRARY_CATALOG_SOURCE_LIMIT
            : submittedSearch
              ? LIBRARY_SEARCH_PAGE_SIZE
              : LIBRARY_VISIBLE_LINK_LIMIT,
        },
  );

  const selectedHashtagIds = Array.isArray(selectedHashtagFilter?.ids)
    ? selectedHashtagFilter.ids
    : [];
  const selectedHashtagTotal = selectedHashtagIds.length;
  const selectedHashtagTotalPages = Math.max(
    1,
    Math.ceil(selectedHashtagTotal / HASHTAG_RESULT_PAGE_SIZE),
  );
  const selectedHashtagPage = Math.min(
    searchPage,
    selectedHashtagTotalPages - 1,
  );
  const selectedHashtagPageIds = selectedHashtagIds.slice(
    selectedHashtagPage * HASHTAG_RESULT_PAGE_SIZE,
    (selectedHashtagPage + 1) * HASHTAG_RESULT_PAGE_SIZE,
  );
  const selectedHashtagLinks = useQuery(
    api.computerLinks.getLinksByIds,
    selectedHashtagFilter
      ? { ids: selectedHashtagPageIds }
      : "skip",
  );
  const libraryResult = selectedHashtagFilter
    ? {
        items: selectedHashtagLinks || [],
        page: selectedHashtagPage,
        pageSize: HASHTAG_RESULT_PAGE_SIZE,
        total: selectedHashtagTotal,
        totalPages: selectedHashtagTotalPages,
        continueCursor: null,
        isDone: true,
      }
    : textLibraryResult;
  useEffect(() => {
    if (!pendingSearchTerm || pendingSearchTerm !== submittedSearch) return;
    if (libraryResult !== undefined) setPendingSearchTerm(null);
  }, [libraryResult, pendingSearchTerm, submittedSearch]);
  const links = libraryResult?.items;
  const shownItemCount = Array.isArray(links) ? links.length : 0;
  const filteredGlobalHashtags = useMemo(() => {
    const query = String(hashtagSearch || "")
      .trim()
      .replace(/^#+/, "")
      .toLowerCase();
    const values = Array.isArray(globalHashtags) ? globalHashtags : [];
    if (!query) return values;
    return values.filter(({ tag }) => String(tag || "").includes(query));
  }, [globalHashtags, hashtagSearch]);
  const displayedPostsDateRange = useMemo(
    () => getDisplayedPostsDateRange(links),
    [links],
  );
  const isSearchingLibrary = Boolean(submittedSearch || selectedHashtagFilter);
  const searchTotal = Number(libraryResult?.total || 0);
  const searchTotalPages = Number(libraryResult?.totalPages || 1);
  const activeSearchPage = Number(libraryResult?.page || 0);
  const showSearchPagination = isSearchingLibrary && searchTotalPages > 1;
  const browseHasNextPage = Boolean(libraryResult?.continueCursor);
  const showBrowsePagination =
    !isSearchingLibrary && (browsePage > 0 || browseHasNextPage);
  const showPagination = showSearchPagination || showBrowsePagination;
  const activePage = isSearchingLibrary ? activeSearchPage : browsePage;
  const displayedTotalPages = isSearchingLibrary ? searchTotalPages : null;
  const shownItemLabel = isSourceCatalog
    ? isBooksFolder
      ? shownItemCount === 1
        ? "tienda mostrada"
        : "tiendas mostradas"
      : shownItemCount === 1
        ? "periódico mostrado"
        : "periódicos mostrados"
    : shownItemCount === 1
      ? "enlace mostrado"
      : "enlaces mostrados";
  const slowTaskPercent = slowTask?.total
    ? Math.min(100, Math.round((Number(slowTask.current || 0) / slowTask.total) * 100))
    : 0;
  const resumeImportTotal = activeImportJob
    ? Number(activeImportJob.totalLinks || 0) +
      Number(activeImportJob.totalSources || 0)
    : 0;
  const resumeImportCurrent = activeImportJob
    ? Number(activeImportJob.processedLinks || 0) +
      Number(activeImportJob.processedSources || 0)
    : 0;
  const resumeImportPercent = resumeImportTotal
    ? Math.min(
        100,
        Math.round((resumeImportCurrent / resumeImportTotal) * 100),
      )
    : 0;
  const filteredIntegrityCategoryCounts = useMemo(() => {
    const counts =
      integrityReport?.kind === "library"
        ? integrityReport?.categoryCounts || []
        : integrityReport?.after?.categoryCounts || [];
    const query = integritySearch.trim().toLowerCase();
    if (!query) return counts;
    return counts.filter(([category]) =>
      String(category || "").toLowerCase().includes(query),
    );
  }, [integrityReport, integritySearch]);

  const startSearch = useCallback(
    (value = search) => {
      const nextSearch = String(value || "").trim();
      setSearch(nextSearch);
      setSelectedHashtagFilter(null);
      if (!nextSearch) {
        setSubmittedSearch("");
        setPendingSearchTerm(null);
        return;
      }
      if (nextSearch === submittedSearch) return;
      setPendingSearchTerm(nextSearch);
      setSubmittedSearch(nextSearch);
    },
    [search, submittedSearch],
  );

  const selectHashtag = useCallback((entry) => {
    const tag = String(entry?.tag || "")
      .trim()
      .replace(/^#+/, "")
      .toLowerCase();
    const ids = Array.isArray(entry?.ids) ? entry.ids : [];
    if (!tag) return;
    setHashtagModalVisible(false);
    setFolderFilter("all");
    setNewsView("articles");
    setNewsSort("publishedDesc");
    setSearch(`#${tag}`);
    setSubmittedSearch("");
    setPendingSearchTerm(null);
    setSearchPage(0);
    setSelectedHashtagFilter({ tag, ids });
  }, []);

  const clearSearch = useCallback(() => {
    setSearch("");
    setSubmittedSearch("");
    setSelectedHashtagFilter(null);
    setPendingSearchTerm(null);
  }, []);

  const leaveHashtagMode = useCallback(() => {
    setSelectedHashtagFilter(null);
    setSearch("");
    setSubmittedSearch("");
    setPendingSearchTerm(null);
    setSearchPage(0);
  }, []);

  const selectLibraryFilter = useCallback((id) => {
    leaveHashtagMode();
    setFolderFilter(String(id));
  }, [leaveHashtagMode]);

  const selectNewsView = useCallback((view) => {
    leaveHashtagMode();
    setNewsView(view);
  }, [leaveHashtagMode]);

  const showNewsArticles = useCallback(() => {
    leaveHashtagMode();
    const newsFolder = folders.find(
      (folder) => !folder.parentFolderId && folder.name === "Noticias",
    );
    setFolderFilter(newsFolder ? String(newsFolder._id) : "all");
    setNewsView("articles");
  }, [folders, leaveHashtagMode]);

  const ensureDefaultFolders = useMutation(
    api.computerLinks.ensureDefaultFolders,
  );
  const addUrl = useMutation(api.computerLinks.addUrl);
  const createFolder = useMutation(api.computerLinks.createFolder);
  const toggleFavorite = useMutation(api.computerLinks.toggleFavorite);
  const updateMetadata = useMutation(api.computerLinks.updateMetadata);
  const updateNewsSource = useMutation(api.computerLinks.updateNewsSource);
  const moveToFolder = useMutation(api.computerLinks.moveToFolder);
  const removeLink = useMutation(api.computerLinks.remove);
  const removeNewsSource = useMutation(api.computerLinks.removeNewsSource);
  const importBackup = useMutation(api.computerLinks.importBackup);
  const importLibraryJobBatch = useMutation(
    api.computerLinks.importLibraryJobBatch,
  );
  const clearLibraryForImportBatch = useMutation(
    api.computerLinks.clearLibraryForImportBatch,
  );
  const ensureNewsSources = useMutation(api.computerLinks.ensureNewsSources);
  const ensureNewsSourcesForDomains = useMutation(
    api.computerLinks.ensureNewsSourcesForDomains,
  );
  const beginLibraryImportJob = useMutation(
    api.computerLinks.beginLibraryImportJob,
  );
  const updateLibraryImportJobProgress = useMutation(
    api.computerLinks.updateLibraryImportJobProgress,
  );
  const completeLibraryImportJob = useMutation(
    api.computerLinks.completeLibraryImportJob,
  );
  const cancelLibraryImportJob = useMutation(
    api.computerLinks.cancelLibraryImportJob,
  );
  const normalizeAndDeduplicate = useMutation(
    api.computerLinks.normalizeAndDeduplicate,
  );
  const extractTitleHashtagsBatch = useMutation(
    api.computerLinks.extractTitleHashtagsBatch,
  );
  const getLinkPreview = useAction(api.linkPreviews.get);
  const refreshPreviewMetadata = useMutation(
    api.computerLinks.updatePreviewMetadata,
  );
  useEffect(() => {
    if (!backupMode) return;
    if (exportStatus === "CanLoadMore") {
      const loadedLinkCount = Array.isArray(exportedLinks)
        ? exportedLinks.length
        : 0;
      setSlowTask((current) =>
        current?.kind === "prepare-export"
          ? {
              ...current,
              message: `Leyendo ${loadedLinkCount} enlaces…`,
              current: loadedLinkCount,
            }
          : current,
      );
      loadMoreExportedLinks(IMPORT_BATCH_SIZE);
      return;
    }
    if (exportStatus === "Exhausted" && libraryBackup) {
      const currentBackupMode = backupMode;
      const currentBackup = libraryBackup;
      setBackupMode(null);

      if (currentBackupMode === "export") {
        const categories = buildImportCategoryOptions(currentBackup);
        setExportReview({
          data: currentBackup,
          categories,
          folderCount: currentBackup.folders.length,
          linkCount: currentBackup.links.length,
          sourceCount: currentBackup.links.filter((link) =>
            ["newsSource", "bookStore"].includes(link?.linkType),
          ).length,
          savedLinkCount:
            currentBackup.links.length -
            currentBackup.links.filter((link) =>
              ["newsSource", "bookStore"].includes(link?.linkType),
            ).length,
        });
        setSelectedExportCategoryKeys(
          categories.map((category) => category.key),
        );
        setExportNameVisible(true);
        setBackupBusy(false);
        setSlowTask(null);
        return;
      }

      if (currentBackupMode === "integrity") {
        (async () => {
          try {
            const before = buildLibraryIntegrityReport(
              currentBackup.links,
              currentBackup.folders,
            );
            let cursor = null;
            let sourceSyncResult = null;
            let processedSources = 0;
            let createdSources = 0;
            while (true) {
              sourceSyncResult = await ensureNewsSources({
                clientId,
                batchSize: INTEGRITY_BATCH_SIZE,
                ...(cursor ? { cursor } : {}),
              });
              processedSources += Number(sourceSyncResult?.processed || 0);
              createdSources += Number(
                sourceSyncResult?.created || sourceSyncResult?.createdSources || 0,
              );
              setSlowTask({
                kind: "integrity",
                title: "Comprobando integridad",
                message: "Reconstruyendo periódicos y tiendas de libros…",
                current: Math.min(processedSources, before.totalLinks),
                total: before.totalLinks,
              });
              if (sourceSyncResult?.isDone) break;
              cursor = sourceSyncResult?.continueCursor || null;
              if (!cursor) break;
            }

            let normalizationCursor = null;
            let normalizationResult = null;
            let correctedPosts = 0;
            let duplicatesRemoved = 0;
            let normalizedCount = 0;
            let normalizedBatches = 0;
            while (true) {
              normalizationResult = await normalizeAndDeduplicate({
                batchSize: 80,
                ...(normalizationCursor
                  ? { cursor: normalizationCursor }
                  : {}),
              });
              correctedPosts += Number(
                normalizationResult?.correctedNewsPosts || 0,
              );
              duplicatesRemoved += Number(
                normalizationResult?.duplicatesRemoved || 0,
              );
              normalizedCount += Number(
                normalizationResult?.normalizedCount || 0,
              );
              normalizedBatches += 1;
              setSlowTask({
                kind: "integrity",
                title: "Comprobando integridad",
                message: `Normalizando enlaces (lote ${normalizedBatches})…`,
              });
              if (normalizationResult?.isDone) break;
              normalizationCursor =
                normalizationResult?.continueCursor || null;
              if (!normalizationCursor) break;
            }

            let hashtagCursor = null;
            let hashtagProcessed = 0;
            let hashtagUpdated = 0;
            let titleHashtagsAdded = 0;
            let hashtagBatches = 0;
            while (true) {
              const hashtagResult = await extractTitleHashtagsBatch({
                batchSize: INTEGRITY_BATCH_SIZE,
                ...(hashtagCursor ? { cursor: hashtagCursor } : {}),
              });
              hashtagProcessed += Number(hashtagResult?.processed || 0);
              hashtagUpdated += Number(hashtagResult?.updated || 0);
              titleHashtagsAdded += Number(hashtagResult?.hashtagsAdded || 0);
              hashtagBatches += 1;
              setSlowTask({
                kind: "integrity",
                title: "Comprobando integridad",
                message: `Extrayendo hashtags de títulos (lote ${hashtagBatches})…`,
                current: Math.min(hashtagProcessed, before.newsPosts || before.totalLinks),
                total: before.newsPosts || before.totalLinks,
              });
              if (hashtagResult?.isDone) break;
              hashtagCursor = hashtagResult?.continueCursor || null;
              if (!hashtagCursor) break;
            }

            // La lista global puede haber cambiado durante la reparación.
            setGlobalHashtags(null);

            setIntegrityReport({
              kind: "library",
              ...before,
              addedSources: createdSources,
              correctedPosts,
              duplicatesRemoved,
              normalizedCount,
              hashtagUpdated,
              titleHashtagsAdded,
              checkedAt: new Date().toISOString(),
            });
          } catch (error) {
            safeAlert(
              "No se pudo comprobar",
              error?.message ||
                "No se pudo revisar la integridad de la Biblioteca.",
            );
          } finally {
            setIntegrityBusy(false);
            setBackupBusy(false);
            setSlowTask(null);
          }
        })();
      }
    }
  }, [
    backupMode,
    clientId,
    ensureNewsSources,
    exportedLinks,
    exportStatus,
    libraryBackup,
    loadMoreExportedLinks,
    normalizeAndDeduplicate,
    extractTitleHashtagsBatch,
  ]);

  useEffect(() => {
    // Esperar a conocer si existe una importación activa. Durante un reemplazo
    // no debemos recrear carpetas mientras la fase de limpieza está en curso.
    if (activeImportJob === undefined || activeImportJob) return;
    ensureDefaultFolders({ clientId }).catch((error) =>
      console.warn("[LibraryScreen] folder setup failed", error),
    );
  }, [activeImportJob, clientId, ensureDefaultFolders]);

  const folderById = useMemo(
    () => new Map(folders.map((folder) => [String(folder._id), folder])),
    [folders],
  );

  const handleAddUrl = useCallback(async () => {
    const url = urlInput.trim();
    if (!url || saving) return;

    if (!isValidHttpUrl(url)) {
      safeAlert(
        "URL no válida",
        "Introduce una dirección web completa que empiece por http:// o https://.",
      );
      return;
    }

    setSaving(true);
    try {
      const result = await addUrl({
        url,
        clientId,
        username: "Biblioteca",
        folderId: selectedFolderId,
        linkType: isCatalogFolder
          ? newsView === "sources"
            ? isBooksFolder
              ? "bookStore"
              : "newsSource"
            : isBooksFolder
              ? "bookLink"
              : "newsArticle"
          : "general",
      });
      setUrlInput("");

      // Una URL pegada explícitamente es una buena oportunidad para refrescar
      // título/fecha, incluso si el enlace ya existía con metadatos antiguos.
      // Nunca guardamos un título de fallback ni usamos la descripción como título.
      if (result?.linkId && (result.existing || isCatalogFolder)) {
        try {
          const preview = await getLinkPreview({ url });
          const parsedDomain = (() => {
            try {
              return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
            } catch {
              return "";
            }
          })();
          const freshTitle = getPreviewTitleCandidate(
            preview,
            parsedDomain,
            "default",
          );
          const freshPublishedAt = Number(preview?.publishedAt || 0) || null;
          if (freshTitle || freshPublishedAt) {
            await refreshPreviewMetadata({
              linkId: result.linkId,
              customTitle: freshTitle || undefined,
              publishedAt: freshPublishedAt || undefined,
            });
          }
        } catch (previewError) {
          console.warn(
            "[LibraryScreen] explicit URL metadata refresh failed",
            previewError,
          );
        }
      }

      if (result.existing) {
        setSelectedHashtagFilter(null);
        setFolderFilter("all");
        setNewsView("articles");
        setSearchPage(0);
        setSearch(url);
        setSubmittedSearch(url);
        safeAlert(
          "Enlace recuperado",
          "El enlace ya existía en la biblioteca. Se ha intentado actualizar su título y fecha antes de mostrarlo.",
        );
      }
    } catch (error) {
      safeAlert("No se pudo guardar", getAddUrlErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }, [
    addUrl,
    clientId,
    getLinkPreview,
    isCatalogFolder,
    isBooksFolder,
    newsView,
    refreshPreviewMetadata,
    saving,
    selectedFolderId,
    urlInput,
  ]);

  const handleCreateFolder = useCallback(async () => {
    if (!folderName.trim() || saving) return;
    setSaving(true);
    try {
      const result = await createFolder({ name: folderName.trim(), clientId });
      setFolderName("");
      setCreatingFolder(false);
      leaveHashtagMode();
      setFolderFilter(String(result.folderId));
    } catch (error) {
      safeAlert("No se pudo crear", error?.message || "Revisa el nombre.");
    } finally {
      setSaving(false);
    }
  }, [clientId, createFolder, folderName, leaveHashtagMode, saving]);

  const handleMove = useCallback(
    async (folder) => {
      if (!movingLink?._id) return;
      try {
        await moveToFolder({
          linkId: movingLink._id,
          folderId: folder?._id,
        });
        setMovingLink(null);
      } catch (error) {
        safeAlert("Error", error?.message || "No se pudo mover el enlace.");
      }
    },
    [moveToFolder, movingLink],
  );

  const confirmRemoveLink = useCallback(
    (link) => {
      if (!link?._id) return;
      safeAlert(
        "Eliminar enlace",
        "Este enlace se eliminará de la Biblioteca.",
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Eliminar",
            style: "destructive",
            onPress: async () => {
              try {
                await removeLink({ linkId: link._id });
              } catch (error) {
                safeAlert(
                  "No se pudo eliminar",
                  error?.message || "Inténtalo de nuevo.",
                );
              }
            },
          },
        ],
      );
    },
    [removeLink],
  );

  const openLinkActions = useCallback((link) => {
    setLinkActions(link);
  }, []);

  const openMetadataEditor = useCallback((link) => {
    setEditingLink(link);
    setNotesInput(link?.notes || "");
    setHashtagsInput((link?.hashtags || []).map((tag) => `#${tag}`).join(" "));
  }, []);

  const openSourceEditor = useCallback((link) => {
    setEditingSource(link);
    setSourceNameInput(link?.customTitle || "");
    setSourceUrlInput(link?.normalizedUrl || link?.url || "");
  }, []);

  const handleSaveSource = useCallback(async () => {
    if (!editingSource?._id || !sourceUrlInput.trim() || saving) return;
    setSaving(true);
    try {
      await updateNewsSource({
        linkId: editingSource._id,
        url: sourceUrlInput.trim(),
        customTitle: sourceNameInput.trim() || undefined,
      });
      setEditingSource(null);
      setSourceNameInput("");
      setSourceUrlInput("");
    } catch (error) {
      safeAlert("No se pudo editar", error?.message || "Revisa la dirección.");
    } finally {
      setSaving(false);
    }
  }, [
    editingSource,
    saving,
    sourceNameInput,
    sourceUrlInput,
    updateNewsSource,
  ]);

  const openSourceUrl = useCallback(async (url) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
      safeAlert("No se pudo abrir", error?.message || "Revisa la dirección.");
    }
  }, []);

  const confirmRemoveSource = useCallback(
    (source) => {
      safeAlert(
        isBooksFolder ? "Eliminar tienda" : "Eliminar periódico",
        `Se eliminará ${source.customTitle || source.hostname} y sus ${isBooksFolder ? "libros" : "noticias"} guardados.`,
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "Eliminar",
            style: "destructive",
            onPress: async () => {
              try {
                await removeNewsSource({ linkId: source._id });
              } catch (error) {
                safeAlert(
                  "No se pudo eliminar",
                  error?.message || "Inténtalo de nuevo.",
                );
              }
            },
          },
        ],
      );
    },
    [isBooksFolder, removeNewsSource],
  );

  const handleSaveMetadata = useCallback(async () => {
    if (!editingLink?._id || saving) return;
    setSaving(true);
    try {
      const hashtags = hashtagsInput
        .split(/[\s,;]+/)
        .map((tag) => tag.trim())
        .filter(Boolean);
      await updateMetadata({
        linkId: editingLink._id,
        notes: notesInput,
        hashtags,
      });
      setEditingLink(null);
      setNotesInput("");
      setHashtagsInput("");
    } catch (error) {
      safeAlert("No se pudo guardar", error?.message || "Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  }, [editingLink, hashtagsInput, notesInput, saving, updateMetadata]);

  const performExportBackup = useCallback(async () => {
    const filename = normalizeBackupFilename(exportFilename);
    if (!exportReview || backupBusy || !filename) return;

    const exportAll =
      exportReview.categories.length === 0 ||
      selectedExportCategoryKeys.length === exportReview.categories.length;
    const selectedData = exportAll
      ? exportReview.data
      : filterBackupByCategories(exportReview.data, selectedExportCategoryKeys);

    setExportNameVisible(false);
    setExportReview(null);
    setSelectedExportCategoryKeys([]);
    setBackupBusy(true);
    setSlowTask({
      kind: "export",
      title: "Exportando Biblioteca",
      message: `Preparando ${selectedData.links.length} enlaces…`,
      current: 0,
      total: selectedData.links.length,
    });
    try {
      const payload = {
        format: "shopp-library-backup",
        version: 1,
        exportedAt: new Date().toISOString(),
        app: "Shopp",
        data: selectedData,
      };
      const json = JSON.stringify(payload, null, 2);

      if (Platform.OS === "web" && typeof document !== "undefined") {
        const blob = new Blob([json], {
          type: "application/json;charset=utf-8",
        });
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(objectUrl);
      } else {
        const fileUri = `${FileSystem.documentDirectory}${filename}`;
        await FileSystem.writeAsStringAsync(fileUri, json, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        safeAlert(
          "Copia creada",
          `Se ha guardado ${filename} en el almacenamiento de Shopp.\n\n${fileUri}`,
        );
      }
    } catch (error) {
      safeAlert("No se pudo exportar", error?.message || "Inténtalo de nuevo.");
    } finally {
      setBackupBusy(false);
      setSlowTask(null);
    }
  }, [backupBusy, exportFilename, exportReview, selectedExportCategoryKeys]);

  const handleExportBackup = useCallback(() => {
    if (backupBusy) return;
    setExportFilename(defaultBackupFilename());
    setBackupBusy(true);
    setSlowTask({
      kind: "prepare-export",
      title: "Preparando exportación",
      message: "Leyendo la Biblioteca…",
      current: 0,
    });
    setBackupMode("export");
  }, [backupBusy]);

  const runResumableImport = useCallback(
    async (job, payload) => {
      if (!job?._id || !payload?.data) {
        safeAlert(
          "No se puede continuar",
          "No se encontró la información necesaria para reanudar esta importación.",
        );
        return;
      }

      const links = Array.isArray(payload.data.links) ? payload.data.links : [];
      const sourceDomains = Array.isArray(payload.sourceDomains)
        ? payload.sourceDomains
        : collectImportNewsDomains(payload.data);
      const totalLinks = links.length;
      const totalSources = sourceDomains.length;
      let currentJob = job;

      setResumeImportModalVisible(false);
      setBackupBusy(true);
      importPauseRequestedRef.current = false;

      try {
        currentJob = await retryImportStep(() =>
          updateLibraryImportJobProgress({
            clientId,
            jobId: job._id,
            status: "running",
            phase:
              Number(job.processedLinks || 0) >= totalLinks ? "sources" : "links",
          }),
        );

        if (payload.importMode === "replace" && !currentJob?.replacePrepared) {
          while (!currentJob?.replacePrepared) {
            setSlowTask({
              kind: "import",
              title: "Preparando reemplazo",
              message: `Eliminando Biblioteca actual por lotes… ${Number(
                currentJob?.linksDeleted || 0,
              ).toLocaleString("es-ES")} enlaces y ${Number(
                currentJob?.foldersDeleted || 0,
              ).toLocaleString("es-ES")} carpetas eliminados.`,
              canPause: true,
            });

            const clearResult = await retryImportStep(() =>
              clearLibraryForImportBatch({
                clientId,
                jobId: job._id,
                batchSize: IMPORT_CLEAR_BATCH_SIZE,
              }),
            );
            currentJob = clearResult?.job || currentJob;

            if (importPauseRequestedRef.current && !clearResult?.done) {
              await updateLibraryImportJobProgress({
                clientId,
                jobId: job._id,
                status: "paused",
                phase: "links",
              });
              setResumeImportModalVisible(true);
              return;
            }

            if (clearResult?.done || currentJob?.replacePrepared) break;
          }
        }

        let processedLinks = Math.min(
          totalLinks,
          Math.max(0, Number(currentJob?.processedLinks || 0)),
        );
        const totalBatches = Math.max(
          1,
          Math.ceil(totalLinks / IMPORT_WRITE_BATCH_SIZE),
        );

        while (processedLinks < totalLinks) {
          const start = processedLinks;
          const end = Math.min(start + IMPORT_WRITE_BATCH_SIZE, totalLinks);
          const batchNumber = Math.floor(start / IMPORT_WRITE_BATCH_SIZE) + 1;
          setSlowTask({
            kind: "import",
            title: "Importando Biblioteca",
            message: `Guardando lote ${batchNumber} de ${totalBatches}…`,
            current: start,
            total: totalLinks,
            canPause: true,
          });

          const batchResult = await retryImportStep(() =>
            importLibraryJobBatch({
              clientId,
              jobId: job._id,
              expectedStart: start,
              links: links.slice(start, end),
              folders: Array.isArray(payload.data?.folders)
                ? payload.data.folders
                : [],
              historicalMerge:
                payload.backupMeta?.source === "legacy-news-array" &&
                payload.importMode !== "replace",
            }),
          );

          currentJob = batchResult?.job || currentJob;
          processedLinks = Math.min(
            totalLinks,
            Math.max(end, Number(currentJob?.processedLinks || end)),
          );

          setSlowTask({
            kind: "import",
            title: "Importando Biblioteca",
            message: `Lote ${batchNumber} de ${totalBatches} guardado`,
            current: processedLinks,
            total: totalLinks,
            canPause: true,
          });

          if (importPauseRequestedRef.current) {
            await updateLibraryImportJobProgress({
              clientId,
              jobId: job._id,
              status: "paused",
              phase: "links",
              processedLinks,
            });
            setResumeImportModalVisible(true);
            return;
          }
        }

        currentJob = await retryImportStep(() =>
          updateLibraryImportJobProgress({
            clientId,
            jobId: job._id,
            status: "running",
            phase: "sources",
            processedLinks: totalLinks,
          }),
        );

        let processedSources = Math.min(
          totalSources,
          Math.max(0, Number(currentJob?.processedSources || 0)),
        );
        const totalSourceBatches = Math.max(
          1,
          Math.ceil(totalSources / IMPORT_SOURCE_BATCH_SIZE),
        );

        while (processedSources < totalSources) {
          const start = processedSources;
          const end = Math.min(
            start + IMPORT_SOURCE_BATCH_SIZE,
            totalSources,
          );
          const batchNumber =
            Math.floor(start / IMPORT_SOURCE_BATCH_SIZE) + 1;
          setSlowTask({
            kind: "import",
            title: "Importando Biblioteca",
            message: `Comprobando periódicos ${batchNumber} de ${totalSourceBatches}…`,
            current: start,
            total: totalSources,
            canPause: true,
          });

          const sourceSummary = await retryImportStep(() =>
            ensureNewsSourcesForDomains({
              clientId,
              domains: sourceDomains.slice(start, end),
            }),
          );

          currentJob = await retryImportStep(() =>
            updateLibraryImportJobProgress({
              clientId,
              jobId: job._id,
              status: "running",
              phase: "sources",
              processedSources: end,
              newsSourcesCreated: Number(sourceSummary?.created || 0),
            }),
          );
          processedSources = end;

          if (importPauseRequestedRef.current) {
            await updateLibraryImportJobProgress({
              clientId,
              jobId: job._id,
              status: "paused",
              phase: "sources",
              processedSources,
            });
            setResumeImportModalVisible(true);
            return;
          }
        }

        const finalJob = await retryImportStep(() =>
          completeLibraryImportJob({
            clientId,
            jobId: job._id,
          }),
        );
        await deleteImportPayload(job._id).catch((error) =>
          console.warn("[LibraryScreen] import payload cleanup failed", error),
        );
        setResumeImportModalVisible(false);

        safeAlert(
          "Biblioteca restaurada",
          `${payload.importMode === "replace" ? "Reemplazo completado." : "Modo combinar completado."}\n\n${Number(finalJob?.newsMetadataChecked || 0) ? `Noticias revisadas: ${Number(finalJob.newsMetadataChecked)}\nNoticias con título/fecha actualizados: ${Number(finalJob.newsMetadataUpdated || 0)}\n` : ""}${Number(finalJob?.linksDeleted || 0) ? `Enlaces eliminados: ${Number(finalJob.linksDeleted)}\n` : ""}${Number(finalJob?.foldersDeleted || 0) ? `Categorías eliminadas: ${Number(finalJob.foldersDeleted)}\n` : ""}Carpetas creadas: ${Number(finalJob?.foldersCreated || 0)}\nEnlaces creados: ${Number(finalJob?.linksCreated || 0)}\nEnlaces actualizados: ${Number(finalJob?.linksUpdated || 0)}${Number(finalJob?.newsSourcesCreated || 0) ? `\nPeriódicos añadidos: ${Number(finalJob.newsSourcesCreated)}` : ""}`,
        );
      } catch (error) {
        console.warn("[LibraryScreen] resumable import interrupted", error);
        try {
          await updateLibraryImportJobProgress({
            clientId,
            jobId: job._id,
            status: "interrupted",
            lastError:
              error?.message || "La conexión se interrumpió durante la importación.",
          });
        } catch (checkpointError) {
          console.warn(
            "[LibraryScreen] import checkpoint update failed",
            checkpointError,
          );
        }
        setResumeImportModalVisible(true);
      } finally {
        importPauseRequestedRef.current = false;
        setBackupBusy(false);
        setSlowTask(null);
      }
    },
    [
      clientId,
      completeLibraryImportJob,
      clearLibraryForImportBatch,
      ensureNewsSourcesForDomains,
      importLibraryJobBatch,
      updateLibraryImportJobProgress,
    ],
  );

  const handleResumeStoredImport = useCallback(async () => {
    if (!activeImportJob || backupBusy) return;
    try {
      const payload = await loadImportPayload(activeImportJob._id);
      if (!payload) {
        throw new Error(
          "No se encuentra la copia local del JSON. Vuelve a seleccionar el archivo original para iniciar una nueva importación.",
        );
      }
      await runResumableImport(activeImportJob, payload);
    } catch (error) {
      safeAlert(
        "No se puede continuar",
        error?.message || "No se pudo recuperar la importación pendiente.",
      );
    }
  }, [activeImportJob, backupBusy, runResumableImport]);

  const handleDiscardStoredImport = useCallback(() => {
    if (!activeImportJob || backupBusy) return;
    safeAlert(
      "Descartar importación",
      "Se eliminará el punto de reanudación. Los enlaces que ya se hayan guardado permanecerán en Biblioteca.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Descartar",
          style: "destructive",
          onPress: async () => {
            try {
              await cancelLibraryImportJob({
                clientId,
                jobId: activeImportJob._id,
              });
              await deleteImportPayload(activeImportJob._id).catch(() => {});
              setResumeImportModalVisible(false);
            } catch (error) {
              safeAlert(
                "No se pudo descartar",
                error?.message || "Inténtalo de nuevo.",
              );
            }
          },
        },
      ],
    );
  }, [activeImportJob, backupBusy, cancelLibraryImportJob, clientId]);

  const handlePauseImport = useCallback(() => {
    if (slowTask?.kind !== "import" || !slowTask?.canPause) return;
    importPauseRequestedRef.current = true;
    setSlowTask((current) =>
      current?.kind === "import"
        ? {
            ...current,
            message: "Pausando al terminar el lote actual…",
            canPause: false,
          }
        : current,
    );
  }, [slowTask]);

  const handleImportSelected = useCallback(async () => {
    if (!importReview || backupBusy) return;
    if (activeImportJob) {
      setResumeImportModalVisible(true);
      return;
    }

    const categoryKeys = selectedImportCategoryKeys;
    if (importReview.categories.length > 0 && categoryKeys.length === 0) {
      return;
    }

    const importAll =
      importReview.categories.length === 0 ||
      categoryKeys.length === importReview.categories.length;
    const selectedData = importAll
      ? importReview.parsed.data
      : filterBackupByCategories(importReview.parsed.data, categoryKeys);
    const selectedImportMode = importMode;
    const selectedFileName = importReview.fileName || "Biblioteca.json";

    const executeImport = async () => {
      setImportReview(null);
      setSelectedImportCategoryKeys([]);
      setImportMode("combine");
      setEnrichNewsOnImport(true);
      setBackupBusy(true);
      setSlowTask({
        kind: "import",
        title: "Preparando importación",
        message: "Preparando los enlaces seleccionados…",
        current: 0,
        total: Array.isArray(selectedData?.links) ? selectedData.links.length : 0,
      });

      let job = null;
      let payloadSaved = false;
      try {
        const selectedLinks = Array.isArray(selectedData?.links)
          ? selectedData.links
          : [];
        const shouldEnrich =
          enrichNewsOnImport && selectedLinks.length <= IMPORT_ENRICH_LIMIT;
        const enriched = shouldEnrich
          ? await enrichImportedNewsMetadata(
              selectedData,
              getLinkPreview,
              ({ completed, total }) =>
                setSlowTask({
                  kind: "import",
                  title: "Preparando importación",
                  message: "Actualizando títulos y fechas de noticias…",
                  current: completed,
                  total,
                }),
            )
          : { data: selectedData, summary: { checked: 0, updated: 0 } };

        const importData = enriched.data;
        const links = Array.isArray(importData?.links) ? importData.links : [];
        const sourceDomains = collectImportNewsDomains(importData);
        const fingerprint = buildImportFingerprint(
          selectedFileName,
          importData,
          selectedImportMode,
        );
        const backupMeta = { ...importReview.parsed };
        delete backupMeta.data;

        if (enrichNewsOnImport && !shouldEnrich && links.length > 0) {
          setSlowTask({
            kind: "import",
            title: "Preparando importación",
            message: `Importación grande: se omite la consulta web de ${links.length.toLocaleString("es-ES")} noticias para acelerar y estabilizar el proceso.`,
            current: 0,
            total: links.length,
          });
          await new Promise((resolve) => setTimeout(resolve, 0));
        }

        job = await beginLibraryImportJob({
          clientId,
          fileName: selectedFileName,
          fingerprint,
          importMode: selectedImportMode,
          totalLinks: links.length,
          totalSources: sourceDomains.length,
          newsMetadataChecked: Number(enriched.summary?.checked || 0),
          newsMetadataUpdated: Number(enriched.summary?.updated || 0),
        });

        const payload = {
          version: 1,
          fileName: selectedFileName,
          importMode: selectedImportMode,
          backupMeta,
          data: importData,
          sourceDomains,
          savedAt: new Date().toISOString(),
        };
        setSlowTask({
          kind: "import",
          title: "Preparando importación",
          message: "Guardando un punto de reanudación local…",
          current: 0,
          total: links.length,
        });
        await saveImportPayload(job._id, payload);
        payloadSaved = true;

        setBackupBusy(false);
        setSlowTask(null);
        await runResumableImport(job, payload);
      } catch (error) {
        if (job?._id && !payloadSaved) {
          await cancelLibraryImportJob({
            clientId,
            jobId: job._id,
          }).catch(() => {});
        } else if (job?._id) {
          await updateLibraryImportJobProgress({
            clientId,
            jobId: job._id,
            status: "interrupted",
            lastError: error?.message || "No se pudo iniciar la importación.",
          }).catch(() => {});
          setResumeImportModalVisible(true);
        }
        safeAlert(
          "No se pudo iniciar la importación",
          error?.message || "No se pudo preparar la Biblioteca.",
        );
        setBackupBusy(false);
        setSlowTask(null);
      }
    };

    if (selectedImportMode === "replace") {
      safeAlert(
        "Reemplazar Biblioteca",
        `Se eliminarán todas las categorías y enlaces actuales y se conservarán únicamente los seleccionados del fichero ${selectedFileName}. La importación podrá reanudarse si se interrumpe, pero esta acción reemplaza los datos actuales.`,
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Reemplazar", style: "destructive", onPress: executeImport },
        ],
      );
      return;
    }

    await executeImport();
  }, [
    activeImportJob,
    backupBusy,
    beginLibraryImportJob,
    cancelLibraryImportJob,
    clientId,
    enrichNewsOnImport,
    getLinkPreview,
    importMode,
    importReview,
    runResumableImport,
    selectedImportCategoryKeys,
    updateLibraryImportJobProgress,
  ]);

  const handleImportBackup = useCallback(async () => {
    if (backupBusy) return;
    if (activeImportJob) {
      setResumeImportModalVisible(true);
      return;
    }
    setBackupBusy(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/json", "text/json", "text/plain"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.uri)
        throw new Error("No se pudo leer el fichero seleccionado.");

      let jsonText = "";
      if (Platform.OS === "web" && asset.file) {
        jsonText = await asset.file.text();
      } else {
        jsonText = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.UTF8,
        });
      }

      const rawParsed = JSON.parse(jsonText);
      const isHistoricalNewsArray = Array.isArray(rawParsed);
      const parsed = isHistoricalNewsArray
        ? buildHistoricalNewsBackup(rawParsed)
        : rawParsed;
      if (parsed?.format !== "shopp-library-backup" || parsed?.version !== 1) {
        throw new Error(
          "El fichero no es una copia de Biblioteca ni un array histórico de noticias compatible.",
        );
      }
      if (
        !parsed?.data ||
        !Array.isArray(parsed.data.folders) ||
        !Array.isArray(parsed.data.links)
      ) {
        throw new Error("La copia está incompleta: faltan carpetas o enlaces.");
      }

      const folderCount = parsed.data.folders.length;
      const linkCount = parsed.data.links.length;
      const sourceCount = parsed.data.links.filter((link) =>
        ["newsSource", "bookStore"].includes(link?.linkType),
      ).length;
      const savedLinkCount = linkCount - sourceCount;
      const categories = buildImportCategoryOptions(parsed.data);
      setImportReview({
        fileName: asset.name || "copia de Biblioteca",
        parsed,
        categories,
        folderCount,
        linkCount,
        sourceCount,
        savedLinkCount,
        isHistoricalNewsArray,
        originalItemCount: isHistoricalNewsArray ? rawParsed.length : linkCount,
        skippedHistoricalCount: isHistoricalNewsArray
          ? Math.max(0, rawParsed.length - linkCount)
          : 0,
      });
      setSelectedImportCategoryKeys(categories.map((category) => category.key));
      setImportMode("combine");
      setEnrichNewsOnImport(!isHistoricalNewsArray);
    } catch (error) {
      if (String(error?.name || "") === "SyntaxError") {
        safeAlert(
          "JSON no válido",
          "El fichero seleccionado no contiene JSON válido.",
        );
      } else {
        safeAlert(
          "No se pudo importar",
          error?.message || "Revisa la copia de seguridad.",
        );
      }
    } finally {
      setBackupBusy(false);
    }
  }, [activeImportJob, backupBusy]);

  const importCategories = importReview?.categories || [];
  const importCatalogSources = importCategories.find(
    (category) => category.isCatalogSources,
  );
  const importFolderCategories = importCategories.filter(
    (category) => !category.isCatalogSources,
  );
  const allImportCategoriesSelected =
    importCategories.length === 0 ||
    selectedImportCategoryKeys.length === importCategories.length;
  const selectedImportLinkCount = allImportCategoriesSelected
    ? importReview?.linkCount || 0
    : importCategories
        .filter((category) => selectedImportCategoryKeys.includes(category.key))
        .reduce((total, category) => total + Number(category.linkCount || 0), 0);
  const importMetadataEnrichmentDisabled =
    selectedImportLinkCount > IMPORT_ENRICH_LIMIT;

  const closeImportReview = useCallback(() => {
    if (backupBusy) return;
    setImportReview(null);
    setSelectedImportCategoryKeys([]);
    setImportMode("combine");
    setEnrichNewsOnImport(true);
  }, [backupBusy]);

  const toggleImportCategory = useCallback((categoryKey) => {
    setSelectedImportCategoryKeys((current) =>
      current.includes(categoryKey)
        ? current.filter((key) => key !== categoryKey)
        : [...current, categoryKey],
    );
  }, []);

  const exportCategories = exportReview?.categories || [];
  const exportCatalogSources = exportCategories.find(
    (category) => category.isCatalogSources,
  );
  const exportFolderCategories = exportCategories.filter(
    (category) => !category.isCatalogSources,
  );
  const allExportCategoriesSelected =
    exportCategories.length === 0 ||
    selectedExportCategoryKeys.length === exportCategories.length;
  const selectedExportLinkCount = allExportCategoriesSelected
    ? exportReview?.linkCount || 0
    : exportCategories
        .filter((category) => selectedExportCategoryKeys.includes(category.key))
        .reduce((total, category) => total + category.linkCount, 0);

  const closeExportReview = useCallback(() => {
    if (backupBusy) return;
    setExportNameVisible(false);
    setExportReview(null);
    setSelectedExportCategoryKeys([]);
  }, [backupBusy]);

  const toggleExportCategory = useCallback((categoryKey) => {
    setSelectedExportCategoryKeys((current) =>
      current.includes(categoryKey)
        ? current.filter((key) => key !== categoryKey)
        : [...current, categoryKey],
    );
  }, []);

  const handleCheckIntegrity = useCallback(() => {
    if (integrityBusy || backupBusy) return;
    setIntegritySearch("");
    setIntegrityReport(null);
    setIntegrityBusy(true);
    setBackupBusy(true);
    setSlowTask({
      kind: "integrity",
      title: "Comprobando integridad",
      message: "Leyendo los enlaces actuales de Biblioteca…",
      current: 0,
    });
    setBackupMode("integrity");
  }, [backupBusy, integrityBusy]);

  const handleCheckLocalJson = useCallback(async () => {
    if (integrityBusy) return;
    setIntegritySearch("");
    setIntegrityBusy(true);
    setBackupBusy(true);
    setSlowTask({
      kind: "integrity",
      title: "Analizando copia local",
      message: "Selecciona una exportación JSON de Biblioteca…",
    });
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/json", "text/json", "text/plain"],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) throw new Error("No se pudo leer el fichero seleccionado.");

      setSlowTask({
        kind: "integrity",
        title: "Analizando copia local",
        message: "Revisando URL, duplicados y fuentes…",
      });
      // Dejamos que se pinte el progreso antes de analizar un archivo grande.
      await new Promise((resolve) => setTimeout(resolve, 0));
      const jsonText =
        Platform.OS === "web" && asset.file
          ? await asset.file.text()
          : await FileSystem.readAsStringAsync(asset.uri, {
              encoding: FileSystem.EncodingType.UTF8,
            });
      const repaired = repairBackupLocally(JSON.parse(jsonText));
      setIntegrityReport({
        kind: "local",
        ...repaired,
        fileName: asset.name || "copia de Biblioteca",
        repairedFileName: localIntegrityFilename(asset.name),
        checkedAt: new Date().toISOString(),
      });
    } catch (error) {
      safeAlert(
        "No se pudo comprobar",
        String(error?.name || "") === "SyntaxError"
          ? "El fichero seleccionado no contiene JSON válido."
          : error?.message || "Revisa la copia de seguridad.",
      );
    } finally {
      setIntegrityBusy(false);
      setBackupBusy(false);
      setSlowTask(null);
    }
  }, [integrityBusy]);

  const downloadRepairedIntegrityBackup = useCallback(async () => {
    if (!integrityReport?.repairedBackup || backupBusy) return;
    setBackupBusy(true);
    try {
      const filename = integrityReport.repairedFileName || "shopp-biblioteca-reparado.json";
      const json = JSON.stringify(integrityReport.repairedBackup, null, 2);
      if (Platform.OS === "web" && typeof document !== "undefined") {
        const blob = new Blob([json], { type: "application/json;charset=utf-8" });
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(objectUrl);
      } else {
        const fileUri = `${FileSystem.documentDirectory}${filename}`;
        await FileSystem.writeAsStringAsync(fileUri, json, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        safeAlert("Copia reparada", `Se ha guardado ${filename} en el almacenamiento de Shopp.\n\n${fileUri}`);
      }
    } catch (error) {
      safeAlert("No se pudo crear la copia", error?.message || "Inténtalo de nuevo.");
    } finally {
      setBackupBusy(false);
    }
  }, [backupBusy, integrityReport]);

  const closeIntegrityReport = useCallback(() => {
    setIntegrityReport(null);
    setIntegritySearch("");
  }, []);

  const topFolders = folders.filter((folder) => !folder.parentFolderId);
  const filters = [
    { _id: "all", name: "Todos", icon: "apps-outline" },
    { _id: "favorites", name: "Favoritos", icon: "star-outline" },
    { _id: "unclassified", name: "Sin clasificar", icon: "file-tray-outline" },
    ...topFolders,
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        <View style={styles.compactTopBar}>
          <Pressable
            onPress={() => navigation?.goBack()}
            style={styles.compactTopButton}
            accessibilityLabel="Volver"
          >
            <Ionicons name="arrow-back" size={20} color="#334155" />
          </Pressable>
          <View style={styles.compactTopTitle}>
            <Ionicons name="library-outline" size={18} color="#2563eb" />
            <Text style={styles.compactTopText}>Biblioteca</Text>
          </View>
          <Pressable
            onPress={() => setToolsModalVisible(true)}
            style={styles.compactTopButton}
            accessibilityLabel="Abrir herramientas de Biblioteca"
          >
            <Ionicons name="options-outline" size={21} color="#2563eb" />
          </Pressable>
          <Pressable
            onPress={() => setToolsExpanded((value) => !value)}
            style={styles.compactTopButton}
            accessibilityLabel={
              toolsExpanded
                ? "Ocultar URL y búsqueda"
                : "Mostrar URL y búsqueda"
            }
          >
            <Ionicons
              name={toolsExpanded ? "chevron-up" : "chevron-down"}
              size={21}
              color="#2563eb"
            />
          </Pressable>
        </View>

        {toolsExpanded ? (
          <View style={styles.toolsPanel}>
            <View style={styles.addRow}>
              <TextInput
                value={urlInput}
                onChangeText={setUrlInput}
                placeholder={
                  isSourceCatalog
                    ? isBooksFolder
                      ? "https://www.casadellibro.com"
                      : "https://www.elmundo.es"
                    : isBooksFolder
                      ? "Pega la URL de un libro"
                      : isNewsFolder
                        ? "Pega la URL de una noticia"
                        : "https://ejemplo.com"
                }
                placeholderTextColor="#94a3b8"
                style={styles.urlInput}
                autoCorrect={false}
                autoCapitalize="none"
                onSubmitEditing={handleAddUrl}
              />
              <Pressable
                onPress={handleAddUrl}
                disabled={!urlInput.trim() || saving}
                style={[
                  styles.addButton,
                  (!urlInput.trim() || saving) && styles.buttonDisabled,
                ]}
              >
                <Ionicons name="add" size={22} color="#fff" />
              </Pressable>
            </View>

            <View style={styles.searchRow}>
              <Ionicons name="search-outline" size={19} color="#64748b" />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Buscar por URL, dominio o autor…"
                placeholderTextColor="#94a3b8"
                style={[
                  styles.searchInput,
                  Platform.OS === "web" && styles.webInputNoOutline,
                ]}
                autoCorrect={false}
                returnKeyType="search"
                onSubmitEditing={() => startSearch()}
              />
              {search ? (
                <Pressable
                  onPress={clearSearch}
                  style={styles.iconButton}
                  accessibilityLabel="Borrar búsqueda"
                >
                  <Ionicons name="close-circle" size={20} color="#94a3b8" />
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => startSearch()}
                disabled={!search.trim() || Boolean(pendingSearchTerm)}
                style={[
                  styles.searchSubmitButton,
                  (!search.trim() || pendingSearchTerm) && styles.buttonDisabled,
                ]}
                accessibilityLabel="Iniciar búsqueda"
              >
                <Ionicons name="search" size={18} color="#fff" />
                <Text style={styles.searchSubmitText}>Buscar</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <Modal
          visible={Boolean(pendingSearchTerm)}
          transparent
          animationType="fade"
          onRequestClose={() => {}}
          statusBarTranslucent
        >
          <View style={styles.searchLoadingBackdrop}>
            <View style={styles.searchLoadingCard}>
              <ActivityIndicator size="large" color="#2563eb" />
              <Text style={styles.searchLoadingTitle}>Buscando enlaces</Text>
              <Text style={styles.searchLoadingText} numberOfLines={2}>
                {pendingSearchTerm}
              </Text>
              <Text style={styles.searchLoadingHint}>
                Espera mientras se cargan los resultados.
              </Text>
            </View>
          </View>
        </Modal>

        <Modal
          visible={Boolean(slowTask)}
          transparent
          animationType="fade"
          onRequestClose={() => {}}
          statusBarTranslucent
        >
          <View style={styles.slowTaskBackdrop}>
            <View style={styles.slowTaskCard}>
              <ActivityIndicator size="large" color="#2563eb" />
              <Text style={styles.slowTaskTitle}>{slowTask?.title}</Text>
              <Text style={styles.slowTaskMessage}>{slowTask?.message}</Text>
              {slowTask?.total ? (
                <View style={styles.slowTaskProgressArea}>
                  <View style={styles.slowTaskProgressTrack}>
                    <View
                      style={[
                        styles.slowTaskProgressFill,
                        { width: `${slowTaskPercent}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.slowTaskProgressText}>
                    {Number(slowTask.current || 0).toLocaleString("es-ES")} de{" "}
                    {Number(slowTask.total).toLocaleString("es-ES")} ({slowTaskPercent}%)
                  </Text>
                </View>
              ) : null}
              {slowTask?.kind === "import" ? (
                <>
                  <Text style={styles.slowTaskHint}>
                    El progreso se guarda después de cada lote. Si la conexión se
                    interrumpe podrás continuar desde el último punto confirmado.
                  </Text>
                  {slowTask?.canPause ? (
                    <Pressable
                      onPress={handlePauseImport}
                      style={[styles.cancelButton, { marginTop: 14, alignSelf: "stretch" }]}
                    >
                      <Text style={styles.cancelText}>Pausar después de este lote</Text>
                    </Pressable>
                  ) : null}
                </>
              ) : (
                <Text style={styles.slowTaskHint}>
                  Esta tarea no se puede cancelar. No cierres, recargues ni salgas
                  de la aplicación hasta que termine.
                </Text>
              )}
            </View>
          </View>
        </Modal>

        <Modal
          visible={Boolean(activeImportJob) && resumeImportModalVisible && !backupBusy}
          transparent
          animationType="fade"
          onRequestClose={() => setResumeImportModalVisible(false)}
          statusBarTranslucent
        >
          <View style={styles.slowTaskBackdrop}>
            <View style={styles.slowTaskCard}>
              <Ionicons name="cloud-offline-outline" size={34} color="#2563eb" />
              <Text style={styles.slowTaskTitle}>Importación pendiente</Text>
              <Text style={styles.slowTaskMessage} numberOfLines={2}>
                {activeImportJob?.fileName || "Biblioteca.json"}
              </Text>
              {resumeImportTotal ? (
                <View style={styles.slowTaskProgressArea}>
                  <View style={styles.slowTaskProgressTrack}>
                    <View
                      style={[
                        styles.slowTaskProgressFill,
                        { width: `${resumeImportPercent}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.slowTaskProgressText}>
                    {resumeImportCurrent.toLocaleString("es-ES")} de{" "}
                    {resumeImportTotal.toLocaleString("es-ES")} ({resumeImportPercent}%)
                  </Text>
                </View>
              ) : null}
              <Text style={styles.slowTaskHint}>
                {activeImportJob?.phase === "sources"
                  ? `Enlaces guardados. Quedan ${Math.max(0, Number(activeImportJob?.totalSources || 0) - Number(activeImportJob?.processedSources || 0)).toLocaleString("es-ES")} dominios por comprobar.`
                  : `Se continuará desde el enlace ${Math.min(Number(activeImportJob?.processedLinks || 0) + 1, Number(activeImportJob?.totalLinks || 0)).toLocaleString("es-ES")}.`}
                {activeImportJob?.lastError
                  ? `\n\nÚltimo error: ${activeImportJob.lastError}`
                  : ""}
              </Text>
              <View style={[styles.modalActions, { alignSelf: "stretch" }]}>
                <Pressable
                  onPress={handleDiscardStoredImport}
                  style={styles.cancelButton}
                >
                  <Text style={styles.cancelText}>Descartar</Text>
                </Pressable>
                <Pressable
                  onPress={() => setResumeImportModalVisible(false)}
                  style={styles.cancelButton}
                >
                  <Text style={styles.cancelText}>Cerrar</Text>
                </Pressable>
                <Pressable
                  onPress={handleResumeStoredImport}
                  style={styles.saveButton}
                >
                  <Text style={styles.saveText}>Continuar</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={toolsModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setToolsModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, styles.toolsModalCard]}>
              <View style={styles.toolsModalHeader}>
                <View style={styles.toolsModalTitleRow}>
                  <Ionicons name="options-outline" size={19} color="#2563eb" />
                  <Text style={styles.toolsModalTitle}>Herramientas</Text>
                </View>
                <Pressable
                  onPress={() => setToolsModalVisible(false)}
                  style={styles.toolsModalClose}
                  accessibilityLabel="Cerrar herramientas"
                >
                  <Ionicons name="close" size={21} color="#475569" />
                </Pressable>
              </View>

              <View style={styles.toolsModalActions}>
                <Pressable
                  onPress={() => {
                    setToolsModalVisible(false);
                    handleExportBackup();
                  }}
                  disabled={backupBusy}
                  style={[
                    styles.backupButton,
                    styles.toolsModalActionButton,
                    backupBusy && styles.buttonDisabled,
                  ]}
                >
                  <Ionicons
                    name="cloud-upload-outline"
                    size={17}
                    color="#2563eb"
                  />
                  <Text style={styles.backupButtonText}>
                    {backupBusy ? "Preparando..." : "Exportar JSON"}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setToolsModalVisible(false);
                    handleImportBackup();
                  }}
                  disabled={backupBusy}
                  style={[
                    styles.backupButton,
                    styles.toolsModalActionButton,
                    backupBusy && styles.buttonDisabled,
                  ]}
                >
                  <Ionicons name="download-outline" size={17} color="#2563eb" />
                  <Text style={styles.backupButtonText}>Importar JSON</Text>
                </Pressable>
                {activeImportJob ? (
                  <Pressable
                    onPress={() => {
                      setToolsModalVisible(false);
                      setResumeImportModalVisible(true);
                    }}
                    disabled={backupBusy}
                    style={[
                      styles.backupButton,
                      styles.toolsModalActionButton,
                      backupBusy && styles.buttonDisabled,
                    ]}
                  >
                    <Ionicons name="refresh-circle-outline" size={17} color="#2563eb" />
                    <Text style={styles.backupButtonText}>
                      Continuar importación
                    </Text>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() => {
                    setToolsModalVisible(false);
                    handleCheckIntegrity();
                  }}
                  disabled={integrityBusy || backupBusy}
                  style={[
                    styles.backupButton,
                    styles.toolsModalActionButton,
                    styles.integrityButton,
                    (integrityBusy || backupBusy) && styles.buttonDisabled,
                  ]}
                >
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={17}
                    color="#047857"
                  />
                  <Text style={styles.integrityButtonText}>
                    {integrityBusy ? "Comprobando…" : "Comprobar integridad"}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setToolsModalVisible(false);
                    handleCheckLocalJson();
                  }}
                  disabled={integrityBusy || backupBusy}
                  style={[
                    styles.backupButton,
                    styles.toolsModalActionButton,
                    (integrityBusy || backupBusy) && styles.buttonDisabled,
                  ]}
                >
                  <Ionicons
                    name="document-text-outline"
                    size={17}
                    color="#2563eb"
                  />
                  <Text style={styles.backupButtonText}>Comprobar JSON local</Text>
                </Pressable>
              </View>

              <View style={styles.toolsModalDisplaySection}>
                <Text style={styles.displayModeLabel}>Vista de Biblioteca</Text>
                <View style={styles.displayModeInline}>
                  <Pressable
                    onPress={() => setLibraryView("cards")}
                    accessibilityRole="button"
                    accessibilityState={{ selected: libraryView === "cards" }}
                    style={[
                      styles.displayModeButton,
                      libraryView === "cards" && styles.displayModeButtonActive,
                    ]}
                  >
                    <Ionicons
                      name="grid-outline"
                      size={15}
                      color={libraryView === "cards" ? "#fff" : "#475569"}
                    />
                    <Text
                      style={[
                        styles.displayModeText,
                        libraryView === "cards" && styles.displayModeTextActive,
                      ]}
                    >
                      Cards
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setLibraryView("minimal")}
                    accessibilityRole="button"
                    accessibilityState={{ selected: libraryView === "minimal" }}
                    style={[
                      styles.displayModeButton,
                      libraryView === "minimal" && styles.displayModeButtonActive,
                    ]}
                  >
                    <Ionicons
                      name="list-outline"
                      size={15}
                      color={libraryView === "minimal" ? "#fff" : "#475569"}
                    />
                    <Text
                      style={[
                        styles.displayModeText,
                        libraryView === "minimal" && styles.displayModeTextActive,
                      ]}
                    >
                      Minimal
                    </Text>
                  </Pressable>
                </View>
                <View style={styles.toolsHashtagSection}>
                  <Text style={styles.displayModeLabel}>Hashtags</Text>
                  <Pressable
                    onPress={() => {
                      setToolsModalVisible(false);
                      setHashtagModalVisible(true);
                    }}
                    style={[styles.backupButton, styles.toolsModalActionButton]}
                    accessibilityLabel="Mostrar todos los hashtags de noticias"
                  >
                    <Ionicons name="pricetags-outline" size={17} color="#2563eb" />
                    <Text style={styles.backupButtonText}>
                      Hashtags de noticias
                      {Array.isArray(globalHashtags)
                        ? ` (${globalHashtags.length})`
                        : ""}
                    </Text>
                  </Pressable>
                  <Text style={styles.toolsHashtagEmpty}>
                    Lista global, independiente de la carpeta o filtro actual.
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={hashtagModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setHashtagModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, styles.hashtagCatalogModalCard]}>
              <View style={styles.hashtagCatalogHeader}>
                <View style={styles.hashtagCatalogTitleRow}>
                  <Ionicons name="pricetags-outline" size={20} color="#2563eb" />
                  <Text style={styles.hashtagCatalogTitle}>Hashtags de noticias</Text>
                </View>
                <Pressable
                  onPress={() => setHashtagModalVisible(false)}
                  style={styles.iconButton}
                  accessibilityLabel="Cerrar hashtags"
                >
                  <Ionicons name="close" size={22} color="#475569" />
                </Pressable>
              </View>

              <Text style={styles.hashtagCatalogSubtitle}>
                Los hashtags se guardan sin # y se muestran con el símbolo en pantalla.
              </Text>

              {Array.isArray(globalHashtags) ? (
                <>
                  <View style={styles.hashtagCatalogSearchRow}>
                    <Ionicons name="search-outline" size={18} color="#64748b" />
                    <TextInput
                      value={hashtagSearch}
                      onChangeText={setHashtagSearch}
                      placeholder="Buscar hashtag…"
                      placeholderTextColor="#94a3b8"
                      style={[
                        styles.hashtagCatalogSearchInput,
                        Platform.OS === "web" && styles.webInputNoOutline,
                      ]}
                      autoCorrect={false}
                    />
                    {hashtagSearch ? (
                      <Pressable
                        onPress={() => setHashtagSearch("")}
                        accessibilityLabel="Limpiar búsqueda de hashtags"
                      >
                        <Ionicons name="close-circle" size={19} color="#94a3b8" />
                      </Pressable>
                    ) : null}
                  </View>

                  <View style={styles.hashtagCatalogSummaryRow}>
                    <Text style={styles.hashtagCatalogSummary}>
                      {globalHashtags.length} hashtags distintos
                    </Text>
                    <Pressable
                      onPress={() => {
                        setGlobalHashtags(null);
                        setHashtagSearch("");
                      }}
                      accessibilityLabel="Actualizar lista de hashtags"
                    >
                      <Text style={styles.hashtagCatalogRefresh}>Actualizar</Text>
                    </Pressable>
                  </View>

                  <ScrollView
                    style={styles.hashtagCatalogList}
                    contentContainerStyle={styles.hashtagCatalogListContent}
                    nestedScrollEnabled
                  >
                    {filteredGlobalHashtags.map((entry) => {
                      const { tag, count } = entry;
                      return (
                      <Pressable
                        key={tag}
                        onPress={() => selectHashtag(entry)}
                        style={styles.toolsHashtagChip}
                        accessibilityLabel={`Filtrar por #${tag}, ${count} noticias`}
                      >
                        <Text style={styles.toolsHashtagText}>#{tag}</Text>
                        <Text style={styles.toolsHashtagCount}>{count}</Text>
                      </Pressable>
                      );
                    })}
                    {!filteredGlobalHashtags.length ? (
                      <Text style={styles.toolsHashtagEmpty}>
                        No hay hashtags que coincidan con la búsqueda.
                      </Text>
                    ) : null}
                  </ScrollView>
                </>
              ) : (
                <HashtagCatalogLoader onLoaded={setGlobalHashtags} />
              )}
            </View>
          </View>
        </Modal>

        <Modal
          visible={newsSortModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setNewsSortModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, styles.newsSortModalCard]}>
              <View style={styles.newsSortModalHeader}>
                <View style={styles.toolsModalTitleRow}>
                  <Ionicons
                    name="swap-vertical-outline"
                    size={19}
                    color="#dc2626"
                  />
                  <Text style={styles.toolsModalTitle}>
                    {isNewsArticleList ? "Ordenar noticias" : "Ordenar enlaces"}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setNewsSortModalVisible(false)}
                  style={styles.toolsModalClose}
                  accessibilityLabel="Cerrar opciones de ordenación"
                >
                  <Ionicons name="close" size={21} color="#475569" />
                </Pressable>
              </View>
              <Text style={styles.newsSortHint}>
                La fecha de publicación es la fecha del artículo; la fecha de
                incorporación es cuando se guardó en Biblioteca.
              </Text>
              <View style={styles.newsSortOptionList}>
                {NEWS_SORT_OPTIONS.map((option) => {
                  const active = option.id === newsSort;
                  return (
                    <Pressable
                      key={option.id}
                      onPress={() => {
                        setNewsSort(option.id);
                        setNewsSortModalVisible(false);
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      style={[
                        styles.newsSortOption,
                        active && styles.newsSortOptionActive,
                      ]}
                    >
                      <Ionicons
                        name={active ? "radio-button-on" : "radio-button-off"}
                        size={20}
                        color={active ? "#dc2626" : "#94a3b8"}
                      />
                      <Ionicons
                        name={option.icon}
                        size={18}
                        color={active ? "#dc2626" : "#475569"}
                      />
                      <View style={styles.newsSortOptionText}>
                        <Text
                          style={[
                            styles.newsSortOptionLabel,
                            active && styles.newsSortOptionLabelActive,
                          ]}
                        >
                          {option.label}
                        </Text>
                        <Text style={styles.newsSortOptionDescription}>
                          {option.description}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        </Modal>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.folderScroll}
          contentContainerStyle={styles.folderBar}
        >
          {filters.map((folder) => {
            const id = String(folder._id);
            const active = folderFilter === id;
            return (
              <Pressable
                key={id}
                onPress={() => selectLibraryFilter(id)}
                style={[styles.folderChip, active && styles.folderChipActive]}
              >
                <Ionicons
                  name={getFolderTabIcon(folder)}
                  size={15}
                  color={active ? "#fff" : getFolderTabColor(folder)}
                />
                <Text
                  style={[styles.folderText, active && styles.folderTextActive]}
                >
                  {folder.name}
                </Text>
              </Pressable>
            );
          })}
          {!isSourceCatalog ? (
            <Pressable
              onPress={() => {
                setEditingFolder(null);
                setCreatingFolder(true);
              }}
              style={styles.newFolderChip}
            >
              <Ionicons name="folder-open-outline" size={15} color="#2563eb" />
              <Text style={styles.newFolderText}>Nueva categoría</Text>
            </Pressable>
          ) : null}
        </ScrollView>

        {selectedHashtagFilter ? (
          <View style={styles.activeHashtagFilterBar}>
            <View style={styles.activeHashtagFilterInfo}>
              <Ionicons name="pricetag-outline" size={15} color="#1d4ed8" />
              <Text style={styles.activeHashtagFilterText}>
                Filtro exacto: #{selectedHashtagFilter.tag}
              </Text>
              <Text style={styles.activeHashtagFilterCount}>
                {selectedHashtagTotal.toLocaleString("es-ES")}
              </Text>
            </View>
            <Pressable
              onPress={showNewsArticles}
              style={styles.activeHashtagFilterClear}
              accessibilityLabel={`Quitar filtro #${selectedHashtagFilter.tag} y mostrar noticias`}
            >
              <Ionicons name="close" size={17} color="#1d4ed8" />
              <Text style={styles.activeHashtagFilterClearText}>Mostrar noticias</Text>
            </Pressable>
          </View>
        ) : null}

        {creatingFolder ? (
          <View style={styles.folderEditor}>
            <View style={styles.folderEditorHeader}>
              <Ionicons
                name="folder-open-outline"
                size={17}
                color={selectedFolder?.color || "#2563eb"}
              />
              <Text style={styles.folderEditorTitle}>Nueva categoría</Text>
            </View>
            <View style={styles.folderEditorRow}>
              <TextInput
                value={folderName}
                onChangeText={setFolderName}
                placeholder="Nombre de la categoría"
                placeholderTextColor="#94a3b8"
                style={styles.folderEditorInput}
                maxLength={50}
                autoFocus
                onSubmitEditing={handleCreateFolder}
              />
              <Pressable
                onPress={() => {
                  setCreatingFolder(false);
                  setFolderName("");
                }}
                style={styles.folderEditorCancel}
              >
                <Ionicons name="close" size={20} color="#64748b" />
              </Pressable>
              <Pressable
                onPress={handleCreateFolder}
                disabled={!folderName.trim() || saving}
                style={[
                  styles.folderEditorSave,
                  (!folderName.trim() || saving) && styles.buttonDisabled,
                ]}
              >
                <Ionicons name="checkmark" size={20} color="#fff" />
                <Text style={styles.folderEditorSaveText}>Crear</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* Las subcategorías se conservan en datos antiguos, pero ya no se muestran. */}
        {false && editingFolder ? (
          <View style={styles.folderEditor}>
            <View style={styles.folderEditorHeader}>
              <Ionicons name="create-outline" size={17} color="#2563eb" />
              <Text style={styles.folderEditorTitle}>Editar subcategoría</Text>
            </View>
            <View style={styles.folderEditorRow}>
              <TextInput
                value={editingFolderName}
                onChangeText={setEditingFolderName}
                placeholder="Nombre de la subcategoría"
                placeholderTextColor="#94a3b8"
                style={styles.folderEditorInput}
                maxLength={50}
                autoFocus
                onSubmitEditing={handleUpdateFolder}
              />
              <Pressable
                onPress={confirmRemoveFolder}
                disabled={saving}
                style={styles.folderEditorDelete}
              >
                <Ionicons name="trash-outline" size={19} color="#dc2626" />
              </Pressable>
              <Pressable
                onPress={() => setEditingFolder(null)}
                style={styles.folderEditorCancel}
              >
                <Ionicons name="close" size={20} color="#64748b" />
              </Pressable>
              <Pressable
                onPress={handleUpdateFolder}
                disabled={!editingFolderName.trim() || saving}
                style={[
                  styles.folderEditorSave,
                  (!editingFolderName.trim() || saving) &&
                    styles.buttonDisabled,
                ]}
              >
                <Ionicons name="checkmark" size={20} color="#fff" />
                <Text style={styles.folderEditorSaveText}>Guardar</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {false &&
        childFolders.length &&
        (!isNewsFolder || newsView === "articles") ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.subfolderScroll}
            contentContainerStyle={styles.subfolderBar}
          >
            {[
              { _id: "all", name: "Todos", icon: "apps-outline" },
              ...childFolders,
            ].map((folder) => {
              const id = String(folder._id);
              const active = subfolderFilter === id;
              return (
                <View
                  key={id}
                  style={[
                    styles.subfolderChip,
                    active && styles.subfolderChipActive,
                  ]}
                >
                  <Pressable
                    onPress={() => setSubfolderFilter(id)}
                    style={styles.subfolderMain}
                  >
                    <Ionicons
                      name={folder.icon || "folder-outline"}
                      size={14}
                      color={active ? "#fff" : folder.color || "#2563eb"}
                    />
                    <Text
                      style={[
                        styles.subfolderText,
                        active && styles.subfolderTextActive,
                      ]}
                    >
                      {folder.name}
                    </Text>
                  </Pressable>
                  {id !== "all" ? (
                    <Pressable
                      onPress={() => openFolderEditor(folder)}
                      style={styles.subfolderEdit}
                    >
                      <Ionicons
                        name="pencil"
                        size={12}
                        color={active ? "#fff" : "#2563eb"}
                      />
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </ScrollView>
        ) : null}

        {isCatalogFolder ? (
          <View style={styles.newsTabs}>
            <Pressable
              onPress={() => {
                selectNewsView("sources");
                setCreatingFolder(false);
                setEditingFolder(null);
              }}
              style={[
                styles.newsTab,
                newsView === "sources" && styles.newsTabActive,
              ]}
            >
              <Ionicons
                name={
                  isBooksFolder ? "storefront-outline" : "newspaper-outline"
                }
                size={16}
                color={newsView === "sources" ? "#fff" : "#475569"}
              />
              <Text
                style={[
                  styles.newsTabText,
                  newsView === "sources" && styles.newsTabTextActive,
                ]}
              >
                {isBooksFolder ? "Tiendas de libros" : "Periódicos"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => selectNewsView("articles")}
              style={[
                styles.newsTab,
                newsView === "articles" && styles.newsTabActive,
              ]}
            >
              <Ionicons
                name={isBooksFolder ? "book-outline" : "bookmark-outline"}
                size={16}
                color={newsView === "articles" ? "#fff" : "#475569"}
              />
              <Text
                style={[
                  styles.newsTabText,
                  newsView === "articles" && styles.newsTabTextActive,
                ]}
              >
                {isBooksFolder ? "Libros guardados" : "Noticias guardadas"}
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.shownItemsBar}>
          <Ionicons name="list-outline" size={15} color="#2563eb" />
          <View style={styles.shownItemsSummary}>
            <Text style={styles.shownItemsText} numberOfLines={1}>
              {isSearchingLibrary
                ? `${shownItemCount} de ${searchTotal} coincidencias`
                : `${shownItemCount} ${shownItemLabel}`}
            </Text>
            {displayedPostsDateRange ? (
              <Text style={styles.shownItemsDateRange} numberOfLines={1}>
                {displayedPostsDateRange}
              </Text>
            ) : null}
          </View>
          {canSortCurrentList ? (
            <Pressable
              onPress={() => setNewsSortModalVisible(true)}
              style={styles.newsSortTrigger}
              accessibilityRole="button"
              accessibilityLabel="Cambiar orden de noticias"
            >
              <Ionicons
                name="swap-vertical-outline"
                size={14}
                color="#b91c1c"
              />
              <Text style={styles.newsSortTriggerText} numberOfLines={1}>
                {selectedNewsSort.shortLabel}
              </Text>
            </Pressable>
          ) : null}
          {showPagination ? (
            <View style={styles.searchPaginationInline}>
              <Pressable
                onPress={() => {
                  if (isSearchingLibrary) {
                    setSearchPage((page) => Math.max(0, page - 1));
                  } else {
                    setBrowsePage((page) => Math.max(0, page - 1));
                  }
                }}
                disabled={activePage === 0}
                style={[
                  styles.searchPaginationInlineButton,
                  activePage === 0 && styles.buttonDisabled,
                ]}
                accessibilityLabel="Página anterior"
              >
                <Ionicons name="chevron-back" size={17} color="#2563eb" />
              </Pressable>
              <Text style={styles.searchPaginationInlineText}>
                {displayedTotalPages
                  ? `${activePage + 1}/${displayedTotalPages}`
                  : activePage + 1}
              </Text>
              <Pressable
                onPress={() => {
                  if (isSearchingLibrary) {
                    setSearchPage((page) =>
                      Math.min(searchTotalPages - 1, page + 1),
                    );
                    return;
                  }
                  const nextCursor = libraryResult?.continueCursor;
                  if (!nextCursor) return;
                  setBrowseCursors((current) => {
                    const next = current.slice(0, browsePage + 1);
                    next.push(nextCursor);
                    return next;
                  });
                  setBrowsePage((page) => page + 1);
                }}
                disabled={
                  isSearchingLibrary
                    ? activeSearchPage >= searchTotalPages - 1
                    : !browseHasNextPage
                }
                style={[
                  styles.searchPaginationInlineButton,
                  ((isSearchingLibrary &&
                    activeSearchPage >= searchTotalPages - 1) ||
                    (!isSearchingLibrary && !browseHasNextPage)) &&
                    styles.buttonDisabled,
                ]}
                accessibilityLabel="Página siguiente"
              >
                <Ionicons
                  name="chevron-forward"
                  size={17}
                  color="#2563eb"
                />
              </Pressable>
            </View>
          ) : null}
        </View>

        <FlatList
          key={
            isSourceCatalog
              ? `source-catalog-${libraryView}`
              : `library-links-${libraryView}-${cardColumns}-${newsSort}-${searchPage}`
          }
          data={links || []}
          horizontal={isSourceCatalogCards}
          numColumns={
            isSourceCatalog || libraryView === "minimal" ? 1 : cardColumns
          }
          columnWrapperStyle={
            !isSourceCatalog && libraryView === "cards" && cardColumns > 1
              ? styles.linkRow
              : undefined
          }
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => String(item._id)}
          style={[
            styles.list,
            isSourceCatalog && styles.sourceList,
            isSourceCatalogMinimal && styles.sourceListMinimal,
          ]}
          initialNumToRender={libraryView === "minimal" ? 12 : 6}
          maxToRenderPerBatch={libraryView === "minimal" ? 12 : 6}
          windowSize={5}
          removeClippedSubviews
          contentContainerStyle={[
            isSourceCatalogCards
              ? styles.sourceListContent
              : isSourceCatalogMinimal
                ? styles.sourceMinimalContent
                : styles.listContent,
            links?.length === 0 && styles.listEmpty,
          ]}
          renderItem={({ item }) => {
            const folder = item.folderId
              ? folderById.get(String(item.folderId))
              : null;
            if (isSourceCatalog) {
              if (libraryView === "minimal") {
                return (
                  <View style={styles.sourceMinimalRow}>
                    <Pressable
                      onPress={() => openSourceUrl(item.normalizedUrl)}
                      style={styles.sourceMinimalMain}
                    >
                      <View style={styles.sourceMinimalIcon}>
                        {isBooksFolder ? (
                          <Ionicons
                            name="storefront-outline"
                            size={22}
                            color="#7c3aed"
                          />
                        ) : (
                          <DomainFavicon
                            hostname={item.sourceDomain || item.hostname}
                          />
                        )}
                      </View>
                      <View style={styles.sourceMinimalText}>
                        <Text
                          style={styles.sourceMinimalTitle}
                          numberOfLines={1}
                        >
                          {item.customTitle || item.hostname}
                        </Text>
                        <Text
                          style={styles.sourceMinimalDomain}
                          numberOfLines={1}
                        >
                          {item.sourceDomain || item.hostname}
                        </Text>
                        <Text style={styles.sourceMinimalUrl} numberOfLines={1}>
                          {item.normalizedUrl}
                        </Text>
                      </View>
                    </Pressable>
                    <View style={styles.sourceMinimalActions}>
                      <Pressable
                        onPress={() => openLinkActions(item)}
                        style={styles.sourceMinimalButton}
                        accessibilityLabel="Opciones"
                      >
                        <Ionicons name="ellipsis-horizontal" size={20} color="#475569" />
                      </Pressable>
                    </View>
                  </View>
                );
              }
              return (
                <View style={styles.sourceTile}>
                  <Pressable
                    onPress={() => openSourceUrl(item.normalizedUrl)}
                    style={styles.sourceTileMain}
                  >
                    <View style={styles.sourceTileIcon}>
                      {isBooksFolder ? (
                        <Ionicons
                          name="storefront-outline"
                          size={24}
                          color="#7c3aed"
                        />
                      ) : (
                        <DomainFavicon
                          hostname={item.sourceDomain || item.hostname}
                        />
                      )}
                    </View>
                    <Text style={styles.sourceTileTitle} numberOfLines={1}>
                      {item.customTitle || item.hostname}
                    </Text>
                    <Text style={styles.sourceTileDomain} numberOfLines={1}>
                      {item.sourceDomain || item.hostname}
                    </Text>
                    <Text style={styles.sourceTileUrl} numberOfLines={2}>
                      {item.normalizedUrl}
                    </Text>
                  </Pressable>
                  <View style={styles.sourceTileActions}>
                    <Pressable
                      onPress={() => openLinkActions(item)}
                      style={styles.sourceTileButton}
                      accessibilityLabel="Opciones"
                    >
                      <Ionicons name="ellipsis-horizontal" size={20} color="#475569" />
                    </Pressable>
                  </View>
                </View>
              );
            }
            if (!isSourceCatalog && libraryView === "minimal") {
              return (
                <View
                  style={[
                    styles.minimalLinkCard,
                    isInformaticaFolder(folder) && styles.minimalLinkCardDetailed,
                  ]}
                >
                  <View style={styles.minimalLinkMain}>
                  <Pressable
                    style={styles.minimalLinkOpenArea}
                    onPress={() => Linking.openURL(item.normalizedUrl)}
                    accessibilityLabel={`Abrir ${item.customTitle || getLinkDomain(item)}`}
                  >
                    <DomainFavicon hostname={getLinkDomain(item)} />
                    <View style={styles.minimalLinkText}>
                      <Text style={styles.minimalLinkDomain} numberOfLines={1}>
                        {getLinkDomain(item)}
                      </Text>
                      <MinimalLinkTitle
                        item={item}
                        previewMode={
                          isInformaticaFolder(folder) ? "document" : "default"
                        }
                      />
                      {formatLinkDate(
                        item.publishedAt || item.createdAt || item.updatedAt,
                      ) ? (
                        <Text style={styles.minimalLinkDate}>
                          {formatLinkDate(
                            item.publishedAt || item.createdAt || item.updatedAt,
                          )}
                        </Text>
                      ) : null}
                      {item.notes ? (
                        <Text style={styles.minimalLinkNotes} numberOfLines={2}>
                          {item.notes}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                  {item.hashtags?.length ? (
                    <View style={styles.minimalHashtagRow}>
                      {item.hashtags.map((tag) => (
                        <Pressable
                          key={tag}
                          onPress={() => startSearch(tag)}
                          accessibilityLabel={`Buscar #${tag}`}
                        >
                          <Text style={styles.minimalHashtag}>#{tag}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                  </View>
                  <View style={styles.minimalLinkActions}>
                    <Pressable
                      onPress={() => toggleFavorite({ linkId: item._id })}
                      style={styles.minimalLinkButton}
                      accessibilityLabel={item.favorite ? "Quitar de favoritos" : "Añadir a favoritos"}
                    >
                      <Ionicons
                        name={item.favorite ? "star" : "star-outline"}
                        size={17}
                        color={item.favorite ? "#eab308" : "#64748b"}
                      />
                    </Pressable>
                    <Pressable
                      onPress={() => openLinkActions(item)}
                      style={styles.minimalLinkButton}
                      accessibilityLabel="Más opciones"
                    >
                      <Ionicons name="ellipsis-horizontal" size={19} color="#475569" />
                    </Pressable>
                  </View>
                </View>
              );
            }
            return (
              <View style={styles.linkCard}>
                <WebPreviewCard url={item.normalizedUrl} compact dense />
                {["newsSource", "bookStore"].includes(item.linkType) &&
                item.customTitle ? (
                  <Text style={styles.sourceCustomTitle}>
                    {item.customTitle}
                  </Text>
                ) : null}
                {!["newsSource", "bookStore"].includes(item.linkType) &&
                item.notes ? (
                  <Text style={styles.linkNotes}>{item.notes}</Text>
                ) : null}
                {!["newsSource", "bookStore"].includes(item.linkType) &&
                item.hashtags?.length ? (
                  <View style={styles.hashtagRow}>
                    {item.hashtags.map((tag) => (
                      <Pressable key={tag} onPress={() => startSearch(tag)}>
                        <Text style={styles.hashtag}>#{tag}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                <View style={styles.actionsRow}>
                  <View style={styles.categoryBadge}>
                    <Ionicons
                      name={folder?.icon || "file-tray-outline"}
                      size={14}
                      color={folder?.color || "#64748b"}
                    />
                    <Text style={styles.categoryText} numberOfLines={1}>
                      {item.linkType === "newsSource"
                        ? `Periódico · ${item.sourceDomain || item.hostname}`
                        : item.linkType === "bookStore"
                          ? `Tienda de libros · ${item.sourceDomain || item.hostname}`
                          : item.linkType === "bookLink"
                            ? `Libro · ${item.sourceDomain || item.hostname}`
                            : item.linkType === "newsArticle"
                              ? `Noticia · ${item.sourceDomain || item.hostname}${""}`
                              : folder?.name === "Libros"
                                ? `Libro · ${item.sourceDomain || item.hostname}`
                                : folder?.name || "Sin clasificar"}
                    </Text>
                  </View>
                  <View style={styles.cardActionButtons}>
                    <Pressable
                      onPress={() => toggleFavorite({ linkId: item._id })}
                      style={styles.iconButton}
                      accessibilityLabel={item.favorite ? "Quitar de favoritos" : "Añadir a favoritos"}
                    >
                      <Ionicons
                        name={item.favorite ? "star" : "star-outline"}
                        size={18}
                        color={item.favorite ? "#eab308" : "#64748b"}
                      />
                    </Pressable>
                    <Pressable
                      onPress={() => openLinkActions(item)}
                      style={styles.iconButton}
                      accessibilityLabel="Más opciones"
                    >
                      <Ionicons name="ellipsis-horizontal" size={19} color="#475569" />
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="library-outline" size={46} color="#94a3b8" />
              <Text style={styles.emptyTitle}>
                {links === undefined ? "Cargando…" : "No hay enlaces"}
              </Text>
              <Text style={styles.emptyText}>
                {links === undefined
                  ? "Cargando los enlaces guardados…"
                  : "Añade una URL o selecciona otra categoría."}
              </Text>
            </View>
          }
        />

        <Modal
          visible={integrityReport?.kind === "local"}
          transparent
          animationType="fade"
          onRequestClose={closeIntegrityReport}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Integridad local del JSON</Text>
              <Text style={styles.integrityLocalHint}>
                Se ha analizado {integrityReport?.fileName || "la copia"} sin leer ni modificar Convex.
              </Text>
              <View style={styles.integritySummaryBox}>
                <Text style={styles.integritySummaryText}>
                  {integrityReport?.before?.totalLinks || 0} enlaces originales ·{" "}
                  {integrityReport?.after?.totalLinks || 0} en la copia reparada
                </Text>
                <Text style={styles.integritySummaryText}>
                  URL normalizadas: {integrityReport?.summary?.normalizedUrls || 0} · Duplicados eliminados: {integrityReport?.summary?.duplicatesRemoved || 0}
                </Text>
                <Text style={styles.integritySummaryText}>
                  Tipos corregidos: {integrityReport?.summary?.typeCorrections || 0} · Periódicos añadidos: {integrityReport?.summary?.sourcesAdded || 0}
                </Text>
              </View>
              {integrityReport?.before?.missingSourceDomains?.length ? (
                <View style={styles.integrityWarningBox}>
                  <Text style={styles.integrityWarning}>
                    Dominios que no tenían periódico antes de la reparación:{" "}
                    {integrityReport.before.missingSourceDomains.length}
                  </Text>
                  <ScrollView
                    style={styles.integrityDomainList}
                    nestedScrollEnabled
                  >
                    <Text style={styles.integrityDomainText}>
                      {integrityReport.before.missingSourceDomains.join(", ")}
                    </Text>
                  </ScrollView>
                </View>
              ) : (
                <Text style={styles.integrityOk}>
                  Todos los dominios de noticias ya tenían periódico.
                </Text>
              )}
              {integrityReport?.summary?.invalidUrls ? (
                <Text style={styles.integrityWarningLegacy}>
                  Enlaces descartados por URL no válida: {integrityReport.summary.invalidUrls}
                </Text>
              ) : null}
              <Text style={styles.fieldLabel}>Enlaces reparados por categoría</Text>
              <View style={styles.integritySearchRow}>
                <Ionicons name="search-outline" size={16} color="#64748b" />
                <TextInput
                  value={integritySearch}
                  onChangeText={setIntegritySearch}
                  placeholder="Buscar categoría o dominio..."
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[
                    styles.integritySearchInput,
                    Platform.OS === "web" && styles.webInputNoOutline,
                  ]}
                />
                {integritySearch ? (
                  <Pressable
                    onPress={() => setIntegritySearch("")}
                    hitSlop={8}
                    accessibilityLabel="Limpiar búsqueda de categorías"
                  >
                    <Ionicons name="close-circle" size={18} color="#94a3b8" />
                  </Pressable>
                ) : null}
              </View>
              <ScrollView style={styles.integrityCategoryList}>
                {filteredIntegrityCategoryCounts.length ? (
                  filteredIntegrityCategoryCounts.map(([category, count]) => (
                    <View key={category} style={styles.integrityCategoryRow}>
                      <Text
                        style={styles.integrityCategoryName}
                        numberOfLines={1}
                      >
                        {category}
                      </Text>
                      <Text style={styles.integrityCategoryCount}>{count}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.integrityEmptySearch}>
                    No hay categorías que coincidan.
                  </Text>
                )}
              </ScrollView>
              <View style={styles.modalActions}>
                <Pressable
                  onPress={downloadRepairedIntegrityBackup}
                  disabled={backupBusy}
                  style={[styles.backupButton, styles.integrityDownloadButton, backupBusy && styles.buttonDisabled]}
                >
                  <Ionicons name="download-outline" size={17} color="#047857" />
                  <Text style={styles.integrityButtonText}>Descargar JSON reparado</Text>
                </Pressable>
                <Pressable
                  onPress={closeIntegrityReport}
                  style={styles.saveButton}
                >
                  <Text style={styles.saveText}>Cerrar</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={integrityReport?.kind === "library"}
          transparent
          animationType="fade"
          onRequestClose={closeIntegrityReport}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Integridad de los enlaces</Text>
              <View style={styles.integritySummaryBox}>
                <Text style={styles.integritySummaryText}>
                  {integrityReport?.totalLinks || 0} enlaces ·{" "}
                  {integrityReport?.newsPosts || 0} noticias ·{" "}
                  {integrityReport?.newsSources || 0} periódicos
                </Text>
                <Text style={styles.integritySummaryText}>
                  Periódicos añadidos: {integrityReport?.addedSources || 0}
                </Text>
                <Text style={styles.integritySummaryText}>
                  Posts corregidos: {integrityReport?.correctedPosts || 0}
                </Text>
                <Text style={styles.integritySummaryText}>
                  URL normalizadas: {integrityReport?.normalizedCount || 0} ·{" "}
                  Duplicados eliminados: {integrityReport?.duplicatesRemoved || 0}
                </Text>
                <Text style={styles.integritySummaryText}>
                  Hashtags añadidos desde títulos: {integrityReport?.titleHashtagsAdded || 0} ·{" "}
                  Noticias actualizadas: {integrityReport?.hashtagUpdated || 0}
                </Text>
              </View>
              {integrityReport?.missingSourceDomains?.length ? (
                <View style={styles.integrityWarningBox}>
                  <Text style={styles.integrityWarning}>
                    Dominios que requerían periódico antes de la reparación:{" "}
                    {integrityReport.missingSourceDomains.length}
                  </Text>
                  <ScrollView
                    style={styles.integrityDomainList}
                    nestedScrollEnabled
                  >
                    <Text style={styles.integrityDomainText}>
                      {integrityReport.missingSourceDomains.join(", ")}
                    </Text>
                  </ScrollView>
                </View>
              ) : (
                <Text style={styles.integrityOk}>
                  Todos los dominios de noticias tenían periódico.
                </Text>
              )}
              <Text style={styles.fieldLabel}>Posts por categoría</Text>
              <View style={styles.integritySearchRow}>
                <Ionicons name="search-outline" size={16} color="#64748b" />
                <TextInput
                  value={integritySearch}
                  onChangeText={setIntegritySearch}
                  placeholder="Buscar categoría o dominio..."
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[
                    styles.integritySearchInput,
                    Platform.OS === "web" && styles.webInputNoOutline,
                  ]}
                />
                {integritySearch ? (
                  <Pressable
                    onPress={() => setIntegritySearch("")}
                    hitSlop={8}
                    accessibilityLabel="Limpiar búsqueda de categorías"
                  >
                    <Ionicons name="close-circle" size={18} color="#94a3b8" />
                  </Pressable>
                ) : null}
              </View>
              <ScrollView style={styles.integrityCategoryList}>
                {filteredIntegrityCategoryCounts.length ? (
                  filteredIntegrityCategoryCounts.map(([category, count]) => (
                    <View key={category} style={styles.integrityCategoryRow}>
                      <Text
                        style={styles.integrityCategoryName}
                        numberOfLines={1}
                      >
                        {category}
                      </Text>
                      <Text style={styles.integrityCategoryCount}>{count}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.integrityEmptySearch}>
                    No hay categorías que coincidan.
                  </Text>
                )}
              </ScrollView>
              <View style={styles.modalActions}>
                <Pressable
                  onPress={closeIntegrityReport}
                  style={styles.saveButton}
                >
                  <Text style={styles.saveText}>Cerrar</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={exportNameVisible}
          transparent
          animationType="fade"
          onRequestClose={closeExportReview}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, styles.importModalCard]}>
              <ScrollView
                style={styles.importModalScroll}
                contentContainerStyle={styles.importModalContent}
                showsVerticalScrollIndicator
              >
                <Text style={styles.modalTitle}>Exportar Biblioteca</Text>

                <Text style={styles.fieldLabel}>Nombre del archivo JSON</Text>
                <TextInput
                  value={exportFilename}
                  onChangeText={setExportFilename}
                  placeholder="shopp-biblioteca.json"
                  placeholderTextColor="#94a3b8"
                  style={styles.modalInput}
                  autoCorrect={false}
                  autoCapitalize="none"
                  maxLength={120}
                  autoFocus={exportNameVisible}
                  selectTextOnFocus
                  onSubmitEditing={performExportBackup}
                />
                <Text style={styles.fieldHelp}>
                  Si omites la extensión, se añadirá automáticamente .json.
                </Text>

                {importReview?.isHistoricalNewsArray ? (
                  <Text style={styles.fieldHelp}>
                    Formato histórico detectado: se importará como Noticias,
                    usando comments como comentario y conservando hashtags.
                    {importReview.skippedHistoricalCount
                      ? ` ${importReview.skippedHistoricalCount} elementos sin URL válida se omitirán.`
                      : ""}
                  </Text>
                ) : null}

                <Text style={styles.fieldLabel}>Informe del contenido</Text>
                <View style={styles.importSummaryBox}>
                  <View style={styles.importSummaryRow}>
                    <Ionicons name="folder-outline" size={17} color="#2563eb" />
                    <Text style={styles.importSummaryText}>
                      {exportReview?.folderCount || 0} carpetas
                    </Text>
                  </View>
                  <View style={styles.importSummaryRow}>
                    <Ionicons name="link-outline" size={17} color="#2563eb" />
                    <Text style={styles.importSummaryText}>
                      {exportReview?.linkCount || 0} enlaces en total
                    </Text>
                  </View>
                  <View style={styles.importSummaryRow}>
                    <Ionicons
                      name="newspaper-outline"
                      size={17}
                      color="#dc2626"
                    />
                    <Text style={styles.importSummaryText}>
                      {exportReview?.sourceCount || 0} periódicos o tiendas de
                      libros
                    </Text>
                  </View>
                  <View style={styles.importSummaryRow}>
                    <Ionicons
                      name="bookmark-outline"
                      size={17}
                      color="#7c3aed"
                    />
                    <Text style={styles.importSummaryText}>
                      {exportReview?.savedLinkCount || 0} enlaces guardados
                    </Text>
                  </View>
                </View>

                <Text style={styles.fieldLabel}>Categorías a exportar</Text>
                <Text style={styles.fieldHelp}>
                  Elige todas las categorías o solo las que quieras incluir. Las
                  subcategorías se exportan con su categoría principal.
                </Text>

                <View style={styles.importCategoryList}>
                  <ImportCheckbox
                    checked={allExportCategoriesSelected}
                    label="Todas las categorías"
                    detail={`${exportReview?.linkCount || 0} enlaces`}
                    icon="apps-outline"
                    color="#2563eb"
                    onPress={() =>
                      setSelectedExportCategoryKeys(
                        allExportCategoriesSelected
                          ? []
                          : exportCategories.map((category) => category.key),
                      )
                    }
                    disabled={exportCategories.length === 0}
                  />
                  {exportCatalogSources ? (
                    <ImportCheckbox
                      checked={selectedExportCategoryKeys.includes(
                        exportCatalogSources.key,
                      )}
                      label={exportCatalogSources.name}
                      detail={`${exportCatalogSources.linkCount} periódicos o tiendas de libros`}
                      icon={exportCatalogSources.icon}
                      color={exportCatalogSources.color}
                      onPress={() =>
                        toggleExportCategory(exportCatalogSources.key)
                      }
                    />
                  ) : null}
                  {exportFolderCategories.map((category) => (
                    <ImportCheckbox
                      key={category.key}
                      checked={selectedExportCategoryKeys.includes(
                        category.key,
                      )}
                      label={category.name}
                      detail={`${category.linkCount} ${category.linkCount === 1 ? "enlace" : "enlaces"}`}
                      icon={category.icon}
                      color={category.color}
                      onPress={() => toggleExportCategory(category.key)}
                    />
                  ))}
                </View>

                <Text style={styles.importSelectionHelp}>
                  Se exportarán {selectedExportLinkCount} enlaces. La copia
                  mantendrá el formato compatible de Biblioteca.
                </Text>
              </ScrollView>

              <View style={styles.modalActions}>
                <Pressable
                  onPress={closeExportReview}
                  disabled={backupBusy}
                  style={styles.cancelButton}
                >
                  <Text style={styles.cancelText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  onPress={performExportBackup}
                  disabled={
                    backupBusy ||
                    !normalizeBackupFilename(exportFilename) ||
                    (exportCategories.length > 0 &&
                      selectedExportCategoryKeys.length === 0)
                  }
                  style={[
                    styles.saveButton,
                    styles.exportConfirmButton,
                    (backupBusy ||
                      !normalizeBackupFilename(exportFilename) ||
                      (exportCategories.length > 0 &&
                        selectedExportCategoryKeys.length === 0)) &&
                      styles.buttonDisabled,
                  ]}
                >
                  <Ionicons
                    name="cloud-upload-outline"
                    size={17}
                    color="#fff"
                  />
                  <Text style={styles.saveText}>
                    {backupBusy ? "Exportando…" : "Exportar seleccionados"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={Boolean(importReview)}
          transparent
          animationType="fade"
          onRequestClose={closeImportReview}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, styles.importModalCard]}>
              <ScrollView
                style={styles.importModalScroll}
                contentContainerStyle={styles.importModalContent}
                showsVerticalScrollIndicator
              >
                <Text style={styles.modalTitle}>Importar Biblioteca</Text>

                <Text style={styles.fieldLabel}>Fichero seleccionado</Text>
                <View style={styles.importFileBox}>
                  <Ionicons
                    name="document-text-outline"
                    size={20}
                    color="#2563eb"
                  />
                  <Text style={styles.importFileName} numberOfLines={2}>
                    {importReview?.fileName}
                  </Text>
                </View>

                <Text style={styles.fieldLabel}>Informe del contenido</Text>
                <View style={styles.importSummaryBox}>
                  <View style={styles.importSummaryRow}>
                    <Ionicons name="folder-outline" size={17} color="#2563eb" />
                    <Text style={styles.importSummaryText}>
                      {importReview?.folderCount || 0} carpetas
                    </Text>
                  </View>
                  <View style={styles.importSummaryRow}>
                    <Ionicons name="link-outline" size={17} color="#2563eb" />
                    <Text style={styles.importSummaryText}>
                      {importReview?.linkCount || 0} enlaces en total
                    </Text>
                  </View>
                  <View style={styles.importSummaryRow}>
                    <Ionicons
                      name="newspaper-outline"
                      size={17}
                      color="#dc2626"
                    />
                    <Text style={styles.importSummaryText}>
                      {importReview?.sourceCount || 0} periódicos o tiendas de
                      libros
                    </Text>
                  </View>
                  <View style={styles.importSummaryRow}>
                    <Ionicons
                      name="bookmark-outline"
                      size={17}
                      color="#7c3aed"
                    />
                    <Text style={styles.importSummaryText}>
                      {importReview?.savedLinkCount || 0} enlaces guardados
                    </Text>
                  </View>
                </View>

                <Text style={styles.fieldLabel}>Categorías a importar</Text>
                <Text style={styles.fieldHelp}>
                  Elige todas las categorías o solo las que quieras añadir. Las
                  subcategorías se incluyen con su categoría principal.
                </Text>

                <View style={styles.importCategoryList}>
                  <ImportCheckbox
                    checked={allImportCategoriesSelected}
                    label="Todas las categorías"
                    detail={`${importReview?.linkCount || 0} enlaces`}
                    icon="apps-outline"
                    color="#2563eb"
                    onPress={() =>
                      setSelectedImportCategoryKeys(
                        allImportCategoriesSelected
                          ? []
                          : importCategories.map((category) => category.key),
                      )
                    }
                    disabled={importCategories.length === 0}
                  />
                  {importCatalogSources ? (
                    <ImportCheckbox
                      checked={selectedImportCategoryKeys.includes(
                        importCatalogSources.key,
                      )}
                      label={importCatalogSources.name}
                      detail={`${importCatalogSources.linkCount} periódicos o tiendas de libros`}
                      icon={importCatalogSources.icon}
                      color={importCatalogSources.color}
                      onPress={() =>
                        toggleImportCategory(importCatalogSources.key)
                      }
                    />
                  ) : null}
                  {importFolderCategories.map((category) => (
                    <ImportCheckbox
                      key={category.key}
                      checked={selectedImportCategoryKeys.includes(
                        category.key,
                      )}
                      label={category.name}
                      detail={`${category.linkCount} ${category.linkCount === 1 ? "enlace" : "enlaces"}`}
                      icon={category.icon}
                      color={category.color}
                      onPress={() => toggleImportCategory(category.key)}
                    />
                  ))}
                </View>

                <Text style={styles.importSelectionHelp}>
                  {importMode === "replace"
                    ? "Se eliminarán los datos actuales y se conservarán únicamente los elementos seleccionados."
                    : "Se combinarán los elementos seleccionados. Los datos actuales se conservarán y las URL repetidas se actualizarán."}
                </Text>

                <Text style={styles.fieldLabel}>Noticias</Text>
                <View style={styles.importCategoryList}>
                  <ImportCheckbox
                    checked={
                      enrichNewsOnImport && !importMetadataEnrichmentDisabled
                    }
                    label="Actualizar título y fecha"
                    detail={
                      importMetadataEnrichmentDisabled
                        ? `Desactivado para importaciones de más de ${IMPORT_ENRICH_LIMIT.toLocaleString("es-ES")} enlaces. Evita miles de consultas web y hace la importación mucho más estable.`
                        : "Lee metadatos HTML de cada noticia seleccionada antes de guardarla."
                    }
                    icon="sparkles-outline"
                    color="#dc2626"
                    disabled={importMetadataEnrichmentDisabled}
                    onPress={() => setEnrichNewsOnImport((value) => !value)}
                  />
                </View>

                <Text style={styles.fieldLabel}>Modo de importación</Text>
                <View style={styles.importModeList}>
                  <Pressable
                    onPress={() => setImportMode("combine")}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: importMode === "combine" }}
                    style={[
                      styles.importModeOption,
                      importMode === "combine" && styles.importModeSelected,
                    ]}
                  >
                    <Ionicons
                      name={
                        importMode === "combine"
                          ? "radio-button-on"
                          : "radio-button-off"
                      }
                      size={20}
                      color={importMode === "combine" ? "#2563eb" : "#94a3b8"}
                    />
                    <View style={styles.importOptionText}>
                      <Text style={styles.importOptionLabel}>Combinar</Text>
                      <Text style={styles.importOptionDetail}>
                        Conserva YouTube, El País y el resto de datos actuales.
                      </Text>
                    </View>
                  </Pressable>
                  <Pressable
                    onPress={() => setImportMode("replace")}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: importMode === "replace" }}
                    style={[
                      styles.importModeOption,
                      importMode === "replace" &&
                        styles.importModeReplaceSelected,
                    ]}
                  >
                    <Ionicons
                      name={
                        importMode === "replace"
                          ? "radio-button-on"
                          : "radio-button-off"
                      }
                      size={20}
                      color={importMode === "replace" ? "#dc2626" : "#94a3b8"}
                    />
                    <View style={styles.importOptionText}>
                      <Text style={styles.importOptionLabel}>
                        Reemplazar Biblioteca
                      </Text>
                      <Text style={styles.importOptionDetail}>
                        Elimina lo actual y deja solo lo seleccionado.
                      </Text>
                    </View>
                  </Pressable>
                </View>
              </ScrollView>

              <View style={styles.modalActions}>
                <Pressable
                  onPress={closeImportReview}
                  disabled={backupBusy}
                  style={styles.cancelButton}
                >
                  <Text style={styles.cancelText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  onPress={handleImportSelected}
                  disabled={
                    backupBusy ||
                    (importCategories.length > 0 &&
                      selectedImportCategoryKeys.length === 0)
                  }
                  style={[
                    styles.saveButton,
                    styles.exportConfirmButton,
                    (backupBusy ||
                      (importCategories.length > 0 &&
                        selectedImportCategoryKeys.length === 0)) &&
                      styles.buttonDisabled,
                  ]}
                >
                  <Ionicons
                    name={
                      importMode === "replace"
                        ? "trash-outline"
                        : "download-outline"
                    }
                    size={17}
                    color="#fff"
                  />
                  <Text style={styles.saveText}>
                    {backupBusy
                      ? "Importando…"
                      : importMode === "replace"
                        ? "Reemplazar Biblioteca"
                        : "Importar seleccionados"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={Boolean(linkActions)}
          transparent
          animationType="fade"
          onRequestClose={() => setLinkActions(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, styles.linkActionsModalCard]}>
              <View style={styles.linkActionsHeader}>
                <Text style={styles.modalTitle}>
                  {["newsSource", "bookStore"].includes(linkActions?.linkType)
                    ? linkActions?.linkType === "bookStore"
                      ? "Opciones de la tienda"
                      : "Opciones del periódico"
                    : "Opciones del enlace"}
                </Text>
                <Pressable
                  onPress={() => setLinkActions(null)}
                  style={styles.toolsModalClose}
                  accessibilityLabel="Cerrar opciones"
                >
                  <Ionicons name="close" size={21} color="#475569" />
                </Pressable>
              </View>
              <Text style={styles.linkActionsTitle} numberOfLines={2}>
                {linkActions?.customTitle || linkActions?.hostname || "Enlace"}
              </Text>
              {["newsSource", "bookStore"].includes(linkActions?.linkType) ? (
                <>
                  <Pressable onPress={() => { const link = linkActions; setLinkActions(null); openSourceUrl(link?.normalizedUrl || link?.url); }} style={styles.linkActionOption}>
                    <Ionicons name="open-outline" size={20} color="#2563eb" />
                    <Text style={styles.linkActionText}>Abrir</Text>
                  </Pressable>
                  <Pressable onPress={() => { const link = linkActions; setLinkActions(null); openSourceEditor(link); }} style={styles.linkActionOption}>
                    <Ionicons name="create-outline" size={20} color="#475569" />
                    <Text style={styles.linkActionText}>{linkActions?.linkType === "bookStore" ? "Editar tienda" : "Editar periódico"}</Text>
                  </Pressable>
                  <Pressable onPress={() => { const link = linkActions; setLinkActions(null); confirmRemoveSource(link); }} style={[styles.linkActionOption, styles.linkActionOptionDanger]}>
                    <Ionicons name="trash-outline" size={20} color="#dc2626" />
                    <Text style={styles.linkActionDangerText}>Eliminar</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Pressable onPress={() => { const link = linkActions; setLinkActions(null); openMetadataEditor(link); }} style={styles.linkActionOption}>
                    <Ionicons name="create-outline" size={20} color="#475569" />
                    <Text style={styles.linkActionText}>Editar comentario y hashtags</Text>
                  </Pressable>
                  <Pressable onPress={() => { const link = linkActions; setLinkActions(null); setMovingLink(link); }} style={styles.linkActionOption}>
                    <Ionicons name="folder-open-outline" size={20} color="#2563eb" />
                    <Text style={styles.linkActionText}>Mover a categoría</Text>
                  </Pressable>
                  <Pressable onPress={() => { const link = linkActions; setLinkActions(null); confirmRemoveLink(link); }} style={[styles.linkActionOption, styles.linkActionOptionDanger]}>
                    <Ionicons name="trash-outline" size={20} color="#dc2626" />
                    <Text style={styles.linkActionDangerText}>Eliminar enlace</Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        </Modal>

        <Modal
          visible={Boolean(editingSource)}
          transparent
          animationType="fade"
          onRequestClose={() => setEditingSource(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>
                {editingSource?.linkType === "bookStore"
                  ? "Editar tienda de libros"
                  : "Editar periódico"}
              </Text>
              <Text style={styles.fieldLabel}>Nombre</Text>
              <TextInput
                value={sourceNameInput}
                onChangeText={setSourceNameInput}
                placeholder={
                  editingSource?.linkType === "bookStore"
                    ? "Por ejemplo: Casa del Libro"
                    : "Por ejemplo: El País"
                }
                placeholderTextColor="#94a3b8"
                style={styles.modalInput}
                maxLength={80}
              />
              <Text style={styles.fieldLabel}>Dirección de portada</Text>
              <TextInput
                value={sourceUrlInput}
                onChangeText={setSourceUrlInput}
                placeholder={
                  editingSource?.linkType === "bookStore"
                    ? "https://www.casadellibro.com"
                    : "https://elpais.com"
                }
                placeholderTextColor="#94a3b8"
                style={styles.modalInput}
                autoCorrect={false}
                autoCapitalize="none"
                onSubmitEditing={handleSaveSource}
              />
              <Text style={styles.fieldHelp}>
                Los comentarios y hashtags se añaden a los{" "}
                {editingSource?.linkType === "bookStore"
                  ? "libros"
                  : "noticias"}{" "}
                guardados, no a la fuente.
              </Text>
              <View style={styles.modalActions}>
                <Pressable
                  onPress={() => setEditingSource(null)}
                  style={styles.cancelButton}
                >
                  <Text style={styles.cancelText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  onPress={handleSaveSource}
                  disabled={!sourceUrlInput.trim() || saving}
                  style={[
                    styles.saveButton,
                    (!sourceUrlInput.trim() || saving) && styles.buttonDisabled,
                  ]}
                >
                  <Text style={styles.saveText}>Guardar</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={Boolean(editingLink)}
          transparent
          animationType="fade"
          onRequestClose={() => setEditingLink(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Comentario y hashtags</Text>
              <Text style={styles.fieldLabel}>Comentario</Text>
              <TextInput
                value={notesInput}
                onChangeText={setNotesInput}
                placeholder="Añade una nota sobre este enlace…"
                placeholderTextColor="#94a3b8"
                style={[styles.modalInput, styles.notesInput]}
                multiline
                maxLength={1000}
              />
              <Text style={styles.fieldLabel}>Hashtags</Text>
              <TextInput
                value={hashtagsInput}
                onChangeText={setHashtagsInput}
                placeholder="#javascript #tutorial #consulta"
                placeholderTextColor="#94a3b8"
                style={styles.modalInput}
                autoCorrect={false}
                autoCapitalize="none"
              />
              <Text style={styles.fieldHelp}>
                Sepáralos mediante espacios o comas.
              </Text>
              <View style={styles.modalActions}>
                <Pressable
                  onPress={() => setEditingLink(null)}
                  style={styles.cancelButton}
                >
                  <Text style={styles.cancelText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  onPress={handleSaveMetadata}
                  disabled={saving}
                  style={[styles.saveButton, saving && styles.buttonDisabled]}
                >
                  <Text style={styles.saveText}>Guardar</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={Boolean(movingLink)}
          transparent
          animationType="fade"
          onRequestClose={() => setMovingLink(null)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Mover a categoría</Text>
              <ScrollView style={styles.moveList}>
                <Pressable
                  onPress={() => handleMove(null)}
                  style={styles.moveItem}
                >
                  <Ionicons
                    name="file-tray-outline"
                    size={20}
                    color="#64748b"
                  />
                  <Text style={styles.moveText}>Sin clasificar</Text>
                </Pressable>
                {topFolders.map((folder) => (
                  <Pressable
                    key={String(folder._id)}
                    onPress={() => handleMove(folder)}
                    style={styles.moveItem}
                  >
                    <Ionicons
                      name={folder.icon || "folder-outline"}
                      size={20}
                      color={folder.color || "#475569"}
                    />
                    <Text style={styles.moveText}>{folder.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Pressable
                onPress={() => setMovingLink(null)}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelText}>Cancelar</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff" },
  screen: { flex: 1, backgroundColor: "#f1f5f9" },
  compactTopBar: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 38,
    paddingHorizontal: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#cbd5e1",
    backgroundColor: "#fff",
  },
  compactTopButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  compactTopTitle: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  compactTopText: { fontSize: 14, fontWeight: "900", color: "#1e293b" },
  toolsPanel: {
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
  },
  iconBox: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
    borderRadius: 14,
    backgroundColor: "#eff6ff",
  },
  introText: { flex: 1 },
  title: { fontSize: 21, fontWeight: "900", color: "#111827" },
  subtitle: { marginTop: 2, fontSize: 12, color: "#64748b" },
  addRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  urlInput: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
    fontSize: 14,
    color: "#111827",
  },
  addButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563eb",
  },
  buttonDisabled: { opacity: 0.45 },
  searchRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 12,
    marginTop: 8,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
  },
  searchInput: { flex: 1, minHeight: 42, fontSize: 14, color: "#111827" },
  webInputNoOutline: { outlineStyle: "none", outlineWidth: 0 },
  searchSubmitButton: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#2563eb",
  },
  searchSubmitText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  searchLoadingBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.58)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  searchLoadingCard: {
    width: "100%",
    maxWidth: 390,
    paddingHorizontal: 22,
    paddingVertical: 24,
    borderRadius: 16,
    backgroundColor: "#fff",
    alignItems: "center",
  },
  searchLoadingTitle: { marginTop: 14, fontSize: 17, fontWeight: "900", color: "#0f172a" },
  searchLoadingText: { marginTop: 7, fontSize: 13, textAlign: "center", color: "#475569" },
  searchLoadingHint: { marginTop: 8, fontSize: 11, textAlign: "center", color: "#64748b" },
  toolsModalCard: {
    width: 430,
    maxHeight: "82%",
    padding: 0,
  },
  toolsModalHeader: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  toolsModalTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  toolsModalTitle: { fontSize: 17, fontWeight: "900", color: "#111827" },
  linkActionsModalCard: { maxWidth: 390 },
  linkActionsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  linkActionsTitle: { marginTop: 4, marginBottom: 12, fontSize: 12, color: "#64748b" },
  linkActionOption: { minHeight: 46, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, borderRadius: 10, backgroundColor: "#f8fafc", marginTop: 7 },
  linkActionOptionDanger: { backgroundColor: "#fff7f7" },
  linkActionText: { flex: 1, fontSize: 13, fontWeight: "800", color: "#334155" },
  linkActionDangerText: { flex: 1, fontSize: 13, fontWeight: "800", color: "#dc2626" },
  toolsModalClose: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  newsSortModalCard: { width: 430, padding: 0 },
  newsSortModalHeader: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#fff7f7",
  },
  newsSortHint: {
    paddingHorizontal: 16,
    paddingTop: 13,
    fontSize: 12,
    lineHeight: 17,
    color: "#64748b",
  },
  newsSortOptionList: { padding: 12, gap: 7 },
  newsSortOption: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    padding: 11,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
  },
  newsSortOptionActive: {
    borderColor: "#fca5a5",
    backgroundColor: "#fff7f7",
  },
  newsSortOptionText: { flex: 1, minWidth: 0 },
  newsSortOptionLabel: { fontSize: 13, fontWeight: "900", color: "#334155" },
  newsSortOptionLabelActive: { color: "#b91c1c" },
  newsSortOptionDescription: {
    marginTop: 2,
    fontSize: 10,
    lineHeight: 14,
    color: "#64748b",
  },
  toolsModalActions: {
    gap: 8,
    padding: 16,
  },
  toolsModalActionButton: {
    minHeight: 43,
    justifyContent: "center",
  },
  toolsModalDisplaySection: {
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e2e8f0",
  },
  toolsHashtagSection: {
    gap: 6,
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e2e8f0",
  },
  toolsHashtagList: { maxHeight: 94 },
  toolsHashtagListContent: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  toolsHashtagChip: {
    minHeight: 29,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
  },
  toolsHashtagText: { fontSize: 11, fontWeight: "800", color: "#2563eb" },
  toolsHashtagCount: { fontSize: 10, fontWeight: "900", color: "#64748b" },
  toolsHashtagEmpty: { fontSize: 11, color: "#64748b" },
  hashtagCatalogModalCard: {
    width: 520,
    maxHeight: "84%",
    padding: 0,
  },
  hashtagCatalogHeader: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
  },
  hashtagCatalogTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  hashtagCatalogTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#111827",
  },
  hashtagCatalogSubtitle: {
    paddingHorizontal: 16,
    paddingTop: 12,
    fontSize: 11,
    lineHeight: 16,
    color: "#64748b",
  },
  hashtagCatalogSearchRow: {
    minHeight: 42,
    marginHorizontal: 16,
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
  },
  hashtagCatalogSearchInput: {
    flex: 1,
    minHeight: 38,
    fontSize: 13,
    color: "#111827",
  },
  hashtagCatalogSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  hashtagCatalogSummary: {
    fontSize: 11,
    fontWeight: "800",
    color: "#475569",
  },
  hashtagCatalogRefresh: {
    fontSize: 11,
    fontWeight: "900",
    color: "#2563eb",
  },
  hashtagCatalogList: {
    marginTop: 8,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  hashtagCatalogListContent: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    paddingBottom: 8,
  },
  hashtagCatalogLoading: {
    minHeight: 150,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 24,
  },
  hashtagCatalogLoadingTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: "#334155",
  },
  hashtagCatalogLoadingText: {
    fontSize: 11,
    color: "#64748b",
  },
  backupButton: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
  },
  backupButtonText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#1d4ed8",
  },
  integrityButton: {
    borderColor: "#a7f3d0",
    backgroundColor: "#ecfdf5",
  },
  integrityButtonText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#047857",
  },
  integrityDownloadButton: {
    borderColor: "#a7f3d0",
    backgroundColor: "#ecfdf5",
  },
  folderScroll: {
    flexGrow: 0,
    flexShrink: 0,
    height: 44,
    maxHeight: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
  },
  folderBar: {
    height: 44,
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 6,
  },
  folderChip: {
    height: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
  },
  folderChipActive: { borderColor: "#2563eb", backgroundColor: "#2563eb" },
  folderText: { fontSize: 10, fontWeight: "800", color: "#475569" },
  folderTextActive: { color: "#fff" },
  newFolderChip: {
    height: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#2563eb",
    backgroundColor: "#eff6ff",
  },
  newFolderText: { fontSize: 10, fontWeight: "800", color: "#2563eb" },
  folderEditor: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#cbd5e1",
    backgroundColor: "#eff6ff",
  },
  folderEditorHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 7,
  },
  folderEditorTitle: { fontSize: 12, fontWeight: "900", color: "#334155" },
  folderEditorRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  folderEditorInput: {
    flex: 1,
    minHeight: 39,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#93c5fd",
    backgroundColor: "#fff",
    fontSize: 13,
    color: "#111827",
  },
  folderEditorCancel: {
    width: 39,
    height: 39,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
  },
  folderEditorDelete: {
    width: 39,
    height: 39,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fff",
  },
  folderEditorSave: {
    height: 39,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 12,
    backgroundColor: "#2563eb",
  },
  folderEditorSaveText: { fontSize: 11, fontWeight: "900", color: "#fff" },
  subfolderScroll: {
    flexGrow: 0,
    flexShrink: 0,
    height: 42,
    maxHeight: 42,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#cbd5e1",
    backgroundColor: "#fff",
  },
  subfolderBar: {
    height: 42,
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 6,
  },
  subfolderChip: {
    height: 28,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
  },
  subfolderChipActive: {
    borderColor: "#2563eb",
    backgroundColor: "#2563eb",
  },
  subfolderMain: {
    height: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingLeft: 9,
    paddingRight: 7,
  },
  subfolderEdit: {
    width: 25,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    paddingRight: 4,
  },
  subfolderText: { fontSize: 10, fontWeight: "800", color: "#1d4ed8" },
  subfolderTextActive: { color: "#fff" },
  newsTabs: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#cbd5e1",
  },
  newsTab: {
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
  },
  newsTabActive: { borderColor: "#dc2626", backgroundColor: "#dc2626" },
  newsTabText: { fontSize: 11, fontWeight: "800", color: "#475569" },
  newsTabTextActive: { color: "#fff" },
  displayModeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#cbd5e1",
  },
  displayModeInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  displayModeLabel: {
    marginRight: 2,
    fontSize: 11,
    fontWeight: "800",
    color: "#64748b",
  },
  displayModeButton: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#f8fafc",
  },
  displayModeButtonActive: {
    borderColor: "#2563eb",
    backgroundColor: "#2563eb",
  },
  displayModeText: { fontSize: 10, fontWeight: "800", color: "#475569" },
  displayModeTextActive: { color: "#fff" },
  activeHashtagFilterBar: {
    marginHorizontal: 10,
    marginTop: 6,
    marginBottom: 2,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  activeHashtagFilterInfo: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  activeHashtagFilterText: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: "700",
    color: "#1e40af",
  },
  activeHashtagFilterCount: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748b",
  },
  activeHashtagFilterClear: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  activeHashtagFilterClearText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1d4ed8",
  },
  shownItemsBar: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    backgroundColor: "#f8fafc",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#dbe3ef",
  },
  shownItemsSummary: { flex: 1, minWidth: 0 },
  shownItemsText: {
    minWidth: 0,
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
  },
  shownItemsDateRange: {
    marginTop: 1,
    fontSize: 9,
    fontWeight: "700",
    color: "#64748b",
  },
  newsSortTrigger: {
    maxWidth: 120,
    height: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fff7f7",
  },
  newsSortTriggerText: { fontSize: 10, fontWeight: "900", color: "#b91c1c" },
  searchPaginationInline: {
    height: 24,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
  },
  searchPaginationInlineButton: {
    width: 24,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  searchPaginationInlineText: {
    minWidth: 30,
    textAlign: "center",
    fontSize: 10,
    fontWeight: "900",
    color: "#2563eb",
  },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 8, paddingTop: 8, paddingBottom: 16 },
  linkRow: { gap: 8 },
  listEmpty: { flexGrow: 1, justifyContent: "center" },
  sourceList: { flex: 1, backgroundColor: "#f1f5f9" },
  sourceListMinimal: { backgroundColor: "#f8fafc" },
  sourceListContent: {
    alignItems: "flex-start",
    gap: 9,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 16,
  },
  sourceMinimalContent: {
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 16,
  },
  sourceMinimalRow: {
    flex: 1,
    minWidth: 0,
    minHeight: 62,
    flexDirection: "row",
    alignItems: "stretch",
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "#dbe3ef",
    backgroundColor: "#fff",
  },
  sourceMinimalMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    padding: 7,
  },
  sourceMinimalIcon: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "#fef2f2",
  },
  sourceMinimalText: { flex: 1, minWidth: 0, marginLeft: 8 },
  sourceMinimalTitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "900",
    color: "#1e293b",
  },
  sourceMinimalDomain: {
    marginTop: 1,
    fontSize: 10,
    fontWeight: "800",
    color: "#dc2626",
  },
  sourceMinimalUrl: {
    marginTop: 2,
    fontSize: 10,
    lineHeight: 13,
    color: "#64748b",
  },
  sourceMinimalActions: {
    flexDirection: "row",
    alignItems: "center",
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  sourceMinimalButton: {
    width: 34,
    height: 62,
    alignItems: "center",
    justifyContent: "center",
  },
  sourceTile: {
    width: 190,
    minHeight: 156,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#dbe3ef",
    borderRadius: 12,
    backgroundColor: "#fff",
  },
  sourceTileMain: { flex: 1, padding: 12 },
  sourceTileIcon: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 9,
    borderRadius: 12,
    backgroundColor: "#fef2f2",
  },
  sourceTileFavicon: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#fecaca",
    overflow: "hidden",
  },
  sourceTileFaviconImage: {
    width: 28,
    height: 28,
  },
  sourceTileFaviconFallback: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    backgroundColor: "#fee2e2",
  },
  sourceTileTitle: { fontSize: 14, fontWeight: "900", color: "#1e293b" },
  sourceTileDomain: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: "800",
    color: "#dc2626",
  },
  sourceTileUrl: {
    marginTop: 6,
    fontSize: 10,
    lineHeight: 14,
    color: "#64748b",
  },
  sourceTileActions: {
    height: 38,
    flexDirection: "row",
    justifyContent: "flex-end",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  sourceTileButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  linkCard: {
    flex: 1,
    alignSelf: "flex-start",
    minWidth: 0,
    maxWidth: 262,
    marginBottom: 8,
    padding: 5,
    borderWidth: 1,
    borderColor: "#dbe3ef",
    backgroundColor: "#fff",
  },
  minimalLinkCard: {
    flex: 1,
    minWidth: 0,
    maxWidth: 720,
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    padding: 7,
    borderWidth: 1,
    borderColor: "#dbe3ef",
    backgroundColor: "#fff",
  },
  minimalLinkCardDetailed: {
    alignItems: "flex-start",
  },
  minimalLinkMain: {
    flex: 1,
    minWidth: 0,
  },
  minimalLinkOpenArea: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
  },
  minimalLinkText: { flex: 1, minWidth: 0, marginLeft: 8 },
  minimalLinkActions: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    marginLeft: 5,
  },
  minimalLinkButton: {
    width: 27,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  minimalLinkDomain: {
    fontSize: 10,
    fontWeight: "900",
    color: "#2563eb",
  },
  minimalLinkTitle: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    color: "#1e293b",
  },
  minimalLinkPreviewDetail: {
    marginTop: 1,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: "700",
    color: "#64748b",
  },
  minimalLinkPreviewDetailDocument: {
    marginTop: 3,
    lineHeight: 14,
    fontWeight: "600",
  },
  minimalLinkDate: { marginTop: 2, fontSize: 10, color: "#64748b" },
  minimalLinkNotes: {
    marginTop: 3,
    fontSize: 11,
    lineHeight: 15,
    color: "#475569",
  },
  minimalHashtagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 4,
  },
  minimalHashtag: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: "#eff6ff",
    fontSize: 10,
    fontWeight: "700",
    color: "#2563eb",
  },
  minimalNewsCard: {
    flex: 1,
    minWidth: 0,
    maxWidth: 420,
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    padding: 7,
    borderWidth: 1,
    borderColor: "#dbe3ef",
    backgroundColor: "#fff",
  },
  minimalNewsText: { flex: 1, minWidth: 0, marginLeft: 8 },
  minimalNewsTitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    color: "#1e293b",
  },
  minimalNewsDate: { marginTop: 2, fontSize: 10, color: "#64748b" },
  linkNotes: {
    marginTop: 7,
    paddingHorizontal: 8,
    fontSize: 12,
    lineHeight: 17,
    color: "#475569",
  },
  sourceCustomTitle: {
    marginTop: 7,
    paddingHorizontal: 8,
    fontSize: 13,
    fontWeight: "900",
    color: "#1e293b",
  },
  hashtagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    paddingHorizontal: 8,
    paddingTop: 7,
  },
  hashtag: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: "#eff6ff",
    fontSize: 10,
    fontWeight: "800",
    color: "#2563eb",
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
    paddingTop: 4,
  },
  categoryBadge: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 4,
    backgroundColor: "#f1f5f9",
  },
  categoryText: {
    flexShrink: 1,
    fontSize: 10,
    fontWeight: "800",
    color: "#475569",
  },
  cardActionButtons: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
  },
  iconButton: {
    width: 25,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: { alignItems: "center", paddingHorizontal: 30 },
  emptyTitle: {
    marginTop: 10,
    fontSize: 17,
    fontWeight: "900",
    color: "#334155",
  },
  emptyText: {
    marginTop: 5,
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
  },
  modalBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
  },
  slowTaskBackdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "rgba(15, 23, 42, 0.72)",
  },
  slowTaskCard: {
    width: 340,
    maxWidth: "100%",
    alignItems: "center",
    padding: 24,
    borderRadius: 18,
    backgroundColor: "#fff",
  },
  slowTaskTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: "900",
    color: "#0f172a",
    textAlign: "center",
  },
  slowTaskMessage: {
    marginTop: 8,
    fontSize: 13,
    color: "#475569",
    textAlign: "center",
  },
  slowTaskProgressArea: { width: "100%", marginTop: 18 },
  slowTaskProgressTrack: {
    height: 8,
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "#dbeafe",
  },
  slowTaskProgressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#2563eb",
  },
  slowTaskProgressText: {
    marginTop: 7,
    fontSize: 11,
    fontWeight: "800",
    color: "#475569",
    textAlign: "center",
  },
  slowTaskHint: {
    marginTop: 18,
    fontSize: 11,
    lineHeight: 16,
    color: "#64748b",
    textAlign: "center",
  },
  modalCard: {
    width: 380,
    maxWidth: "100%",
    maxHeight: "78%",
    padding: 16,
    backgroundColor: "#fff",
  },
  importModalCard: {
    maxHeight: "88%",
    padding: 0,
  },
  importModalScroll: { flexShrink: 1 },
  importModalContent: { padding: 16, paddingBottom: 6 },
  modalTitle: {
    marginBottom: 12,
    fontSize: 18,
    fontWeight: "900",
    color: "#111827",
  },
  modalInput: {
    minHeight: 44,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
    fontSize: 14,
    color: "#111827",
  },
  notesInput: { minHeight: 92, paddingTop: 11, textAlignVertical: "top" },
  fieldLabel: {
    marginTop: 8,
    marginBottom: 6,
    fontSize: 12,
    fontWeight: "800",
    color: "#334155",
  },
  fieldHelp: { marginTop: 5, fontSize: 10, color: "#64748b" },
  importFileBox: {
    minHeight: 45,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
  },
  importFileName: {
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
    color: "#1e3a8a",
  },
  importSummaryBox: {
    gap: 7,
    padding: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  importSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  importSummaryText: { flex: 1, fontSize: 12, color: "#334155" },
  integritySummaryBox: {
    gap: 7,
    padding: 10,
    borderWidth: 1,
    borderColor: "#a7f3d0",
    backgroundColor: "#ecfdf5",
  },
  integritySummaryText: { fontSize: 12, color: "#065f46" },
  integrityLocalHint: {
    marginTop: -5,
    marginBottom: 10,
    fontSize: 11,
    lineHeight: 16,
    color: "#64748b",
  },
  integrityOk: { marginTop: 10, fontSize: 12, color: "#047857" },
  integrityWarningBox: {
    marginTop: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: "#fed7aa",
    backgroundColor: "#fff7ed",
  },
  integrityWarning: {
    fontSize: 12,
    lineHeight: 17,
    color: "#b45309",
  },
  integrityDomainList: {
    maxHeight: 92,
    marginTop: 5,
    paddingTop: 5,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#fed7aa",
  },
  integrityDomainText: {
    fontSize: 11,
    lineHeight: 16,
    color: "#92400e",
  },
  integrityWarningLegacy: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 17,
    color: "#b45309",
  },
  integrityCategoryList: {
    maxHeight: 180,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  integritySearchRow: {
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 8,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
  },
  integritySearchInput: {
    flex: 1,
    minHeight: 36,
    fontSize: 13,
    color: "#111827",
  },
  integrityEmptySearch: {
    padding: 12,
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
  },
  integrityCategoryRow: {
    minHeight: 31,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
  },
  integrityCategoryName: { flex: 1, fontSize: 11, color: "#334155" },
  integrityCategoryCount: { fontSize: 12, fontWeight: "900", color: "#2563eb" },
  importCategoryList: { marginTop: 10, gap: 6 },
  importOption: {
    minHeight: 49,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
  },
  importOptionChecked: {
    borderColor: "#bfdbfe",
    backgroundColor: "#f8fbff",
  },
  importOptionPressed: { opacity: 0.75 },
  importCheckbox: {
    width: 21,
    height: 21,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#94a3b8",
    backgroundColor: "#fff",
  },
  importCheckboxChecked: {
    borderColor: "#2563eb",
    backgroundColor: "#2563eb",
  },
  importOptionText: { flex: 1, minWidth: 0 },
  importOptionLabel: { fontSize: 13, fontWeight: "800", color: "#334155" },
  importOptionDetail: { marginTop: 2, fontSize: 10, color: "#64748b" },
  importSelectionHelp: {
    marginTop: 10,
    fontSize: 10,
    lineHeight: 15,
    color: "#64748b",
  },
  importModeList: { gap: 6, marginTop: 8 },
  importModeOption: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
  },
  importModeSelected: {
    borderColor: "#bfdbfe",
    backgroundColor: "#f8fbff",
  },
  importModeReplaceSelected: {
    borderColor: "#fecaca",
    backgroundColor: "#fff7f7",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 14,
  },
  cancelButton: {
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  cancelText: { fontSize: 13, fontWeight: "800", color: "#475569" },
  saveButton: {
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    backgroundColor: "#2563eb",
  },
  exportConfirmButton: { flexDirection: "row", gap: 7 },
  saveText: { fontSize: 13, fontWeight: "900", color: "#fff" },
  moveList: { flexGrow: 0, marginBottom: 12 },
  moveItem: {
    minHeight: 47,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
  },
  moveText: { fontSize: 14, fontWeight: "700", color: "#334155" },
});

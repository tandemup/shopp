import React, {
  useCallback,
  useEffect,
  useMemo,
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
const IMPORT_BATCH_SIZE = 1000;
const IMPORT_PREVIEW_CONCURRENCY = 3;
const LIBRARY_VISIBLE_LINK_LIMIT = 80;
const LIBRARY_CATALOG_SOURCE_LIMIT = 600;
const LIBRARY_SEARCH_PAGE_SIZE = 40;
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
  const title = stripImportedDomainPrefix(
    isYouTube || previewMode === "document"
      ? metadataTitle || description
      : description || metadataTitle,
    domain,
  );
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

export default function LibraryScreen({ navigation }) {
  const { width: screenWidth } = useWindowDimensions();
  const [clientId] = useState(getClientId);
  const [urlInput, setUrlInput] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [folderFilter, setFolderFilter] = useState("all");
  const [newsView, setNewsView] = useState("articles");
  const [movingLink, setMovingLink] = useState(null);
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

  const folders = useQuery(api.computerLinks.listFolders) || [];
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
    const timeoutId = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [search]);
  useEffect(() => {
    setSearchPage(0);
    setBrowsePage(0);
    setBrowseCursors([null]);
  }, [debouncedSearch, folderFilter, newsView, newsSort]);
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
  const libraryResult = useQuery(api.computerLinks.list, {
    search: debouncedSearch || undefined,
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
    page: debouncedSearch ? searchPage : undefined,
    cursor: debouncedSearch ? undefined : browseCursors[browsePage] || undefined,
    paginate: !debouncedSearch || undefined,
    limit: isSourceCatalog
      ? LIBRARY_CATALOG_SOURCE_LIMIT
      : debouncedSearch
        ? LIBRARY_SEARCH_PAGE_SIZE
        : LIBRARY_VISIBLE_LINK_LIMIT,
  });
  const links = libraryResult?.items;
  const shownItemCount = Array.isArray(links) ? links.length : 0;
  const shownHashtags = useMemo(() => {
    const counts = new Map();
    (Array.isArray(links) ? links : []).forEach((link) => {
      (Array.isArray(link?.hashtags) ? link.hashtags : []).forEach((tag) => {
        const normalizedTag = String(tag || "")
          .trim()
          .replace(/^#+/, "")
          .toLowerCase();
        if (!normalizedTag) return;
        counts.set(normalizedTag, (counts.get(normalizedTag) || 0) + 1);
      });
    });
    return [...counts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((first, second) =>
        second.count - first.count || first.tag.localeCompare(second.tag),
      );
  }, [links]);
  const displayedPostsDateRange = useMemo(
    () => getDisplayedPostsDateRange(links),
    [links],
  );
  const isSearchingLibrary = Boolean(debouncedSearch);
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
  const filteredIntegrityCategoryCounts = useMemo(() => {
    const counts = integrityReport?.after?.categoryCounts || [];
    const query = integritySearch.trim().toLowerCase();
    if (!query) return counts;
    return counts.filter(([category]) =>
      String(category || "").toLowerCase().includes(query),
    );
  }, [integrityReport, integritySearch]);

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
  const getLinkPreview = useAction(api.linkPreviews.get);
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

    }
  }, [
    backupMode,
    exportedLinks,
    exportStatus,
    libraryBackup,
    loadMoreExportedLinks,
  ]);

  useEffect(() => {
    ensureDefaultFolders({ clientId }).catch((error) =>
      console.warn("[LibraryScreen] folder setup failed", error),
    );
  }, [clientId, ensureDefaultFolders]);

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
      if (result.existing) {
        setFolderFilter("all");
        setNewsView("articles");
        setSearch(url);
        safeAlert(
          "Enlace recuperado",
          "El enlace ya existía en la biblioteca. Se muestra ahora en los resultados.",
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
    isCatalogFolder,
    isBooksFolder,
    newsView,
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
      setFolderFilter(String(result.folderId));
    } catch (error) {
      safeAlert("No se pudo crear", error?.message || "Revisa el nombre.");
    } finally {
      setSaving(false);
    }
  }, [clientId, createFolder, folderName, saving]);

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

  const handleImportSelected = useCallback(async () => {
    if (!importReview || backupBusy) return;

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

    const executeImport = async () => {
      setImportReview(null);
      setSelectedImportCategoryKeys([]);
      setImportMode("combine");
      setEnrichNewsOnImport(true);
      setBackupBusy(true);
      setSlowTask({
        kind: "import",
        title: "Importando Biblioteca",
        message: "Preparando los enlaces seleccionados…",
        current: 0,
        total: Array.isArray(selectedData?.links) ? selectedData.links.length : 0,
      });
      try {
        const enriched = enrichNewsOnImport
          ? await enrichImportedNewsMetadata(
              selectedData,
              getLinkPreview,
              ({ completed, total }) =>
                setSlowTask({
                  kind: "import",
                  title: "Importando Biblioteca",
                  message: "Actualizando títulos y fechas de noticias…",
                  current: completed,
                  total,
                }),
            )
          : { data: selectedData, summary: { checked: 0, updated: 0 } };
        const importData = enriched.data;
        const links = Array.isArray(importData.links) ? importData.links : [];
        const linkBatches = [];
        for (let index = 0; index < links.length; index += IMPORT_BATCH_SIZE) {
          linkBatches.push(links.slice(index, index + IMPORT_BATCH_SIZE));
        }
        if (linkBatches.length === 0) linkBatches.push([]);

        const summary = {
          foldersCreated: 0,
          linksCreated: 0,
          linksUpdated: 0,
          foldersDeleted: 0,
          linksDeleted: 0,
          newsMetadataChecked: enriched.summary.checked,
          newsMetadataUpdated: enriched.summary.updated,
        };
        for (let index = 0; index < linkBatches.length; index += 1) {
          setSlowTask({
            kind: "import",
            title: "Importando Biblioteca",
            message: `Guardando lote ${index + 1} de ${linkBatches.length}…`,
            current: index * IMPORT_BATCH_SIZE,
            total: links.length,
          });
          const importArgs = {
            clientId,
            backup: {
              ...importReview.parsed,
              data: { ...importData, links: linkBatches[index] },
            },
            replaceExisting: importMode === "replace" && index === 0,
          };
          const batchSummary = await importBackup(importArgs);
          Object.keys(summary).forEach((key) => {
            summary[key] += Number(batchSummary?.[key] || 0);
          });
          setSlowTask({
            kind: "import",
            title: "Importando Biblioteca",
            message: `Guardando lote ${index + 1} de ${linkBatches.length}…`,
            current: Math.min((index + 1) * IMPORT_BATCH_SIZE, links.length),
            total: links.length,
          });
        }
        safeAlert(
          "Biblioteca restaurada",
          `${importMode === "replace" ? "Reemplazo completado." : "Modo combinar completado."}\n\n${summary.newsMetadataChecked ? `Noticias revisadas: ${summary.newsMetadataChecked}\nNoticias con título/fecha actualizados: ${summary.newsMetadataUpdated}\n` : ""}${summary.linksDeleted ? `Enlaces eliminados: ${summary.linksDeleted}\n` : ""}${summary.foldersDeleted ? `Categorías eliminadas: ${summary.foldersDeleted}\n` : ""}Carpetas creadas: ${summary.foldersCreated}\nEnlaces creados: ${summary.linksCreated}\nEnlaces actualizados: ${summary.linksUpdated}`,
        );
      } catch (error) {
        safeAlert(
          "No se pudo importar",
          error?.message || "No se pudo modificar la Biblioteca.",
        );
      } finally {
        setBackupBusy(false);
        setSlowTask(null);
      }
    };

    if (importMode === "replace") {
      safeAlert(
        "Reemplazar Biblioteca",
        `Se eliminarán todas las categorías y enlaces actuales y se conservarán únicamente los seleccionados del fichero ${importReview.fileName}. Esta acción no se puede deshacer.`,
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Reemplazar", style: "destructive", onPress: executeImport },
        ],
      );
      return;
    }

    await executeImport();
  }, [
    backupBusy,
    clientId,
    enrichNewsOnImport,
    getLinkPreview,
    importBackup,
    importMode,
    importReview,
    selectedImportCategoryKeys,
  ]);

  const handleImportBackup = useCallback(async () => {
    if (backupBusy) return;
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

      const parsed = JSON.parse(jsonText);
      if (parsed?.format !== "shopp-library-backup" || parsed?.version !== 1) {
        throw new Error("El fichero no es una copia de Biblioteca compatible.");
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
      });
      setSelectedImportCategoryKeys(categories.map((category) => category.key));
      setImportMode("combine");
      setEnrichNewsOnImport(true);
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
  }, [backupBusy]);

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

  const handleCheckIntegrity = useCallback(async () => {
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
              />
              {search ? (
                <Pressable
                  onPress={() => setSearch("")}
                  style={styles.iconButton}
                >
                  <Ionicons name="close-circle" size={20} color="#94a3b8" />
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}

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
              <Text style={styles.slowTaskHint}>
                Esta tarea no se puede cancelar. No cierres, recargues ni salgas
                de la aplicación hasta que termine.
              </Text>
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
                    {integrityBusy ? "Analizando…" : "Comprobar JSON local"}
                  </Text>
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
                  <Text style={styles.displayModeLabel}>
                    Hashtags de los enlaces mostrados
                  </Text>
                  {shownHashtags.length ? (
                    <ScrollView
                      style={styles.toolsHashtagList}
                      contentContainerStyle={styles.toolsHashtagListContent}
                      nestedScrollEnabled
                    >
                      {shownHashtags.map(({ tag, count }) => (
                        <Pressable
                          key={tag}
                          onPress={() => {
                            setSearch(tag);
                            setToolsModalVisible(false);
                          }}
                          style={styles.toolsHashtagChip}
                          accessibilityLabel={`Filtrar por #${tag}, ${count} enlaces`}
                        >
                          <Text style={styles.toolsHashtagText}>#{tag}</Text>
                          <Text style={styles.toolsHashtagCount}>{count}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  ) : (
                    <Text style={styles.toolsHashtagEmpty}>
                      No hay hashtags en los enlaces mostrados.
                    </Text>
                  )}
                </View>
              </View>
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
                onPress={() => {
                  setFolderFilter(id);
                }}
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
                setNewsView("sources");
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
              onPress={() => setNewsView("articles")}
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
                        onPress={() => openSourceUrl(item.normalizedUrl)}
                        style={styles.sourceMinimalButton}
                      >
                        <Ionicons
                          name="open-outline"
                          size={18}
                          color="#2563eb"
                        />
                      </Pressable>
                      <Pressable
                        onPress={() => openSourceEditor(item)}
                        style={styles.sourceMinimalButton}
                      >
                        <Ionicons name="pencil" size={17} color="#475569" />
                      </Pressable>
                      <Pressable
                        onPress={() => confirmRemoveSource(item)}
                        style={styles.sourceMinimalButton}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={18}
                          color="#dc2626"
                        />
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
                      onPress={() => openSourceUrl(item.normalizedUrl)}
                      style={styles.sourceTileButton}
                    >
                      <Ionicons name="open-outline" size={18} color="#2563eb" />
                    </Pressable>
                    <Pressable
                      onPress={() => openSourceEditor(item)}
                      style={styles.sourceTileButton}
                    >
                      <Ionicons name="pencil" size={17} color="#475569" />
                    </Pressable>
                    <Pressable
                      onPress={() => confirmRemoveSource(item)}
                      style={styles.sourceTileButton}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={18}
                        color="#dc2626"
                      />
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
                          onPress={() => setSearch(tag)}
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
                      onPress={() => openMetadataEditor(item)}
                      style={styles.minimalLinkButton}
                      accessibilityLabel="Editar enlace"
                    >
                      <Ionicons name="create-outline" size={17} color="#475569" />
                    </Pressable>
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
                      onPress={() => setMovingLink(item)}
                      style={styles.minimalLinkButton}
                      accessibilityLabel="Mover enlace"
                    >
                      <Ionicons name="folder-open-outline" size={17} color="#2563eb" />
                    </Pressable>
                    <Pressable
                      onPress={() => removeLink({ linkId: item._id })}
                      style={styles.minimalLinkButton}
                      accessibilityLabel="Eliminar enlace"
                    >
                      <Ionicons name="trash-outline" size={17} color="#dc2626" />
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
                      <Pressable key={tag} onPress={() => setSearch(tag)}>
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
                      onPress={() =>
                        ["newsSource", "bookStore"].includes(item.linkType)
                          ? openSourceEditor(item)
                          : openMetadataEditor(item)
                      }
                      style={styles.iconButton}
                    >
                      <Ionicons
                        name="create-outline"
                        size={18}
                        color="#475569"
                      />
                    </Pressable>
                    <Pressable
                      onPress={() => toggleFavorite({ linkId: item._id })}
                      style={styles.iconButton}
                    >
                      <Ionicons
                        name={item.favorite ? "star" : "star-outline"}
                        size={18}
                        color={item.favorite ? "#eab308" : "#64748b"}
                      />
                    </Pressable>
                    <Pressable
                      onPress={() => setMovingLink(item)}
                      style={styles.iconButton}
                    >
                      <Ionicons
                        name="folder-open-outline"
                        size={18}
                        color="#2563eb"
                      />
                    </Pressable>
                    <Pressable
                      onPress={() => removeLink({ linkId: item._id })}
                      style={styles.iconButton}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={18}
                        color="#dc2626"
                      />
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
          visible={Boolean(integrityReport)}
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
                    checked={enrichNewsOnImport}
                    label="Actualizar título y fecha"
                    detail="Lee metadatos HTML de cada noticia seleccionada antes de guardarla."
                    icon="sparkles-outline"
                    color="#dc2626"
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

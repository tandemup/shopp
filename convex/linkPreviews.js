import { action } from "./_generated/server";
import { v } from "convex/values";

const MAX_REDIRECTS = 4;
const MAX_HTML_BYTES = 512 * 1024;
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36";
const DATE_METADATA_KEYS = [
  "article:published_time",
  "article:published",
  "datepublished",
  "datecreated",
  "uploaddate",
  "pubdate",
  "publishdate",
  "publish_date",
  "published-date",
  "published_time",
  "date",
  "dc.date.issued",
  "dc.date",
  "dcterms.issued",
  "dcterms.date",
  "parsely-pub-date",
  "sailthru.date",
  "sailthru.date.published",
  "bt:pubdate",
  "cxenseparse:recs:publishtime",
  "article:modified_time",
  "og:updated_time",
  "last-modified",
];

function isPublicHttpUrl(value) {
  let url;
  try {
    url = new URL(String(value || "").trim());
  } catch {
    return false;
  }

  if (!/^https?:$/.test(url.protocol) || !url.hostname) return false;
  if (url.username || url.password) return false;

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return !(
    hostname === "localhost" ||
    hostname === "::1" ||
    hostname === "0.0.0.0" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    /^127\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^169\.254\./.test(hostname) ||
    /^172\.(?:1[6-9]|2\d|3[01])\./.test(hostname)
  );
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .trim();
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
  return slug ? slug.charAt(0).toUpperCase() + slug.slice(1) : "";
}

function normalizeComparableText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^www\./i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function cleanPreviewTitle(value, siteName = "", hostname = "") {
  let title = decodeHtml(value).replace(/\s+/g, " ").trim();
  if (!title) return "";

  const suffixParts = title.split(/\s+(?:[-|–—:])\s+/);
  if (suffixParts.length > 1) {
    const suffix = suffixParts[suffixParts.length - 1];
    const normalizedSuffix = normalizeComparableText(suffix);
    const normalizedSite = normalizeComparableText(siteName);
    const normalizedHost = normalizeComparableText(hostname.split(".")[0]);
    const isSiteSuffix =
      normalizedSuffix &&
      (normalizedSuffix === normalizedSite ||
        normalizedSuffix === normalizedHost ||
        normalizedSite.includes(normalizedSuffix));
    if (isSiteSuffix) {
      title = suffixParts.slice(0, -1).join(" - ").trim();
    }
  }

  return title;
}

function toUtcTimestamp(year, month, day, hour = 0, minute = 0, second = 0) {
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    date.getUTCHours() !== hour ||
    date.getUTCMinutes() !== minute ||
    date.getUTCSeconds() !== second
  ) {
    return null;
  }
  return date.getTime();
}

function parseDateCandidate(value) {
  const raw = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!raw) return null;

  if (/^\d{13}$/.test(raw)) {
    const timestamp = Number(raw);
    return timestamp > 0 ? timestamp : null;
  }
  if (/^\d{10}$/.test(raw)) {
    const timestamp = Number(raw) * 1000;
    return timestamp > 0 ? timestamp : null;
  }

  const separated = raw.match(
    /\b((?:19|20)\d{2})[/-](0?[1-9]|1[0-2])[/-](0?[1-9]|[12]\d|3[01])(?:[T\s]+([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?)?/,
  );
  if (separated) {
    const timestamp = toUtcTimestamp(
      Number(separated[1]),
      Number(separated[2]),
      Number(separated[3]),
      separated[4] ? Number(separated[4]) : 0,
      separated[5] ? Number(separated[5]) : 0,
      separated[6] ? Number(separated[6]) : 0,
    );
    if (timestamp) return timestamp;
  }

  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function readAttributes(tag) {
  const attributes = {};
  const regex = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let match;
  while ((match = regex.exec(tag))) {
    attributes[match[1].toLowerCase()] = decodeHtml(
      match[2] ?? match[3] ?? match[4] ?? "",
    );
  }
  return attributes;
}

function collectMetadata(html) {
  const metadata = new Map();
  for (const match of String(html || "").matchAll(/<meta\b[^>]*>/gi)) {
    const attributes = readAttributes(match[0]);
    const key = String(
      attributes.property || attributes.name || attributes.itemprop || "",
    ).toLowerCase();
    if (key && attributes.content && !metadata.has(key)) {
      metadata.set(key, attributes.content);
    }
  }
  return metadata;
}

function flattenJsonLd(value, result = []) {
  if (!value || typeof value !== "object") return result;
  if (Array.isArray(value)) {
    for (const item of value) flattenJsonLd(item, result);
    return result;
  }
  result.push(value);
  for (const key of ["@graph", "itemListElement", "mainEntity", "item"]) {
    if (value[key]) flattenJsonLd(value[key], result);
  }
  return result;
}

function collectJsonLdArticle(html) {
  for (const match of String(html || "").matchAll(
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const parsed = JSON.parse(match[1].trim());
      const entries = flattenJsonLd(parsed);
      const article = entries.find((entry) => {
        const type = Array.isArray(entry?.["@type"])
          ? entry["@type"]
          : [entry?.["@type"]];
        return type.some((value) =>
          /article|newsarticle|reportage/i.test(String(value)),
        );
      });
      if (article) return article;
    } catch {
      // Algunas páginas sirven JSON-LD incompleto o con caracteres no válidos.
    }
  }
  return null;
}

function firstJsonLdDate(value) {
  if (!value) return null;
  const candidates = Array.isArray(value) ? value : [value];
  for (const candidate of candidates) {
    const timestamp = parseDateCandidate(candidate);
    if (timestamp) return timestamp;
  }
  return null;
}

function collectPublishedAtFromJsonLd(article) {
  return (
    firstJsonLdDate(article?.datePublished) ||
    firstJsonLdDate(article?.dateCreated) ||
    firstJsonLdDate(article?.uploadDate) ||
    firstJsonLdDate(article?.dateModified) ||
    null
  );
}

function collectPublishedAtFromMetadata(metadata) {
  for (const key of DATE_METADATA_KEYS) {
    const timestamp = parseDateCandidate(metadata.get(key));
    if (timestamp) return timestamp;
  }
  return null;
}

function collectPublishedAtFromTimeTags(html) {
  let firstTimestamp = null;
  for (const match of String(html || "").matchAll(/<time\b[^>]*>/gi)) {
    const attributes = readAttributes(match[0]);
    const timestamp = parseDateCandidate(
      attributes.datetime || attributes.content || "",
    );
    if (!timestamp) continue;
    const itemprop = String(attributes.itemprop || "").toLowerCase();
    if (
      attributes.pubdate !== undefined ||
      itemprop === "datepublished" ||
      itemprop === "datecreated"
    ) {
      return timestamp;
    }
    if (!firstTimestamp) firstTimestamp = timestamp;
  }
  return firstTimestamp;
}

function collectPublishedAt(html, metadata, article) {
  return (
    collectPublishedAtFromJsonLd(article) ||
    collectPublishedAtFromMetadata(metadata) ||
    collectPublishedAtFromTimeTags(html) ||
    null
  );
}

function getYouTubeVideoId(value) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.replace(/^www\./, "").toLowerCase();
    if (hostname === "youtu.be")
      return url.pathname.split("/").filter(Boolean)[0] || "";
    if (
      !["youtube.com", "m.youtube.com", "music.youtube.com"].includes(hostname)
    )
      return "";
    if (url.pathname === "/watch") return url.searchParams.get("v") || "";
    const match = url.pathname.match(
      /^\/(?:shorts|live|embed)\/([A-Za-z0-9_-]{11})/,
    );
    return match?.[1] || "";
  } catch {
    return "";
  }
}

function getMetadataFetchUrl(value) {
  const url = new URL(value);
  const hostname = url.hostname.replace(/^www\./, "").toLowerCase();
  if (hostname === "elpais.com") {
    // La versión AMP conserva Open Graph y JSON-LD, pero evita la respuesta
    // de consentimiento/bloqueo que a veces recibe el servidor de Convex.
    url.searchParams.set("outputType", "amp");
  }
  return url.toString();
}

async function getYouTubePreview(url) {
  const videoId = getYouTubeVideoId(url);
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) return null;
  const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const response = await fetch(
    `https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalUrl)}&format=json`,
    {
      headers: { Accept: "application/json", "User-Agent": BROWSER_USER_AGENT },
    },
  );
  if (!response.ok) return null;
  const data = await response.json();
  return {
    url: canonicalUrl,
    hostname: "youtube.com",
    siteName: "YouTube",
    title: decodeHtml(data?.title) || "Vídeo de YouTube",
    description: data?.author_name
      ? `Canal: ${decodeHtml(data.author_name)}`
      : "",
    image:
      data?.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    publishedAt: null,
    fallback: false,
    reason: "",
  };
}

function normalizeCharset(value) {
  const charset = String(value || "")
    .trim()
    .toLowerCase();
  if (!charset) return "";
  if (["latin1", "latin-1", "iso-8859-1", "iso8859-1"].includes(charset)) {
    return "windows-1252";
  }
  if (["utf8", "utf_8"].includes(charset)) return "utf-8";
  return charset;
}

function getDeclaredCharset(contentType, bytes) {
  const headerCharset = contentType.match(
    /charset\s*=\s*["']?([^;\s"']+)/i,
  )?.[1];
  if (headerCharset) return normalizeCharset(headerCharset);

  const probe = new TextDecoder("windows-1252").decode(bytes.slice(0, 8192));
  const metaCharset =
    probe.match(/<meta\b[^>]*charset\s*=\s*["']?([^\s"'/>]+)/i)?.[1] ||
    probe.match(
      /<meta\b[^>]*content\s*=\s*["'][^"']*charset\s*=\s*([^;\s"']+)/i,
    )?.[1];
  return normalizeCharset(metaCharset);
}

function encodingErrorScore(text) {
  return (
    (text.match(/\uFFFD/g)?.length || 0) * 20 +
    (text.match(/Ã.|Â.|â€|â€™|â€œ|â€/g)?.length || 0) * 5
  );
}

function decodeDocument(bytes, contentType) {
  const declaredCharset = getDeclaredCharset(contentType, bytes);
  const candidates = [declaredCharset, "utf-8", "windows-1252"].filter(
    (value, index, values) => value && values.indexOf(value) === index,
  );
  let bestText = "";
  let bestScore = Number.POSITIVE_INFINITY;

  for (const charset of candidates) {
    try {
      const text = new TextDecoder(charset).decode(bytes);
      const score = encodingErrorScore(text);
      if (score < bestScore) {
        bestText = text;
        bestScore = score;
      }
      if (score === 0 && charset === declaredCharset) break;
    } catch {
      // Continúa con la siguiente codificación compatible.
    }
  }
  return bestText || new TextDecoder().decode(bytes);
}

function absolutize(value, baseUrl) {
  if (!value) return "";
  try {
    const url = new URL(value, baseUrl);
    return /^https?:$/.test(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
}

function isUnusablePreviewImage(value) {
  try {
    const parsed = new URL(String(value || ""));
    const hostname = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();
    return (
      path.includes("favicon") ||
      path.includes("apple-touch-icon") ||
      (hostname.endsWith("gstatic.com") && path.includes("icon")) ||
      hostname.startsWith("staging.")
    );
  } catch {
    return true;
  }
}

function getUsablePreviewImage(values, baseUrl) {
  for (const value of values) {
    const image = absolutize(value, baseUrl);
    if (image && !isUnusablePreviewImage(image)) return image;
  }
  return "";
}

function fallbackPreview(url, reason = "unavailable") {
  const parsed = new URL(url);
  const hostname = parsed.hostname.replace(/^www\./, "");
  const title = cleanSlugTitle(
    decodeURIComponent(parsed.pathname.split("/").filter(Boolean).pop() || ""),
  );
  return {
    url: parsed.toString(),
    hostname,
    siteName: hostname,
    title: title || hostname,
    description: "",
    image: "",
    publishedAt: null,
    fallback: true,
    reason,
  };
}

async function getMicrolinkPreview(url) {
  const response = await fetch(
    `https://api.microlink.io?url=${encodeURIComponent(url)}`,
    { headers: { Accept: "application/json" } },
  );
  if (!response.ok) return null;
  const payload = await response.json();
  const data = payload?.data;
  const siteName = decodeHtml(data?.publisher) || "EL PAÍS";
  const title = cleanPreviewTitle(data?.title, siteName, new URL(url).hostname);
  if (!title) return null;
  return {
    url,
    hostname: new URL(url).hostname.replace(/^www\./, ""),
    siteName,
    title,
    description: decodeHtml(data?.description),
    image: getUsablePreviewImage([data?.image?.url], url),
    publishedAt: parseDateCandidate(
      data?.date || data?.publishedAt || data?.published_at || data?.createdAt,
    ),
    fallback: false,
    reason: "",
  };
}

async function getProviderPreviewOrFallback(url, reason) {
  try {
    const preview = await getMicrolinkPreview(url);
    if (preview) return preview;
  } catch {
    // El título derivado de la URL mantiene una tarjeta útil sin ensuciar logs.
  }
  return fallbackPreview(url, reason);
}

function redirectedArticleToHomepage(originalUrl, finalUrl) {
  try {
    const original = new URL(originalUrl);
    const final = new URL(finalUrl);
    const originalHost = original.hostname.replace(/^www\./i, "").toLowerCase();
    const finalHost = final.hostname.replace(/^www\./i, "").toLowerCase();
    const originalPath = original.pathname.replace(/\/+/g, "/");
    const finalPath = final.pathname.replace(/\/+/g, "/");
    const originalLooksLikeArticle = originalPath !== "/" && originalPath.length > 1;
    const finalLooksLikeHomepage = finalPath === "/" || finalPath === "";
    return originalHost === finalHost && originalLooksLikeArticle && finalLooksLikeHomepage;
  } catch {
    return false;
  }
}

async function fetchWithValidatedRedirects(initialUrl) {
  let currentUrl = initialUrl;
  for (
    let redirectCount = 0;
    redirectCount <= MAX_REDIRECTS;
    redirectCount += 1
  ) {
    if (!isPublicHttpUrl(currentUrl)) throw new Error("unsafe_url");
    const response = await fetch(currentUrl, {
      redirect: "manual",
      headers: {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.7",
        "Cache-Control": "no-cache",
        "User-Agent": BROWSER_USER_AGENT,
      },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return { response, finalUrl: currentUrl };
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }
    return { response, finalUrl: currentUrl };
  }
  throw new Error("too_many_redirects");
}

export const get = action({
  args: { url: v.string() },
  handler: async (_ctx, args) => {
    let normalizedUrl;
    try {
      normalizedUrl = new URL(args.url).toString();
    } catch {
      throw new Error("URL no válida.");
    }
    if (!isPublicHttpUrl(normalizedUrl)) {
      throw new Error("La URL no apunta a una web pública permitida.");
    }

    try {
      const youtubePreview = await getYouTubePreview(normalizedUrl);
      if (youtubePreview) return youtubePreview;
      const normalizedHostname = new URL(normalizedUrl).hostname.replace(
        /^www\./,
        "",
      );
      if (normalizedHostname === "elpais.com") {
        try {
          const providerPreview = await getMicrolinkPreview(normalizedUrl);
          if (providerPreview) return providerPreview;
        } catch (providerError) {
          console.warn(
            "[linkPreviews.get] Microlink fallback failed",
            providerError,
          );
        }
      }
      const metadataUrl = getMetadataFetchUrl(normalizedUrl);
      const { response, finalUrl } =
        await fetchWithValidatedRedirects(metadataUrl);

      // Algunos periódicos redirigen las peticiones de servidor a la portada
      // por cookies/consentimiento/anti-bot. No debemos aceptar entonces el
      // título de la home como título del artículo solicitado.
      if (redirectedArticleToHomepage(normalizedUrl, finalUrl)) {
        return await getProviderPreviewOrFallback(
          normalizedUrl,
          "redirected_to_homepage",
        );
      }
      if (!response.ok) {
        return await getProviderPreviewOrFallback(
          normalizedUrl,
          `http_${response.status}`,
        );
      }

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.toLowerCase().includes("text/html")) {
        return await getProviderPreviewOrFallback(normalizedUrl, "not_html");
      }

      const bytes = new Uint8Array(await response.arrayBuffer());
      const html = decodeDocument(bytes.slice(0, MAX_HTML_BYTES), contentType);
      const metadata = collectMetadata(html);
      const article = collectJsonLdArticle(html);
      const publishedAt = collectPublishedAt(html, metadata, article);
      const titleTag = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
      const parsed = new URL(finalUrl);
      const hostname = parsed.hostname.replace(/^www\./, "");
      const articleImage = Array.isArray(article?.image)
        ? article.image[0]
        : typeof article?.image === "object"
          ? article.image?.url
          : article?.image;
      const image = getUsablePreviewImage(
        [metadata.get("og:image"), metadata.get("twitter:image"), articleImage],
        finalUrl,
      );
      const siteName = metadata.get("og:site_name") || hostname;
      const rawTitle =
        article?.headline ||
        article?.name ||
        metadata.get("og:title") ||
        metadata.get("twitter:title") ||
        decodeHtml(titleTag) ||
        hostname;

      return {
        url: normalizedUrl,
        hostname,
        siteName,
        title: cleanPreviewTitle(rawTitle, siteName, hostname) || hostname,
        description:
          metadata.get("og:description") ||
          metadata.get("twitter:description") ||
          metadata.get("description") ||
          "",
        image,
        publishedAt,
        fallback: false,
        reason: "",
      };
    } catch (error) {
      return await getProviderPreviewOrFallback(normalizedUrl, "fetch_failed");
    }
  },
});

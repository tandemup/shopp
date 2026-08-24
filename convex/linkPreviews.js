import { action } from "./_generated/server";
import { v } from "convex/values";

const MAX_REDIRECTS = 4;
const MAX_HTML_BYTES = 512 * 1024;

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
    const key = String(attributes.property || attributes.name || "").toLowerCase();
    if (key && attributes.content && !metadata.has(key)) {
      metadata.set(key, attributes.content);
    }
  }
  return metadata;
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

function fallbackPreview(url, reason = "unavailable") {
  const parsed = new URL(url);
  const hostname = parsed.hostname.replace(/^www\./, "");
  return {
    url: parsed.toString(),
    hostname,
    siteName: hostname,
    title: hostname,
    description: "",
    image: absolutize("/favicon.ico", parsed.origin),
    fallback: true,
    reason,
  };
}

async function fetchWithValidatedRedirects(initialUrl) {
  let currentUrl = initialUrl;
  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    if (!isPublicHttpUrl(currentUrl)) throw new Error("unsafe_url");
    const response = await fetch(currentUrl, {
      redirect: "manual",
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "Shopp-LinkPreview/1.0",
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
      const { response, finalUrl } = await fetchWithValidatedRedirects(normalizedUrl);
      if (!response.ok) return fallbackPreview(finalUrl, `http_${response.status}`);

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.toLowerCase().includes("text/html")) {
        return fallbackPreview(finalUrl, "not_html");
      }

      const bytes = new Uint8Array(await response.arrayBuffer());
      const html = new TextDecoder().decode(bytes.slice(0, MAX_HTML_BYTES));
      const metadata = collectMetadata(html);
      const titleTag = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
      const parsed = new URL(finalUrl);
      const hostname = parsed.hostname.replace(/^www\./, "");
      const image = absolutize(
        metadata.get("og:image") || metadata.get("twitter:image"),
        finalUrl,
      );

      return {
        url: finalUrl,
        hostname,
        siteName: metadata.get("og:site_name") || hostname,
        title:
          metadata.get("og:title") ||
          metadata.get("twitter:title") ||
          decodeHtml(titleTag) ||
          hostname,
        description:
          metadata.get("og:description") ||
          metadata.get("twitter:description") ||
          metadata.get("description") ||
          "",
        image,
        fallback: false,
        reason: "",
      };
    } catch (error) {
      console.warn("[linkPreviews.get] preview failed", error);
      return fallbackPreview(normalizedUrl, "fetch_failed");
    }
  },
});

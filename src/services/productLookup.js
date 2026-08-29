// services/productLookup.js

import { normalizeProductSearchType } from "@/src/constants/productSearchTypes";

const OPEN_FOOD_FACTS_API_BASE_URL = "https://world.openfoodfacts.org/api/v2/product";
const OPEN_PRODUCTS_FACTS_API_BASE_URL = "https://world.openproductsfacts.org/api/v2/product";
const GOOGLE_BOOKS_API_BASE_URL = "https://www.googleapis.com/books/v1/volumes";
const OPEN_LIBRARY_BOOKS_API_URL = "https://openlibrary.org/api/books";
const MUSICBRAINZ_API_BASE_URL = "https://musicbrainz.org/ws/2/release";

const OPEN_FOOD_FACTS_PRODUCT_BASE_URL =
  "https://world.openfoodfacts.org/product";

const REQUEST_TIMEOUT_MS = 10000;

function normalizeBarcode(code) {
  return String(code || "")
    .replace(/\D/g, "")
    .trim();
}

function normalizeOptionalString(value) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim();
}

function isSupportedBarcode(barcode) {
  return barcode.length === 8 || barcode.length === 12 || barcode.length === 13;
}

function isLikelyIsbn(barcode) {
  return (
    barcode.length === 13 &&
    (barcode.startsWith("978") || barcode.startsWith("979"))
  );
}

function isbn13ToIsbn10(isbn13) {
  if (!/^978\d{10}$/.test(isbn13)) return "";
  const body = isbn13.slice(3, 12);
  const weightedSum = body
    .split("")
    .reduce((sum, digit, index) => sum + Number(digit) * (10 - index), 0);
  const remainder = (11 - (weightedSum % 11)) % 11;
  const checkDigit = remainder === 10 ? "X" : String(remainder);
  return `${body}${checkDigit}`;
}

function getBarcodeFormat(barcode, productType) {
  if (productType === "Libros" && isLikelyIsbn(barcode)) return "ISBN_13";
  if (barcode.length === 13) return "EAN_13";
  if (barcode.length === 12) return "UPC_A";
  if (barcode.length === 8) return "EAN_8";
  return "GTIN";
}

function getBestImage(product) {
  return (
    product?.image_front_url ||
    product?.image_url ||
    product?.selected_images?.front?.display?.es ||
    product?.selected_images?.front?.display?.en ||
    product?.selected_images?.front?.small?.es ||
    product?.selected_images?.front?.small?.en ||
    ""
  );
}

function getBestProductName(product) {
  return (
    product?.product_name_es ||
    product?.product_name ||
    product?.generic_name_es ||
    product?.generic_name ||
    ""
  ).trim();
}

function getOpenFoodFactsProductUrl(product, barcode) {
  return product?.url || `${OPEN_FOOD_FACTS_PRODUCT_BASE_URL}/${barcode}`;
}

async function fetchWithTimeout(url, options = {}) {
  if (typeof AbortController === "undefined") {
    return fetch(url, options);
  }

  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function lookupFactsProduct(cleanBarcode, productType) {
  const isFood = productType === "Alimentos";
  const apiBaseUrl = isFood
    ? OPEN_FOOD_FACTS_API_BASE_URL
    : OPEN_PRODUCTS_FACTS_API_BASE_URL;
  const productBaseUrl = isFood
    ? OPEN_FOOD_FACTS_PRODUCT_BASE_URL
    : "https://world.openproductsfacts.org/product";
  const fields = [
    "code", "product_name", "product_name_es", "generic_name", "generic_name_es",
    "brands", "categories", "quantity", "image_url", "image_front_url",
    "selected_images", "url",
  ].join(",");
  const response = await fetchWithTimeout(
    `${apiBaseUrl}/${cleanBarcode}.json?fields=${encodeURIComponent(fields)}`,
    { method: "GET", headers: { Accept: "application/json" } },
  );
  if (!response.ok) return { found: false, product: null, reason: "http_error", status: response.status };
  const data = await response.json();
  if (data?.status !== 1 || !data?.product) return { found: false, product: null, reason: "not_found" };
  const product = data.product;
  const productUrl = product?.url || `${productBaseUrl}/${cleanBarcode}`;
  return {
    found: true,
    product: {
      type: isFood ? "food" : "supermarket",
      productType,
      barcode: cleanBarcode,
      barcodeFormat: getBarcodeFormat(cleanBarcode, productType),
      name: getBestProductName(product),
      brand: normalizeOptionalString(product?.brands),
      category: normalizeOptionalString(product?.categories),
      imageUrl: getBestImage(product),
      productUrl,
      url: productUrl,
      details: { quantity: normalizeOptionalString(product?.quantity) },
      source: isFood ? "open_food_facts" : "open_products_facts",
      lookupSource: isFood ? "open_food_facts" : "open_products_facts",
      verified: true,
    },
  };
}

async function lookupGoogleBook(cleanBarcode, isbn10) {
  const candidates = [cleanBarcode, isbn10].filter(Boolean);
  for (const candidate of candidates) {
    const response = await fetchWithTimeout(
      `${GOOGLE_BOOKS_API_BASE_URL}?q=${encodeURIComponent(`isbn:${candidate}`)}&maxResults=5`,
      { headers: { Accept: "application/json" } },
    );
    if (!response.ok) continue;
    const data = await response.json();
    const volume = data?.items?.find((item) =>
      item?.volumeInfo?.industryIdentifiers?.some((entry) =>
        candidates.includes(String(entry?.identifier || "").replace(/-/g, "")),
      ),
    );
    if (volume) return volume;
  }
  return null;
}

async function lookupOpenLibraryBook(cleanBarcode, isbn10) {
  const candidates = [cleanBarcode, isbn10].filter(Boolean);
  const bibkeys = candidates.map((isbn) => `ISBN:${isbn}`).join(",");
  const response = await fetchWithTimeout(
    `${OPEN_LIBRARY_BOOKS_API_URL}?bibkeys=${encodeURIComponent(bibkeys)}&format=json&jscmd=data`,
    { headers: { Accept: "application/json" } },
  );
  if (!response.ok) return null;
  const data = await response.json();
  const record = candidates
    .map((isbn) => data?.[`ISBN:${isbn}`])
    .find(Boolean);
  if (!record) return null;

  return {
    found: true,
    product: {
      type: "book",
      productType: "Libros",
      barcode: cleanBarcode,
      barcodeFormat: "ISBN_13",
      name: normalizeOptionalString(record.title),
      category: normalizeOptionalString(record.subjects?.[0]?.name),
      imageUrl: normalizeOptionalString(
        record.cover?.large || record.cover?.medium || record.cover?.small,
      ).replace(/^http:/i, "https:"),
      productUrl: normalizeOptionalString(record.url),
      details: {
        isbn10,
        isbn13: cleanBarcode,
        authors: (record.authors || []).map((author) => author?.name).filter(Boolean).join(", "),
        publisher: (record.publishers || []).map((publisher) => publisher?.name).filter(Boolean).join(", "),
        publicationYear: normalizeOptionalString(record.publish_date),
        pageCount: record.number_of_pages == null ? "" : String(record.number_of_pages),
        synopsis: normalizeOptionalString(record.notes),
      },
      source: "open_library",
      lookupSource: "open_library",
      verified: true,
    },
  };
}

async function lookupBook(cleanBarcode) {
  const isbn10 = isbn13ToIsbn10(cleanBarcode);
  const volume = await lookupGoogleBook(cleanBarcode, isbn10);

  if (!volume) {
    const openLibraryResult = await lookupOpenLibraryBook(cleanBarcode, isbn10);
    return openLibraryResult || { found: false, product: null, reason: "not_found" };
  }
  const info = volume.volumeInfo || {};
  const identifiers = info.industryIdentifiers || [];
  const imageUrl = info.imageLinks?.large || info.imageLinks?.medium || info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || "";
  return {
    found: true,
    product: {
      type: "book",
      productType: "Libros",
      barcode: cleanBarcode,
      barcodeFormat: getBarcodeFormat(cleanBarcode, "Libros"),
      name: normalizeOptionalString(info.title),
      category: normalizeOptionalString(info.categories?.[0]),
      imageUrl: normalizeOptionalString(imageUrl).replace(/^http:/i, "https:"),
      productUrl: normalizeOptionalString(info.infoLink || info.canonicalVolumeLink),
      details: {
        isbn10: normalizeOptionalString(identifiers.find((entry) => entry.type === "ISBN_10")?.identifier) || isbn10,
        isbn13: normalizeOptionalString(identifiers.find((entry) => entry.type === "ISBN_13")?.identifier) || cleanBarcode,
        authors: (info.authors || []).join(", "),
        publisher: normalizeOptionalString(info.publisher),
        publicationYear: normalizeOptionalString(info.publishedDate),
        language: normalizeOptionalString(info.language),
        pageCount: info.pageCount == null ? "" : String(info.pageCount),
        synopsis: normalizeOptionalString(info.description),
      },
      source: "google_books",
      lookupSource: "google_books",
      verified: true,
    },
  };
}

async function lookupMusic(cleanBarcode) {
  // MusicBrainz puede almacenar el mismo GTIN como UPC-A (12 dígitos)
  // o como EAN-13 con un cero inicial.
  const barcodeCandidates =
    cleanBarcode.length === 12
      ? [cleanBarcode, `0${cleanBarcode}`]
      : cleanBarcode.length === 13 && cleanBarcode.startsWith("0")
        ? [cleanBarcode, cleanBarcode.slice(1)]
        : [cleanBarcode];
  const query = encodeURIComponent(
    barcodeCandidates.map((candidate) => `barcode:${candidate}`).join(" OR "),
  );
  const response = await fetchWithTimeout(
    `${MUSICBRAINZ_API_BASE_URL}/?query=${query}&fmt=json&limit=5`,
    { headers: { Accept: "application/json" } },
  );
  if (!response.ok) return { found: false, product: null, reason: "http_error", status: response.status };
  const data = await response.json();
  const release =
    data?.releases?.find((item) => barcodeCandidates.includes(item?.barcode)) ||
    data?.releases?.[0];
  if (!release) return { found: false, product: null, reason: "not_found" };
  const artists = (release["artist-credit"] || []).map((credit) => credit?.name || credit?.artist?.name).filter(Boolean);
  const labels = (release["label-info"] || []).map((entry) => entry?.label?.name).filter(Boolean);
  const catalogNumber = (release["label-info"] || []).map((entry) => entry?.["catalog-number"]).filter(Boolean).join(", ");
  const media = release.media || [];
  const productUrl = `https://musicbrainz.org/release/${release.id}`;
  return {
    found: true,
    product: {
      type: "music",
      productType: "Música",
      barcode: cleanBarcode,
      barcodeFormat: getBarcodeFormat(cleanBarcode, "Música"),
      name: normalizeOptionalString(release.title),
      category: "Música",
      imageUrl: `https://coverartarchive.org/release/${release.id}/front-500`,
      productUrl,
      details: {
        artist: artists.join(", "),
        format: media.map((item) => item?.format).filter(Boolean).join(", ") || "CD",
        discCount: media.length ? String(media.length) : "",
        label: labels.join(", "),
        catalogNumber,
        releaseYear: normalizeOptionalString(release.date),
      },
      source: "musicbrainz",
      lookupSource: "musicbrainz",
      verified: true,
    },
  };
}

export async function lookupProductByBarcode(barcode, options = {}) {
  const cleanBarcode = normalizeBarcode(barcode);
  const productType = normalizeProductSearchType(
    options.productType,
    isLikelyIsbn(cleanBarcode) ? "Libros" : "Alimentos",
  );

  if (!cleanBarcode || !isSupportedBarcode(cleanBarcode)) {
    return {
      found: false,
      product: null,
      reason: "invalid_barcode",
    };
  }

  if (productType === "Libros" && !isLikelyIsbn(cleanBarcode)) {
    return {
      found: false,
      product: null,
      reason: "invalid_isbn",
    };
  }

  try {
    if (productType === "Libros") return await lookupBook(cleanBarcode);
    if (productType === "Música") return await lookupMusic(cleanBarcode);
    return await lookupFactsProduct(cleanBarcode, productType);
  } catch (error) {
    const isAbortError = error?.name === "AbortError";

    console.log(
      isAbortError
        ? "Product lookup request timed out"
        : "Error looking up product by barcode:",
      error,
    );

    return {
      found: false,
      product: null,
      reason: isAbortError ? "timeout" : "network_error",
    };
  }
}

export function getProductDisplayName(product, fallbackBarcode = "") {
  return (
    normalizeOptionalString(product?.name) ||
    normalizeOptionalString(product?.product_name) ||
    normalizeOptionalString(product?.title) ||
    normalizeOptionalString(product?.rawData?.product?.product_name_es) ||
    normalizeOptionalString(product?.rawData?.product?.product_name) ||
    `Producto ${fallbackBarcode}`
  );
}

export function getProductBrand(product) {
  return (
    normalizeOptionalString(product?.brand) ||
    normalizeOptionalString(product?.brands) ||
    normalizeOptionalString(product?.rawData?.product?.brands)
  );
}

export function getProductImageUrl(product) {
  return (
    normalizeOptionalString(product?.imageUrl) ||
    normalizeOptionalString(product?.image_url) ||
    normalizeOptionalString(product?.image) ||
    normalizeOptionalString(product?.rawData?.product?.image_front_url) ||
    normalizeOptionalString(product?.rawData?.product?.image_url)
  );
}

export function getProductCategory(product) {
  return (
    normalizeOptionalString(product?.category) ||
    normalizeOptionalString(product?.categories) ||
    normalizeOptionalString(product?.rawData?.product?.categories)
  );
}

export function getProductUrl(product, barcode = "") {
  return (
    normalizeOptionalString(product?.productUrl) ||
    normalizeOptionalString(product?.url) ||
    normalizeOptionalString(product?.link) ||
    normalizeOptionalString(product?.rawData?.product?.url) ||
    (barcode
      ? `${OPEN_FOOD_FACTS_PRODUCT_BASE_URL}/${encodeURIComponent(barcode)}`
      : "")
  );
}

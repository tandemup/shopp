import { normalizeBarcode } from "@/src/utils/barcodeNormalization";

export const SCANNED_PRODUCT_TYPES = [
  "Alimentos",
  "Supermercado",
  "Libros",
  "Música",
];

function text(value) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim();
}

function firstText(...values) {
  for (const value of values) {
    const normalized = text(value);

    if (normalized) {
      return normalized;
    }
  }

  return "";
}

function removeAccents(value) {
  return text(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function normalizeProductType(value) {
  const normalized = removeAccents(value);

  if (!normalized) {
    return "";
  }

  if (normalized.includes("libro") || normalized.includes("book")) {
    return "Libros";
  }

  if (normalized.includes("music") || normalized.includes("musica")) {
    return "Música";
  }

  if (normalized.includes("aliment") || normalized.includes("food")) {
    return "Alimentos";
  }

  if (normalized.includes("supermerc")) {
    return "Supermercado";
  }

  return text(value);
}

export function getScannedProductType(product) {
  const explicit = firstText(
    product?.productType,
    product?.product_type,
  );

  if (explicit) {
    return normalizeProductType(explicit);
  }

  if (product?.isBook === true) {
    return "Libros";
  }

  // Registros antiguos guardaban a veces el tipo dentro de category. Solo
  // promovemos valores que realmente pertenecen a la taxonomía principal;
  // una categoría externa como "en:beverages" sigue siendo category.
  const legacyCategory = normalizeProductType(
    firstText(product?.category, product?.categoryId),
  );

  return SCANNED_PRODUCT_TYPES.includes(legacyCategory) ? legacyCategory : "";
}

export function getScannedProductCategory(product) {
  return firstText(
    product?.category,
    product?.categoryName,
    product?.categories,
    product?.main_category,
  );
}

export function getScannedProductSubcategory(product) {
  return firstText(
    product?.subcategory,
    product?.subcategoryName,
    product?.subcategory_name,
  );
}

export function getScannedProductImageUrl(product) {
  return firstText(
    product?.imageUrl,
    product?.image_url,
    product?.image,
    product?.thumbnailUrl,
    product?.thumbnail_uri,
    product?.thumbnailUri,
  );
}

/**
 * Converts legacy/external product shapes to the canonical scanned-product
 * shape. Unknown fields are retained so navigation parameters and metadata
 * from older records continue to work.
 */
export function normalizeScannedProduct(product = {}, barcode = "") {
  const source = product && typeof product === "object" ? product : {};
  const canonicalBarcode = normalizeBarcode(barcode || source.barcode);

  return {
    ...source,
    id: source.id || source._id || canonicalBarcode,
    barcode: canonicalBarcode,
    name: firstText(source.name, source.productName, source.product_name),
    brand: firstText(source.brand, source.brands),
    productType: getScannedProductType(source),
    category: getScannedProductCategory(source),
    subcategory: getScannedProductSubcategory(source),
    imageUrl: getScannedProductImageUrl(source),
    url: firstText(source.url, source.productUrl, source.product_url),
    productUrl: firstText(source.productUrl, source.url, source.product_url),
    scanCount: Number(source.scanCount ?? 1),
  };
}

/**
 * Payload used by local storage and Convex. Empty canonical values are kept
 * locally but omitted by the Convex adapter when appropriate.
 */
export function toScannedProductPatch(product = {}, barcode = "") {
  const normalized = normalizeScannedProduct(product, barcode);

  return {
    barcode: normalized.barcode,
    name: normalized.name,
    brand: normalized.brand,
    productType: normalized.productType,
    category: normalized.category,
    subcategory: normalized.subcategory,
    imageUrl: normalized.imageUrl,
    url: normalized.url,
    productUrl: normalized.productUrl,
    thumbnailUri: product?.thumbnailUri ?? null,
    notes: text(product?.notes),
    source: text(product?.source) || "scanner",
    lookupSource: product?.lookupSource ?? null,
    dataSource: text(product?.dataSource),
    scannedAt: text(product?.scannedAt),
    updatedAt: text(product?.updatedAt),
  };
}

export function hasUsefulScannedProductData(product) {
  const normalized = normalizeScannedProduct(product);

  return Boolean(
    normalized.name ||
      normalized.brand ||
      normalized.productType ||
      normalized.category ||
      normalized.subcategory ||
      normalized.imageUrl ||
      normalized.productUrl,
  );
}

export function getScannedProductGroup(product) {
  const value = removeAccents(
    firstText(
      product?.productType,
      product?.product_type,
      product?.category,
      product?.categoryId,
    ),
  );

  if (product?.isBook === true || value.includes("libro") || value.includes("book")) {
    return "books";
  }

  if (value.includes("music") || value.includes("musica")) {
    return "music";
  }

  if (value.includes("aliment") || value.includes("food")) {
    return "food";
  }

  return "supermarket";
}

const MIGRATION_BATCH_SIZE = 100;

function optionalText(value) {
  const text = String(value ?? "").trim();
  return text || undefined;
}

function optionalNullableText(value) {
  if (value === null) return null;
  return optionalText(value);
}

function getUpdatedAtMs(item) {
  const explicit = Number(item?.updatedAtMs);
  if (Number.isFinite(explicit) && explicit >= 0) return explicit;

  const parsed = Date.parse(item?.updatedAt || item?.scannedAt || "");
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function toConvexScanItem(item) {
  if (!item || typeof item !== "object") return null;

  const barcode = String(item.barcode || "").replace(/\D/g, "").trim();
  if (!barcode) return null;

  const scanCount = Number(item.scanCount);
  const updatedAtMs = getUpdatedAtMs(item);

  return {
    barcode,
    name: optionalText(item.name),
    brand: optionalText(item.brand),
    url: optionalText(item.url),
    productUrl: optionalText(item.productUrl),
    imageUrl: optionalText(item.imageUrl || item.image_url),
    thumbnailUri: optionalNullableText(item.thumbnailUri),
    category: optionalText(item.category),
    categoryId: optionalNullableText(item.categoryId),
    subcategoryName: optionalNullableText(item.subcategoryName),
    productType: optionalText(item.productType || item.product_type),
    isBook: typeof item.isBook === "boolean" ? item.isBook : undefined,
    notes: optionalText(item.notes),
    source: optionalText(item.source),
    lookupSource: optionalNullableText(item.lookupSource),
    dataSource: optionalText(item.dataSource),
    scannedAt: optionalText(item.scannedAt),
    updatedAt: optionalText(item.updatedAt),
    updatedAtMs,
    scanCount: Number.isFinite(scanCount) ? Math.max(1, scanCount) : 1,
  };
}

export async function migrateLocalScanHistoryToConvex({
  items,
  importBatch,
}) {
  if (typeof importBatch !== "function") {
    throw new Error("No se ha configurado la mutación de sincronización.");
  }

  const sourceItems = Array.isArray(items) ? items : [];
  const safeItems = sourceItems.map(toConvexScanItem).filter(Boolean);

  const total = {
    imported: 0,
    updated: 0,
    skipped: 0,
    invalid: Math.max(0, sourceItems.length - safeItems.length),
  };

  for (let index = 0; index < safeItems.length; index += MIGRATION_BATCH_SIZE) {
    const batch = safeItems.slice(index, index + MIGRATION_BATCH_SIZE);
    const result = await importBatch({ items: batch });

    total.imported += Number(result?.imported || 0);
    total.updated += Number(result?.updated || 0);
    total.skipped += Number(result?.skipped || 0);
    total.invalid += Number(result?.invalid || 0);
  }

  return {
    ...total,
    total: safeItems.length,
  };
}


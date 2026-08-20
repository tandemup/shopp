import {
  normalizeScannedProduct,
  toScannedProductPatch,
} from "@/src/utils/scannedProductModel";

function normalizeBarcode(value) {
  return String(value || "").replace(/\D/g, "");
}

function timeOf(item) {
  const value = item?.updatedAt || item?.scannedAt;
  const time = value ? Date.parse(value) : 0;

  return Number.isFinite(time) ? time : 0;
}

function keyOf(item) {
  return normalizeBarcode(item?.barcode);
}

/**
 * Combines local and remote history without changing the canonical product
 * fields. When both devices have the same barcode, the newest record wins.
 */
export function mergeScannedHistory(localItems = [], remoteItems = []) {
  const merged = new Map();

  for (const sourceItem of [...localItems, ...remoteItems]) {
    const item = normalizeScannedProduct(sourceItem);
    const barcode = keyOf(item);

    if (!barcode) continue;

    const previous = merged.get(barcode);

    if (!previous || timeOf(item) >= timeOf(previous)) {
      merged.set(barcode, { ...item, barcode });
    }
  }

  return [...merged.values()].sort((a, b) => timeOf(b) - timeOf(a));
}

/**
 * Synchronizes an already loaded local history with Convex. Local changes
 * newer than the remote copy are uploaded; remote-only or newer remote
 * records are written back to local storage.
 */
export async function synchronizeScannedHistory({
  localItems = [],
  remoteItems = [],
  uploadEntry,
  saveLocalHistory,
  onUploadError,
}) {
  const localByBarcode = new Map(
    localItems.map((item) => [keyOf(item), normalizeScannedProduct(item)]),
  );
  const remoteByBarcode = new Map(
    remoteItems.map((item) => [keyOf(item), normalizeScannedProduct(item)]),
  );
  const merged = mergeScannedHistory(localItems, remoteItems);

  if (typeof uploadEntry === "function") {
    for (const [barcode, localItem] of localByBarcode) {
      if (!barcode) continue;

      const remoteItem = remoteByBarcode.get(barcode);
      const localIsNewer =
        !remoteItem || timeOf(localItem) > timeOf(remoteItem);

      if (!localIsNewer) continue;

      try {
        await uploadEntry(barcode, {
          ...toScannedProductPatch(localItem, barcode),
          scanCount: Number(localItem.scanCount ?? 1),
        });
      } catch (error) {
        onUploadError?.(error, localItem);
      }
    }
  }

  if (typeof saveLocalHistory === "function") {
    await saveLocalHistory(merged);
  }

  return merged;
}

/**
 * Used when the user enables synchronization in the profile. The operation
 * is idempotent because the Convex mutation replaces the record by barcode.
 */
export async function migrateLocalScannedHistory({
  localItems = [],
  uploadEntry,
  onUploadError,
}) {
  let uploaded = 0;
  let failed = 0;

  if (typeof uploadEntry !== "function") {
    return { uploaded, failed };
  }

  for (const sourceItem of localItems) {
    const item = normalizeScannedProduct(sourceItem);
    const barcode = keyOf(item);

    if (!barcode) continue;

    try {
      await uploadEntry(barcode, {
        ...toScannedProductPatch(item, barcode),
        scanCount: Number(item.scanCount ?? 1),
      });
      uploaded += 1;
    } catch (error) {
      failed += 1;
      onUploadError?.(error, item);
    }
  }

  return { uploaded, failed };
}

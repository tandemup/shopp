import { useCallback, useMemo, useRef } from "react";
import { useConvex, useMutation, useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import {
  clearScannedHistory as clearLocalScannedHistory,
  getScannedHistory as getLocalScannedHistory,
  removeScannedItem as removeLocalScannedItem,
  saveScannedEntry as saveLocalScannedEntry,
  saveScannedHistory as saveLocalScannedHistory,
  updateScannedEntry as updateLocalScannedEntry,
} from "@/src/services/scannerHistory";
import {
  normalizeScannedProduct,
  toScannedProductPatch,
} from "@/src/utils/scannedProductModel";
import { synchronizeScannedHistory } from "@/src/services/scannedHistorySync";

function normalizeBarcode(barcode) {
  return String(barcode || "")
    .replace(/\D/g, "")
    .trim();
}

function normalizeNullableString(value) {
  if (value === null) {
    return null;
  }

  if (value === undefined) {
    return undefined;
  }

  const cleanValue = String(value).trim();

  return cleanValue || undefined;
}

function toConvexScanPayload(barcode, patch = {}) {
  const cleanBarcode = normalizeBarcode(barcode || patch.barcode);
  const canonical = toScannedProductPatch(patch, cleanBarcode);
  const payload = {
    ...canonical,
    productType: normalizeNullableString(canonical.productType),
    category: normalizeNullableString(canonical.category),
    subcategory: normalizeNullableString(canonical.subcategory),
    imageUrl: normalizeNullableString(canonical.imageUrl),
  };

  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
  );
}

function toConvexSyncPayload(barcode, patch = {}) {
  const payload = toConvexScanPayload(barcode, patch);
  const scanCount = Number(patch.scanCount);

  if (Number.isFinite(scanCount)) {
    payload.scanCount = Math.max(1, scanCount);
  }

  return payload;
}

function normalizeConvexScan(item) {
  if (!item) {
    return null;
  }

  return normalizeScannedProduct(
    {
      ...item,
      id: item._id || item.id || item.barcode,
      scanCount: Number(item.scanCount ?? 1),
    },
    item.barcode,
  );
}

function normalizeConvexScanList(items) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map(normalizeConvexScan).filter(Boolean);
}

export function useScannedHistoryStorage() {
  const convex = useConvex();
  const profile = useQuery(api.users.getMyProfile);
  const syncInFlightRef = useRef(null);

  const saveMyScannedEntry = useMutation(
    api.userScanHistory.saveMyScannedEntry,
  );
  const removeMyScannedEntry = useMutation(
    api.userScanHistory.removeMyScannedEntry,
  );
  const clearMyScanHistory = useMutation(
    api.userScanHistory.clearMyScanHistory,
  );
  const syncMyScannedEntry = useMutation(
    api.userScanHistory.syncMyScannedEntry,
  );

  const syncEnabled = profile?.scanHistorySyncEnabled === true;
  const loading = profile === undefined;

  const resolveSyncEnabled = useCallback(async () => {
    if (profile !== undefined) {
      return profile?.scanHistorySyncEnabled === true;
    }

    try {
      const freshProfile = await convex.query(api.users.getMyProfile, {});

      return freshProfile?.scanHistorySyncEnabled === true;
    } catch (error) {
      console.warn("[useScannedHistoryStorage] profile lookup failed", error);

      return false;
    }
  }, [convex, profile]);

  const synchronize = useCallback(
    async (localItems = null) => {
      if (syncInFlightRef.current) {
        return await syncInFlightRef.current;
      }

      const task = (async () => {
        const localHistory =
          Array.isArray(localItems) && localItems.length >= 0
            ? localItems
            : await getLocalScannedHistory();
        const remoteScans = await convex.query(
          api.userScanHistory.listMyScanHistory,
          { limit: 300 },
        );

        return await synchronizeScannedHistory({
          localItems: localHistory,
          remoteItems: normalizeConvexScanList(remoteScans),
          uploadEntry: async (barcode, patch) => {
            await syncMyScannedEntry({ ...patch, barcode });
          },
          saveLocalHistory: async (items) => {
            await saveLocalScannedHistory(items);
          },
          onUploadError: (error, item) => {
            console.warn(
              "[useScannedHistoryStorage] remote sync failed",
              item?.barcode,
              error,
            );
          },
        });
      })();

      syncInFlightRef.current = task;

      try {
        return await task;
      } finally {
        if (syncInFlightRef.current === task) {
          syncInFlightRef.current = null;
        }
      }
    },
    [convex, syncMyScannedEntry],
  );

  const getScannedHistory = useCallback(async () => {
    const localHistory = await getLocalScannedHistory();
    const shouldSync = await resolveSyncEnabled();

    if (!shouldSync) {
      return localHistory;
    }

    try {
      return await synchronize(localHistory);
    } catch (error) {
      console.warn(
        "[useScannedHistoryStorage] keeping local history after sync failure",
        error,
      );
      return localHistory;
    }
  }, [resolveSyncEnabled, synchronize]);

  const getScannedEntryByBarcode = useCallback(
    async (barcode) => {
      const cleanBarcode = normalizeBarcode(barcode);

      if (!cleanBarcode) {
        return null;
      }

      const history = await getScannedHistory();

      return (
        history.find(
          (item) => normalizeBarcode(item?.barcode) === cleanBarcode,
        ) || null
      );
    },
    [getScannedHistory],
  );

  const saveScannedEntry = useCallback(
    async (barcode, patch = {}) => {
      const cleanBarcode = normalizeBarcode(barcode);

      if (!cleanBarcode) {
        return null;
      }

      const localScan = await saveLocalScannedEntry(cleanBarcode, patch);
      const shouldSync = await resolveSyncEnabled();

      if (shouldSync) {
        try {
          await saveMyScannedEntry(
            toConvexScanPayload(cleanBarcode, localScan || patch),
          );
        } catch (error) {
          console.warn("[useScannedHistoryStorage] save sync failed", error);
        }
      }

      return localScan;
    },
    [resolveSyncEnabled, saveMyScannedEntry],
  );

  const updateScannedEntry = useCallback(
    async (barcode, patch = {}) => {
      const cleanBarcode = normalizeBarcode(barcode);

      if (!cleanBarcode) {
        return null;
      }

      const localScan = await updateLocalScannedEntry(cleanBarcode, patch);
      const shouldSync = await resolveSyncEnabled();

      if (shouldSync) {
        try {
          await syncMyScannedEntry(
            toConvexSyncPayload(cleanBarcode, localScan || patch),
          );
        } catch (error) {
          console.warn("[useScannedHistoryStorage] update sync failed", error);
        }
      }

      return localScan;
    },
    [resolveSyncEnabled, syncMyScannedEntry],
  );

  const removeScannedItem = useCallback(
    async (barcode) => {
      const cleanBarcode = normalizeBarcode(barcode);

      const shouldSync = await resolveSyncEnabled();

      const nextLocal = await removeLocalScannedItem(cleanBarcode);

      if (shouldSync) {
        try {
          await removeMyScannedEntry({ barcode: cleanBarcode });
        } catch (error) {
          console.warn("[useScannedHistoryStorage] delete sync failed", error);
        }
      }

      return nextLocal;
    },
    [getScannedHistory, removeMyScannedEntry, resolveSyncEnabled],
  );

  const clearScannedHistory = useCallback(async () => {
    const shouldSync = await resolveSyncEnabled();

    const localResult = await clearLocalScannedHistory();

    if (shouldSync) {
      try {
        await clearMyScanHistory({});
      } catch (error) {
        console.warn("[useScannedHistoryStorage] clear sync failed", error);
      }
    }

    return localResult;
  }, [clearMyScanHistory, resolveSyncEnabled]);

  const replaceScannedHistory = useCallback(
    async (items = []) => {
      if (!Array.isArray(items)) {
        throw new Error("El historial importado no es una lista válida.");
      }

      const savedItems = await saveLocalScannedHistory(items);
      const shouldSync = await resolveSyncEnabled();

      if (shouldSync) {
        await clearMyScanHistory({});

        for (const item of savedItems) {
          await syncMyScannedEntry(
            toConvexSyncPayload(item.barcode, item),
          );
        }
      }

      return savedItems;
    },
    [clearMyScanHistory, resolveSyncEnabled, syncMyScannedEntry],
  );

  return useMemo(
    () => ({
      syncEnabled,
      loading,
      getScannedHistory,
      getScannedEntryByBarcode,
      saveScannedEntry,
      updateScannedEntry,
      removeScannedItem,
      clearScannedHistory,
      replaceScannedHistory,
    }),
    [
      syncEnabled,
      loading,
      getScannedHistory,
      getScannedEntryByBarcode,
      saveScannedEntry,
      updateScannedEntry,
      removeScannedItem,
      clearScannedHistory,
      replaceScannedHistory,
    ],
  );
}
